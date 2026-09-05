import type {
  Agent, Answer, Automation, Changeset, Completion, ContentRef, Customization, FileContent, PendingInput, QueuedMessage,
  ChangesetOperationTarget, ChangesetScope, ModelSelection, ResourceEntry, SessionConfig, SessionDetail, SessionSummary, SessionUri, TerminalRow, TerminalState,
  ToolCall, Turn,
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
  subscribe(uri: SessionUri, observer: (event: HostEvent) => void, chat?: string): { close(): void };

  /**
   * Pull the page of history that sits before the turns already loaded.
   *
   * The turns do not come back from this. A host inserts them into the chat's
   * own state and dispatches `chat/turnsLoaded` before it answers, so anything
   * subscribed to that chat sees them arrive the way it sees everything else -
   * which is why there is no return value carrying turns and no second path
   * from a turn to the screen.
   *
   * What comes back is whether there is still more behind it, so a caller that
   * wants the whole conversation can ask again and one that wants a screenful
   * can stop.
   *
   * How much history a snapshot arrives with is the host's business and the
   * two that exist disagree: one sends a tail window, and one sends none at
   * all and expects to be asked. So this is not only how a long conversation
   * is read to its beginning - against some hosts it is how it is read at all.
   */
  loadOlderTurns(uri: SessionUri, chat?: string): Promise<boolean>;

  /**
   * Open a second conversation in the same session.
   *
   * A chat belongs to a session, and a session may hold several - the session
   * is a container, not the conversation. The URI is chosen here, as a
   * session's is, so it can be subscribed to without a round trip in between.
   *
   * Only where the agent advertises it: a host that does not is one where
   * `createChat` MUST NOT be called at all.
   */
  createChat(uri: SessionUri, first?: string): Promise<string>;

  /**
   * The terminals the host is running.
   *
   * The host's rather than a session's: one outlives the turn that opened it,
   * several clients watch one, and the protocol lists them on the root
   * channel - which is where something owned by no session belongs.
   */
  terminals(): Promise<TerminalRow[]>;
  /** Open one. The URI is chosen here, so it can be watched without a round trip. */
  createTerminal(options?: { cwd?: string; name?: string }): Promise<string>;
  /** Kill it and let go. */
  disposeTerminal(uri: string): Promise<void>;
  /** Watch one: its state, and then everything that happens to it. */
  watchTerminal(uri: string, observer: (state: TerminalState) => void): { close(): void };
  /** Send input. Nothing comes back but what the shell says. */
  writeTerminal(uri: string, data: string): void;
  /**
   * Tell the host how big this client is drawing the terminal.
   *
   * `terminal-channel.md` lists `terminal/resized` among the client-dispatched
   * actions and its reducer sets `cols` and `rows`. A host never told wraps
   * its output at a width nobody chose.
   */
  resizeTerminal(uri: string, cols: number, rows: number): void;
  /** Empty the scrollback. `terminal/cleared` resets `content` to nothing. */
  clearTerminal(uri: string): void;
  /** Rename it. `terminal/titleChanged` sets `title`. */
  renameTerminal(uri: string, title: string): void;
  /** Take it, or give it up. `terminal/claimed` sets `claim`. */
  claimTerminal(uri: string, claim: string | null): void;

  /**
   * What the host offers to complete what is being typed.
   *
   * The host's question, not this client's: a path is a path on *its*
   * filesystem, and a skill is one it contributed. Asked with the whole draft
   * and where the caret is, because what is being completed depends on the
   * word the caret is in - an at-sign mid-word is an address and a slash
   * mid-sentence is a path.
   *
   * Nothing is a real answer: a host that completes neither is one whose
   * composer offers no menu, which is what it did before either was served.
   */
  completions(options: { channel: string; text: string; offset?: number }): Promise<Completion[]>;

  /**
   * Send one action verbatim, without this client knowing what it means.
   *
   * The escape hatch, and optional because only a real host has one: the
   * protocol has far more client-dispatchable actions than a chat client has
   * controls for, and a way to send an arbitrary one is what makes the rest of
   * them testable at all. `chat` targets the chat channel rather than the
   * session's.
   */
  dispatch?(uri: SessionUri, action: Record<string, unknown>, chat?: boolean): void;

  /**
   * One directory of the host's filesystem, as far as it lets this client see.
   *
   * Optional, because a host may serve none: `createHost` takes its filesystem
   * as a port, and one given none answers `-32601`. Absent here means the same
   * thing a layer up - there is nothing to browse, rather than nothing there.
   */
  resourceList?(uri: string): Promise<ResourceEntry[]>;
  /**
   * One file's bytes, by `file://` URI on the *host's* machine.
   *
   * `encoding` is reported rather than assumed, because a host serves whatever
   * is on its disk: a caller that treated every answer as text would print a
   * PNG to a terminal.
   */
  resourceRead?(uri: string): Promise<{ data: string; encoding: string; contentType?: string }>;
  /**
   * What the host knows about one path without reading it.
   *
   * `type` is the host's own `ResourceType` rather than a boolean: a symlink
   * is neither a file nor a directory, and narrowing it here would be this
   * client deciding something the host already answered.
   */
  resourceResolve?(uri: string): Promise<{ uri: string; type: string; size?: number; mtime?: string }>;
  /**
   * Write one file.
   *
   * The whole `resource*` family is symmetrical and optional: a host that
   * serves no filesystem answers `-32601`, which is why these are optional
   * here too. `-32009` is a refusal naming the grant that would lift it, and
   * `createOnly` is the protocol's guard against replacing something that is
   * already there.
   */
  resourceWrite?(uri: string, data: string, options?: { encoding?: string; createOnly?: boolean }): Promise<void>;
  resourceDelete?(uri: string, options?: { recursive?: boolean }): Promise<void>;
  resourceMkdir?(uri: string): Promise<void>;
  resourceMove?(from: string, to: string, options?: { failIfExists?: boolean }): Promise<void>;
  resourceCopy?(from: string, to: string, options?: { failIfExists?: boolean }): Promise<void>;
  /**
   * Be told when something under a path changes, instead of asking again.
   *
   * `resource-watch-channel.md`: the receiver allocates the channel URI and it
   * is opaque; there is no dispose command, and the receiver MUST release the
   * watcher once every subscriber has unsubscribed - so letting go of the
   * returned handle is the whole of closing one. Creating one goes through the
   * same permission flow as the rest of the family, so a refusal is `-32009`
   * naming the grant that would lift it.
   */
  watchResource?(uri: string, observer: (changes: { uri: string; kind: string }[]) => void, options?: { recursive?: boolean }): Promise<{ close(): void }>;
  /** Close one. The last chat in a session is the session; dispose that instead. */
  disposeChat(chat: string): Promise<void>;

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
  /**
   * Put the message being composed where other clients can see it.
   *
   * `chat-channel.md`: clients MAY sync their input into `ChatState.draft` so
   * it survives a reload and is visible to other clients on the same chat,
   * SHOULD debounce rather than sync eagerly, and the host clears it when the
   * message is sent. An empty string is the clear.
   */
  setDraft(uri: SessionUri, text: string): void;
  say(uri: SessionUri, text: string, model?: ModelSelection): void;
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
  queue(uri: SessionUri, text: string, model?: ModelSelection): void;
  /** Take one back, while it is still waiting. */
  unqueue(uri: SessionUri, id: string): void;

  /** Answer a tool confirmation. */
  confirmToolCall(uri: SessionUri, toolCallId: string, approved: boolean, optionId?: string): void;
  /** Answer a question. An accept with no answers resumes the agent on none. */
  completeInput(uri: SessionUri, requestId: string, accepted: boolean, answers: Record<string, Answer>): void;

  /**
   * Which changesets this session offers.
   *
   * The protocol has a session advertise several - what the conversation
   * changed, what one turn changed, what the working tree has - and a client
   * that reads only the first shows one of them and hides the rest.
   */
  changesets?(uri: SessionUri): Promise<ChangesetScope[]>;
  /**
   * One of them, by the URI its template became.
   *
   * Left out, the first that needs no filling in - which is what a screen
   * showing a single changeset wants and what this answered before there was
   * any way to ask for another.
   */
  changes(uri: SessionUri, uri_?: string): Promise<Changeset>;
  /**
   * Mark files in a changeset reviewed, or clear them.
   *
   * Optional, and only where the changeset's catalogue entry says it is
   * reviewable. Sent to the changeset's own channel, not the session's.
   */
  review?(changeset: string, files: string[], reviewed: boolean): void;

  /**
   * Run one of the verbs a changeset advertised.
   *
   * Not fire-and-forget, unlike most of what a client sends: the host answers
   * whether it accepted, and refuses out loud - so a button that failed can
   * say why instead of looking like one that did nothing. What the operation
   * *did* still arrives on the changeset's channel, because every other client
   * has to see it too.
   *
   * `target` is omitted for a changeset-scoped operation and required for the
   * others. A host refuses an `operationId` it did not advertise, which is why
   * this takes one rather than an enum.
   */
  invoke?(changeset: string, operationId: string, target?: ChangesetOperationTarget): Promise<{ message?: string }>;

  /**
   * Ask to be allowed to write something.
   *
   * The other half of `invoke`, and the reason a refused operation is not a
   * dead end: a host that will not run a write refuses with a payload naming
   * the request that would unlock it, and this is what sends that request. A
   * client that only knew how to press the button would show one that fails
   * and cannot explain itself.
   */
  requestResource?(uri: string, access: { read?: boolean; write?: boolean }): Promise<void>;

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
   * What a slash offers before any session exists.
   *
   * Separate from `customizations` because that one takes a session, and on
   * the new-session screen there is not one yet - which is exactly when
   * somebody wants to open with a skill. The host knows what its harness
   * contributes without having been asked to run anything, so this is a
   * question it can answer, and the only one that can: a client cannot derive
   * it from a catalogue of sessions it is not opening.
   *
   * Answering with nothing is a real answer, and the one to give for a
   * harness nobody has signed into.
   */
  harnessCommands(): Promise<Customization[]>;

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
  /**
   * Wait for what has been dispatched to have actually left.
   *
   * For a caller that sends one thing and exits. Everything here is
   * fire-and-forget, and one of those is still asynchronous on the way out -
   * closing the connection in the same breath closes it first, and the
   * dispatch is never sent at all.
   */
  /**
   * Every automation this host holds.
   *
   * Optional, and the absence is the answer: a host that serves no automations
   * channel answers `-32601`, and a client that drew an empty list for it
   * would be claiming the host has none rather than that it has no such thing.
   */
  automations?(): Promise<Automation[]>;
  /**
   * Told when one moves, so the screen is not polled.
   *
   * The interesting change is the one nobody made: an automation firing at
   * nine in the morning arrives here and nowhere else.
   */
  onAutomations?(observer: () => void): { close(): void };
  /**
   * Write a new one, and answer with the URI it was given.
   *
   * The client picks the URI, as it does for a session and a chat, so the
   * thing is addressable before the host has answered. `definition` is the
   * protocol's own shape and is passed through rather than modelled here -
   * what this client fills in is a subset, and a host may hold keys it never
   * wrote.
   */
  createAutomation?(definition: Record<string, unknown>): Promise<string>;
  /** Start one now, whatever its schedule says. */
  runAutomation?(uri: string): Promise<void>;
  /** Switch one on or off, which is a patch of its definition. */
  setAutomationEnabled?(uri: string, enabled: boolean): Promise<void>;
  /** Forget one, and everything it has done. */
  removeAutomation?(uri: string): Promise<void>;

  flush?(): Promise<void>;
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
  | {
    type: 'snapshot'; turns: Turn[]; active?: Turn; input?: PendingInput; status: number; queued: QueuedMessage[];
    /**
     * The message being composed, as the host is holding it.
     *
     * `ChatState.draft` is shared: another client typing into this chat is
     * visible here, and a draft survives this client being restarted. Present
     * on every snapshot so a screen can take it when it opens; empty is a real
     * answer, meaning the host holds no draft.
     */
    draft: string;
  }
  | { type: 'turnStarted'; turn: Turn }
  | { type: 'delta'; partId: string; kind: 'markdown' | 'reasoning'; text: string }
  | { type: 'toolCall'; call: ToolCall }
  | { type: 'inputNeeded'; input: PendingInput }
  | { type: 'inputResolved' }
  | { type: 'turnComplete'; turn: Turn }
  /** The whole queue, as the host now has it. */
  | { type: 'queued'; messages: QueuedMessage[] }
  /**
   * The session's chats, as the host now has them.
   *
   * A session is a container and its chats come and go on their own - one
   * opened from another client, one closed - so this is separate from the
   * chat snapshot, which is about the conversation being watched.
   */
  | { type: 'chats'; items: { resource: string; title: string }[]; defaultChat: string }
  /**
   * The session's skills, prompts and MCP servers, as the host now has them.
   *
   * Sent when the session channel says they changed - a server signing in, a
   * switch answered, a plugin arriving late. Without it the panel shows what
   * was true when it was opened, so a toggle that worked looked like one that
   * did nothing.
   */
  | { type: 'customizations'; items: Customization[] }
  /**
   * Who else is in this session, as the host has it.
   *
   * `SessionState.activeClients` is host-kept membership: a client adds itself
   * with `session/activeClientSet` and the host removes it when the last
   * subscription goes. Two people on one session is the case this exists for.
   */
  | { type: 'present'; clients: { clientId: string; displayName?: string }[] }
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
