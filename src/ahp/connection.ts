import type {
  Agent, Answer, Changeset, ContentRef, Customization, FileContent, PendingInput, QueuedMessage,
  SessionConfig, SessionDetail, SessionSummary, SessionUri, ToolCall, Turn,
} from './types.js';

/**
 * What a chat client needs from an agent host.
 *
 * A host is a *sessions server*: several clients watch and drive the same
 * sessions and none of them owns the process running the agent. So everything
 * here is either a question about state the host owns, or a fire-and-forget
 * dispatch - there is no local "send and append what I sent". The turn appears
 * when the host has reduced it, which is why the UI re-reads rather than
 * echoing.
 *
 * This is the seam. `fakeHost` implements it with a scripted agent so the
 * example runs, and is checked, with nothing installed; a real client
 * implements the same shape over a WebSocket and changes nothing above it.
 */
export interface HostConnection {
  readonly id: string;
  readonly url: string;
  state(): 'connecting' | 'connected' | 'offline';

  /** The catalogue. Deliberately thin - everything else is on the channel. */
  listSessions(): Promise<SessionSummary[]>;
  /** The harnesses the host advertises, and the models each offers. */
  agents(): Promise<Agent[]>;
  /**
   * The configuration schema for a session that does not exist yet.
   *
   * `resolveSessionConfig`, which is the whole reason it is separate from
   * `config`: the permission modes a harness offers have to be offerable
   * *before* anything has been created, and they differ by provider. It is
   * iterative on a real host - an answer can bring new questions, a git
   * workspace is what makes a host offer a worktree - so it takes what has
   * been chosen so far rather than only the provider.
   */
  resolveConfig(options: {
    provider: string;
    workingDirectory?: string;
    /** What has been chosen so far. The host echoes it back with defaults applied. */
    values?: Record<string, string>;
  }): Promise<SessionConfig>;

  /**
   * Create one.
   *
   * `config` is what the composer's control row was set to. It belongs here
   * rather than in a `setConfig` after the fact: most of what the schema
   * offers is not `sessionMutable`, so a session created without it is a
   * session that can never be given it.
   */
  createSession(options: {
    provider: string;
    workingDirectory?: string;
    config?: Record<string, string>;
  }): Promise<SessionUri>;
  disposeSession(uri: SessionUri): Promise<void>;
  setArchived(uri: SessionUri, archived: boolean): void;
  /**
   * Mark read, or put the bold back.
   *
   * A client flag, not activity: `IsRead` says a person has looked since the
   * last change, and the host tells every other client that one of them has.
   */
  setRead(uri: SessionUri, read: boolean): void;

  /**
   * Subscribe to a session: a snapshot, then an ordered stream of what happens.
   *
   * Closing the returned handle drops *this consumer*, and a second subscribe
   * on a channel already being drained must not unsubscribe it - that is
   * channel-wide, and silently kills the stream everything else is reading.
   */
  subscribe(uri: SessionUri, observer: (event: HostEvent) => void): { close(): void };

  /**
   * The catalogue moved: a session appeared, finished, or is now waiting.
   *
   * Separate from `subscribe`, which is one session's channel and says nothing
   * about the ninety-nine a client is not watching. Without this the only way
   * a list gets fresh is somebody navigating away and back, which is a reader
   * doing by hand what the host already said.
   *
   * It carries no payload on purpose. The host owns the catalogue and
   * `listSessions` is how you read it; an event that carried a row would be a
   * second, staler source of the same answer.
   */
  onSessions(observer: () => void): { close(): void };

  /** Begin a turn. Any turn - this is not only how the first one starts. */
  say(uri: SessionUri, text: string, model?: string): void;
  stopTurn(uri: SessionUri): void;
  /**
   * Say it *after* the turn that is running.
   *
   * Not `say` with a wait in front of it. The queue is the host's - it starts
   * the next turn from the head the moment it goes idle, and every client
   * watching the chat sees the same list - so a client that held the message
   * itself would be the only thing that could ever send it, and would not,
   * because nothing in a client is watching for the turn to end.
   */
  queue(uri: SessionUri, text: string, model?: string): void;
  /** Take one back, while it is still waiting. */
  unqueue(uri: SessionUri, id: string): void;

