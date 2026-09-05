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
  /**
   * What started this, when it was not a person.
   *
   * New in protocol 0.9.0, and the only way a catalogue can tell a session
   * somebody typed from one that started itself at nine this morning. Absent
   * for a session a person opened, which is most of them.
   */
  origin?: { kind: 'automation'; automation: string; run: string };
  /** The footprint, so a list can show it without subscribing to a changeset. */
  changes?: { files?: number; additions?: number; deletions?: number };
  /**
   * The project this session is in, as the *host* names it.
   *
   * Not the same as the last segment of `workingDirectories[0]`, which is what
   * this client falls back to: a host may call a project something its
   * directory is not called, and it is the authority on its own names.
   */
  project?: { uri: string; displayName: string };
  /**
   * Provider-specific metadata, opaque but for the keys a client knows.
   *
   * `git.branch` is the one read here - it is the protocol's well-known key
   * and what the reference host puts there. Anything else is carried and
   * ignored rather than dropped, because the next reader of this row may know
   * a key this one does not.
   */
  _meta?: Record<string, unknown>;
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
  lifecycle: 'creating' | 'ready' | 'failed';
  config: SessionConfig;
  /**
   * What the last turn ran on. A session has no model; each message has one.
   *
   * Resolved against the catalogue rather than carried whole: a turn names an
   * id, and the name, the harness and the options belong to the model row the
   * root channel advertises. A host whose harness nobody has signed into
   * advertises no models, so an id that resolves to nothing is a real answer
   * and stands in for itself.
   */
  model?: ModelRow;
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
  | { kind: 'toolCall'; id: string; call: ToolCall }
  /** How a turn failed, in the host's words. `resumable`: the host can carry on from it. */
  | { kind: 'error'; id: string; message: string; resumable: boolean };

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
  /**
   * What this turn ran on, as the host reported it.
   *
   * The id and whatever settings went with it. Carried whole because the
   * settings are the only record of what a turn was actually asked for -
   * a thinking level is chosen per turn and takes effect from that turn
   * onwards, so an id alone cannot say what any given answer cost.
   */
  model?: ModelSelection;
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
  /**
   * Whether somebody has ticked this file off.
   *
   * Absent is not-yet-reviewed, which is what the protocol says a missing
   * value means - so a client must not read absence as a third state.
   */
  reviewed?: boolean;
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
  /**
   * The verbs the host offers on this changeset.
   *
   * Server-advertised, and that is the access model rather than a hint: a host
   * refuses an `operationId` it did not put in this list, so a client may
   * offer nothing that is not here. Absent means there is nothing to do to
   * this changeset, which is a real answer for a host that computes diffs and
   * never acts on one.
   */
  operations?: ChangesetOperation[];
}

/**
 * One verb a changeset offers.
 *
 * `confirmation` is not decoration: the protocol says a client **MUST**
 * display it before invoking, and its presence is also how the host says the
 * operation is destructive - so a client that dropped it would be one that
 * deletes somebody's work without asking.
 */
export interface ChangesetOperation {
  id: string;
  label: string;
  description?: string;
  /** Whether it applies to the whole changeset, one file, or a range in one. */
  scopes: ('changeset' | 'resource' | 'range')[];
  /** Ask this first. Present iff the host considers the operation destructive. */
  confirmation?: string;
  /** A hint, e.g. `git-commit` or `discard`. */
  icon?: string;
  /** Operations sharing one are drawn together. */
  group?: string;
  /**
   * What may be pressed, and what is happening.
   *
   * The host's, not this client's: `disabled` while a turn is running,
   * `running` while an invocation of it is out, `error` after one failed. Two
   * clients watching one changeset see the same spinner because the host is
   * what they see it through.
   */
  status: 'idle' | 'running' | 'error' | 'disabled';
  /** Why the last invocation failed. Present iff `status` is `error`. */
  error?: { message: string };
}

