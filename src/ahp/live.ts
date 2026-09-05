import { randomUUID } from 'node:crypto';
import { openChannels } from './channels.js';
import { publish } from './publish.js';
import type { Published } from './publish.js';
import type { HostConnection, HostEvent } from './connection.js';
import type {
  Agent, Answer, Automation, AutomationRun, Changeset, ChangesetOperation, ChangesetOperationTarget, Completion, ConfigProperty, ContentRef, Customization, CustomizationKind,
  TerminalRow, TerminalState,
  FileContent, FileEdit, McpState, PendingInput, QueuedMessage, Question, QuestionKind,
  ModelRow, ModelSelection, ResponsePart, SessionConfig, SessionDetail, SessionSummary, SessionUri, ToolCall,
  ToolCallStatus, Turn,
} from './types.js';
import { SessionFlag } from './types.js';

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
  /**
   * Open a transport, in place of a WebSocket to `url`.
   *
   * The seam a test drives: a connection is the one thing here that cannot be
   * scripted from above, because `fakeHost` implements the seam this file
   * produces rather than the protocol underneath it. Called once per attempt,
   * so a reconnect asks for a new one.
   */
  connect?(): Promise<unknown>;
  /**
   * How long to wait before each attempt to come back, in milliseconds.
   *
   * The last entry repeats for as long as the host stays away. Given in full
   * rather than as a formula so a test can ask for no waiting at all, and so
   * the schedule is a thing that can be read.
   */
  backoff?: readonly number[];
  /** How often to ping an otherwise silent connection. `0` sends none. */
  keepaliveMs?: number;
  /** How long to hold a channel nobody is reading before letting it go. */
  lingerMs?: number;
  /**
   * Told when this client stopped short of everything the host had.
   *
   * Not a refusal - the host answered, and answered fully. It is this client
   * declining to walk a catalogue past the point where walking it is the
   * wrong thing to be doing, and a person is owed the sentence.
   */
  onLimit?(message: string): void;
  /**
   * Work the host is doing, by its own token.
   *
   * `null` means that token is finished. The specification's own example is a
   * harness being downloaded before a session can start, which is exactly the
   * wait that looked like nothing happening.
   */
  onProgress?(token: string, message: string | null): void;
  /**
   * The host wants a token before it will go on.
   *
   * `reason: 'expired'` is the one that matters: `authentication.md` says the
   * client MUST acquire a new credential and MUST NOT blindly replay the one
   * that was challenged. Arrives either as the `auth/required` notification or
   * as the `data` on any `-32007`, which the specification says may come back
   * from **any** command rather than only from `authenticate`.
   */
  onAuthRequired?(resources: { resource: string; description?: string }[], reason?: string): void;
  /**
   * What this client serves back, when it was told to serve anything.
   *
   * Absent means a `publish()` that refuses everything, which is the default
   * and the safe one - a client that offers its filesystem to whichever host
   * it connects to is a mistake, not a feature.
   */
  publish?: Published;
}

/**
 * What to wait before the next attempt, when a host has gone.
 *
 * Doubling to half a minute, which is short enough that a daemon restarted by
 * hand is picked up while the person is still looking at the screen, and long
 * enough that a host which is gone for the afternoon is not asked about it
 * eight thousand times.
 */
const BACKOFF = [250, 500, 1000, 2000, 5000, 10_000, 30_000] as const;

/** How long a connection may say nothing before this client checks it is there. */
const KEEPALIVE_MS = 30_000;

/**
 * How long a channel nobody is reading is kept before it is given up.
 *
 * Long enough to cover reading a snapshot and then opening the view on the
 * same session, and closing a screen and going back to it - which are the two
 * places an immediate release put an `unsubscribe` in the middle of what a
 * person experienced as one thing.
 */
const LINGER_MS = 5_000;

/**
 * How many pages of the catalogue to walk before stopping and saying so.
 *
 * A bound rather than a page size: the host picks how big a page is, and this
 * picks how many of them are worth walking to draw a list somebody is going to
 * scroll. Twenty is past any catalogue either implementation has produced, and
 * reaching it is reported rather than passed over in silence.
 */
const PAGES = 20;

/**
 * Whether a host answered, or was not there to answer.
 *
 * The difference decides whether coming back is worth trying differently or
 * only worth trying again: a refusal is a host with an opinion about this
 * client, and a transport failure is no host at all. JSON-RPC gives a numeric
 * `code` and a transport error does not, which is the only thing separating
 * them that does not depend on the library's own class names.
 */
function isRpcRefusal(error: unknown): boolean {
  return typeof (error as { code?: unknown } | null)?.code === 'number';
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
  initialize(args: {
    clientId: string;
    protocolVersions: readonly string[];
    initialSubscriptions?: readonly string[];
    clientInfo?: { name: string; version?: string };
    locale?: string;
  }): Promise<unknown>;
  /**
   * Take up a dropped connection where it left off.
   *
   * Answers either the envelopes missed since `lastSeenServerSeq`, or - when
   * the gap is longer than the host's buffer - fresh snapshots for the
   * channels it could restore. `missing` names the ones it could not.
   */
  reconnect(args: {
    clientId: string;
    lastSeenServerSeq: number;
    subscriptions: readonly string[];
  }): Promise<Record<string, unknown>>;
  /** Install the answer to anything the host asks this client. */
  setServerRequestHandler(handler: unknown): void;
  request(method: string, params: unknown): Promise<Record<string, unknown>>;
  subscribe(uri: string): Promise<{
    result: { snapshot?: { state?: unknown } };
    subscription: Subscription;
  }>;
  /** Tell the host nobody is reading a channel. Fire-and-forget, by the protocol. */
  unsubscribe(uri: string): Promise<void>;
  /** Every channel's traffic in one stream, tagged with the channel it came on. */
  events(): AsyncIterableIterator<{ channel: string; event: { type: string; params?: unknown } }>;
  /** Connection transitions, which is how a drop is noticed before a read fails. */
  stateChanges(): AsyncIterableIterator<{ status: string; reason?: { type: string } }>;
  /** In-band liveness. A proxy that drops idle sockets never sees the traffic below it. */
  ping(): Promise<void>;
  dispatch(channel: string, action: unknown): unknown;
}

interface Mirror {
  readonly root: { agents?: unknown[]; terminals?: unknown[] };
  applySnapshot(snapshot: unknown): void;
  apply(envelope: unknown): void;
}

