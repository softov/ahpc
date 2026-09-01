import { randomUUID } from 'node:crypto';
import type { HostConnection, HostEvent } from './connection.js';
import type {
  Agent, Answer, Automation, AutomationRun, Changeset, ChangesetOperation, ChangesetOperationTarget, Completion, ConfigProperty, ContentRef, Customization, CustomizationKind,
  TerminalRow, TerminalState,
  FileContent, FileEdit, McpState, PendingInput, QueuedMessage, Question, QuestionKind,
  ResponsePart, SessionConfig, SessionDetail, SessionSummary, SessionUri, ToolCall,
  ToolCallStatus, Turn,
} from './types.js';

/**
 * The other implementation of the seam: a real agent host, over a WebSocket.
 *
 * `fakeHost` is a script and this is a socket, and nothing above either of them
 * can tell which is which - that is what `HostConnection` is for. Point it at a
 * host with `--host ws://…` and the same screens drive somebody's editor.
 *
 * **Reducers are the host's, not ours.** The protocol ships a client library
 * with the transport, the subscription fan-out and a generated reducer per
 * channel, and reimplementing eighty typed mutations here would be inventing a
 * second answer to "what is the state now". So the package is loaded at
 * runtime and everything below is translation: its state shapes into the
 * flattened ones in `types.ts`, and back out as the actions a client is
 * allowed to dispatch.
 *
 * It is an **optional** dependency, because the example has to run, and be
 * checked, with nothing installed:
 *
 * ```
 * npm install @microsoft/agent-host-protocol
 * ```
 *
 * Written against protocol 0.9.0, from the package's own `src/types/`. What it
 * speaks is the subset this client needs: `initialize`, `listSessions`,
 * `subscribe`, `createSession`, `disposeSession`, `resolveSessionConfig`, and
 * the seven client-dispatchable actions that drive and answer a turn.
 */

export interface LiveHostOptions {
  /** `ws://host:port/…`, as the host advertises it. */
  url: string;
  /** A bearer token, if the host is behind one. Appended as `?tkn=`. */
  token?: string;
  clientId?: string;
  /** Told when the socket drops, so the badge can stop claiming otherwise. */
  onState?(state: 'connecting' | 'connected' | 'offline'): void;
  /**
   * Told when the host refuses one channel, in the host's own words.
   *
   * Separate from `onState` because they mean opposite things: a refusal is
   * the host answering, and reporting it as a lost connection sends somebody
   * to debug their network over a session whose agent has simply gone.
   */
  onRefusal?(uri: string, message: string): void;
}

/**
 * Versions to offer at `initialize`, most preferred first.
 *
 * A host picks the first entry it also speaks, so this is a preference rather
 * than a floor. Offering one the installed library has no types for is safe:
 * every command used here is stable across all of them.
 *
 * `1.0.0` is not published - VS Code's host vendors the protocol from its
 * repository and runs ahead of npm - and it accepts `^1.0.0` and nothing 0.x.
 * Leaving it out is therefore not the conservative choice: it is every entry
 * refused with `-32005`, which arrives here looking like a host that is not
 * there. `0.9.0` is the newest published, and the version the package below
 * is built from.
 *
 * This list is load-bearing, because there is no fallback behind it.
 */
const VERSIONS = ['1.0.0', '0.9.0', '0.8.0', '0.7.0'];

const ROOT = 'ahp-root://';
const AUTOMATIONS = 'ahp-automations://';

// --------------------------------------------------------------- the package

/**
 * What this file uses of `@microsoft/agent-host-protocol`.
 *
 * Declared rather than imported, so the example typechecks and its tests run
 * with the package absent. The specifier is a variable for the same reason:
 * a literal one is resolved at build time, and there would be nothing to
 * resolve it to.
 */
interface Subscription extends AsyncIterable<{ type: string; params?: unknown }> {
  close(): Promise<void>;
}

interface Client {
  connect(): void;
  shutdown(): Promise<void>;
  initialize(args: { clientId: string; protocolVersions: readonly string[] }): Promise<unknown>;
  request(method: string, params: unknown): Promise<Record<string, unknown>>;
  subscribe(uri: string): Promise<{
    result: { snapshot?: { state?: unknown } };
    subscription: Subscription;
  }>;
  dispatch(channel: string, action: unknown): unknown;
}

interface Mirror {
  readonly root: { agents?: unknown[]; terminals?: unknown[] };
  applySnapshot(snapshot: unknown): void;
  apply(envelope: unknown): void;
}

interface Loaded {
  Client: new (transport: unknown, config?: unknown) => Client;
  Mirror: new () => Mirror;
  connect(url: string): Promise<unknown>;
  automationReducer(state: unknown, action: unknown): unknown;
  chatReducer(state: unknown, action: unknown): unknown;
  sessionReducer(state: unknown, action: unknown): unknown;
  terminalReducer(state: unknown, action: unknown): unknown;
}

export class MissingProtocolPackage extends Error {
  constructor() {
    super('A live host needs @microsoft/agent-host-protocol. Install it:\n'
      + '  npm install @microsoft/agent-host-protocol\n'
      + 'Or leave --host off and drive the scripted one.');
    this.name = 'MissingProtocolPackage';
  }
}

async function load(): Promise<Loaded> {
  const base: string = '@microsoft/agent-host-protocol';
  try {
    const core = await import(base) as Record<string, never>;
    const client = await import(`${base}/client`) as Record<string, never>;
    const ws = await import(`${base}/ws`) as Record<string, never>;
    const transport = ws.WebSocketTransport as unknown as { connect(url: string): Promise<unknown> };
    return {
      Client: client.AhpClient as unknown as Loaded['Client'],
      Mirror: client.AhpStateMirror as unknown as Loaded['Mirror'],
      connect: (url) => transport.connect(url),
      automationReducer: core.automationReducer as unknown as Loaded['automationReducer'],
      chatReducer: core.chatReducer as unknown as Loaded['chatReducer'],
      sessionReducer: core.sessionReducer as unknown as Loaded['sessionReducer'],
      terminalReducer: core.terminalReducer as unknown as Loaded['terminalReducer'],
    };
  } catch (error) {
    // Node says `ERR_MODULE_NOT_FOUND` for a missing package and a missing
    // file alike, and the message differs between the two ("Cannot find
    // package", "Cannot find module"), so the code is what is tested.
    const code = (error as { code?: string } | null)?.code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      throw new MissingProtocolPackage();
    }
    throw error;
  }
}

