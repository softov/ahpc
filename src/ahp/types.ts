/**
 * The protocol, as a client reads it.
 *
 * These are AHP's own names for AHP's own shapes - `SessionSummary.status` is
 * the bitset the host sends, `responseParts` is one ordered stream, a pending
 * input is either a tool confirmation or a question. Renaming them here would
 * only mean translating twice, and the whole point of the example is to find
 * out which components the *protocol's* shapes need.
 *
 * It is a subset: what a chat client has to render. The authority is the
 * `@agent-host-protocol` package's own `src/types/`.
 */

/** `ahp-session:/<uuid>`, or whatever scheme the provider registered. */
export type SessionUri = string;

/**
 * Status is activity and client flags in one number.
 *
 * `InputNeeded` carries `InProgress`, so it has to be tested first - a turn
 * waiting on a confirmation otherwise reads as merely running, and nobody
 * goes to answer it.
 */
export const SessionFlag = {
  Idle: 1,
  Error: 2,
  InProgress: 8,
  InputNeeded: 24,
  IsRead: 32,
  IsArchived: 64,
} as const;

export interface SessionSummary {
  resource: SessionUri;
  provider: string;
  title: string;
  status: number;
  createdAt: string;
  modifiedAt: string;
  workingDirectories: string[];
  /** What the host says it is doing, in its own words. Often absent. */
  activity?: string;
  /** The footprint, so a list can show it without subscribing to a changeset. */
  changes?: { files?: number; additions?: number; deletions?: number };
}

/**
 * Everything else about a session, which the catalogue does not carry.
 *
 * `listSessions` returns summaries, and a summary is deliberately thin - it is
 * what a list row needs. The chat URI, the lifecycle and the configuration in
 * force all live on the session channel, and a client that wants them
 * subscribes and reads its state. Kept apart here for the same reason: the
 * catalogue can be refreshed without asking every session about itself.
 */
export interface SessionDetail {
  resource: SessionUri;
  /**
   * The default chat.
   *
   * A session is not a conversation - it *holds* chats, and everything said is
   * dispatched to one of them. `defaultChat` is the one a session created the
   * ordinary way has, and guessing a chat URI is what having it avoids.
   */
  chat: string | null;
  chats: { resource: string; title: string }[];
  lifecycle: 'creating' | 'ready' | 'creationFailed';
  config: SessionConfig;
  /** What the last turn ran on. A session has no model; each message has one. */
  model?: string;
  activity?: string;
  /**
   * Why the host would not talk about this session, in its own words.
   *
   * A live catalogue lists sessions whose agent is gone, and the host answers
   * `-32001 No agent for session` to anything that tries to watch one. The row
   * is still real - it is what the catalogue returned - so this says what is
   * missing rather than the pane quietly showing a session's worth of blanks.
   */
  refusal?: string;
}

export type ToolCallStatus =
  | 'pending' | 'pending-confirmation' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * One tool call, flattened.
 *
 * `ToolCallState` is a union of eight states whose fields differ by state.
 * A reader wants one shape, so the union is flattened on the way in and the
 * fields that are not there yet are simply absent.
 */
export interface ToolCall {
  id: string;
  /** What the host calls it. */
  name: string;
  /** Kept apart: hosts give many tools one display name. */
  toolName: string;
  status: ToolCallStatus;
  /** The command. The only thing separating twenty identical rows. */
  input?: string;
  /** What it meant to do. Markdown. */
  intention?: string;
  /** What it did, past tense. */
  outcome?: string;
  /** What came back. */
  output?: string;
  exitCode?: number;
  files?: string[];
  /** Set while `pending-confirmation`. */
  confirmationTitle?: string;
  options?: { id: string; label: string }[];
}

export type ResponsePart =
  | { kind: 'markdown'; id: string; content: string }
  | { kind: 'reasoning'; id: string; content: string }
  | { kind: 'systemNotification'; id: string; content: string }
  | { kind: 'toolCall'; id: string; call: ToolCall };