interface Loaded {
  Client: new (transport: unknown, config?: unknown) => Client;
  createResourceRequestHandler(handlers: Record<string, (params: unknown) => Promise<unknown>>): unknown;
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

/**
 * The client's preferred language, as a BCP 47 tag.
 *
 * `lifecycle.md` says a server SHOULD use this to localise the strings a
 * person reads - confirmation option labels among them. POSIX spells a locale
 * `en_US.UTF-8`; BCP 47 wants `en-US`, so the encoding is dropped and the
 * underscore becomes a hyphen. `C` and `POSIX` name no language and are sent
 * as nothing rather than as a tag no server can read.
 */
function locale(): string | undefined {
  const found = process.env.LC_ALL ?? process.env.LC_MESSAGES ?? process.env.LANG;
  if (found === undefined || found === '') return undefined;
  const tag = found.split('.')[0]?.replace(/_/g, '-');
  if (tag === undefined || tag === '' || tag === 'C' || tag === 'POSIX') return undefined;
  return tag;
}

/**
 * A transport that also hands every inbound notification to a listener.
 *
 * The protocol's own client models five notifications and *drops the rest* -
 * its handler has a default branch that discards anything it does not
 * recognise, `root/progress` and `otlp/exportLogs` among them, so neither
 * reaches `events()` and neither can be read through the client at all.
 *
 * Both are in the specification, so the answer is not to do without them. The
 * frames arrive here on their way in and are read on the way past: nothing is
 * intercepted, nothing is answered, and the client below sees exactly what it
 * would have seen.
 */
interface Framed {
  send(message: unknown): Promise<void> | void;
  recv(): Promise<{ kind: string; message?: unknown; text?: string } | null>;
  close(): Promise<void> | void;
}

function tee(inner: Framed, heard: (method: string, params: Bag) => void): Framed {
  return {
    send: (message: unknown) => inner.send(message),
    close: () => inner.close(),
    recv: async () => {
      const frame = await inner.recv();
      if (frame === null) return null;
      try {
        const message = frame.kind === 'parsed'
          ? bag(frame.message)
          : frame.kind === 'text' ? bag(JSON.parse(frame.text ?? 'null')) : null;
        // A notification is a message with a method and no id.
        if (message === null) return frame;
        const method = str(message.method);
        if (method !== undefined && message.id === undefined) heard(method, bag(message.params));
      }
      catch { /* the client below reports a frame it cannot read */ }
      return frame;
    },
  };
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
      createResourceRequestHandler:
        client.createResourceRequestHandler as unknown as Loaded['createResourceRequestHandler'],
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
    ...(selection(message.model, found.usage) ? { model: selection(message.model, found.usage) as ModelSelection } : {}),
    at: str(found.startedAt) ?? new Date(0).toISOString(),
    ...(typeof found.duration === 'number' ? { elapsedMs: found.duration } : {}),
  };
}

/**
 * The activity bits, from what this client can see rather than what it was told.
 *
 * There is no `session/statusChanged` in the protocol. A subscribed client is
 * told `session/activityChanged` - a word - and the reducer keeps that word in
 * `activity` and deliberately leaves `status` alone; the only actions that
 * move `status` are the input-needed pair and the read and archived flags. So
 * on a live session the activity bits only ever go up. Answering a question
 * clears `InputNeeded` and leaves `InProgress` set, which the reducer's own
 * comment calls falling back to in-progress, and nothing afterwards takes it
 * off - a session goes on saying it is working through every turn that
 * follows, until something re-reads the catalogue.
 *
 * Everything the bits are about is already here: whether a turn is running,
 * whether something is waiting on a person, and whether the last turn failed.
 * The order is the host's own - what is wanted, then what is happening, then
 * what went wrong - and the session's own flags are carried through untouched,
 * because read and archived are not about activity at all.
 */
export function activityOf(status: number, asked: boolean, running: boolean, failed: boolean): number {
  const flags = status & (SessionFlag.IsRead | SessionFlag.IsArchived);
  if (asked) return flags | SessionFlag.InputNeeded;
  if (running) return flags | SessionFlag.InProgress;
  if (failed) return flags | SessionFlag.Error;
  return flags | SessionFlag.Idle;
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
 * Reduce one action, or say so and go on listening.
 *
 * A reducer is handed whatever the host sent, and a host that sends a
 * malformed action throws inside it - `session/inputNeededSet` without its
 * `request` is `action.request.id` on undefined, which is a `TypeError` and
 * not an RPC error. Thrown out of a `for await` it rejects the whole loop and
 * takes the subscription with it, so the session goes deaf: the block waiting
 * on a person never clears, the status never moves, and the only sign of any
 * of it is a sentence about a property of undefined on the status bar.
 *
 * One word this client cannot read is not a reason to stop reading the rest
 * of them. The action is dropped, the state it would have changed is left as
 * it was, and it is said out loud - because a client quietly ignoring what a
 * host tells it is the other way to be wrong here.
 */
export function applyAction<T>(
  reduce: (state: T, action: never) => unknown,
  state: T,
  action: unknown,
  onBad: (message: string) => void,
): T {
  try {
    return reduce(state, action as never) as T;
  }
  catch (error) {
    const said = error instanceof Error ? error.message : String(error);
    const type = typeof (action as { type?: unknown } | null)?.type === 'string'
      ? (action as { type: string }).type
      : 'an action';
    onBad(`The host sent ${type} in a shape this client cannot read: ${said}`);
    return state;
  }
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
        ...(str(property.default) ? { default: str(property.default) as string } : {}),
      };
    }),
    values: Object.fromEntries(Object.entries(values).map(([key, entry]) => [key, String(entry)])),
  };
}

/**
 * What a turn was asked for, and failing that what it was reported as using.
 *
 * `Message.model` is where the protocol says a turn's model is recorded, and
 * a host may leave it empty - one captured conversation has it absent on every
 * turn with the model in `usage.model` instead, which is declared as "model
 * used" and is a plain string rather than a `ModelSelection`. So both are
 * read, asked for first: one says what was requested and the other what
 * answered, and a client that read only the first showed no model at all.
 *
 * The settings are dropped by that second path, because usage does not carry
 * any - which is honest. A thinking level takes effect from the turn that
 * names it, so two answers from one model are two different questions, and a
 * host that does not record which cannot be made to have done.
 *
 * Values are flattened to strings because that is what a form returns and what
 * every reader here shows; a host that sends a number sends one this can
 * print.
 */