/** The file, or lines of it, an operation is pointed at. */
export interface ChangesetOperationTarget {
  kind: 'resource' | 'range';
  /** The row's id, which is a `file://` URI. */
  resource: string;
  side?: 'before' | 'after';
  range?: { startLine: number; endLine: number };
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
 */

/**
 * One model a harness offers.
 *
 * The same shape wherever a model appears - what the catalogue advertises and
 * what a session says it ran on are one protocol object, and two readings of
 * it would be two answers to "which model is this".
 *
 * `options` is the model's own `configSchema`, which the protocol says a
 * client presents as a form and returns through `ModelSelection.config`. It is
 * read and shown here and not offered as a control, because the hosts that
 * send it do not yet consume what comes back - see the roadmap. The labels are
 * the host's: three implementations spell the same effort levels three
 * different ways, so a client with its own words is one that disagrees with
 * whichever host it is connected to.
 */
/**
 * A model, as a turn names one.
 *
 * The protocol's own shape: an id, and the resolved answers to whatever
 * `ModelRow.options` asked. Distinct from the catalogue row - this is the
 * choice, that is what there was to choose from.
 */
/**
 * Where a new chat comes from, when it comes from an existing one.
 *
 * A fork copies the source's history through a completed turn into the new
 * chat's visible turns; a side chat supplies the same context without copying
 * it into what a person reads. Both are gated on the agent advertising them -
 * `capabilities.multipleChats: { fork, sideChat }` - and a host that does not
 * is one where the option is not offered rather than offered and refused.
 */
export type ChatSource =
  | { kind: 'fork'; chat: string; turnId: string }
  | { kind: 'sideChat'; chat: string; turnId: string };

export interface ModelSelection {
  id: string;
  /** Answers by property key, in the host's own vocabulary. */
  config?: Record<string, string>;
}

export interface ModelRow {
  /** What rides on a turn. */
  id: string;
  /** The protocol's `name`. Ids are things like `claude-sonnet-4-5-20250929`. */
  displayName: string;
  /**
   * The harness it belongs to.
   *
   * Required by the protocol and always the enclosing agent's own, so it
   * identifies rather than informs: worth carrying, not worth a row of its
   * own beside a model already listed under its harness.
   */
  provider: string;
  /** The model's own settings, where it has any. */
  options?: ConfigProperty[];
}

/**
 * One thing the host offers to complete what is being typed.
 *
 * Carries the range it replaces rather than only the text, because what is
 * being completed is a *fragment*: `@src/ho` becomes `@src/host.ts` by
 * replacing from the at-sign, and a client that appended would produce
 * `@src/ho@src/host.ts`.
 */
export interface Completion {
  /** What to put in the draft. */
  insertText: string;
  /** Where the replaced fragment starts, as an offset into the draft. */
  rangeStart: number;
  /** Where it ends. */
  rangeEnd: number;
  /** What a person reads in the menu. */
  label: string;
  /** One line under it, when the host said something worth reading. */
  description?: string;
}

/** One terminal the host is running, as the root channel lists it. */
export interface TerminalRow {
  /** Its channel URI. */
  resource: string;
  /** Display title. */
  title: string;
  /** The process's exit code, once it has one. Absent while it runs. */
  exitCode?: number;
}

/** A terminal's own state, as its channel reports it. */
export interface TerminalState {
  /** Display title. */
  title: string;
  /** Everything written so far, flattened from the protocol's content parts. */
  output: string;
  /** Where it is running. */
  cwd?: string;
  /** The process's exit code, once it has one. */
  exitCode?: number;
  /**
   * Whether a pseudoterminal is behind it.
   *
   * `false` means the output is plain text and carries no VT sequences - so a
   * client neither has to parse them nor should expect anything that draws
   * itself with cursor movement to look right.
   */
  isPty: boolean;
}

export interface Agent {
  provider: string;
  displayName: string;
  description?: string;
  models: ModelRow[];
  /**
   * What this harness wants a token for before it will work.
   *
   * `AgentInfo.protectedResources`, and the only place a `resource` name may
   * come from other than a live MCP challenge - `authenticate` MUST name one
   * the host advertised, so a client that invents a name is one the host is
   * obliged to refuse.
   */
  protectedResources?: { resource: string; description?: string }[];
  /**
   * Whether this agent can hold more than one chat in a session.
   *
   * A gate, not a hint: a host that does not advertise it is one where
   * `createChat` MUST NOT be called, so the command is not offered either.
   */
  multipleChats?: boolean;
  /** Whether it can fork a chat, and whether it can hold a side chat. */
  chatSources?: { fork?: boolean; sideChat?: boolean };
  /**
   * What this harness offers, before any session exists.
   *
   * The protocol puts the same list in two places on purpose: here, where a
   * client can read it without creating anything, and on a session, where it
   * has been resolved against that session's directory. The first is what a
   * new-session screen needs - somebody choosing a skill to open with is
   * choosing before there is a session to ask.
   *
   * Empty is a real answer, and the one to expect from a host whose harness
   * nobody has signed into.
   */
  customizations?: Customization[];
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
  /**
   * Whether the host has to be asked for the values rather than sending them.
   *
   * The reference host sets this on `branch` while isolation is `worktree`: a
   * branch list on a large repository is not something to put in a schema, so
   * the schema says "ask me" and `sessionConfigCompletions` is the asking.
   */
  enumDynamic?: boolean;
  /**
   * What the host opens with, where it said.
   *
   * Routinely absent, and absent is not "the first one": a model that takes a
   * single effort level below the one its harness defaults to carries the
   * choice and no default at all, so a form that filled the gap in from the
   * top of the list would show a setting the host never named.
   */
  default?: string;
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

/**
 * One entry of a directory the host serves.
 *
 * AHP's own shape, kept to its own names: `uri` is a `file://` URI on the
 * *host's* machine, never on this one.
 */
export interface ResourceEntry {
  uri: string;
  name: string;
  /** `file`, `directory`, or whatever else the host distinguishes. */
  kind: string;
  size?: number;
}

/**
 * One changeset a session offers, as its catalogue advertises it.
 *
 * A *scope*, not a diff: what this conversation changed, what one turn
 * changed, what changed between two, what the working tree has. The host names
 * them and a client picks; `variables` is what still has to be filled in
 * before the template is a URI - empty for one that already is.
 */
export interface ChangesetScope {
  label: string;
  uriTemplate: string;
  description?: string;
  /**
   * What kind of changeset this is, for grouping and icons.
   *
   * An advisory hint, and the protocol says to fall back sensibly on a value
   * this client has never heard of rather than to drop the entry.
   */
  changeKind?: string;
  /**
   * Whether files here can be ticked off as read.
   *
   * On the *catalogue* entry, which is what lets a client decide whether to
   * draw the checkbox before it subscribes to anything.
   */
  reviewable?: boolean;
  /** The `{name}` placeholders left in the template, in the order they appear. */
  variables: string[];
}

// ------------------------------------------------------------- automations

/**
 * One run of an automation, flattened to what a list row shows.
 *
 * The protocol carries a lifecycle object and an origin object; a reader wants
 * to know whether it worked, whether anybody asked for it, and what to open.
 */
export interface AutomationRun {
  resource: string;
  /** `pending`, `running`, `completed`, `failed` or `cancelled`. */
  status: string;
  /** The session it started, once it has one. What opening the run opens. */
  session?: string;
  /** Whether a trigger started it, rather than somebody pressing Run. */
  triggered: boolean;
}

/**
 * One automation: a session the host starts without anybody asking.
 *
 * `schedule` and `nextRunAt` answer different questions and both are worth
 * showing. The first is what somebody wrote and is true whatever the host
 * does with it; the second is what the host will actually do, and its absence
 * is how a host says it will not fire this - because it holds no clock,
 * because the automation is switched off, or because the expression is one it
 * could not read.
 */
export interface Automation {
  resource: string;
  title: string;
  enabled: boolean;
  /** The cron expression and zone, as written. Absent for a manual-only one. */
  schedule?: { expression: string; timeZone: string };
  /** ISO 8601. Absent when nothing will fire it. */
  nextRunAt?: string;
  /** Newest first, and a bounded window of them. */
  runs: AutomationRun[];
  /** Which of `update`, `remove` and `run` the host will accept for it now. */
  operations: string[];
}