/**
 * A turn.
 *
 * `parts` is one ordered stream, not prose and calls kept apart: "let me search
 * for those" means something before the searches and nothing after them.
 *
 * The running turn is `activeTurn` on the chat and is *not* in `turns` until it
 * finishes, so a client that reads only the history shows an empty conversation
 * for exactly as long as somebody is watching one happen.
 */
export interface Turn {
  id: string;
  role: 'user' | 'agent';
  /** What the person sent, on a user turn. */
  message?: string;
  parts: ResponsePart[];
  state: 'running' | 'complete' | 'cancelled' | 'failed';
  model?: string;
  at: string;
  elapsedMs?: number;
}

export type QuestionKind =
  | 'text' | 'number' | 'integer' | 'boolean' | 'single-select' | 'multi-select';

export interface Question {
  id: string;
  kind: QuestionKind;
  message: string;
  required?: boolean;
  options?: { id: string; label: string }[];
  /** Answering in words *instead of* choosing, not as a choice. */
  allowFreeformInput?: boolean;
}

/**
 * What the agent is waiting for.
 *
 * Two kinds, and they are nothing alike. A confirmation is a yes or a no about
 * a tool call. A question carries no tool call at all - its prose is the
 * request's message and what is being asked is its questions. Rendering the
 * second as the first loses the entire request: the choices vanish and what is
 * left on screen is a heading and an Approve button.
 */
export interface ToolConfirmation {
  kind: 'toolConfirmation';
  id: string;
  call: ToolCall;
}

export interface ChatInputRequest {
  kind: 'chatInput';
  id: string;
  message: string;
  questions: Question[];
}

export type PendingInput = ToolConfirmation | ChatInputRequest;

/**
 * A message waiting for the running turn to finish.
 *
 * The host's, not the client's: `queuedMessages` is on the chat, a client
 * appends to it with `chat/pendingMessageSet` and withdraws one with
 * `chat/pendingMessageRemoved`, and the host starts the next turn from the
 * head as soon as it is idle. A client that kept its own list instead would
 * be showing a queue nothing was ever going to send, and hiding one that
 * another client had already filled.
 */
export interface QueuedMessage {
  id: string;
  text: string;
}

/** Keyed by question id. The value names its own kind. */
export type Answer =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'selected'; value: string }
  | { kind: 'selected-many'; value: string[] };

export interface FileEdit {
  uri: string;
  /** Absent `before` is a creation, absent `after` a deletion. */
  before?: string;
  after?: string;
  diff: { added: number; removed: number };
  /**
   * Where the two versions of the file actually are.
   *
   * `before` and `after` are the file's own URIs - what it is called on either
   * side of the edit, which is how a rename shows. The content is somewhere
   * else: the protocol keeps it out of the state tree behind a `ContentRef`,
   * because a changeset of two hundred files is a list a client wants and four
   * megabytes it does not. So a row is cheap and opening one is a fetch.
   */
  content?: { before?: ContentRef; after?: ContentRef };
}

/**
 * A pointer to content the state tree does not carry.
 *
 * `sizeHint` is worth keeping rather than reading past: it is the only thing
 * that says, before the fetch, that the answer is a hundred megabytes. A
 * viewer that reads first and measures after is a viewer that reads first.
 */
export interface ContentRef {
  uri: string;
  sizeHint?: number;
  contentType?: string;
}

/** What came back for a `ContentRef`, decoded. */
export interface FileContent {
  text: string;
  /** Set instead of `text` when the bytes are not text this can show. */
  binary?: { bytes: number; contentType?: string };
}

export interface Changeset {
  status: 'computing' | 'complete';
  files: FileEdit[];
}

