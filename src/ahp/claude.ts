import { randomUUID } from 'node:crypto';
import type { HostConnection, HostEvent } from './connection.js';
import type {
  Agent, Answer, Changeset, ChatInputRequest, ContentRef, Customization, FileContent,
  PendingInput, Question, ResponsePart, SessionConfig, SessionDetail, SessionSummary,
  SessionUri, ToolCall, ToolConfirmation, Turn,
} from './types.js';
import { SessionFlag } from './types.js';

/**
 * The third implementation of the seam: Claude Code, in this process.
 *
 * `fakeHost` is a script, `liveHost` is a socket to somebody's editor, and this
 * is the agent itself - the Claude Agent SDK, which is Claude Code as a
 * library. Nothing above `HostConnection` can tell the three apart, which is
 * the whole point of the seam and the reason this file is worth having: the
 * screens that drive an editor's agent drive a local one unchanged.
 *
 * **It is not a host, and the difference is the interesting part.** AHP's
 * model is a sessions server - several clients watch and drive the same
 * sessions and none of them owns the process running the agent. The SDK's
 * model is the opposite: this process spawns the CLI and owns it alone. So a
 * handful of things AHP assumes have no answer here, and they are refused
 * rather than faked:
 *
 * - **The queue is the host's** (`chat/pendingMessageSet`), and there is no
 *   host to hold one. A queue kept here would be a list only this client could
 *   ever send, which is the failure `connection.ts` warns about.
 * - **A changeset** is something the host computes. The SDK has file
 *   checkpointing, which is not a diff stream.
 * - **`onSessions`** is the catalogue moving underneath you because somebody
 *   else changed it. Nobody else is here.
 *
 * Each refusal is deliberate. They are the list of things an AHP host built on
 * this would have to supply itself, and a fake would hide exactly that.
 *
 * The read and archived flags are different, and are *not* refused: AHP calls
 * them client flags, and a single-client host holding them in memory is
 * telling the truth. They die with the process, which is what a single client
 * means.
 *
 * The SDK is an **optional** dependency, for the same reason the protocol
 * package is - the example has to run, and be checked, with nothing installed:
 *
 * ```
 * pnpm --filter @textui/example-chat add @anthropic-ai/claude-agent-sdk
 * ```
 *
 * Written against `@anthropic-ai/claude-agent-sdk` 0.3.250, from the package's
 * own `sdk.d.ts`. Types are declared here rather than imported for that same
 * reason, and because what this needs is a narrow subset of a very wide
 * surface.
 */

export interface ClaudeHostOptions {
  /**
   * Where the agent works.
   *
   * The SDK spawns the CLI as a child of *this* process, so unlike a live
   * host's working directory this is a path on this machine - the one place
   * the two hosts genuinely differ, and why `--path` defaults to
   * `process.cwd()` here and to nothing at all against `--host`.
   *
   * It also decides which sessions exist: the SDK keys its transcripts by
   * working directory, so this is what `listSessions` is a catalogue *of*.
   */
  path: string;
  /** What a turn runs on, when the composer has not said. */
  model?: string;
  /**
   * Told when this host will not do something, in its own words.
   *
   * The queue, changesets and the catalogue stream are the whole list, and
   * every one of them is a thing an AHP host would have to supply. Reporting
   * them is how they stay visible instead of looking like a client bug.
   */
  onRefusal?(uri: string, message: string): void;
}

export class MissingAgentSdk extends Error {
  constructor() {
    super('A Claude host needs @anthropic-ai/claude-agent-sdk. Install it in this example:\n'
      + '  pnpm --filter @textui/example-chat add @anthropic-ai/claude-agent-sdk\n'
      + 'Or leave --claude off and drive the scripted one.');
    this.name = 'MissingAgentSdk';
  }
}

// ------------------------------------------------------- the surface it needs

/** One frame pushed into a running query. The SDK's `SDKUserMessage`. */
interface UserFrame {
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
}

type PermissionResult =
  | { behavior: 'allow'; updatedInput: Record<string, unknown> }
  | { behavior: 'deny'; message: string };

interface QueryHandle extends AsyncIterable<Record<string, unknown>> {
  interrupt(): Promise<unknown>;
  setPermissionMode(mode: string): Promise<void>;
  setModel(model?: string): Promise<void>;
  supportedModels(): Promise<{ id?: string; displayName?: string }[]>;
  streamInput(stream: AsyncIterable<UserFrame>): Promise<void>;
  close(): void;
}

interface SdkSessionInfo {
  sessionId: string;
  summary?: string;
  lastModified: number;
  customTitle?: string;
  firstPrompt?: string;
  cwd?: string;
  createdAt?: number;
}