// ------------------------------------------------------------- reading state

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag => (typeof value === 'object' && value !== null ? value as Bag : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** `StringOrMarkdown` is a string or `{ markdown }`, and a reader wants neither. */
function plain(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value;
  const found = str(bag(value).markdown) ?? str(bag(value).value);
  return found === '' ? undefined : found;
}

/**
 * One tool call, flattened out of an eight-state union.
 *
 * Which fields exist depends on the state - `toolInput` arrives when the
 * parameters are complete, `pastTenseMessage` and `content` only after it ran -
 * so everything is read defensively and what is not there yet is left out.
 */
function toolCall(value: unknown): ToolCall {
  const call = bag(value);
  const input = call.toolInput;
  const content = list(call.content);

  const text = content
    .map((entry) => plain(bag(entry).text) ?? plain(bag(entry).preview))
    .filter((entry): entry is string => entry !== undefined)
    .join('\n');
  const files = content
    .map((entry) => str(bag(bag(entry).file).uri) ?? str(bag(entry).uri))
    .filter((entry): entry is string => entry !== undefined);

  return {
    id: str(call.toolCallId) ?? randomUUID(),
    name: str(call.displayName) ?? str(call.toolName) ?? 'tool',
    toolName: str(call.toolName) ?? 'tool',
    status: (str(call.status) ?? 'running') as ToolCallStatus,
    // A `ContentRef` is a promise of content rather than content: reporting
    // nothing is better than reporting the reference as if it were the command.
    ...(typeof input === 'string' ? { input } : {}),
    ...(plain(call.intention) ?? plain(call.invocationMessage)
      ? { intention: (plain(call.intention) ?? plain(call.invocationMessage)) as string }
      : {}),
    ...(plain(call.pastTenseMessage) ? { outcome: plain(call.pastTenseMessage) as string } : {}),
    ...(text ? { output: text } : {}),
    ...(files.length > 0 ? { files } : {}),
    ...(plain(call.confirmationTitle) ? { confirmationTitle: plain(call.confirmationTitle) as string } : {}),
    ...(list(call.options).length > 0
      ? {
        options: list(call.options).map((option) => ({
          id: str(bag(option).id) ?? '',
          label: str(bag(option).label) ?? str(bag(option).id) ?? '',
        })),
      }
      : {}),
  };
}

/** `responseParts` is one ordered stream, and the order is the reasoning. */
function parts(value: unknown): ResponsePart[] {
  const out: ResponsePart[] = [];
  for (const entry of list(value)) {
    const part = bag(entry);
    const id = str(part.id) ?? randomUUID();
    switch (str(part.kind)) {
      // The prose is in `content`. Not `markdown`, not `text` - reading the
      // wrong name costs every word the agent said.
      case 'markdown':
        out.push({ kind: 'markdown', id, content: str(part.content) ?? '' });
        break;
      case 'reasoning':
        out.push({ kind: 'reasoning', id, content: str(part.content) ?? '' });
        break;
      case 'systemNotification':
        out.push({ kind: 'systemNotification', id, content: plain(part.content) ?? '' });
        break;
      case 'toolCall': {
        const call = toolCall(part.toolCall);
        out.push({ kind: 'toolCall', id: call.id, call });
        break;
      }
      // A turn that failed mid-stream, new in 0.9.0. It is a part rather than
      // a turn state because what came before it still stands: the agent said
      // three things and then hit this, and dropping it leaves a turn that
      // simply stops.
      case 'error': {
        const error = bag(part.error);
        out.push({
          kind: 'error',
          id,
          message: str(error.message) ?? str(error.errorType) ?? 'The agent failed.',
          resumable: part.resumable === true,
        });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function turn(value: unknown, running: boolean): Turn {
  const found = bag(value);
  const message = bag(found.message);
  const state = str(found.state);
  return {
    id: str(found.id) ?? randomUUID(),
    role: 'agent',
    ...(str(message.text) ? { message: str(message.text) as string } : {}),
    parts: parts(found.responseParts),
    state: running ? 'running'
      : state === 'cancelled' ? 'cancelled'
        : state === 'error' ? 'failed' : 'complete',
    ...(str(bag(message.model).id) ? { model: str(bag(message.model).id) as string } : {}),
    at: str(found.startedAt) ?? new Date(0).toISOString(),
    ...(typeof found.duration === 'number' ? { elapsedMs: found.duration } : {}),
  };
}

/**
 * The conversation, as the transcript reads it.
 *
 * A turn on the wire carries both what the person said and what the agent
 * answered; a transcript wants them as two blocks, so the message becomes a
 * user turn ahead of the agent's. And the running turn is `activeTurn`, not in
 * `turns` - a client that reads only the history shows an empty conversation
 * for exactly as long as somebody is watching one happen.
 */
function transcript(chat: Bag): Turn[] {
  const out: Turn[] = [];
  const add = (value: unknown, running: boolean): void => {
    const found = bag(value);
    const said = str(bag(found.message).text);
    if (said) {
      out.push({
        id: `${str(found.id) ?? ''}:said`,
        role: 'user',
        message: said,
        parts: [],
        state: 'complete',
        at: str(found.startedAt) ?? new Date(0).toISOString(),
      });
    }
    const agent = turn(found, running);
    delete agent.message;
    out.push(agent);
  };
  for (const entry of list(chat.turns)) add(entry, false);
  if (chat.activeTurn) add(chat.activeTurn, true);
  return out;
}

const KINDS: Record<string, QuestionKind> = {
  text: 'text', number: 'number', integer: 'integer', boolean: 'boolean',
  'single-select': 'single-select', 'multi-select': 'multi-select',
};

function question(value: unknown): Question {
  const found = bag(value);
  return {
    id: str(found.id) ?? randomUUID(),
    kind: KINDS[str(found.kind) ?? 'text'] ?? 'text',
    message: str(found.message) ?? str(found.title) ?? '',
    ...(found.required === true ? { required: true } : {}),
    ...(list(found.options).length > 0
      ? {
        options: list(found.options).map((option) => ({
          id: str(bag(option).id) ?? '',
          label: str(bag(option).label) ?? str(bag(option).id) ?? '',
        })),
      }
      : {}),
    ...(found.allowFreeformInput === true ? { allowFreeformInput: true } : {}),
  };
}

/**
 * What the agent is waiting for, if anything.
 *
 * `SessionState.inputNeeded` is the session-level summary and **not every host
 * fills it in**: VS Code 1.132 shows its own dialog while the session reports
 * status 40 and no `inputNeeded` key at all. The tool call is unambiguous
 * though - `pending-confirmation` carries the title, the input and the options -
 * so the chat is scanned when the field is empty.
 */
function pendingInput(session: Bag, chat: Bag): PendingInput | null {
  for (const entry of list(session.inputNeeded)) {
    const found = bag(entry);
    const id = str(found.id) ?? randomUUID();
    if (str(found.kind) === 'toolConfirmation') {
      return { kind: 'toolConfirmation', id, call: toolCall(found.toolCall) };
    }
    if (str(found.kind) === 'chatInput') {
      const request = bag(found.request);
      return {
        kind: 'chatInput',
        // The request's own id answers it, not the entry's.
        id: str(request.id) ?? id,
        message: str(request.message) ?? '',
        questions: list(request.questions).map(question),
      };
    }
  }

  const active = bag(chat.activeTurn);
  for (const part of list(active.responseParts)) {
    const found = bag(part);
    if (str(found.kind) !== 'toolCall') continue;
    const call = bag(found.toolCall);
    if (str(call.status) !== 'pending-confirmation') continue;
    const flat = toolCall(call);
    return { kind: 'toolConfirmation', id: flat.id, call: flat };
  }
  return null;
}

function summary(value: unknown): SessionSummary {
  const found = bag(value);
  const changes = bag(found.changes);
  return {
    resource: str(found.resource) ?? '',
    provider: str(found.provider) ?? 'unknown',
    title: str(found.title) ?? 'Untitled session',
    status: typeof found.status === 'number' ? found.status : 1,
    createdAt: str(found.createdAt) ?? '',
    modifiedAt: str(found.modifiedAt) ?? str(found.createdAt) ?? '',
    workingDirectories: list(found.workingDirectories).filter((dir): dir is string => typeof dir === 'string'),
    ...(str(found.activity) ? { activity: str(found.activity) as string } : {}),
    // What started it, when it was not a person. Only `automation` exists in
    // 0.9.0, and an origin of some later kind is left off rather than drawn
    // as one - a catalogue that called an unknown origin an automation would
    // be making something up.
    ...(str(bag(found.origin).automation)
      ? {
        origin: {
          kind: 'automation' as const,
          automation: str(bag(found.origin).automation) as string,
          run: str(bag(found.origin).run) ?? '',
        },
      }
      : {}),
    // Both only when the host said them: a project with an empty name would
    // draw a blank where the directory used to be, which is worse than the
    // fallback it replaced.
    ...(str(bag(found.project).displayName)
      ? {
        project: {
          uri: str(bag(found.project).uri) ?? '',
          displayName: str(bag(found.project).displayName) as string,
        },
      }
      : {}),
    ...(found._meta && typeof found._meta === 'object'
      ? { _meta: found._meta as Record<string, unknown> }
      : {}),
    ...(found.changes
      ? {
        changes: {
          ...(typeof changes.files === 'number' ? { files: changes.files } : {}),
          ...(typeof changes.additions === 'number' ? { additions: changes.additions } : {}),
          ...(typeof changes.deletions === 'number' ? { deletions: changes.deletions } : {}),
        },
      }
      : {}),
  };
}

/** One run, flattened out of its lifecycle and its origin. */
function automationRun(value: unknown): AutomationRun {
  const found = bag(value);
  return {
    resource: str(found.resource) ?? '',
    status: str(bag(found.lifecycle).status) ?? 'pending',
    ...(str(found.primarySession) ? { session: str(found.primarySession) as string } : {}),
    triggered: str(bag(found.origin).kind) === 'trigger',
  };
}

/**
 * One automation, flattened.
 *
 * The schedule is read out of the *definition*, which is the client's own
 * writing given back - so this reads the first schedule trigger and shows what
 * it says. `nextRunAt` is the host's, and the two disagreeing is the useful
 * case rather than a contradiction: an expression that is written down and is
 * never going to fire is exactly what a reader needs to see.
 */
function automation(value: unknown): Automation {
  const found = bag(value);
  const definition = bag(found.definition);
  const schedule = list(definition.triggers)
    .map(bag)
    .find((trigger) => trigger.kind === 'schedule');
  const timing = bag(schedule?.schedule);
  return {
    resource: str(found.resource) ?? '',
    title: str(definition.title) ?? 'Untitled automation',
    // Absent means on. It is the definition's own default, and a client that
    // read a missing key as off would switch off everything it was shown.
    enabled: definition.enabled !== false,
    ...(str(timing.expression)
      ? {
        schedule: {
          expression: str(timing.expression) as string,
          timeZone: str(timing.timeZone) ?? 'UTC',
        },
      }
      : {}),
    ...(str(found.nextRunAt) ? { nextRunAt: str(found.nextRunAt) as string } : {}),
    runs: list(found.runs).map(automationRun),
    operations: list(found.operations).filter((one): one is string => typeof one === 'string'),
  };
}

/**
 * The config schema, flattened to what a form needs.
 *
 * `enumLabels` and `enumDescriptions` are arrays parallel to `enum`, so they
 * are read by index rather than looked up by name. `sessionMutable` decides
 * whether a control is offered at all: absent means not changeable while the
 * session runs, and the cautious reading is the correct one.
 */
function config(value: unknown): SessionConfig {
  const found = bag(value);
  const schema = bag(found.schema);
  const properties = bag(schema.properties);
  const values = bag(found.values);

  return {
    properties: Object.entries(properties).map(([key, raw]): ConfigProperty => {
      const property = bag(raw);
      const labels = list(property.enumLabels);
      const descriptions = list(property.enumDescriptions);
      return {
        key,
        title: str(property.title) ?? key,
        ...(str(property.description) ? { description: str(property.description) as string } : {}),
        values: list(property.enum).map((entry, index) => ({
          value: String(entry),
          label: str(labels[index]) ?? String(entry),
          ...(str(descriptions[index]) ? { description: str(descriptions[index]) as string } : {}),
        })),
        sessionMutable: property.sessionMutable === true,
      };
    }),
    values: Object.fromEntries(Object.entries(values).map(([key, entry]) => [key, String(entry)])),
  };
}

/** What an invocation said for itself. Failure is the rejection, not a field. */
function decodeInvoked(value: unknown): { message?: string } {
  const found = bag(value);
  // `message` may be a string or a `{ markdown }`, because the protocol's
  // `StringOrMarkdown` is either.
  const said = str(found.message) ?? str(bag(found.message).markdown);
  return said !== undefined ? { message: said } : {};
}

function changeset(value: unknown): Changeset {
  const found = bag(value);
  return {
    status: str(found.status) === 'computing' ? 'computing' : 'complete',
    files: list(found.files).map((entry): FileEdit => {
      const edit = bag(bag(entry).edit);
      const before = str(bag(edit.before).uri);
      const after = str(bag(edit.after).uri);
      const diff = bag(edit.diff);
      // The pointers, not the bytes. Kept so a row that is opened has
      // somewhere to fetch from, and nothing is fetched until one is.
      const refs = {
        ...(contentRef(bag(edit.before).content) ? { before: contentRef(bag(edit.before).content) as ContentRef } : {}),
        ...(contentRef(bag(edit.after).content) ? { after: contentRef(bag(edit.after).content) as ContentRef } : {}),
      };
      return {
        uri: after ?? before ?? '',
        ...(bag(entry).reviewed === true ? { reviewed: true } : {}),
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
        diff: {
          added: typeof diff.added === 'number' ? diff.added : 0,
          removed: typeof diff.removed === 'number' ? diff.removed : 0,
        },
        ...(Object.keys(refs).length > 0 ? { content: refs } : {}),
      };
    }),
    ...(list(found.operations).length > 0 ? { operations: operations(found.operations) } : {}),
  };
}

/**
 * The verbs, as the host advertises them.
 *
 * `status` defaults to `idle` rather than being dropped when a host leaves it
 * out: the protocol says an absent status means ready, and a control drawn
 * with no state at all is one nobody can tell from a disabled one.
 */
function operations(value: unknown): ChangesetOperation[] {
  return list(value).map((entry): ChangesetOperation => {
    const one = bag(entry);
    const status = str(one.status);
    return {
      id: str(one.id) ?? '',
      label: str(one.label) ?? str(one.id) ?? '',
      ...(str(one.description) ? { description: str(one.description) as string } : {}),
      scopes: list(one.scopes)
        .filter((scope): scope is string => typeof scope === 'string')
        .filter((scope): scope is 'changeset' | 'resource' | 'range' =>
          scope === 'changeset' || scope === 'resource' || scope === 'range'),
      // Carried whatever it is: the protocol says a client MUST show it before
      // invoking, so dropping it would be deleting somebody's work unasked.
      ...(str(one.confirmation) ? { confirmation: str(one.confirmation) as string } : {}),
      ...(str(one.icon) ? { icon: str(one.icon) as string } : {}),
      ...(str(one.group) ? { group: str(one.group) as string } : {}),
      status: status === 'running' || status === 'error' || status === 'disabled' ? status : 'idle',
      ...(str(bag(one.error).message) ? { error: { message: str(bag(one.error).message) as string } } : {}),
    };
  });
}

function contentRef(value: unknown): ContentRef | undefined {
  const found = bag(value);
  const uri = str(found.uri);
  if (!uri) return undefined;
  return {
    uri,
    ...(typeof found.sizeHint === 'number' ? { sizeHint: found.sizeHint } : {}),
    ...(str(found.contentType) ? { contentType: str(found.contentType) as string } : {}),
  };
}

/**
 * The customization tree, flattened.
 *
 * Containers come first and then what each one brought, so the list reads in
 * the order somebody would draw it: the plugin, then its skills. An MCP server
 * is the one kind that turns up at both levels - contributed by a plugin, or
 * by the host directly - and it is the same shape either way, so it is decoded
 * once and placed twice.
 *
 * `enablement[0]` is the decisive decision. The protocol requires producers to
 * sort by descending specificity, so the session's answer is first when there
 * is one and the global one is all there is otherwise. Reading past the head
 * of that array would be preferring a broader scope to a narrower one.
 */
function customizations(value: unknown): Customization[] {
  const out: Customization[] = [];

  const decide = (entry: Bag, within: boolean): boolean => {
    const explicit = list(entry.enablement).map(bag)[0];
    const own = explicit !== undefined
      ? explicit.enabled !== false
      : typeof entry.enabled === 'boolean' ? entry.enabled : true;
    // Both, never one: a child's own flag says nothing about whether the
    // plugin that brought it is switched on.
    return within && own;
  };

  const one = (entry: Bag, from: string | undefined, within: boolean): Customization | null => {
    const kind = str(entry.type) as CustomizationKind | undefined;
    const id = str(entry.id);
    if (!kind || !id) return null;
    const state = bag(entry.state);
    return {
      id,
      kind,
      name: str(entry.name) ?? id,
      uri: str(entry.uri) ?? '',
      enabled: decide(entry, within),
      ...(from ? { from } : {}),
      ...(plain(entry.description) ? { description: plain(entry.description) as string } : {}),
      ...(kind === 'skill' || kind === 'agent'
        ? { userInvocable: entry.disableUserInvocation !== true }
        : {}),
      ...(kind === 'mcpServer' && str(state.kind)
        ? { state: str(state.kind) as McpState }
        : {}),
      // `message` on the degraded and error states, and the auth reason when a
      // server is only waiting to be signed into. Either way it is the host
      // saying why, which is the whole value of showing the row at all.
      ...(plain(state.message) ?? str(state.reason)
        ? { problem: (plain(state.message) ?? str(state.reason)) as string }
        : {}),
    };
  };

  for (const raw of list(value)) {
    const entry = bag(raw);
    const container = one(entry, undefined, true);
    if (!container) continue;
    // A container's own load failure is worth carrying: a plugin that did not
    // parse contributes nothing, and a panel that showed it as merely empty
    // would be hiding the reason.
    const load = bag(entry.load);
    if (plain(load.message)) container.problem = plain(load.message) as string;
    out.push(container);

    for (const rawChild of list(entry.children)) {
      const child = one(bag(rawChild), container.name, container.enabled);
      if (child) out.push(child);
    }
  }
  return out;
}

/**
 * The queue, as the host has it.
 *
 * `queuedMessages` is on the chat, so it arrives through the same reducer as
 * everything else and needs no bookkeeping here - which is the point of
 * queueing through the protocol rather than in the client: a message queued
 * from an editor shows up in this list too.
 */
function queued(chat: Bag): QueuedMessage[] {
  return list(chat.queuedMessages).map((entry) => {
    const found = bag(entry);
    return { id: str(found.id) ?? '', text: str(bag(found.message).text) ?? '' };
  }).filter((message) => message.id !== '');
}

/** The typed answer the protocol wants, built from the question that was asked. */
function answerValue(answer: Answer): unknown {
  return { state: 'submitted', value: { kind: answer.kind, value: answer.value } };
}

// ------------------------------------------------------------- the connection

export async function liveHost(options: LiveHostOptions): Promise<HostConnection & {
  close(): Promise<void>;
}> {
  const ahp = await load();
  const endpoint = options.token
    ? `${options.url}${options.url.includes('?') ? '&' : '?'}tkn=${encodeURIComponent(options.token)}`
    : options.url;

  let state: 'connecting' | 'connected' | 'offline' = 'connecting';
  const moveTo = (next: typeof state): void => { state = next; options.onState?.(next); };

  const transport = await ahp.connect(endpoint);
  const client = new ahp.Client(transport, {});
  const mirror = new ahp.Mirror();
  client.connect();

  const hello = bag(await client.initialize({
    clientId: options.clientId ?? `ahpc-${randomUUID().slice(0, 8)}`,
    protocolVersions: VERSIONS,
  }));
  for (const snapshot of list(hello.snapshots)) mirror.applySnapshot(snapshot);
  moveTo('connected');

  // The root channel, for the agents it advertises. Drained rather than
  // polled: re-subscribing to take a fresh look tears down the stream.
  /**
   * Watchers of the catalogue.
   *
   * The root channel is already being drained for the agents it advertises,
   * and every session that appears, finishes or starts waiting arrives on it
   * as an action. Nothing was told: the catalogue only got fresh when somebody
   * navigated away and back, which is a reader doing by hand what the host had
   * already said.
   */
  const catalogue = new Set<() => void>();

  const root = await client.subscribe(ROOT);
  if (root.result.snapshot) mirror.applySnapshot(root.result.snapshot);
  void (async () => {
    try {
      for await (const event of root.subscription) {
        if (event.type !== 'action') continue;
        mirror.apply(event.params);
        // Every action, without inspecting it. What a root action means is the
        // host's business and it grows new kinds; "something over there moved,
        // read it again" is true of all of them, and the read is one request.
        for (const listener of catalogue) listener();
      }
    } catch { moveTo('offline'); }
  })();

  /**
   * The automations channel, watched for as long as this connection lives.
   *
   * Subscribed once at connect rather than when the screen opens, for the same
   * reason the root channel is: the change worth hearing about is the one
   * nobody made, and an automation that fires at nine in the morning has to
   * reach a client that was not looking at the time.
   *
   * A host that serves none refuses this, and the refusal is *kept* rather
   * than retried - it is an answer about what this host is, and it will not
   * become a different answer on the next keystroke.
   */
  const automationWatchers = new Set<() => void>();
  let automationState: Bag | null = null;
  let noAutomations: string | undefined;
  try {
    const channel = await client.subscribe(AUTOMATIONS);
    automationState = bag(channel.result.snapshot?.state);
    void (async () => {
      try {
        for await (const event of channel.subscription) {
          if (event.type !== 'action') continue;
          // The host's own reducer. Two mutations is not eighty, but a second
          // answer to "what is the state now" is a second answer at any size.
          automationState = bag(ahp.automationReducer(automationState, bag(event.params).action));
          for (const listener of automationWatchers) listener();
        }
      } catch { /* the connection going is reported by the root channel */ }
    })();
  }
  catch (error) {
    const rpc = error as { message?: string } | null;
    noAutomations = rpc?.message ?? 'This host serves no automations.';
  }

  /** The chat a session dispatches to, remembered so it is asked for once. */
  const chats = new Map<SessionUri, string>();
  /**
   * Channels this host has refused, and what it said.
   *
   * A live catalogue contains sessions whose agent is gone - the host lists
   * them and then answers `-32001 No agent for session` to anything that tries
   * to watch one. That is an *answer*, not a failure of the connection, and
   * asking again on every keystroke turns one refusal into a stream of them.
   */
  const refused = new Map<string, string>();

  /**
   * The reason a host gave, in the words it used.
   *
   * `-32001` is "no agent for this session", `-32007` is "authentication is
   * required to use Claude". They want opposite things from a person - forget
   * this session, or go and sign in on the host - so the message is carried
   * through rather than replaced with one of ours.
   */
  const reason = (error: unknown): string => {
    const rpc = error as { code?: number; message?: string } | null;
    const message = rpc?.message ?? String(error);
    return typeof rpc?.code === 'number' ? `${message} (${rpc.code})` : message;
  };

  /**
   * A snapshot, or nothing.
   *
   * Nothing is a real answer here: a session with no agent still has a row in
   * the catalogue, and a detail pane that shows what the summary knows is
   * better than an application that exits. This threw, and the rejection was
   * unhandled, and an unhandled rejection ends the process - from a terminal
   * in its alternate screen, which is the worst way for anything to end.
   */
  const snapshotOf = async (uri: string): Promise<Bag | null> => {
    const known = refused.get(uri);
    if (known !== undefined) return null;
    try {
      const { result, subscription } = await client.subscribe(uri);
      // Closing drops *this consumer*. `unsubscribe` is channel-wide and would
      // kill the stream whatever else is reading it depends on.
      void subscription.close().catch(() => undefined);
      return bag(result.snapshot?.state);
    } catch (error) {
      const said = reason(error);
      refused.set(uri, said);
      options.onRefusal?.(uri, said);
      return null;
    }
  };

  const chatOf = async (uri: SessionUri): Promise<string | null> => {
    const known = chats.get(uri);
    if (known) return known;
    const found = str((await snapshotOf(uri) ?? {}).defaultChat);
    if (found) chats.set(uri, found);
    return found ?? null;
  };

  /**
   * Dispatch to the session's chat, and never reject.
   *
   * These are the fire-and-forget half of the protocol: nothing awaits them,
   * so a rejection here has nowhere to go but `unhandledRejection`, which ends
   * the process. What a caller gets instead is the refusal, reported.
   */
  /**
   * Dispatches that have not reached the socket yet.
   *
   * A dispatch is fire-and-forget by design - the host reduces it and says so,
   * and nothing here waits for a turn it did not start. But it is *async*
   * before it is sent, because the chat a session dispatches to has to be
   * looked up, so a caller that hangs up immediately afterwards hangs up
   * first. A screen never does that; a command that sends one thing and exits
   * does it every time.
   */
  const inFlight = new Set<Promise<void>>();

  const dispatch = (uri: SessionUri, action: unknown): void => {
    const sending = (async () => {
      const chat = await chatOf(uri);
      if (!chat) {
        options.onRefusal?.(uri, refused.get(uri) ?? 'this session has no chat to speak to');
        return;
      }
      client.dispatch(chat, action);
    })().catch((error: unknown) => options.onRefusal?.(uri, reason(error)));
    inFlight.add(sending);
    void sending.finally(() => inFlight.delete(sending));
  };

  return {
    id: 'live',
    url: options.url,
    state: () => state,

    /*
     * The host's filesystem, read-only.
     *
     * Present because a live host may serve it. A host that does not answers
     * `-32601`, which arrives here as a rejected request - the caller says so
     * rather than drawing an empty directory, which would read as a directory
     * that is empty.
     */
    resourceList: async (uri) => {
      const result = bag(await client.request('resourceList', { channel: ROOT, uri }));
      const parent = uri.replace(/\/+$/, '');
      return list(result.entries).map((raw) => {
        const entry = bag(raw);
        return {
          // Derived when the host sends only a name, which is what the
          // protocol's own listing carries. A row whose URI cannot be handed
          // straight back for a read is a listing you have to assemble paths
          // out of by hand.
          uri: str(entry.uri) ?? `${parent}/${str(entry.name) ?? ''}`,
          name: str(entry.name) ?? '',
          kind: str(entry.kind) ?? str(entry.type) ?? 'file',
          ...(typeof entry.size === 'number' ? { size: entry.size } : {}),
        };
      }).filter((entry) => entry.name !== '');
    },

    resourceRead: async (uri) => {
      const result = bag(await client.request('resourceRead', { channel: ROOT, uri }));
      return {
        data: str(result.data) ?? '',
        // Assumed only when the host says nothing, and utf-8 is the assumption
        // that shows a mistake rather than hiding one.
        encoding: str(result.encoding) ?? 'utf-8',
        ...(str(result.contentType) ? { contentType: str(result.contentType) as string } : {}),
      };
    },

    /*
     * Raw, and deliberately unvalidated.
     *
     * Everything else here names the action it sends, because a control that
     * builds a malformed one is a bug. This is the opposite: what it is for is
     * sending actions this client has no control for, so the host is the only
     * thing that can say whether one is right - and it says so by refusing.
     */
    dispatch: (uri, action, chat) => {
      if (chat) dispatch(uri, action);
      else client.dispatch(uri, action);
    },

    listSessions: async () => {
      const result = await client.request('listSessions', { channel: ROOT, limit: 100 });
      // Asking again is what a refresh is for. A refusal is remembered so that
      // moving the highlight does not re-ask a hundred times, and forgotten
      // here so that `r` is a way to try - which matters for the refusals that
      // are temporary, like a harness nobody had signed into yet.
      refused.clear();
      return list(result.items).map(summary);
    },

    agents: async (): Promise<Agent[]> => list(mirror.root.agents).map((entry) => {
      const agent = bag(entry);
      return {
        provider: str(agent.provider) ?? str(agent.id) ?? 'unknown',
        displayName: str(agent.displayName) ?? str(agent.provider) ?? 'Agent',
        ...(str(agent.description) ? { description: str(agent.description) as string } : {}),
        // `name`, which is what `SessionModelInfo` calls the readable one -
        // reading `displayName` here (the *agent's* field) meant every model
        // fell through to its id, and a host's ids are things like
        // `claude-sonnet-4-5-20250929`.
        // A gate, not a hint. Absent means `createChat` must not be called.
        ...(bag(agent.capabilities).multipleChats !== undefined ? { multipleChats: true } : {}),
        // The same decoder a session's list goes through, because it is the
        // same shape - the protocol says these entries are augmented and
        // propagated into a session's own when one is created with this agent,
        // so two decoders would be two readings of one thing.
        ...(list(agent.customizations).length > 0
          ? { customizations: customizations(agent.customizations) }
          : {}),
        models: list(agent.models).map((raw) => {
          const model = bag(raw);
          return {
            id: str(model.id) ?? '',
            displayName: str(model.name) ?? str(model.displayName) ?? str(model.id) ?? '',
          };
        }),
      };
    }),

    // `workingDirectory`, singular. `createSession` takes a list and this
    // takes one, so the plural spelling was a parameter the host had no name
    // for: it answered about no directory at all, and a schema that offers a
    // worktree only when the directory is a git checkout never offered one.
    resolveConfig: async ({ provider, workingDirectory, values }) => config(await client.request('resolveSessionConfig', {
      channel: ROOT,
      provider,
      ...(workingDirectory ? { workingDirectory: `file://${workingDirectory}` } : {}),
      // Iterative: what has been answered is what decides which questions are
      // left, so the host is told rather than asked the same first question.
      ...(values && Object.keys(values).length > 0 ? { config: values } : {}),
    })),

    createSession: async ({ provider, workingDirectory, config: values }) => {
      // The client chooses the URI, which is what makes the session
      // addressable before the host has answered.
      const resource = `ahp-session:/${randomUUID()}`;
      // The channel *is* the new session's URI. `createSession` reads as a
      // root command and is not one: sending it to `ahp-root://` with the URI
      // beside it named a parameter the host has nothing called, so the
      // session was created - somewhere - and never at the URI we then went
      // on to subscribe to.
      await client.request('createSession', {
        channel: resource,
        provider,
        ...(workingDirectory ? { workingDirectories: [`file://${workingDirectory}`] } : {}),
        ...(values && Object.keys(values).length > 0 ? { config: values } : {}),
      });
      return resource;
    },

    automations: async () => {
      // The host's words, not ours. "Serves no automations" and "the daemon
      // has gone" want opposite things from a person.
      if (noAutomations !== undefined) throw new Error(noAutomations);
      return list(bag(automationState).entries).map(automation);
    },

    onAutomations: (observer) => {
      automationWatchers.add(observer);
      return { close: () => { automationWatchers.delete(observer); } };
    },

    runAutomation: async (uri) => {
      await client.request('runAutomation', {
        channel: AUTOMATIONS,
        automation: uri,
        // The protocol has this so a client can match its own request to the
        // run it gets back; this client reads the catalogue instead, and sends
        // one because the field is required.
        requestId: randomUUID(),
      });
    },

    setAutomationEnabled: async (uri, enabled) => {
      // Straight at the channel. The `dispatch` above resolves a *session's*
      // chat, which this is not.
      //
      // `changes` and not the whole definition: it is a patch, and sending
      // everything back would revert whatever another client changed
      // meanwhile. A request rather than a write - the host answers with
      // `automation/set` saying what it actually holds, which is where the
      // screen reads it from.
      client.dispatch(AUTOMATIONS, {
        type: 'automation/updateRequested',
        resource: uri,
        changes: { enabled },
      });
    },

    removeAutomation: async (uri) => {
      // `automation/removed`, in the protocol's own spelling: the client says
      // it is gone and the host revalidates that `remove` is still offered
      // before it is.
      client.dispatch(AUTOMATIONS, { type: 'automation/removed', resource: uri });
    },

    terminals: async () => list(mirror.root.terminals).map((raw): TerminalRow => {
      const found = bag(raw);
      // Both forms of the exit code, because this client speaks four versions.
      // 0.9.0 moved it inside `lifecycle`, where it exists only once the
      // process has exited; before that it was flat on the terminal. Reading
      // one name leaves every exit under half the hosts reported as still
      // running.
      const exited = bag(found.lifecycle).exitCode;
      const code = typeof exited === 'number' ? exited
        : typeof found.exitCode === 'number' ? found.exitCode
        : undefined;
      return {
        resource: str(found.resource) ?? '',
        title: str(found.title) ?? 'Terminal',
        ...(code !== undefined ? { exitCode: code } : {}),
      };
    }).filter((row) => row.resource !== ''),

    createTerminal: async (options) => {
      // The client picks the URI, as it does for a session and a chat, so it
      // can be watched without a round trip in between.
      const uri = `ahp-terminal:/${randomUUID()}`;
      await client.request('createTerminal', {
        channel: uri,
        claim: { kind: 'client', clientId: 'live' },
        ...(options?.cwd ? { cwd: `file://${options.cwd}` } : {}),
        ...(options?.name ? { name: options.name } : {}),
      });
      return uri;
    },

    disposeTerminal: async (uri) => {
      await client.request('disposeTerminal', { channel: uri });
    },

    /**
     * Watch one, and report its whole state each time it changes.
     *
     * The whole state rather than the delta, for the same reason the chat
     * does: the reducer is the authority on what the terminal now contains,
     * and a second hand-written path from action to screen is a second answer
     * to the same question.
     */
    watchTerminal: (uri, observer) => {
      let live = true;
      let closer: (() => void) | undefined;
      const shape = (state: Bag): TerminalState => ({
        title: str(state.title) ?? 'Terminal',
        // The protocol's typed parts, flattened: a command part carries its
        // output and an unclassified one its value, and a reader wants the
        // stream either way.
        output: list(state.content)
          .map((raw) => {
            const part = bag(raw);
            return str(part.type) === 'command' ? str(part.output) ?? '' : str(part.value) ?? '';
          })
          .join(''),
        ...(str(state.cwd) ? { cwd: (str(state.cwd) as string).replace(/^file:\/\//, '') } : {}),
        ...(typeof state.exitCode === 'number' ? { exitCode: state.exitCode } : {}),
        isPty: state.isPty === true,
      });

      void (async () => {
        try {
          const opened = await client.subscribe(uri);
          if (!live) { void opened.subscription.close(); return; }
          closer = () => void opened.subscription.close();
          let state = bag(opened.result.snapshot?.state);
          observer(shape(state));
          for await (const event of opened.subscription) {
            if (event.type !== 'action') continue;
            state = bag(ahp.terminalReducer(state, bag(event.params).action));
            if (live) observer(shape(state));
          }
        }
        catch (error) { options.onRefusal?.(uri, reason(error)); }
      })();

      return { close: () => { live = false; closer?.(); } };
    },

    writeTerminal: (uri, data) => {
      try {
        // Side-effect only: what comes back is `terminal/data`, once the shell
        // has actually said something. Echoing here would print every
        // keystroke twice on the client that typed it.
        client.dispatch(uri, { type: 'terminal/input', data });
      } catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    completions: async ({ channel, text, offset }) => {
      try {
        const result = await client.request('completions', {
          channel,
          kind: 'userMessage',
          text,
          offset: offset ?? text.length,
        });
        return list(result.items).map((raw): Completion => {
          const item = bag(raw);
          const attachment = bag(item.attachment);
          const insertText = str(item.insertText) ?? '';
          return {
            insertText,
            // A host that answered without a range means "replace what I was
            // asked about", and the whole draft is the safe reading of that.
            rangeStart: typeof item.rangeStart === 'number' ? item.rangeStart : 0,
            rangeEnd: typeof item.rangeEnd === 'number' ? item.rangeEnd : text.length,
            label: str(attachment.label) ?? insertText,
            ...(plain(attachment.modelRepresentation)
              ? { description: plain(attachment.modelRepresentation) as string }
              : {}),
          };
        }).filter((item) => item.insertText !== '');
      }
      // A host that does not serve them is one whose composer offers no menu,
      // which is what every host did before either was served.
      catch { return []; }
    },

    createChat: async (uri, first) => {
      // The client picks the URI, as it does for a session, so it can be
      // subscribed to without a round trip in between.
      const chat = `ahp-chat:/${randomUUID()}`;
      await client.request('createChat', {
        channel: uri,
        chat,
        ...(first ? { initialMessage: { text: first, origin: { kind: 'user' } } } : {}),
      });
      return chat;
    },

    disposeChat: async (chat) => {
      await client.request('disposeChat', { channel: chat });
    },

    disposeSession: async (uri) => {
      await client.request('disposeSession', { channel: uri });
      chats.delete(uri);
      refused.delete(uri);
    },

    setArchived: (uri, archived) => {
      try {
        client.dispatch(uri, { type: 'session/isArchivedChanged', isArchived: archived });
      } catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    setRead: (uri, read) => {
      try {
        client.dispatch(uri, { type: 'session/isReadChanged', isRead: read });
      } catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    /**
     * Watch one session, and the chat it dispatches to.
     *
     * Two channels, two reducers, one observer. Every action rebuilds the
     * whole view and re-emits it as a snapshot rather than being translated
     * into a delta: the reducers are the authority on what the state is now,
     * and a second, hand-written path from action to screen is a second answer
     * to the same question. The transcript already renders from a snapshot -
     * that is what it does when it is opened - so this costs nothing but a
     * rebuild per action.
     */
    onSessions: (observer) => {
      catalogue.add(observer);
      return { close: () => { catalogue.delete(observer); } };
    },

    subscribe: (uri, observer, wanted) => {
      let live = true;
      const closers: (() => void)[] = [];
      let session: Bag = {};
      let chat: Bag = {};
      /** What was last reported, so an unchanged list is not re-sent. */
      let contributed = '';
      let listed = '';

      /** The session's chats, when that has changed. */
      const chatsChanged = (): void => {
        const items = list(session.chats).map((raw) => ({
          resource: str(bag(raw).resource) ?? '',
          title: str(bag(raw).title) ?? 'Chat',
        })).filter((entry) => entry.resource !== '');
        const now = JSON.stringify(items);
        if (now === listed) return;
        listed = now;
        if (live) observer({ type: 'chats', items, defaultChat: str(session.defaultChat) ?? '' });
      };

      const emit = (): void => {
        if (!live) return;
        const all = transcript(chat);
        const active = all.find((found) => found.state === 'running');
        const event: HostEvent = {
          type: 'snapshot',
          turns: all.filter((found) => found !== active),
          ...(active ? { active } : {}),
          ...(pendingInput(session, chat) ? { input: pendingInput(session, chat) as PendingInput } : {}),
          status: typeof session.status === 'number' ? session.status : 1,
          queued: queued(chat),
        };
        observer(event);
      };

      void (async () => {
        const known = refused.get(uri);
        if (known !== undefined) { observer({ type: 'error', message: known }); return; }
        const opened = await client.subscribe(uri);
        if (!live) { void opened.subscription.close(); return; }
        closers.push(() => void opened.subscription.close());
        session = bag(opened.result.snapshot?.state);

        chatsChanged();
        // The one that was asked for, or the session's own. A client watching
        // a second chat is watching that chat, not the session's first.
        const chatUri = wanted ?? str(session.defaultChat);
        if (chatUri) {
          chats.set(uri, chatUri);
          const talking = await client.subscribe(chatUri);
          if (!live) { void talking.subscription.close(); return; }
          closers.push(() => void talking.subscription.close());
          chat = bag(talking.result.snapshot?.state);
          void (async () => {
            for await (const event of talking.subscription) {
              if (event.type !== 'action') continue;
              chat = bag(ahp.chatReducer(chat, bag(event.params).action));
              emit();
            }
          })();
        }
        emit();

        for await (const event of opened.subscription) {
          if (event.type !== 'action') continue;
          session = bag(ahp.sessionReducer(session, bag(event.params).action));
          // Separate from the snapshot below, which is the chat: these are the
          // session's, they change for reasons that have nothing to do with a
          // turn, and a panel that only re-read when it was opened showed a
          // switch that had been answered as though it had not.
          const items = customizations(session.customizations);
          const now = JSON.stringify(items);
          if (now !== contributed) {
            contributed = now;
            if (live) observer({ type: 'customizations', items });
          }
          chatsChanged();
          emit();
        }
      })().catch((error: unknown) => {
        // The host answering "no" is not the host being gone. Marking the
        // connection offline over one dead session is how a person is sent to
        // check their network about a session whose agent simply exited.
        const said = reason(error);
        refused.set(uri, said);
        options.onRefusal?.(uri, said);
        if (live) observer({ type: 'error', message: said });
      });

      return {
        close: () => {
          live = false;
          for (const close of closers) close();
        },
      };
    },

    say: (uri, text, model) => {
      dispatch(uri, {
        type: 'chat/turnStarted',
        turnId: randomUUID(),
        startedAt: new Date().toISOString(),
        message: {
          text,
          origin: { kind: 'user' },
          ...(model ? { model: { id: model } } : {}),
        },
      });
    },

    /*
     * Appended to the host's queue, not held here.
     *
     * `chat/pendingMessageSet` with a fresh id appends; the same id again
     * would edit the one already there. The host starts a turn from the head
     * as soon as it is idle - and if it is idle *now* it consumes this
     * immediately, which is the protocol saying so, and is why this does not
     * need to know whether a turn is running.
     */
    queue: (uri, text, model) => {
      dispatch(uri, {
        type: 'chat/pendingMessageSet',
        kind: 'queued',
        id: randomUUID(),
        message: {
          text,
          origin: { kind: 'user' },
          ...(model ? { model: { id: model } } : {}),
        },
      });
    },

    unqueue: (uri, id) => {
      dispatch(uri, { type: 'chat/pendingMessageRemoved', kind: 'queued', id });
    },

    stopTurn: (uri) => {
      void (async () => {
        const chatUri = await chatOf(uri);
        if (!chatUri) return;
        // The id is read back rather than remembered: a turn somebody started
        // in an editor is stoppable from here too, and its id is in the state.
        const state = await snapshotOf(chatUri);
        const active = bag(bag(state).activeTurn);
        const turnId = str(active.id);
        if (!turnId) return;
        const started = Date.parse(str(active.startedAt) ?? '');
        client.dispatch(chatUri, {
          type: 'chat/turnCancelled',
          turnId,
          duration: Number.isNaN(started) ? 0 : Math.max(0, Date.now() - started),
        });
      })().catch((error: unknown) => options.onRefusal?.(uri, reason(error)));
    },

    confirmToolCall: (uri, toolCallId, approved, optionId) => {
      dispatch(uri, approved
        ? {
          type: 'chat/toolCallConfirmed',
          toolCallId,
          approved: true,
          // A person pressed a button, and the record of why this ran should
          // say so rather than blaming a setting.
          confirmed: 'user-action',
          ...(optionId ? { selectedOptionId: optionId } : {}),
        }
        : { type: 'chat/toolCallConfirmed', toolCallId, approved: false, reason: 'denied' });
    },

    completeInput: (uri, requestId, accepted, answers) => {
      const typed = Object.fromEntries(
        Object.entries(answers).map(([id, answer]) => [id, answerValue(answer)]),
      );
      dispatch(uri, {
        type: 'chat/inputCompleted',
        requestId,
        response: accepted ? 'accept' : 'decline',
        // Omitted rather than empty: an accept carrying no answers resumes the
        // agent on the ones it already had, which for a question it has just
        // asked is none.
        ...(Object.keys(typed).length > 0 ? { answers: typed } : {}),
      });
    },

    changesets: async (uri) => {
      const state = await snapshotOf(uri);
      return list(bag(state).changesets).map(bag).flatMap((found) => {
        const template = str(found.uriTemplate);
        if (!template) return [];
        return [{
          label: str(found.label) ?? 'Changes',
          uriTemplate: template,
          ...(str(found.changeKind) ? { changeKind: str(found.changeKind) as string } : {}),
          ...(str(found.description) ? { description: str(found.description) as string } : {}),
          // A presence flag: an empty object means supported, absence means
          // not. Sub-fields are reserved, so only its being there is read.
          ...(bag(found.capabilities).review !== undefined ? { reviewable: true } : {}),
          // RFC 6570 in the only shape this protocol defines: `{name}`, and
          // nothing else. A variable this client does not know how to fill in
          // is still worth naming, so a caller can say what it needs.
          variables: [...template.matchAll(/\{(\w+)\}/g)].map((found_) => found_[1] as string),
        }];
      });
    },

    /*
     * Tick a file off, or clear it.
     *
     * Dispatched on the *changeset's* channel rather than the session's, and
     * deliberately not an operation: the protocol has clients dispatch this
     * and the server keep the flag, which is why it needs no `operations`
     * entry and writes nothing to anybody's repository.
     */
    review: (changesetUri, files, isReviewed) => {
      client.dispatch(changesetUri, { type: 'changeset/filesReviewChanged', files, reviewed: isReviewed });
    },

    requestResource: async (uri, access) => {
      await client.request('resourceRequest', { channel: ROOT, uri, ...access });
    },

    /**
     * Run one, and let the refusal through.
     *
     * Deliberately not negotiating here. A `-32009` carries the request that
     * would unlock the same call, and answering it is a *decision* - retry
     * quietly, or stop and ask the person - which belongs above the seam where
     * the screen and the shell can differ. `operate()` is where that lives, so
     * it happens the same way against this host and against the scripted one.
     */
    invoke: async (changesetUri, operationId, target) => decodeInvoked(
      await client.request('invokeChangesetOperation', {
        channel: changesetUri,
        operationId,
        ...(target ? { target } : {}),
      }),
    ),

    changes: async (uri, wanted) => {
      if (wanted) return changeset(await snapshotOf(wanted) ?? {});
      const state = await snapshotOf(uri);
      const entry = list(bag(state).changesets)
        .map(bag)
        // The first that is already a URI. One with variables left in it is a
        // turn or a pair of them, and there is nothing here to fill them from.
        .find((found) => str(found.uriTemplate) && !str(found.uriTemplate)?.includes('{'));
      const template = str(entry?.uriTemplate);
      if (!template) return { status: 'complete', files: [] };
      return changeset(await snapshotOf(template) ?? {});
    },

    content: async (ref): Promise<FileContent> => {
      // `resourceRead` is on the root channel whatever the content belongs to:
      // a `ContentRef` uri is opaque and the host resolves it, so there is no
      // session to address this to.
      const answer = await client.request('resourceRead', {
        channel: ROOT, uri: ref.uri, encoding: 'utf-8',
      });
      const data = str(answer.data) ?? '';
      // A host may answer base64 for anything it decides is not text, and
      // decoding that into a viewer produces a screenful of mojibake. Said
      // plainly instead.
      if (str(answer.encoding) === 'base64') {
        return {
          text: '',
          binary: {
            bytes: Math.floor(data.length * 3 / 4),
            ...(str(answer.contentType) ? { contentType: str(answer.contentType) as string } : {}),
          },
        };
      }
      return { text: data };
    },

    customizations: async (uri) => customizations(bag(await snapshotOf(uri)).customizations),

    /**
     * Asked as `completions`, which is what the protocol has for this.
     *
     * The root channel, because there is no session: a host that serves it
     * answers with what its harness offers, and one that does not refuses -
     * which is a slash menu with the client's own commands in it, not a
     * failure worth reporting.
     *
     * A leading slash and nothing after it, so the answer is the whole list.
     * The menu filters what was typed itself, the same way it does on an open
     * session, rather than asking again per keystroke.
     */
    harnessCommands: async () => {
      try {
        const result = await client.request('completions', {
          channel: ROOT,
          kind: 'userMessage',
          text: '/',
          offset: 1,
        });
        return list(result.items).map((raw): Customization => {
          const item = bag(raw);
          const attachment = bag(item.attachment);
          // `insertText` is what would be typed - `/name` or `/name ` - and
          // the name is what a menu row is. The label is the same thing with
          // the slash still on it.
          const name = (str(item.insertText) ?? str(attachment.label) ?? '')
            .replace(/^\//, '')
            .trim();
          return {
            id: `command:${name}`,
            kind: 'prompt',
            name,
            uri: name,
            enabled: true,
            userInvocable: true,
            ...(plain(attachment.modelRepresentation) ? { description: plain(attachment.modelRepresentation) as string } : {}),
          };
        }).filter((command) => command.name !== '');
      }
      catch { return []; }
    },

    setCustomizationEnabled: (uri, id, enabled) => {
      try {
        // Session scope. The other two are a decision about every session on
        // this workspace or on this machine, and a panel inside one session is
        // not where somebody means to make either.
        client.dispatch(uri, {
          type: 'session/customizationToggled',
          id,
          enablement: [{ kind: 'session', enabled }],
        });
      } catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    detail: async (uri): Promise<SessionDetail> => {
      const state = bag(await snapshotOf(uri));
      const chatUri = str(state.defaultChat) ?? null;
      if (chatUri) chats.set(uri, chatUri);
      const talking = bag(chatUri ? await snapshotOf(chatUri) : {});
      const last = [...list(talking.turns), talking.activeTurn]
        .map(bag)
        .reverse()
        .find((found) => str(bag(bag(found).message).model));

      return {
        resource: uri,
        chat: chatUri,
        chats: list(state.chats).map((entry) => ({
          resource: str(bag(entry).resource) ?? '',
          title: str(bag(entry).title) ?? 'Chat',
        })),
        // What the host said, when it said no. A pane reading "creating" over
        // a session whose agent is gone is worse than one that says so.
        // 0.9.0 renamed `creationFailed` to `failed`, and this client speaks
        // both sides of that rename - so the old name is translated here
        // rather than carried inland as a second word for one state.
        lifecycle: (str(state.lifecycle) === 'creationFailed'
          ? 'failed'
          : str(state.lifecycle) ?? 'creating') as SessionDetail['lifecycle'],
        ...(refused.has(uri) ? { refusal: refused.get(uri) as string } : {}),
        config: config(state.config),
        ...(last ? { model: str(bag(bag(bag(last).message).model).id) as string } : {}),
        ...(str(state.activity) ? { activity: str(state.activity) as string } : {}),
      };
    },

    config: async (uri) => config(bag(await snapshotOf(uri)).config),

    setConfig: (uri, key, value) => {
      // One key. The action merges into `config.values`, so sending the object
      // writes back everything this client happened to be holding - including
      // whatever another client changed while it was on screen.
      try {
        client.dispatch(uri, { type: 'session/configChanged', config: { [key]: value } });
      } catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    /** Everything already sent, actually sent. */
    flush: async () => { await Promise.allSettled([...inFlight]); },

    close: async () => {
      // Set, not announced. `onState` means something happened *to* the
      // connection, and hanging up on purpose is not that - reporting it
      // sends somebody to check their network over a program that simply
      // finished.
      state = 'offline';
      await client.shutdown();
    },
  };
}