/**
 * What `ahp-root://` advertises: the harnesses, and the models each offers.
 *
 * `models` is routinely empty, and that is a real answer rather than a
 * failure: a harness enumerates its models once the host has a token for the
 * resources it declares in `protectedResources`, so a host nobody has signed
 * into advertises the harness and nothing to run on it. A client that treats
 * an empty list as "still loading" shows a blank panel forever.
 *
 * A model's own options - thinking level, context size - are a `configSchema`
 * on the model, in the same shape as `SessionConfig`. Nothing here reads it
 * yet, and inventing a field for it would be describing a protocol that does
 * not exist.
 */
export interface Agent {
  provider: string;
  displayName: string;
  description?: string;
  /** `displayName` is the protocol's `name`. The id is what rides on a turn. */
  models: { id: string; displayName: string }[];
}

/**
 * A session's configuration, as the host describes it.
 *
 * The host sends a JSON Schema with titles, `enumLabels` and
 * `enumDescriptions`; this is that, flattened to what a form needs.
 * `sessionMutable` is the property that decides whether a control is offered
 * at all: `permissionMode` can be changed on a running session and `isolation`
 * cannot, and a form that lets you try produces a refusal instead of an edit.
 */
export interface ConfigProperty {
  key: string;
  title: string;
  description?: string;
  values: { value: string; label: string; description?: string }[];
  sessionMutable: boolean;
}

export interface SessionConfig {
  properties: ConfigProperty[];
  /** What is in force. A change dispatches the one key, never the object. */
  values: Record<string, string>;
}

/**
 * What a plugin, a directory or the host itself contributed to this session.
 *
 * One flat shape for eight `CustomizationType`s, because a reader wants a
 * list. The protocol nests them - a plugin or a directory is a *container*
 * whose `children` are the skills, prompts, rules, hooks, agents and MCP
 * servers it brought - and an MCP server can also arrive at the top level,
 * contributed by the host rather than by anything. Flattening keeps `from`
 * so a panel can still say where a skill came from, which is the question
 * somebody looking at a list of forty of them actually has.
 *
 * `enabled` is derived, not copied. A child's own flag is independent of its
 * container's, and the effective answer is both: a disabled plugin disables
 * everything it brought whatever each child says about itself. A panel that
 * showed the child's flag alone would list a skill as on inside a plugin that
 * is off.
 */
export type CustomizationKind =
  | 'plugin' | 'directory' | 'agent' | 'skill' | 'prompt' | 'rule' | 'hook' | 'mcpServer';

export interface Customization {
  /** Session-unique and opaque. What every action targeting one sends. */
  id: string;
  kind: CustomizationKind;
  name: string;
  /** The file, directory or plugin URL it was read from. */
  uri: string;
  description?: string;
  /** The container's and its own, resolved together. */
  enabled: boolean;
  /** The plugin or directory it came from. Absent at the top level. */
  from?: string;
  /**
   * Whether a person may invoke it, for the kinds where that is a question.
   *
   * A skill can be marked as the agent's alone - `disable-user-invocation` in
   * its frontmatter - and offering it in a slash menu is then offering
   * something the host will refuse. The other direction, an agent-only skill
   * hidden from the menu, is why this is a field rather than an assumption.
   */
  userInvocable?: boolean;
  /** MCP servers: `starting`, `ready`, `authRequired`, `error` or `stopped`. */
  state?: McpState;
  /** Why it is not ready, in the host's own words. */
  problem?: string;
}

export type McpState = 'starting' | 'ready' | 'authRequired' | 'error' | 'stopped';

/**
 * Something a person can put after a slash.
 *
 * Two sources that look alike and behave nothing alike, which is why `kind` is
 * here rather than left to be guessed at the call site. A `client` command is
 * one of ours: it opens a screen or changes a setting, and sending it down the
 * session channel would put `/theme` in the transcript and ask an agent to
 * make sense of it. A `session` command is a skill or a prompt the *host*
 * contributed, and the only way to invoke one is to send its name as the
 * message - which is exactly what the composer does with a slash it does not
 * recognise.
 */
export interface SlashCommand {
  id: string;
  kind: 'client' | 'session';
  title: string;
  description?: string;
  /** Where a session command came from: the plugin or directory. */
  from?: string;
}