interface Loaded {
  query(args: {
    prompt: AsyncIterable<UserFrame>;
    options: Record<string, unknown>;
  }): QueryHandle;
  /**
   * `dir`, and it matters: the option that scopes a listing to one project is
   * spelled `dir` while the one that puts a *query* somewhere is `cwd`. An
   * unrecognised key is not an error here - it is ignored, and an unscoped
   * `listSessions` answers with every session on the machine. So the wrong
   * spelling reads as a working catalogue right up until you notice it lists
   * the sessions of every project you have ever opened.
   */
  listSessions(options?: { dir?: string }): Promise<SdkSessionInfo[]>;
  getSessionMessages(id: string, options?: { dir?: string }): Promise<Record<string, unknown>[]>;
}

async function load(): Promise<Loaded> {
  const base: string = '@anthropic-ai/claude-agent-sdk';
  try {
    const sdk = await import(base) as Record<string, never>;
    return {
      query: sdk.query as unknown as Loaded['query'],
      listSessions: sdk.listSessions as unknown as Loaded['listSessions'],
      getSessionMessages: sdk.getSessionMessages as unknown as Loaded['getSessionMessages'],
    };
  } catch (error) {
    if (error instanceof Error && /Cannot find (module|package)/.test(error.message)) {
      throw new MissingAgentSdk();
    }
    throw error;
  }
}