function selection(value: unknown, usage?: unknown): ModelSelection | undefined {
  const found = bag(value);
  const id = str(found.id) ?? str(bag(usage).model);
  if (id === undefined) return undefined;
  const config = Object.entries(bag(found.config))
    .filter(([, one]) => one !== null && typeof one !== 'object')
    .map(([key, one]) => [key, String(one)]);
  return {
    id,
    ...(config.length > 0 ? { config: Object.fromEntries(config) as Record<string, string> } : {}),
  };
}

/** A selection as it goes out: the id, and the answers it was given. */
function selectionOf(model: ModelSelection): Record<string, unknown> {
  return {
    id: model.id,
    ...(model.config && Object.keys(model.config).length > 0 ? { config: model.config } : {}),
  };
}

/**
 * One model, wherever it appears.
 *
 * `configSchema` is a schema on its own rather than the `{ schema, values }`
 * a session's config arrives as, so it is wrapped rather than read a second
 * way - it is the same document, and a second decoder for it would be a
 * second set of rules about `enumLabels`.
 */
function model(value: unknown): ModelRow {
  const found = bag(value);
  const options = config({ schema: found.configSchema }).properties;
  return {
    id: str(found.id) ?? '',
    // `name`, which is what `SessionModelInfo` calls the readable one -
    // reading `displayName` here (the *agent's* field) meant every model fell
    // through to its id, and a host's ids are things like
    // `claude-sonnet-4-5-20250929`.
    displayName: str(found.name) ?? str(found.displayName) ?? str(found.id) ?? '',
    provider: str(found.provider) ?? '',
    ...(options.length > 0 ? { options } : {}),
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

  /**
   * This client's name to the host, for the life of the process.
   *
   * `reconnect` is addressed by it: a fresh one each time the socket comes
   * back is a host asked to resume a client it has never heard of, which it
   * answers by refusing - so the identity has to outlive the connection it
   * was first used on.
   */
  const clientId = options.clientId ?? `ahpc-${randomUUID().slice(0, 8)}`;
  const openTransport = options.connect ?? (() => ahp.connect(endpoint));
  const backoff = options.backoff ?? BACKOFF;
  const keepaliveMs = options.keepaliveMs ?? KEEPALIVE_MS;

  /**
   * Work a host is doing that has been given a token to report against.
   *
   * `root-channel.md`: `progress` is monotonically non-decreasing for a token,
   * the operation is complete when `progress === total`, and the host MUST
   * send a final frame satisfying that - so a token is forgotten on the frame
   * that closes it rather than on a timer. `total` absent means the magnitude
   * is not known and a client SHOULD show an indeterminate indicator.
   */
  const working = new Map<string, string>();
  const notified = (method: string, params: Bag): void => {
    if (method === 'auth/required') {
      const one = bag(params.resource);
      const resource = str(one.resource);
      if (resource === undefined) return;
      options.onAuthRequired?.(
        [{ resource, ...(str(one.description) ? { description: str(one.description) as string } : {}) }],
        str(params.reason),
      );
      return;
    }
    if (method !== 'root/progress') return;
    const token = str(params.progressToken);
    if (token === undefined) return;
    const done = typeof params.total === 'number' && params.progress === params.total;
    if (done) { working.delete(token); options.onProgress?.(token, null); return; }
    // The host's own words, which `root-channel.md` says a generic client MAY
    // show verbatim - this client has no label of its own for work it did not
    // name. The share is left out where no total was given rather than
    // guessed at.
    const said = str(params.message) ?? 'Working';
    const share = typeof params.total === 'number' && params.total > 0
      ? ` ${Math.round((Number(params.progress) / params.total) * 100)}%`
      : '';
    working.set(token, `${said}${share}`);
    options.onProgress?.(token, `${said}${share}`);
  };

  const transport = tee(await openTransport() as Framed, notified);
  let client = new ahp.Client(transport, {});
  /*
   * What a host may ask this client for.
   *
   * The protocol is symmetrical and the package answers `-32601` to every
   * server-initiated method until a handler is installed. Installing one is
   * what makes this client an implementation of the reverse direction rather
   * than a client that happens not to crash: a published directory answers,
   * and everything else is refused with the code the specification declares
   * for a refusal instead of the one for a method that does not exist.
   */
  const serving = options.publish ?? publish();
  const answering = ahp.createResourceRequestHandler(serving.handlers());
  const mirror = new ahp.Mirror();
  client.setServerRequestHandler(answering);
  client.connect();

  /*
   * The root channel, asked for in the handshake rather than after it.
   *
   * `lifecycle.md` gives `initialSubscriptions` as part of `initialize` and
   * the root channel's own page says a client SHOULD subscribe to it that way.
   * It saves a round trip on every connection, and the reconnect path already
   * had to do this on its `initialize` fallback - only the first connection
   * was still asking twice.
   */
  /** Channels the handshake opened, with the state it answered. */
  const adopted = new Map<string, Bag | null>();

  const hello = bag(await client.initialize({
    clientId,
    protocolVersions: VERSIONS,
    clientInfo: { name: 'ahpc' },
    initialSubscriptions: [ROOT],
    ...(locale() !== undefined ? { locale: locale() as string } : {}),
  }));
  for (const snapshot of list(hello.snapshots)) mirror.applySnapshot(snapshot);
  moveTo('connected');

  /** True once `close` has been called, so a deliberate hang-up is not retried. */
  let finished = false;

  /**
   * The reason a host gave, in the words it used.
   *
   * `-32001` is "no agent for this session", `-32007` is "authentication is
   * required to use Claude". They want opposite things from a person - forget
   * this session, or go and sign in on the host - so the message is carried
   * through rather than replaced with one of ours.
   */
  const reason = (error: unknown): string => {
    const rpc = error as { code?: number; message?: string; data?: unknown } | null;
    const message = rpc?.message ?? String(error);
    /*
     * A `-32007` says which resources need signing into, in its `data`.
     *
     * `authentication.md` puts an `AuthRequiredErrorData` there and says the
     * error MAY come back from **any** command, not only `authenticate` - so
     * this is read wherever a refusal is turned into words rather than at one
     * call site. Dropping it left a person told that authentication was
     * required and not told to what.
     */
    if (rpc?.code === -32007) {
      const resources = list(bag(rpc.data).resources).map((raw) => {
        const one = bag(raw);
        return {
          resource: str(one.resource) ?? '',
          ...(str(one.description) ? { description: str(one.description) as string } : {}),
        };
      }).filter((one) => one.resource !== '');
      if (resources.length > 0) options.onAuthRequired?.(resources);
    }
    return typeof rpc?.code === 'number' ? `${message} (${rpc.code})` : message;
  };

  /**
   * Every channel this client is holding open, and who is reading each one.
   *
   * Between the protocol client and the screens: it counts the readers of a
   * channel so the last one leaving is what sends `unsubscribe`, and it holds
   * the set that has to be named to `reconnect` when the socket comes back.
   */
  // What the handshake already answered for, so the first reader of the root
  // channel is handed that snapshot instead of asking for a second one.
  for (const snapshot of list(hello.snapshots)) {
    const one = bag(snapshot);
    const uri = str(one.resource);
    if (uri !== undefined) adopted.set(uri, bag(one.state));
  }

  const channels = openChannels({
    client,
    reason,
    lingerMs: options.lingerMs ?? LINGER_MS,
    onRefusal: (uri, message) => options.onRefusal?.(uri, message),
    clientId,
    // A refused action reaches a person the same way a refused channel does.
    // Both are the host saying no in its own words, and neither is a fault
    // here to be dressed up as one.
    onRejection: (uri, message) => options.onRefusal?.(uri, message),
  });
  for (const [uri, state] of adopted) channels.adopt(uri, state);
  channels.drain(client);

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

  channels.open(ROOT, {
    opened: (root) => { if (root) mirror.applySnapshot({ resource: ROOT, state: root }); },
    event: (event) => {
      // Actions carry root state and the notifications carry the catalogue.
      // Both mean "something over there moved, read it again", which is true
      // of every kind of them and is one request either way.
      if (event.type === 'action') mirror.apply(event.params);
      else if (event.type !== 'sessionAdded' && event.type !== 'sessionRemoved'
        && event.type !== 'sessionSummaryChanged') return;
      for (const listener of catalogue) listener();
    },
  });

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
  /**
   * The automations catalogue, under whichever name the host's version gives it.
   *
   * This is the whole of what changed between protocol 0.9.0 and 1.0.0 in
   * anything this client reads. 0.9.0 calls the catalogue `AutomationState`
   * and puts the automations in `entries`; 1.0.0 renames the catalogue to
   * `AutomationCatalogState` and the field to `automations`, and moves the
   * name `AutomationState` onto a single automation. The automations
   * themselves did not move - 0.9.0's `AutomationEntry` and 1.0.0's
   * `AutomationState` have the same fields, and every action on the channel
   * kept its name and its shape.
   *
   * So one field is normalised here, at the edge, and everything past this
   * point - the reducer included, which is the 0.9.0 one and reads `entries` -
   * carries on unaware there was ever a second spelling.
   */
  const automationCatalogue = (state: Bag | null): Bag | null => {
    if (state === null) return null;
    if (state.entries !== undefined || state.automations === undefined) return state;
    const { automations, ...rest } = state;
    return { ...rest, entries: automations };
  };

  const automationWatchers = new Set<() => void>();
  let automationState: Bag | null = null;
  let noAutomations: string | undefined;
  /*
   * Asked for only where the host said it had them.
   *
   * `InitializeResult.automations` is what *permits* a client to use the
   * channel and the three commands, so its absence is the answer and asking
   * anyway is a request with a known reply. It is not a harmless one either:
   * a host that routes an unknown channel to its session table answers
   * `-32001` about a session nobody named, which is a refusal a person then
   * has to be told to ignore.
   */
  if (hello.automations === undefined || hello.automations === null) {
    noAutomations = 'This host serves no automations.';
  }
  else {
    channels.open(AUTOMATIONS, {
      opened: (state) => { automationState = automationCatalogue(state); },
      event: (event) => {
        if (event.type !== 'action') return;
        // The host's own reducer. Two mutations is not eighty, but a second
        // answer to "what is the state now" is a second answer at any size.
        automationState = bag(ahp.automationReducer(automationState, bag(event.params).action));
        for (const listener of automationWatchers) listener();
      },
      refused: (message) => { noAutomations = message; },
    });
  }

  /**
   * A model id, resolved against what the root channel advertises.
   *
   * A turn names an id and nothing else, and the name, the harness and the
   * model's own options live on the catalogue row. Unresolved is a real
   * answer rather than a failure - a host whose harness nobody has signed
   * into advertises no models at all - and an id that matches nothing stands
   * in for itself rather than disappearing.
   */
  const known = (id: string): ModelRow => {
    for (const entry of list(mirror.root.agents)) {
      for (const raw of list(bag(entry).models)) {
        const row = model(raw);
        if (row.id !== id) continue;
        return row.provider === ''
          ? { ...row, provider: str(bag(entry).provider) ?? str(bag(entry).id) ?? '' }
          : row;
      }
    }
    return { id, displayName: id, provider: '' };
  };

  /**
   * What the host says it protects, across every agent it advertises.
   *
   * `AgentInfo.protectedResources` is the static half of where a `resource`
   * may come from; the other half is a live MCP challenge, which arrives as
   * `auth/required` rather than being listable.
   */
  const advertised = async (): Promise<{ resource: string; description?: string }[]> => {
    const found = new Map<string, { resource: string; description?: string }>();
    for (const entry of list(mirror.root.agents)) {
      for (const raw of list(bag(entry).protectedResources)) {
        const one = bag(raw);
        const resource = str(one.resource);
        if (resource === undefined) continue;
        found.set(resource, {
          resource,
          ...(str(one.description) ? { description: str(one.description) as string } : {}),
        });
      }
    }
    return [...found.values()];
  };

  /** The chat a session dispatches to, remembered so it is asked for once. */
  const chats = new Map<SessionUri, string>();

  /**
   * Wait, unless the client is being closed while waiting.
   *
   * A backoff of half a minute is half a minute a person can spend quitting,
   * and a timer nobody cancels holds the process open after they have.
   */
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const pause = (ms: number): Promise<void> => new Promise((resolve) => {
    const timer = setTimeout(() => { timers.delete(timer); resolve(); }, ms);
    timers.add(timer);
  });

  /**
   * Take the connection back after it drops, and say so while it is gone.
   *
   * A dropped socket is a pause rather than an ending: the host holds the
   * sessions, so what is lost is this client's view of them and not the work.
   * The identity and the held channels are carried across, `reconnect` asks
   * for what was missed, and the catalogue is re-read because protocol
   * notifications are never replayed - a session created while this client
   * was away is announced once, to a client that was not there to hear it.
   */
  void (async () => {
    for (;;) {
      let dropped = false;
      try {
        for await (const change of client.stateChanges()) {
          if (change.status !== 'closed') continue;
          dropped = change.reason?.type !== 'shutdown';
          break;
        }
      }
      catch { dropped = true; }
      if (finished || !dropped) return;

      channels.detach();
      moveTo('connecting');

      for (let attempt = 0; !finished; attempt += 1) {
        await pause(backoff[Math.min(attempt, backoff.length - 1)] ?? 0);
        if (finished) return;
        try {
          const socket = tee(await openTransport() as Framed, notified);
          const fresh = new ahp.Client(socket, {});
          fresh.setServerRequestHandler(answering);
          fresh.connect();
          const held = channels.held();

          let answer: Bag | null = null;
          try {
            answer = bag(await fresh.reconnect({
              clientId,
              lastSeenServerSeq: channels.seq(),
              subscriptions: held,
            }));
          }
          catch (error) {
            // A host that will not resume this client is the ordinary case
            // rather than a failure: a daemon restarted between the drop and
            // now has never heard of this `clientId`, and answers so. What
            // cannot be resumed is started again - retrying `reconnect` at a
            // host that has forgotten us is a loop with no end in it.
            if (!isRpcRefusal(error)) throw error;
            await fresh.initialize({
              clientId,
              protocolVersions: VERSIONS,
              clientInfo: { name: 'ahpc' },
              initialSubscriptions: held,
            });
          }

          client = fresh;
          if (answer === null) channels.resume(fresh, {});
          else {
            channels.resume(fresh, str(answer.type) === 'replay'
              ? { replayed: list(answer.actions), missing: list(answer.missing).filter((uri): uri is string => typeof uri === 'string') }
              : { resumed: list(answer.snapshots) as { resource: string; state?: unknown }[] });
          }
          moveTo('connected');
          // Notifications are not replayed, so what the catalogue missed is
          // not in the answer above and has to be asked for again.
          for (const listener of catalogue) listener();
          break;
        }
        catch { /* the host is not back yet, or would not have us back */ }
      }
    }
  })();

  /**
   * Say something on an otherwise silent connection.
   *
   * A proxy between this client and its host drops a socket that has carried
   * nothing for long enough, and neither end is told - so a session left open
   * overnight is one whose next keystroke goes nowhere. `ping` is the
   * protocol's own answer to that, and a failed one is a drop the supervisor
   * above can act on rather than one nobody has noticed yet.
   */
  if (keepaliveMs > 0) {
    void (async () => {
      while (!finished) {
        await pause(keepaliveMs);
        if (finished) return;
        try { await client.ping(); }
        catch { /* the state change is what the supervisor reads */ }
      }
    })();
  }

  /**
   * A snapshot, or nothing.
   *
   * Nothing is a real answer here: a session with no agent still has a row in
   * the catalogue, and a detail pane that shows what the summary knows is
   * better than an application that exits. This threw, and the rejection was
   * unhandled, and an unhandled rejection ends the process - from a terminal
   * in its alternate screen, which is the worst way for anything to end.
   */
  const snapshotOf = async (uri: string): Promise<Bag | null> => channels.state(uri);

  const chatOf = async (uri: SessionUri): Promise<string | null> => {
    const known = chats.get(uri);
    if (known) return known;
    const found = str((await snapshotOf(uri) ?? {}).defaultChat);
    if (found) chats.set(uri, found);
    return found ?? null;
  };

  /**
   * Pull the page of history before the turns already loaded.
   *
   * Shared by the seam method and by the chat consumer, which asks once on
   * opening when it was handed an empty window - so the two can never drift
   * into fetching different things.
   */
  const loadOlder = async (uri: SessionUri, wanted?: string): Promise<boolean> => {
    const chatUri = wanted ?? await chatOf(uri);
    if (chatUri === null) return false;
    const before = bag(await snapshotOf(chatUri));
    /*
     * The cursor if there is one, and nothing if there is not.
     *
     * Omitting it is not the same as having none: the protocol says an absent
     * cursor asks the host for its next older page anyway, which is what a
     * host that sent an empty window without one still owes. A cursor this
     * client invented would be `-32602`, so the choice is between the host's
     * own and no field at all.
     */
    const cursor = str(before.turnsNextCursor);
    try {
      // The result is empty by design. What was fetched arrives as
      // `chat/turnsLoaded` on the chat channel, before this answers.
      await client.request('fetchTurns', {
        channel: chatUri,
        ...(cursor === undefined ? {} : { cursor }),
      });
    }
    catch (error) {
      options.onRefusal?.(chatUri, reason(error));
      return false;
    }
    const after = bag(await snapshotOf(chatUri));
    // Absence means the state holds every turn the host retained, which is the
    // protocol's own words for "that was the last page".
    return str(after.turnsNextCursor) !== undefined;
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
        options.onRefusal?.(uri, channels.refusal(uri) ?? 'this session has no chat to speak to');
        return;
      }
      client.dispatch(chat, action);
    })().catch((error: unknown) => options.onRefusal?.(uri, reason(error)));
    inFlight.add(sending);
    void sending.finally(() => inFlight.delete(sending));
  };

  return {
    // The name the host knows this connection by, not a word meaning "real".
    // A daemon logs the `clientId` it accepted and the one that went away, so
    // reporting it here is what lets a run on this side be tied to a run on
    // that one - `ahpc status --json` prints it, and nothing else could.
    id: clientId,
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
     * A token, for a resource the host said it protects.
     *
     * The `resource` is checked against what was advertised before anything is
     * sent: `authentication.md` says it MUST match, so a name this client made
     * up is a request the host is obliged to refuse - better to say which
     * names exist than to have the host say no.
     */
    authenticate: async (resource, token, opts) => {
      const known = await advertised();
      if (known.length > 0 && !known.some((one) => one.resource === resource)) {
        throw new Error(`This host protects ${known.map((one) => one.resource).join(', ')}, not ${resource}.`);
      }
      await client.request('authenticate', {
        channel: ROOT,
        resource,
        token,
        ...(opts?.scopes && opts.scopes.length > 0 ? { scopes: opts.scopes } : {}),
        // A positive integer or nothing. Zero and negatives are not "expired
        // already", they are values the protocol does not allow.
        ...(typeof opts?.expiresIn === 'number' && Number.isInteger(opts.expiresIn) && opts.expiresIn > 0
          ? { expiresIn: opts.expiresIn }
          : {}),
      });
    },

    protectedResources: async () => advertised(),

    resourceResolve: async (uri) => {
      const result = bag(await client.request('resourceResolve', { channel: ROOT, uri }));
      return {
        uri: str(result.uri) ?? uri,
        // `ResourceType`, the host's own word for what is there. Passed
        // through rather than narrowed to a boolean: a symlink is neither a
        // file nor a directory and this client is not the thing that decides.
        type: str(result.type) ?? 'file',
        ...(typeof result.size === 'number' ? { size: result.size } : {}),
        ...(str(result.mtime) ? { mtime: str(result.mtime) as string } : {}),
      };
    },

    /*
     * The write half, which is the same family sent the other way.
     *
     * Exactly the declared parameters and no more. The prose on `resourceWrite`
     * documents a `-32011 Conflict` "if `ifMatch` is set and the current `etag`
     * does not match", and neither `ifMatch` on the params nor `etag` on the
     * resolve result is declared anywhere in the package - so sending one
     * would be inventing a field, which is the thing this client is not for.
     * `createOnly` is the guard the protocol does declare.
     */
    resourceWrite: async (uri, data, opts) => {
      await client.request('resourceWrite', {
        channel: ROOT,
        uri,
        data,
        encoding: opts?.encoding ?? 'utf-8',
        ...(opts?.createOnly ? { createOnly: true } : {}),
      });
    },

    resourceDelete: async (uri, opts) => {
      await client.request('resourceDelete', {
        channel: ROOT,
        uri,
        ...(opts?.recursive ? { recursive: true } : {}),
      });
    },

    resourceMkdir: async (uri) => {
      await client.request('resourceMkdir', { channel: ROOT, uri });
    },

    // `source` and `destination`, and `failIfExists` rather than an
    // `overwrite` that reads the other way round. Both spellings were guessed
    // at here before the declarations were read.
    resourceMove: async (from, to, opts) => {
      await client.request('resourceMove', {
        channel: ROOT,
        source: from,
        destination: to,
        ...(opts?.failIfExists ? { failIfExists: true } : {}),
      });
    },

    resourceCopy: async (from, to, opts) => {
      await client.request('resourceCopy', {
        channel: ROOT,
        source: from,
        destination: to,
        ...(opts?.failIfExists ? { failIfExists: true } : {}),
      });
    },

    watchResource: async (uri, observer, opts) => {
      const result = bag(await client.request('createResourceWatch', {
        channel: ROOT,
        uri,
        ...(opts?.recursive ? { recursive: true } : {}),
      }));
      // Receiver-assigned and opaque: whatever the host called it is what gets
      // subscribed to, and nothing here parses it.
      const channel = str(result.channel);
      if (channel === undefined) throw new Error('This host allocated no watch channel.');
      const hold = channels.open(channel, {
        opened: () => undefined,
        event: (event) => {
          if (event.type !== 'action') return;
          const action = bag(bag(event.params).action);
          if (str(action.type) !== 'resourceWatch/changed') return;
          // `changes` is wrapped in `items` for forward compatibility, so it
          // is read through rather than treated as the array itself.
          observer(list(bag(action.changes).items).map((raw) => {
            const change = bag(raw);
            return { uri: str(change.uri) ?? '', kind: str(change.kind) ?? str(change.type) ?? 'changed' };
          }));
        },
      });
      // There is no dispose command. Releasing the last hold is what sends the
      // `unsubscribe` the host releases the watcher on.
      return { close: () => hold.release() };
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
      // Asking again is what a refresh is for. A refusal is remembered so that
      // moving the highlight does not re-ask a hundred times, and forgotten
      // here so that `r` is a way to try - which matters for the refusals that
      // are temporary, like a harness nobody had signed into yet.
      channels.forget();

      /*
       * The whole catalogue, in whatever pages the host chooses to give it.
       *
       * No `limit` is sent: the page size is the host's to pick, and a number
       * chosen here is a number only this client can see. What is followed is
       * `nextCursor`, which is the host saying there is more - this asked for
       * a hundred rows and dropped that sentence, so a catalogue of 123 showed
       * 100 and gave no sign the rest existed.
       */
      const rows: unknown[] = [];
      let cursor: string | undefined;
      let more = false;
      for (let page = 0; page < PAGES; page += 1) {
        const result = await client.request('listSessions', {
          channel: ROOT,
          ...(cursor === undefined ? {} : { cursor }),
        });
        rows.push(...list(result.items));
        cursor = str(result.nextCursor);
        if (cursor === undefined) break;
        more = page === PAGES - 1;
      }
      // Said rather than swallowed. Reaching this means a catalogue larger
      // than this client will walk in one go, and a list that stops without
      // saying so is the defect this replaced.
      if (more) {
        options.onLimit?.(`Showing the first ${rows.length} sessions; this host has more.`);
      }
      return rows.map(summary);
    },

    agents: async (): Promise<Agent[]> => list(mirror.root.agents).map((entry) => {
      const agent = bag(entry);
      return {
        provider: str(agent.provider) ?? str(agent.id) ?? 'unknown',
        displayName: str(agent.displayName) ?? str(agent.provider) ?? 'Agent',
        ...(str(agent.description) ? { description: str(agent.description) as string } : {}),
        ...(list(agent.protectedResources).length > 0
          ? {
            protectedResources: list(agent.protectedResources).map((raw) => {
              const one = bag(raw);
              return {
                resource: str(one.resource) ?? '',
                ...(str(one.description) ? { description: str(one.description) as string } : {}),
              };
            }).filter((one) => one.resource !== ''),
          }
          : {}),
        // A gate, not a hint. Absent means `createChat` must not be called.
        ...(bag(agent.capabilities).multipleChats !== undefined ? { multipleChats: true } : {}),
        // The same decoder a session's list goes through, because it is the
        // same shape - the protocol says these entries are augmented and
        // propagated into a session's own when one is created with this agent,
        // so two decoders would be two readings of one thing.
        ...(list(agent.customizations).length > 0
          ? { customizations: customizations(agent.customizations) }
          : {}),
        // The provider a model row carries is required and is always the
        // agent's own, so a host that has not filled it in yet - it was
        // missing until recently - is read as belonging to the agent it
        // arrived under rather than dropped for being incomplete.
        models: list(agent.models).map((raw) => {
          const row = model(raw);
          return row.provider === ''
            ? { ...row, provider: str(agent.provider) ?? str(agent.id) ?? '' }
            : row;
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
      /*
       * The client chooses the URI, which is what makes the session
       * addressable before the host has answered - and it is named after the
       * provider, because the scheme is how every other client decides which
       * provider a session belongs to.
       *
       * A session created as `ahp-session:/<uuid>` was one no other client
       * could open: the host echoes the creator's name into its catalogue, and
       * VS Code's window read the scheme, found no provider called
       * `ahp-session`, and drew the row without ever loading its conversation.
       */
      const resource = `${provider}:/${randomUUID()}`;
      // The channel *is* the new session's URI. `createSession` reads as a
      // root command and is not one: sending it to `ahp-root://` with the URI
      // beside it named a parameter the host has nothing called, so the
      // session was created - somewhere - and never at the URI we then went
      // on to subscribe to.
      /*
       * A token to report against.
       *
       * `root-channel.md` gives downloading an agent as the example, which is
       * exactly the wait this command can sit in: a harness that is not on the
       * machine yet is fetched before the session exists, and without a token
       * the host has nowhere to say so.
       */
      const progressToken = randomUUID();
      await client.request('createSession', {
        channel: resource,
        provider,
        progressToken,
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

    createAutomation: async (definition) => {
      const uri = `ahp-automation:/${randomUUID()}`;
      // A *request*, in the protocol's own spelling: the client says what it
      // wants and the host decides, then says what it actually holds with
      // `automation/set`. So nothing is echoed back here - what appears on the
      // screen is the host's answer arriving on the channel.
      client.dispatch(AUTOMATIONS, {
        type: 'automation/createRequested',
        resource: uri,
        definition,
      });
      return uri;
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

      let state: Bag = {};
      const hold = channels.open(uri, {
        opened: (fresh) => {
          // A reconnect too long for replay arrives here as well, which is
          // why this rebuilds rather than merges: the host's state is the
          // answer and the one held across the gap is a guess about it.
          if (fresh) state = fresh;
          if (live) observer(shape(state));
        },
        event: (event) => {
          if (event.type !== 'action') return;
          state = bag(ahp.terminalReducer(state, bag(event.params).action));
          if (live) observer(shape(state));
        },
        refused: (message) => options.onRefusal?.(uri, message),
      });

      return { close: () => { live = false; hold.release(); } };
    },

    writeTerminal: (uri, data) => {
      try {
        // Side-effect only: what comes back is `terminal/data`, once the shell
        // has actually said something. Echoing here would print every
        // keystroke twice on the client that typed it.
        client.dispatch(uri, { type: 'terminal/input', data });
      } catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    resizeTerminal: (uri, cols, rows) => {
      try { client.dispatch(uri, { type: 'terminal/resized', cols, rows }); }
      catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    clearTerminal: (uri) => {
      try { client.dispatch(uri, { type: 'terminal/cleared' }); }
      catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    renameTerminal: (uri, title) => {
      try { client.dispatch(uri, { type: 'terminal/titleChanged', title }); }
      catch (error) { options.onRefusal?.(uri, reason(error)); }
    },

    claimTerminal: (uri, claim) => {
      // Null gives it up. The reducer sets `claim` either way, so releasing is
      // the same action with nothing in it rather than a second one.
      try { client.dispatch(uri, { type: 'terminal/claimed', ...(claim === null ? {} : { claim }) }); }
      catch (error) { options.onRefusal?.(uri, reason(error)); }
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

    loadOlderTurns: loadOlder,

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
      channels.forget(uri);
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
      /** An action this client could not apply. Said once, and read on. */
      const bad = (message: string): void => {
        options.onRefusal?.(uri, message);
        if (live) observer({ type: 'error', message });
      };

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
        // Nothing is claimed about a conversation until the channel carrying
        // it has spoken. A session with no chat to follow has nothing to wait
        // for and emits at once.
        const following = wanted ?? str(session.defaultChat);
        if (following !== undefined && following !== '' && !listening) return;
        const all = transcript(chat);
        const active = all.find((found) => found.state === 'running');
        const asked = pendingInput(session, chat);
        const event: HostEvent = {
          type: 'snapshot',
          turns: all.filter((found) => found !== active),
          ...(active ? { active } : {}),
          ...(asked ? { input: asked as PendingInput } : {}),
          status: activityOf(
            typeof session.status === 'number' ? session.status : 1,
            Boolean(asked),
            active !== undefined,
            all[all.length - 1]?.state === 'failed',
          ),
          queued: queued(chat),
          // What the host is holding as the message being composed. Shared
          // state: another client typing here is visible, and it outlives
          // this one being restarted.
          draft: str(bag(chat.draft).text) ?? '',
        };
        observer(event);
      };

      /** Who the host says is in this session, so an unchanged list is not re-sent. */
      let present = '';
      const here = (): void => {
        const clients = list(session.activeClients).map((one) => {
          const found = bag(one);
          return {
            clientId: str(found.clientId) ?? '',
            ...(str(found.displayName) ? { displayName: str(found.displayName) as string } : {}),
          };
        });
        const now = JSON.stringify(clients);
        if (now === present) return;
        present = now;
        if (live) observer({ type: 'present', clients });
      };

      /** The chat channel, once the session has said which one it is. */
      let talking: { release(): void } | undefined;
      /**
       * Whether the chat this view follows has handed over its state.
       *
       * A session and its chat are two channels, and the session answers
       * first. Reporting a snapshot in between says "here is the
       * conversation" while holding none of it - which a screen survives,
       * because the chat arrives a moment later and it redraws, and a reader
       * that takes the first snapshot and stops does not. `session history`
       * is exactly that reader, and it printed nothing.
       */
      let listening = false;

      /**
       * Follow the session's chat.
       *
       * Called once the session state names one, and again after a reconnect
       * hands back a session state naming a different one - a client watching
       * a second chat is watching that chat, not the session's first.
       */
      const followChat = (): void => {
        const chatUri = wanted ?? str(session.defaultChat);
        if (!chatUri || !live) return;
        if (chats.get(uri) === chatUri && talking) return;
        talking?.release();
        chats.set(uri, chatUri);
        talking = channels.open(chatUri, {
          opened: (fresh) => {
            if (fresh) chat = fresh;
            listening = true;
            emit();
            /*
             * A window with nothing in it, and a cursor saying there is more.
             *
             * One host puts a tail of the conversation in the snapshot and one
             * puts none, and the second is not saying the chat is empty - it
             * is saying to ask. Without this, opening such a session shows a
             * blank transcript that no amount of waiting fills, and a person
             * has no reason to think scrolling up would do anything.
             *
             * Once, on opening, and only when the window is empty: a chat that
             * arrived with turns is one where reading further back is the
             * person's business rather than this client's.
             */
            if (!live) return;
            if (list(chat.turns).length > 0) return;
            if (str(chat.turnsNextCursor) === undefined) return;
            void loadOlder(uri, chatUri).catch(() => undefined);
          },
          event: (event) => {
            if (event.type !== 'action') return;
            chat = bag(applyAction(ahp.chatReducer, chat, bag(event.params).action, bad));
            emit();
          },
          refused: (message) => {
            // The conversation is not coming. Saying so is better than a
            // reader that waits for a snapshot which will never be emitted.
            listening = true;
            if (live) observer({ type: 'error', message });
          },
        });
        closers.push(() => talking?.release());
      };

      /*
       * Opening a session is somebody asking, so a refusal is not inherited.
       *
       * What is remembered is remembered so that *moving the highlight* does
       * not re-ask a hundred times - and that path reads snapshots rather
       * than opening views. A person pressing enter on a row has asked, and
       * some of what a host refuses is momentary: a session it was evicting
       * when the last question arrived answers the next one.
       */
      channels.forget(uri);
      const previous = chats.get(uri);
      if (previous !== undefined) channels.forget(previous);
      if (wanted !== undefined) channels.forget(wanted);

      const known = channels.refusal(uri);
      if (known !== undefined) {
        queueMicrotask(() => { if (live) observer({ type: 'error', message: known }); });
      }
      else {
        const held = channels.open(uri, {
          opened: (fresh) => {
            if (fresh) session = fresh;
            /*
             * Say this client is here.
             *
             * `SessionState.activeClients` is host-kept: a client adds or
             * refreshes itself with `session/activeClientSet` and the host
             * removes it when the last subscription goes, which this client
             * now sends. Without it two people on one session cannot see each
             * other, which is most of the reason a sessions server exists
             * rather than a local agent.
             *
             * `tools` is empty and required: this client contributes none,
             * and an absent list is not the same answer as an empty one.
             */
            client.dispatch(uri, {
              type: 'session/activeClientSet',
              activeClient: { clientId, displayName: 'ahpc', tools: [] },
            });
            here();
            chatsChanged();
            followChat();
            emit();
          },
          event: (event) => {
            if (event.type !== 'action') return;
            session = bag(applyAction(ahp.sessionReducer, session, bag(event.params).action, bad));
            // Separate from the snapshot below, which is the chat: these are the
            // session's, they change for reasons that have nothing to do with a
            // turn, and a panel that only re-read when it was opened showed a
            // switch that had been answered as though it had not.
            here();
            const items = customizations(session.customizations);
            const now = JSON.stringify(items);
            if (now !== contributed) {
              contributed = now;
              if (live) observer({ type: 'customizations', items });
            }
            chatsChanged();
            followChat();
            emit();
          },
          // The host answering "no" is not the host being gone. Marking the
          // connection offline over one dead session is how a person is sent
          // to check their network about a session whose agent simply exited.
          refused: (message) => { if (live) observer({ type: 'error', message }); },
        });
        closers.push(() => held.release());
      }

      return {
        close: () => {
          live = false;
          for (const close of closers) close();
        },
      };
    },

    /*
     * The model selection rides on the message, whole.
     *
     * `chat-channel.md` puts it there - a draft carries "its model/agent
     * selection" and `createChat`'s `initialMessage` carries "its own" - and
     * the schema says a client presents a model's `configSchema` as a form and
     * passes the resolved values in `ModelSelection.config`. Sending the id
     * alone made every one of those answers unsendable.
     */
    setDraft: (uri, text) => {
      // An empty draft is `undefined`, not an empty message: the protocol
      // clears the field rather than holding a message with nothing in it.
      dispatch(uri, {
        type: 'chat/draftChanged',
        ...(text === '' ? {} : { draft: { text, origin: { kind: 'user' } } }),
      });
    },

    say: (uri, text, model) => {
      dispatch(uri, {
        type: 'chat/turnStarted',
        turnId: randomUUID(),
        startedAt: new Date().toISOString(),
        message: {
          text,
          origin: { kind: 'user' },
          ...(model ? { model: selectionOf(model) } : {}),
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
          ...(model ? { model: selectionOf(model) } : {}),
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
      /*
       * The last turn that recorded one, and the session's own after that.
       *
       * This used to test `str(message.model)` - a string test against an
       * object - so it matched nothing a host has ever sent and the pane said
       * "nothing said yet" against every host there is. `SessionState.model`
       * is the fallback and is a *private extension*: no version of the
       * protocol declares it, and the one host known to send it means the
       * session's current model by it. Read last, and read as a string,
       * because that is all that can be assumed of a field the specification
       * does not have - including that the next host to send it means the
       * same thing.
       *
       * Both spellings, and both for good. `_meta` is where an extension
       * belongs and the host that sends this one is moving it there; the bare
       * field is what every copy of that host already deployed still sends,
       * and reading only the new name would break against all of them to save
       * one `??`.
       */
      const ran = [...list(talking.turns), talking.activeTurn]
        .map(bag)
        .reverse()
        .map((found) => selection(bag(found.message).model, found.usage))
        .find((found) => found !== undefined);
      const last = ran?.id ?? str(bag(state._meta).model) ?? str(state.model);

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
        ...(channels.refusal(uri) !== undefined ? { refusal: channels.refusal(uri) as string } : {}),
        config: config(state.config),
        ...(last !== undefined ? { model: known(last) } : {}),
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
      finished = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      channels.detach();
      await client.shutdown();
    },
  };
}