  /** Answer a tool confirmation. */
  confirmToolCall(uri: SessionUri, toolCallId: string, approved: boolean, optionId?: string): void;
  /** Answer a question. An accept with no answers resumes the agent on none. */
  completeInput(uri: SessionUri, requestId: string, accepted: boolean, answers: Record<string, Answer>): void;

  changes(uri: SessionUri): Promise<Changeset>;

  /**
   * One file out of a changeset, fetched.
   *
   * Separate from `changes` on purpose: a changeset is a list of rows and this
   * is one file's worth of bytes, and a client that returned both together
   * would download a session's entire diff to draw a list of names. Nothing
   * calls this until somebody opens a row.
   */
  content(ref: ContentRef): Promise<FileContent>;

  /**
   * What this session was given: plugins, directories, skills, MCP servers.
   *
   * Read from the session channel rather than the catalogue, because it is
   * per-session - two sessions on the same host, in different directories,
   * are handed different skills. Flattened on the way out; see
   * `Customization`.
   */
  customizations(uri: SessionUri): Promise<Customization[]>;

  /**
   * Turn one on or off, by id.
   *
   * Fire-and-forget like the rest of the dispatches: the host decides, tells
   * every client watching, and what comes back is the customization list
   * having changed - not a return value here.
   */
  setCustomizationEnabled(uri: SessionUri, id: string, enabled: boolean): void;

  /**
   * The session channel's own state: its chat, its lifecycle, its settings.
   *
   * Separate from `listSessions` because a summary is what a *row* needs and
   * this is what a reader needs - asking every session about itself to draw a
   * catalogue is a round trip per row.
   */
  detail(uri: SessionUri): Promise<SessionDetail>;

  /** What this session can be told to do differently. */
  config(uri: SessionUri): Promise<SessionConfig>;
  /**
   * Change one key.
   *
   * The action merges into `config.values`, so sending the whole object writes
   * back everything this client happened to be holding - including a value
   * another client changed while the page had it on screen.
   */
  setConfig(uri: SessionUri, key: string, value: string): void;

  /**
   * Let go of whatever the connection is holding.
   *
   * Optional because not every host holds anything: the scripted one is a
   * pile of objects and ends when the process does. A socket and a
   * subprocess are the opposite - they keep the event loop alive on their
   * own, so a program that has finished drawing and returned from `main`
   * still does not exit. That is what this is for, and the reason it is on
   * the seam rather than only on the implementations that need it: the caller
   * cannot know which kind it was handed.
   */
  close?(): void | Promise<void>;
}

/**
 * What the host says happened.
 *
 * Named after the actions rather than after what a screen does with them: the
 * host is describing its own state changing, and a client that renamed
 * `chat/delta` to `appendToBubble` would have written the UI into the wire.
 */
export type HostEvent =
  | { type: 'snapshot'; turns: Turn[]; active?: Turn; input?: PendingInput; status: number; queued: QueuedMessage[] }
  | { type: 'turnStarted'; turn: Turn }
  | { type: 'delta'; partId: string; kind: 'markdown' | 'reasoning'; text: string }
  | { type: 'toolCall'; call: ToolCall }
  | { type: 'inputNeeded'; input: PendingInput }
  | { type: 'inputResolved' }
  | { type: 'turnComplete'; turn: Turn }
  /** The whole queue, as the host now has it. */
  | { type: 'queued'; messages: QueuedMessage[] }
  | { type: 'status'; status: number }
  | { type: 'changes'; changes: Changeset }
  /**
   * The host answered, and the answer was no.
   *
   * Not the same as the connection dropping, and worth its own event for that
   * reason: a session whose agent has gone is refused for ever while the host
   * is perfectly well, and a client that reported that as "offline" would send
   * somebody to check their network.
   */
  | { type: 'error'; message: string };