// ------------------------------------------------------------- reading frames

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag => (typeof value === 'object' && value !== null ? value as Bag : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * What a tool call is *about*, in one line.
 *
 * The only thing separating twenty identical rows, so it is worth doing per
 * tool rather than printing the whole input object: `Bash` is its command,
 * the file tools are their path, and anything else is its arguments. A row
 * reading `{"file_path":"/very/long/…","offset":0,"limit":2000}` is a row
 * nobody reads.
 */
function summarize(name: string, input: Bag): string | undefined {
  if (name === 'Bash') return str(input.command);
  if (name === 'Read' || name === 'Write' || name === 'Edit') return str(input.file_path);
  if (name === 'Glob' || name === 'Grep') return str(input.pattern);
  if (name === 'Task' || name === 'Agent') return str(input.description);
  const keys = Object.keys(input);
  if (keys.length === 0) return undefined;
  return JSON.stringify(input).slice(0, 400);
}

/** A `tool_result` block's content, which is a string or a list of blocks. */
function resultText(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  const parts = list(content)
    .map((block) => str(bag(block).text))
    .filter((text): text is string => text !== undefined);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

// --------------------------------------------------------------- the host

/** What this host can be told to do differently. Everything else is the CLI's. */
const CONFIG: SessionConfig['properties'] = [
  {
    key: 'permissionMode',
    title: 'Permissions',
    description: 'How much the agent may do before it asks.',
    sessionMutable: true,
    values: [
      { value: 'default', label: 'Ask each time', description: 'Every tool call is confirmed' },
      { value: 'acceptEdits', label: 'Accept edits', description: 'File edits run; commands still ask' },
      { value: 'plan', label: 'Plan only', description: 'Read and reason, change nothing' },
      { value: 'bypassPermissions', label: 'Bypass', description: 'Nothing is confirmed' },
    ],
  },
];

interface Run {
  /** The SDK's own id, once `init` has said what it is. Resume uses this. */
  sdkId?: string;
  handle: QueryHandle;
  /** Pushes a message into the running query. */
  send(text: string): void;
  /** Ends the input stream, which ends the query. */
  stop(): void;
  /** The turn being built, held by reference - the reducer redraws what it has. */
  active?: Turn;
  /**
   * Open parts, by two different keys and deliberately so.
   *
   * A tool call is filed under its own id, because the `tool_result` that
   * completes it arrives in a later frame and names that id. Text and
   * reasoning have no id, so they are filed under the message they belong to
   * and their index in it - `#<message>:<index>`. Indexing on position alone
   * collides on the second assistant message of a turn, which is the ordinary
   * case the moment a tool runs.
   */
  parts: Map<string, ResponsePart>;
  /** The message the stream events are currently inside. */
  streaming?: string;
  /** Answered by `confirmToolCall` or `completeInput`. */
  pending?: {
    input: PendingInput;
    /** The `AskUserQuestion` payload, which has to be echoed back verbatim. */
    questions?: unknown[];
    /** Question id to the question text the SDK keys answers by. */
    asked: Map<string, string>;
    settle(result: PermissionResult): void;
  };
  failed?: string;
}

/**
 * What the CLI said at the handshake, per session.
 *
 * Module scope rather than a field on the run, because `customizations` is
 * asked about a session that may have no run and the answer is still the last
 * thing the CLI said about it.
 */
const handshakes = new Map<SessionUri, Bag>();

export async function claudeHost(options: ClaudeHostOptions): Promise<HostConnection> {
  const sdk = await load();
  const cwd = options.path;

  const runs = new Map<SessionUri, Run>();
  const observers = new Map<SessionUri, Set<(event: HostEvent) => void>>();
  const turns = new Map<SessionUri, Turn[]>();
  const titles = new Map<SessionUri, string>();
  const configs = new Map<SessionUri, Record<string, string>>();
  const models = new Map<SessionUri, string>();
  /** The SDK's id to the uri we minted, so a listing does not double a row. */
  const bySdkId = new Map<string, SessionUri>();
  /**
   * `IsRead` and `IsArchived`, in memory.
   *
   * Client flags, which is exactly what AHP calls them - so a single-client
   * host holding them here is not a shortcut. They do not outlive the process,
   * because nothing else was ever going to read them.
   */
  const flags = new Map<SessionUri, number>();

  let counter = 0;
  const nextId = (prefix: string): string => `${prefix}${++counter}`;

  const emit = (uri: SessionUri, event: HostEvent): void => {
    for (const observer of observers.get(uri) ?? []) observer(event);
  };

  const refuse = (uri: string, message: string): void => {
    options.onRefusal?.(uri, message);
    emit(uri, { type: 'error', message });
  };

  /**
   * Derived, never assigned.
   *
   * There is no host sending a bitset, so it is computed from what this file
   * is actually holding: a promise nobody has settled is `InputNeeded`, a
   * turn being built is `InProgress`, and anything else is idle. A status that
   * could be set independently of the run is a session that says "waiting on
   * you" with nothing waiting.
   */
  const statusOf = (uri: SessionUri): number => {
    const run = runs.get(uri);
    const activity = run?.pending ? SessionFlag.InputNeeded
      : run?.active ? SessionFlag.InProgress
        : run?.failed ? SessionFlag.Error
          : SessionFlag.Idle;
    return activity | (flags.get(uri) ?? 0);
  };

  const touch = (uri: SessionUri): void => {
    emit(uri, { type: 'status', status: statusOf(uri) });
  };

  const setFlag = (uri: SessionUri, flag: number, on: boolean): void => {
    const now = flags.get(uri) ?? 0;
    flags.set(uri, on ? now | flag : now & ~flag);
    touch(uri);
  };

  // ------------------------------------------------------------ translation

  /**
   * One assistant frame, folded into the turn being built.
   *
   * The parts are mutated on the turn the client already holds and the event
   * is what makes the write visible - `state.ts` is explicit that rebuilding
   * the list is what changes identity, so a new Turn object per frame would
   * make the transcript flicker and lose the scroll.
   */
  const opened = (uri: SessionUri, run: Run): Turn => {
    const held = run.active;
    if (held) return held;
    const turn: Turn = {
      id: nextId('turn'),
      role: 'agent',
      parts: [],
      state: 'running',
      at: new Date().toISOString(),
      ...(models.get(uri) ? { model: models.get(uri) as string } : {}),
    };
    run.active = turn;
    turns.set(uri, [...(turns.get(uri) ?? []), turn]);
    emit(uri, { type: 'turnStarted', turn });
    return turn;
  };

  const assistant = (uri: SessionUri, run: Run, message: Bag): void => {
    const turn = opened(uri, run);
    const of = str(message.id) ?? 'm';
    const blocks = list(message.content);
    for (let index = 0; index < blocks.length; index++) {
      const block = bag(blocks[index]);
      const kind = str(block.type);
      const id = str(block.id) ?? `${of}:${index}`;

      if (kind === 'text' || kind === 'thinking') {
        // The deltas already opened this and already filled it: the streamed
        // text is what is on screen, and writing the complete block on top of
        // it prints the whole answer twice. Same key both ways, or the
        // duplicate is what ships.
        if (run.parts.has(`#${of}:${index}`)) continue;
        const text = str(block.text) ?? str(block.thinking) ?? '';
        const part: ResponsePart = kind === 'text'
          ? { kind: 'markdown', id, content: text }
          : { kind: 'reasoning', id, content: text };
        run.parts.set(`#${of}:${index}`, part);
        turn.parts.push(part);
        emit(uri, { type: 'delta', partId: id, kind: kind === 'text' ? 'markdown' : 'reasoning', text });
        continue;
      }

      if (kind === 'tool_use') {
        const name = str(block.name) ?? 'tool';
        const call: ToolCall = {
          id,
          name,
          toolName: name,
          status: 'running',
          ...(summarize(name, bag(block.input)) ? { input: summarize(name, bag(block.input)) as string } : {}),
        };
        const part: ResponsePart = { kind: 'toolCall', id, call };
        run.parts.set(id, part);
        turn.parts.push(part);
        emit(uri, { type: 'toolCall', call });
      }
    }
  };

  /**
   * A user frame, which is where tool results arrive.
   *
   * The SDK reports a call finishing by sending back a user message carrying
   * `tool_result`, so the row that is already on screen is completed in place
   * rather than a second row appearing under it.
   */
  const results = (uri: SessionUri, run: Run, message: Bag): void => {
    for (const raw of list(message.content)) {
      const block = bag(raw);
      if (str(block.type) !== 'tool_result') continue;
      const id = str(block.tool_use_id);
      if (!id) continue;
      const part = run.parts.get(id);
      if (!part || part.kind !== 'toolCall') continue;
      part.call.status = block.is_error === true ? 'failed' : 'completed';
      const text = resultText(block.content);
      if (text !== undefined) part.call.output = text;
      emit(uri, { type: 'toolCall', call: part.call });
    }
  };

  /** A streaming event. Only the deltas matter; the rest is bookkeeping. */
  const streamed = (uri: SessionUri, run: Run, event: Bag): void => {
    const type = str(event.type);

    // The stream is what arrives *first*. A turn opened only on the complete
    // assistant message is a turn that opens after everything it was supposed
    // to stream into it, so every delta lands on nothing and the transcript
    // fills in one jump at the end.
    if (type === 'message_start') {
      run.streaming = str(bag(event.message).id) ?? 'm';
      opened(uri, run);
      return;
    }

    const of = run.streaming ?? 'm';
    const key = `#${of}:${String(event.index)}`;

    if (type === 'content_block_start') {
      const turn = opened(uri, run);
      const block = bag(event.content_block);
      const kind = str(block.type);
      // Only prose streams into a part. A tool call's arguments stream as
      // json, and a row that redraws per keystroke of a json blob is a row
      // that costs a frame each and says nothing until it is complete.
      if (kind !== 'text' && kind !== 'thinking') return;
      if (run.parts.has(key)) return;
      const part: ResponsePart = kind === 'text'
        ? { kind: 'markdown', id: `${of}:${String(event.index)}`, content: '' }
        : { kind: 'reasoning', id: `${of}:${String(event.index)}`, content: '' };
      run.parts.set(key, part);
      turn.parts.push(part);
      return;
    }

    if (type === 'content_block_delta') {
      // A delta names the block's position in its message and nothing else,
      // so it is found under the message and index `content_block_start`
      // filed it under.
      const part = run.parts.get(key);
      if (!part || part.kind === 'toolCall') return;
      const delta = bag(event.delta);
      const text = str(delta.text) ?? str(delta.thinking);
      if (text === undefined) return;
      part.content += text;
      emit(uri, {
        type: 'delta',
        partId: part.id,
        kind: part.kind === 'reasoning' ? 'reasoning' : 'markdown',
        text,
      });
    }
  };

  // ---------------------------------------------------------- asking a person

  /**
   * The agent wants something, and it comes through one callback either way.
   *
   * `canUseTool` fires for a tool that needs approving *and* for
   * `AskUserQuestion`, and the two are nothing alike - which is the same
   * distinction `PendingInput` already makes. Rendering the question as a
   * confirmation loses the entire request, so it is split here, at the only
   * point where the difference is still visible.
   */
  const asked = (uri: SessionUri, run: Run) =>
    (toolName: string, input: Bag): Promise<PermissionResult> =>
      new Promise<PermissionResult>((settle) => {
        const id = nextId('req');

        if (toolName === 'AskUserQuestion') {
          const raw = list(input.questions);
          const map = new Map<string, string>();
          const questions: Question[] = raw.map((entry, index) => {
            const question = bag(entry);
            const key = `q${index + 1}`;
            const text = str(question.question) ?? '';
            map.set(key, text);
            return {
              id: key,
              kind: question.multiSelect === true ? 'multi-select' : 'single-select',
              message: text,
              required: true,
              options: list(question.options).map((option) => {
                const choice = bag(option);
                const label = str(choice.label) ?? '';
                // The label is the id, because the label is what the SDK
                // wants back: answers are keyed by question text and valued
                // by the option's own label, not by any id of ours.
                return { id: label, label: str(choice.description) ? `${label} - ${str(choice.description)}` : label };
              }),
              allowFreeformInput: true,
            };
          });
          const request: ChatInputRequest = {
            kind: 'chatInput',
            id,
            message: str(input.header) ?? 'The agent has a question',
            questions,
          };
          run.pending = { input: request, questions: raw, asked: map, settle };
          emit(uri, { type: 'inputNeeded', input: request });
          touch(uri);
          return;
        }

        const call: ToolCall = {
          id,
          name: toolName,
          toolName,
          status: 'pending-confirmation',
          confirmationTitle: `Run ${toolName}?`,
          ...(summarize(toolName, input) ? { input: summarize(toolName, input) as string } : {}),
        };
        const confirmation: ToolConfirmation = { kind: 'toolConfirmation', id, call };
        run.pending = {
          input: confirmation,
          asked: new Map(),
          settle: (result) => settle(result.behavior === 'allow'
            ? { behavior: 'allow', updatedInput: input }
            : result),
        };
        emit(uri, { type: 'inputNeeded', input: confirmation });
        touch(uri);
      });

  // ------------------------------------------------------------- running one

  /**
   * Start the CLI for a session, and drain what it says.
   *
   * Lazily, on the first thing said rather than on subscribe: a query is a
   * subprocess, and opening a session to read it is not a reason to spawn one.
   */
  const start = (uri: SessionUri): Run => {
    const held = runs.get(uri);
    if (held) return held;

    const waiting: UserFrame[] = [];
    let wake: (() => void) | undefined;
    let closed = false;

    async function* input(): AsyncGenerator<UserFrame> {
      for (;;) {
        while (waiting.length > 0) yield waiting.shift() as UserFrame;
        if (closed) return;
        await new Promise<void>((resolve) => { wake = resolve; });
      }
    }

    const resume = bySdkId.get(uri.replace('ahp-session:/', '')) === uri
      ? uri.replace('ahp-session:/', '')
      : undefined;

    const run: Run = {
      handle: undefined as unknown as QueryHandle,
      parts: new Map(),
      send: (text) => {
        waiting.push({ type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null });
        wake?.();
        wake = undefined;
      },
      stop: () => { closed = true; wake?.(); wake = undefined; },
    };
    if (resume) run.sdkId = resume;

    run.handle = sdk.query({
      prompt: input(),
      options: {
        cwd,
        includePartialMessages: true,
        ...(options.model ? { model: options.model } : {}),
        ...(models.get(uri) ? { model: models.get(uri) as string } : {}),
        ...(resume ? { resume } : {}),
        ...(configs.get(uri)?.permissionMode ? { permissionMode: configs.get(uri)?.permissionMode } : {}),
        canUseTool: asked(uri, run),
      },
    });

    runs.set(uri, run);
    void drain(uri, run);
    return run;
  };

  /** The loop. Everything the client sees comes out of here. */
  const drain = async (uri: SessionUri, run: Run): Promise<void> => {
    try {
      for await (const raw of run.handle) {
        const message = bag(raw);
        const type = str(message.type);

        if (type === 'system' && str(message.subtype) === 'init') {
          const id = str(message.session_id);
          if (id) { run.sdkId = id; bySdkId.set(id, uri); }
          // What this session was handed. Kept because `customizations` is
          // asked about it later, and the handshake is the only time the CLI
          // says it.
          handshakes.set(uri, message);
          continue;
        }

        if (type === 'stream_event') { streamed(uri, run, bag(message.event)); continue; }

        if (type === 'assistant') { assistant(uri, run, bag(message.message)); continue; }

        if (type === 'user') { results(uri, run, bag(message.message)); continue; }

        if (type === 'result') {
          const turn = run.active;
          if (turn) {
            turn.state = str(message.subtype) === 'success' ? 'complete' : 'failed';
            if (typeof message.duration_ms === 'number') turn.elapsedMs = message.duration_ms;
            run.active = undefined;
            run.parts.clear();
            run.streaming = undefined;
            emit(uri, { type: 'turnComplete', turn });
          }
          if (message.is_error === true) {
            run.failed = list(message.errors).map((e) => String(e)).join('\n') || 'The turn failed';
            emit(uri, { type: 'error', message: run.failed });
          }
          touch(uri);
        }
      }
    } catch (error) {
      run.failed = error instanceof Error ? error.message : String(error);
      const turn = run.active;
      if (turn) {
        turn.state = 'failed';
        run.active = undefined;
        emit(uri, { type: 'turnComplete', turn });
      }
      emit(uri, { type: 'error', message: run.failed });
      touch(uri);
    }
  };

  /**
   * A session's history, read off disk.
   *
   * Opening a past session should show what was said in it, and the SDK keeps
   * the transcript rather than the reduced turns - so this walks the same
   * blocks the live path walks, into one agent turn per assistant message.
   * Best effort on purpose: a transcript this cannot read is a session that
   * opens empty, not one that will not open.
   */
  const history = async (uri: SessionUri): Promise<Turn[]> => {
    const held = turns.get(uri);
    if (held) return held;
    const id = uri.replace('ahp-session:/', '');
    let built: Turn[] = [];
    try {
      const messages = await sdk.getSessionMessages(id, { dir: cwd });
      const calls = new Map<string, ToolCall>();
      for (const entry of messages) {
        const frame = bag(entry);
        const message = bag(frame.message);
        const role = str(frame.type);
        const blocks = list(message.content);
        const parts: ResponsePart[] = [];

        for (let index = 0; index < blocks.length; index++) {
          const block = bag(blocks[index]);
          const kind = str(block.type);
          const partId = str(block.id) ?? `${str(frame.uuid) ?? 'h'}:${index}`;
          if (kind === 'text' && role === 'assistant') {
            parts.push({ kind: 'markdown', id: partId, content: str(block.text) ?? '' });
          } else if (kind === 'thinking') {
            parts.push({ kind: 'reasoning', id: partId, content: str(block.thinking) ?? '' });
          } else if (kind === 'tool_use') {
            const name = str(block.name) ?? 'tool';
            const call: ToolCall = {
              id: partId,
              name,
              toolName: name,
              status: 'completed',
              ...(summarize(name, bag(block.input)) ? { input: summarize(name, bag(block.input)) as string } : {}),
            };
            calls.set(partId, call);
            parts.push({ kind: 'toolCall', id: partId, call });
          } else if (kind === 'tool_result') {
            const call = calls.get(str(block.tool_use_id) ?? '');
            if (call) {
              call.status = block.is_error === true ? 'failed' : 'completed';
              const text = resultText(block.content);
              if (text !== undefined) call.output = text;
            }
          }
        }

        if (role === 'user') {
          const said = typeof message.content === 'string'
            ? message.content
            : list(message.content).map((b) => str(bag(b).text)).filter(Boolean).join('\n');
          // A user frame carrying only tool results is the SDK reporting a
          // call finishing, not somebody saying something. Turning it into a
          // bubble puts the agent's own tool output in the person's voice.
          if (!said) continue;
          built.push({
            id: str(frame.uuid) ?? nextId('turn'),
            role: 'user',
            message: said,
            parts: [],
            state: 'complete',
            at: new Date().toISOString(),
          });
          continue;
        }
        if (role === 'assistant' && parts.length > 0) {
          built.push({
            id: str(frame.uuid) ?? nextId('turn'),
            role: 'agent',
            parts,
            state: 'complete',
            at: new Date().toISOString(),
          });
        }
      }
    } catch {
      // A transcript that will not read is an empty session, not a refusal:
      // the catalogue said it exists and the catalogue is right.
      built = [];
    }
    turns.set(uri, built);
    return built;
  };

  const summaryOf = (info: SdkSessionInfo): SessionSummary => {
    const uri = bySdkId.get(info.sessionId) ?? `ahp-session:/${info.sessionId}`;
    bySdkId.set(info.sessionId, uri);
    const title = titles.get(uri) ?? info.customTitle ?? info.summary ?? info.firstPrompt ?? 'Session';
    return {
      resource: uri,
      provider: 'claude',
      title,
      status: statusOf(uri),
      createdAt: new Date(info.createdAt ?? info.lastModified).toISOString(),
      modifiedAt: new Date(info.lastModified).toISOString(),
      workingDirectories: info.cwd ? [`file://${info.cwd}`] : [`file://${cwd}`],
    };
  };

  // --------------------------------------------------------------- connection

  return {
    id: 'claude',
    url: `claude://${cwd}`,
    // In-process. There is no socket to lose, so claiming anything else would
    // be a badge that can never change.
    state: () => 'connected',

    listSessions: async () => {
      const found = await sdk.listSessions({ dir: cwd });
      const known = found.map(summaryOf);
      // Sessions started in this process that have not been written yet are
      // real and are not on disk. A catalogue that dropped them would lose
      // the session somebody is looking at.
      for (const [uri] of runs) {
        if (known.some((session) => session.resource === uri)) continue;
        known.push({
          resource: uri,
          provider: 'claude',
          title: titles.get(uri) ?? 'New session',
          status: statusOf(uri),
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          workingDirectories: [`file://${cwd}`],
        });
      }
      return known;
    },

    agents: async (): Promise<Agent[]> => {
      const run = [...runs.values()][0];
      // No models until something is running, and that is a real answer
      // rather than a failure - the SDK enumerates what the CLI offers, and
      // nothing has asked the CLI yet. Same shape a host gives for a harness
      // nobody has signed into.
      let offered: { id: string; displayName: string }[] = [];
      if (run) {
        try {
          offered = (await run.handle.supportedModels())
            .map((model) => ({ id: model.id ?? '', displayName: model.displayName ?? model.id ?? '' }))
            .filter((model) => model.id !== '');
        } catch { offered = []; }
      }
      return [{
        provider: 'claude',
        displayName: 'Claude Code',
        description: `The Agent SDK, in this process, on ${cwd}`,
        models: offered,
      }];
    },

    resolveConfig: async ({ values }): Promise<SessionConfig> => ({
      properties: CONFIG,
      values: { permissionMode: 'default', ...values },
    }),

    createSession: async ({ workingDirectory, config: values }) => {
      // A uri before there is a session, the way the live host does it: the
      // SDK has no id until `init`, and the client needs something
      // addressable to subscribe to now. `init` binds the two.
      const uri = `ahp-session:/${randomUUID()}`;
      if (values) configs.set(uri, values);
      turns.set(uri, []);
      if (workingDirectory && workingDirectory !== cwd) {
        refuse(uri, `This host works in ${cwd}. A session elsewhere needs another --path.`);
      }
      start(uri);
      return uri;
    },

    disposeSession: async (uri) => {
      const run = runs.get(uri);
      run?.stop();
      run?.handle.close();
      runs.delete(uri);
      turns.delete(uri);
      flags.delete(uri);
    },

    setArchived: (uri, archived) => setFlag(uri, SessionFlag.IsArchived, archived),
    setRead: (uri, read) => setFlag(uri, SessionFlag.IsRead, read),

    /**
     * Nothing else is here to move the catalogue.
     *
     * A live host broadcasts because several clients share its sessions. This
     * process is the only one driving these, so the only thing that changes
     * the catalogue is this client - and it already knows.
     */
    onSessions: () => ({ close: () => {} }),

    /**
     * A snapshot, then what happens - and the snapshot is not a promise.
     *
     * Subscribing has to answer *now*, with whatever is held. Reading the
     * transcript off disk is I/O, so a subscribe that waited for it would
     * hand every consumer an empty session first and fill it a tick later:
     * a flash of nothing on every open, and in a still, which cannot await,
     * a session that is permanently empty.
     *
     * So the held turns go out synchronously, and a transcript that had to be
     * read arrives as a second snapshot. A host revising what it just said is
     * ordinary; a host answering late is not.
     */
    subscribe: (uri, observer) => {
      let set = observers.get(uri);
      if (!set) { set = new Set(); observers.set(uri, set); }
      set.add(observer);

      const snapshot = (held: Turn[]): void => {
        const run = runs.get(uri);
        observer({
          type: 'snapshot',
          turns: held.filter((turn) => turn !== run?.active),
          ...(run?.active ? { active: run.active } : {}),
          ...(run?.pending ? { input: run.pending.input } : {}),
          status: statusOf(uri),
          queued: [],
        });
      };

      const held = turns.get(uri);
      snapshot(held ?? []);
      // Only when there is nothing yet: re-reading the transcript over a
      // conversation this process is driving would replace live turns with a
      // stale copy of them.
      if (!held) void history(uri).then(snapshot);

      return { close: () => { set?.delete(observer); } };
    },

    say: (uri, text, model) => {
      if (model) models.set(uri, model);
      const run = start(uri);
      const turn: Turn = {
        id: nextId('turn'),
        role: 'user',
        message: text,
        parts: [],
        state: 'complete',
        at: new Date().toISOString(),
      };
      turns.set(uri, [...(turns.get(uri) ?? []), turn]);
      emit(uri, { type: 'turnStarted', turn });
      if (!titles.has(uri)) titles.set(uri, text.slice(0, 60));
      run.send(text);
      touch(uri);
    },

    /**
     * The queue is the host's, and there is no host.
     *
     * `queuedMessages` lives on the chat so that every client watching sees
     * the same list and the server starts the next turn from its head. Holding
     * one here would be a list only this client could send, which is the
     * failure `connection.ts` names. A host built on this would have to own it.
     */
    queue: (uri) => {
      refuse(uri, 'This host has no queue. Wait for the turn, or stop it and say it again.');
    },
    unqueue: (uri) => {
      refuse(uri, 'This host has no queue.');
    },

    stopTurn: (uri) => {
      const run = runs.get(uri);
      if (!run) return;
      // A turn blocked on a person is stopped by answering no, not by leaving
      // a promise nobody will ever settle - the subprocess would sit there.
      run.pending?.settle({ behavior: 'deny', message: 'The turn was stopped' });
      run.pending = undefined;
      emit(uri, { type: 'inputResolved' });
      void run.handle.interrupt().catch(() => {});
      touch(uri);
    },

    confirmToolCall: (uri, toolCallId, approved) => {
      const run = runs.get(uri);
      const pending = run?.pending;
      if (!run || !pending || pending.input.kind !== 'toolConfirmation') return;
      if (pending.input.call.id !== toolCallId) return;
      run.pending = undefined;
      emit(uri, { type: 'inputResolved' });
      pending.settle(approved
        ? { behavior: 'allow', updatedInput: {} }
        : { behavior: 'deny', message: 'The person declined this action' });
      touch(uri);
    },

    /**
     * Answer the question, in the shape the tool wants it back.
     *
     * `AskUserQuestion` is answered by allowing the call with the questions
     * echoed verbatim and an `answers` object keyed by each question's own
     * text - not by any id. Sending back ids, or dropping `questions`, is a
     * call the tool cannot process and a turn that stalls rather than errors.
     */
    completeInput: (uri, requestId, accepted, answers: Record<string, Answer>) => {
      const run = runs.get(uri);
      const pending = run?.pending;
      if (!run || !pending || pending.input.id !== requestId) return;
      run.pending = undefined;
      emit(uri, { type: 'inputResolved' });

      if (!accepted) {
        pending.settle({ behavior: 'deny', message: 'The person declined to answer' });
        touch(uri);
        return;
      }

      const said: Record<string, string | string[]> = {};
      for (const [key, answer] of Object.entries(answers)) {
        const question = pending.asked.get(key);
        if (!question) continue;
        // Freeform is the person's own words as the value, not the word
        // "Other" - the tool reads the value as the answer itself.
        said[question] = answer.kind === 'selected-many' ? answer.value
          : answer.kind === 'selected' ? answer.value
            : answer.kind === 'boolean' ? String(answer.value)
              : answer.kind === 'number' ? String(answer.value)
                : answer.value;
      }
      pending.settle({
        behavior: 'allow',
        updatedInput: { questions: pending.questions ?? [], answers: said },
      });
      touch(uri);
    },

    /**
     * A changeset is the host's arithmetic, and this host does none.
     *
     * The SDK checkpoints files, which is a way to put them back - not a diff
     * stream with a status and a per-file footprint. Answering with an empty
     * complete changeset would say the agent changed nothing, so the refusal
     * is reported and the list is left honestly empty.
     */
    changes: async (uri): Promise<Changeset> => {
      refuse(uri, 'This host does not compute a changeset. Read the diff in the working tree.');
      return { status: 'complete', files: [] };
    },

    content: async (ref: ContentRef): Promise<FileContent> => {
      throw new Error(`This host has no changeset, so nothing points at ${ref.uri}`);
    },

    /**
     * What the CLI said it was given, from the handshake.
     *
     * `init` carries the skills, plugins, MCP servers and commands in force
     * for this session, which is the same question AHP answers per session and
     * for the same reason: two sessions in different directories are handed
     * different things.
     */
    customizations: async (uri): Promise<Customization[]> => {
      const found: Customization[] = [];
      const seen = handshakes.get(uri);
      // Nothing has run, so nothing has been handed anything. An empty list is
      // the true answer, not a session that is still loading.
      if (!seen) return [];
      for (const name of list(seen.skills).map((s) => str(s)).filter(Boolean) as string[]) {
        found.push({ id: `skill:${name}`, kind: 'skill', name, uri: name, enabled: true });
      }
      for (const plugin of list(seen.plugins)) {
        const entry = bag(plugin);
        const name = str(entry.name);
        if (!name) continue;
        found.push({ id: `plugin:${name}`, kind: 'plugin', name, uri: str(entry.path) ?? name, enabled: true });
      }
      for (const server of list(seen.mcp_servers)) {
        const entry = bag(server);
        const name = str(entry.name);
        if (!name) continue;
        const state = str(entry.status);
        found.push({
          id: `mcp:${name}`,
          kind: 'mcpServer',
          name,
          uri: name,
          enabled: state !== 'failed',
          ...(state === 'connected' ? { state: 'ready' as const }
            : state === 'failed' ? { state: 'error' as const }
              : { state: 'starting' as const }),
        });
      }
      for (const command of list(seen.slash_commands).map((c) => str(c)).filter(Boolean) as string[]) {
        found.push({
          id: `command:${command}`,
          kind: 'prompt',
          name: command,
          uri: command,
          enabled: true,
          userInvocable: true,
        });
      }
      return found;
    },

    setCustomizationEnabled: (uri) => {
      refuse(uri, 'This host cannot turn a skill or server off mid-session. Change it in settings and start a new one.');
    },

    detail: async (uri): Promise<SessionDetail> => {
      const run = runs.get(uri);
      // The SDK has one conversation per session and no separate chat
      // channel, so the chat uri is derived rather than reported. It exists
      // because everything above addresses a chat, not because there are two.
      const chat = `${uri}/chat`;
      return {
        resource: uri,
        chat,
        chats: [{ resource: chat, title: titles.get(uri) ?? 'Chat' }],
        lifecycle: 'ready',
        config: { properties: CONFIG, values: { permissionMode: 'default', ...(configs.get(uri) ?? {}) } },
        ...(models.get(uri) ? { model: models.get(uri) as string } : {}),
        ...(run?.failed ? { refusal: run.failed } : {}),
      };
    },

    config: async (uri): Promise<SessionConfig> => ({
      properties: CONFIG,
      values: { permissionMode: 'default', ...(configs.get(uri) ?? {}) },
    }),

    setConfig: (uri, key, value) => {
      configs.set(uri, { ...(configs.get(uri) ?? {}), [key]: value });
      const run = runs.get(uri);
      if (!run) return;
      // The running CLI is told, not restarted. `permissionMode` is the one
      // thing it will change under a live turn, which is why it is the one
      // property this host says is `sessionMutable`.
      if (key === 'permissionMode') void run.handle.setPermissionMode(value).catch(() => {});
    },

    /**
     * Stop every CLI this host started.
     *
     * A query is a subprocess and a subprocess keeps the event loop alive, so
     * without this a program that has finished its work never exits.
     */
    close: () => {
      for (const run of runs.values()) { run.stop(); run.handle.close(); }
      runs.clear();
    },
  };
}
