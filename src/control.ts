import type {
  ArgChoices,
  CommandDefinition,
  Disposable,
  ServiceKey,
  TextUIApp,
} from '@textui/core';
import { createBag, serviceKey } from '@textui/core';
import { confirm } from '@textui/widgets';
import { operate } from './ahp/operate.js';
import type { HostConnection } from './ahp/connection.js';
import type { Terminals } from './terminal.js';
import { createTerminals } from './terminal.js';
import type {
  Agent, Answer, Automation, Changeset, ChangesetScope, Completion, ContentRef, Customization, FileContent, ResourceEntry, SessionConfig, SessionDetail,
  SessionUri, Turn,
} from './ahp/types.js';
import { SessionFlag } from './ahp/types.js';
import { valueIcon } from './view/icons.js';
import {
  ARCHIVED, BOOD_FLOAT, CAN_ADD_CHAT, CHAT_URI, CHATS, CUSTOMIZATIONS, DRAFT, EXPANDED, FILTER, HAS_CHATS,
  HOST, HOST_ERROR, INPUT, MODEL, OPEN_TERMINAL,
  AUTOMATIONS, AUTOMATION_ROW,
  CHANGES as CHANGES_AT_PATH, CHANGE_AT, CHANGE_ROW, CHANGE_SCOPES, FILES_AT, FILES_OPEN,
  OPEN, OPEN_FILE, PROVIDER, MARKDOWN, QUEUE, RUNNING, SCREEN, SELECTED, SETTINGS, SIDEBAR,
  SPLIT_AT, SPLIT_DEFAULT, TURNS, WORKSPACE,
  applyEvent, pendingInput, queue, sessions, turns, writeSessions, writeStatus,
} from './state.js';

/**
 * The control side: what the application can do, and what it does when the
 * host says something.
 *
 * Split from the views because these are the two things that change for
 * different reasons. A new screen is a rendering change; answering a new kind
 * of request is a change here. Keeping them in one file is what makes a small
 * protocol change touch every component that draws a bubble.
 *
 * Everything a key can do is a command, so the palette gets it for free and
 * nothing is reachable one way only.
 */

export interface Controller {
  refresh(): Promise<void>;
  open(uri: SessionUri): void;
  close(): void;
  /** Send, or queue when a turn is already running. */
  send(text: string): void;
  /** Take a queued message back, while it is still waiting. */
  unqueue(id: string): void;
  stop(): void;
  approve(optionId?: string): void;
  deny(): void;
  answer(answers: Record<string, Answer>, accepted?: boolean): void;
  setArchived(uri: SessionUri, archived: boolean): void;
  /** Put the bold back, or take it away. A client flag, not activity. */
  setRead(uri: SessionUri, read: boolean): void;
  /** Say that the host refused something, wherever it was noticed. */
  report(error: unknown): void;
  /**
   * End the session on the host.
   *
   * Not `dispose`. This object is also a `Disposable` - it owns the
   * subscription, the commands and the keys - and `Object.assign` put that
   * `dispose()` straight over the top of this one. Confirming "delete this
   * session" therefore tore down the whole controller instead: every command
   * and every keybinding went with it, and the application stopped answering
   * the keyboard entirely. The protocol's own name for this is
   * `disposeSession`, and using it means the two can never collide again.
   */
  disposeSession(uri: SessionUri): Promise<void>;
  create(options: { provider: string; workingDirectory?: string; first?: string }): Promise<SessionUri>;
  /** The harnesses this host advertises, and the models each offers. */
  agents(): Promise<Agent[]>;
  /** The session channel's own state: its chat, its lifecycle, its settings. */
  detail(uri: SessionUri): Promise<SessionDetail>;
  config(uri: SessionUri): Promise<SessionConfig>;
  /** What the host handed this session: plugins, skills, MCP servers. */
  customizations(uri: SessionUri): Promise<Customization[]>;
  /**
   * Terminals, as operations.
   *
   * Its own object because a terminal is not a session and shares nothing with
   * one: it belongs to the host, outlives any turn, and what a screen needs
   * from it is a different set of verbs.
   */
  readonly terminals: Terminals;
  /** What the host offers to complete what is being typed. */
  completions(channel: string, text: string, offset?: number): Promise<Completion[]>;
  /** Read a different chat in the session already open. */
  openChat(chat: string): void;
  /** Open another chat in it, and read that. */
  createChat(first?: string): Promise<void>;
  /** Close one, and read whatever is left. */
  disposeChat(chat: string): Promise<void>;
  /** What a slash offers before any session exists. */
  harnessCommands(): Promise<Customization[]>;
  /** Turn one on or off. The host decides and tells everyone watching. */
  setCustomizationEnabled(uri: SessionUri, id: string, enabled: boolean): void;
  /**
   * One directory of the host's filesystem.
   *
   * The *host's*, which is the whole reason this goes through the connection
   * rather than through `node:fs`: the daemon may be on another machine, and
   * the project a session is working in is over there.
   *
   * Empty for a host that serves none - `createHost` takes its filesystem as a
   * port and one given none answers `-32601`, which a client reads as nothing
   * to browse rather than as a failure.
   */
  files(uri: string): Promise<ResourceEntry[]>;
  /**
   * Every automation the host holds.
   *
   * Rejects, rather than answering empty, for a host that serves none: an
   * empty list is a host with a clock and nothing on it, and the two want
   * different words on the screen.
   */
  automations(): Promise<Automation[]>;
  /** Told when one moves, including one that fired while nobody was looking. */
  onAutomations(observer: () => void): { close(): void };
  /** Write a new one, and answer with the URI the host gave it. */
  createAutomation(definition: Record<string, unknown>): Promise<string>;
  /** Start one now, whatever its schedule says. */
  runAutomation(uri: string): Promise<void>;
  /** Switch one on or off. */
  setAutomationEnabled(uri: string, enabled: boolean): Promise<void>;
  /** Forget one. */
  removeAutomation(uri: string): Promise<void>;
  /** One file's bytes, by URI on the host. */
  file(uri: string): Promise<{ data: string; encoding: string; contentType?: string }>;
  /**
   * Which changesets this session offers.
   *
   * Asked once per session rather than derived: a host that advertises none
   * has none, and a client that assumed the four the protocol names would
   * offer a picker full of things to be refused.
   */
  changesets(uri: SessionUri): Promise<ChangesetScope[]>;
  /** One of them, by the URI its template became. Absent is whichever the host would pick. */
  changesAt(uri: SessionUri, changeset?: string): Promise<Changeset>;
  /**
   * Tick a file off, or take the tick back.
   *
   * Fire-and-forget: the host keeps the flag and tells every client watching,
   * so what redraws this screen is the changeset coming back, not this call.
   */
  review(changeset: string, files: string[], reviewed: boolean): void;
  /** One file out of a changeset, fetched. Nothing calls it until a row opens. */
  content(ref: ContentRef): Promise<FileContent>;
  /**
   * What the host will answer questions about, here and now.
   *
   * One call, because "here and now" has two answers and the caller should not
   * have to know which: an open session describes itself, and a session that
   * does not exist yet is what `resolveSessionConfig` is for. Asking also
   * *registers* a command per property the schema offers, so the control row
   * and the palette are showing the host's own questions rather than the ones
   * this client was written knowing about.
   */
  settings(): Promise<SessionConfig>;
  setConfig(uri: SessionUri, key: string, value: string): void;
  /** Drive the scripted host. A real connection has a socket instead. */
  pump(): boolean;
}

export const CONTROLLER: ServiceKey<Controller> = serviceKey<Controller>('chat.controller');

/** The command that asks about one config key. Registered when a host offers it. */
export const settingCommand = (key: string): string => `compose.set.${key}`;

/**
 * The two focus scopes, and why single-letter keys need them.
 *
 * The runtime already offers a key to the focused node before any keybinding,
 * so `q` typed into the composer is a letter and not a quit. What a scope adds
 * is *where a key exists at all*: `d` disposes a session on the catalogue and
 * means nothing in a conversation, and a binding that exists on both screens
 * is one that fires on the wrong one.
 *
 * A scope is active while the component that declares it is mounted, so the
 * screens are what turn these on and off.
 */
export const SESSIONS_SCOPE = 'chat.sessions';
export const CHAT_SCOPE = 'chat.conversation';
export const SKILLS_SCOPE = 'chat.skills';
export const MCP_SCOPE = 'chat.mcp';
export const CHANGES_SCOPE = 'chat.changes';
export const AUTOMATIONS_SCOPE = 'chat.automations';

export function createController(
  app: TextUIApp,
  host: HostConnection & { pump?(): boolean },
): Controller & Disposable {
  const bag = createBag();
  // The client's own copy of the conversation, kept so a delta can be applied
  // to the part it names rather than the store being read back and rewritten.
  let model: Turn[] = [];
  let subscription: { close(): void } | null = null;

  app.store.set(HOST, { id: host.id, url: host.url, state: host.state() });
  app.store.set(FILTER, '');
  app.store.set(ARCHIVED, false);
  app.store.set(EXPANDED, {});
  app.store.set(QUEUE, []);
  app.store.set(DRAFT, '');
  // What the first message will be sent as, before there is a session to ask.
  app.store.set(PROVIDER, 'claude');
  app.store.set(MODEL, '');
  app.store.set(SETTINGS, {});

  /**
   * What to do when the host says no.
   *
   * Everything below is either fire-and-forget or driven from an effect, so a
   * rejection has nowhere to be caught by the caller - and an unhandled
   * rejection ends the process, from a terminal sitting in its alternate
   * screen. A refusal is information: it goes where the screens can read it.
   */
  /**
   * One command per question the host says it will answer.
   *
   * Registered rather than written, because the questions are the harness's
   * and not this client's: `permissionMode` is what the fixture calls its key
   * and a real host's are `isolation`, `autoApprove` and `mode`. A command
   * naming a key works against one host, so nothing here names one - the
   * schema arrives, and the palette and the control row have it.
   *
   * Late binding is the whole point: a harness that grows a new setting grows
   * a new chip and a new palette entry, and this file does not change.
   */
  const offered = new Map<string, Disposable>();
  const unicode = app.capabilities.unicode;

  const offer = (config: SessionConfig, uri: SessionUri | null): void => {
    const keep = new Set<string>();
    for (const property of config.properties) {
      // Nothing to choose from is nothing to ask: a host's `permissions` key
      // is an object the agent maintains, not a question with answers.
      if (property.values.length === 0) continue;
      // A session that exists can only be changed where the host says so, and
      // offering the rest produces a refusal instead of an edit.
      if (uri && !property.sessionMutable) continue;
      const id = settingCommand(property.key);
      keep.add(id);
      offered.get(id)?.dispose();
      // Whether the values are worth a mark at all. Five approval modes named
      // in the same two words need one; a list of branch names does not, and a
      // column of identical dots beside them is noise with a shape.
      const marked = property.values.some((value) => valueIcon(unicode, value.value, value.label));
      offered.set(id, app.commands.register({
        id,
        title: property.title,
        category: 'Compose',
        slots: ['palette'],
        args: [{
          name: 'value',
          type: 'string' as const,
          required: true,
          description: property.description ?? `Choose ${property.title.toLowerCase()}`,
          /*
           * What it is set to now, so the picker opens on that row.
           *
           * Read through a getter rather than captured: `offer` runs when the
           * schema arrives and the value changes every time one of these is
           * answered, so a value read at registration time is the answer that
           * was in force when the host first replied.
           */
          get default(): string | undefined {
            const values = app.store.get<Record<string, string>>(SETTINGS) ?? {};
            return values[property.key];
          },
          // The host's own words, all three of them. "Auto Mode" and "Plan
          // Mode" are two words apart and mean entirely different things; the
          // sentence under each is what tells them apart, and it is the
          // difference between picking and guessing.
          //
          // Which is why the sentence gets a line of its own as soon as one of
          // the values has one. Beside the label it shares the width with it,
          // and a column of "Every tool call is c…" / "File edits run; com…"
          // truncates away the exact part the reader is choosing on.
          ...(property.values.some((value) => value.description)
            ? { descriptions: 'below' as const }
            : {}),
          choices: () => property.values.map((value) => ({
            value: value.value,
            label: value.label,
            ...(marked ? { icon: valueIcon(unicode, value.value, value.label, { fallback: true }) } : {}),
            ...(value.description ? { description: value.description } : {}),
          })),
        }],
        run: (args: Record<string, unknown>) => {
          const chosen = property.values.find((value) => value.value === String(args.value));
          if (!chosen) return;
          const current = app.store.get<Record<string, string>>(SETTINGS) ?? {};
          app.store.set(SETTINGS, { ...current, [property.key]: chosen.value });
          const open = app.store.get<SessionUri>(OPEN);
          // One key at a time: the action merges, so sending the object
          // writes back whatever this client happened to be holding.
          if (open) host.setConfig(open, property.key, chosen.value);
        },
      }));
    }
    // A harness the composer just switched to does not answer the last one's
    // questions, and a chip pointing at a command nobody unregistered is a
    // panel offering another harness's values.
    for (const [id, disposable] of offered) {
      if (keep.has(id)) continue;
      disposable.dispose();
      offered.delete(id);
    }
  };
  bag.add({
    dispose: () => {
      for (const disposable of offered.values()) disposable.dispose();
      offered.clear();
    },
  });

  const failed = (error: unknown): void => {
    const rpc = error as { code?: number; message?: string } | null;
    const message = rpc?.message ?? String(error);
    app.store.set(HOST_ERROR, typeof rpc?.code === 'number' ? `${message} (${rpc.code})` : message);
  };

  /**
   * Read the catalogue again, at most once per turn of the loop.
   *
   * The host says "something moved" per action, and a turn finishing is
   * several of them - so the unguarded version is one `listSessions` per
   * delta. Coalescing makes a burst one read, and the read is what the list
   * is drawn from either way.
   */
  let pending: ReturnType<typeof setTimeout> | null = null;
  const refreshSoon = (): void => {
    if (pending) return;
    pending = setTimeout(() => { pending = null; void reread(); }, 120);
    // Nothing here should hold a process open: this is a repaint, not work.
    (pending as unknown as { unref?(): void }).unref?.();
  };
  bag.add({ dispose: () => { if (pending) clearTimeout(pending); pending = null; } });

  /**
   * Read the catalogue, and say nothing about anything else.
   *
   * `refresh` clears the last refusal, because a person pressing `r` is asking
   * whether the host is answering again and a fresh list is the answer. This
   * one is not that: it runs whenever the host says something moved, and a
   * catalogue that answered says nothing about a session channel that refused
   * - so clearing it here wiped "Authentication is required" off the status
   * bar the moment any other session ticked.
   */
  const reread = async (): Promise<void> => {
    try {
      writeSessions(app.store, await host.listSessions());
    } catch (error) { failed(error); }
  };

  /**
   * What each provider says it can do, by provider id.
   *
   * Asked once at boot rather than when a palette happens to open: the chat
   * commands are gated on it, and a gate that answers "no" until somebody
   * opens an unrelated picker is a command missing for no visible reason.
   */
  const capable = new Map<string, boolean>();
  /**
   * Whether one session's agent can hold another chat.
   *
   * Read from the row's own provider rather than the composer's: a client can
   * have several hosts' sessions in one list, and only some of their agents
   * can hold more than one.
   */
  const canAddChat = (uri: SessionUri): boolean => {
    const found = sessions(app.store).find((row) => row.resource === uri)?.provider;
    return found !== undefined && capable.get(found) === true;
  };
  void host.agents().then((found) => {
    for (const entry of found) capable.set(entry.provider, entry.multipleChats === true);
    // A session may already be open by the time this lands.
    const uri = app.store.get<SessionUri>(OPEN);
    if (uri) app.store.set(CAN_ADD_CHAT, canAddChat(uri));
  }).catch(() => undefined);

  const terminals = createTerminals(app, host, failed);

  const controller: Controller = {
    async refresh() {
      try {
        writeSessions(app.store, await host.listSessions());
        app.store.set(HOST_ERROR, null);
      } catch (error) { failed(error); }
    },

    report: failed,

    /**
     * Read a different chat in the session already open.
     *
     * A whole re-subscribe rather than a swap: the transcript, the queue and
     * what is waiting all belong to the chat, so keeping any of them across
     * the change would show one conversation's state under another's name.
     */
    terminals,
    completions: (channel, text, offset) => host.completions({
      channel,
      text,
      ...(offset !== undefined ? { offset } : {}),
    }),

    openChat(chat) {
      const uri = app.store.get<SessionUri>(OPEN);
      if (!uri || app.store.get<string>(CHAT_URI) === chat) return;
      subscription?.close();
      model = [];
      app.store.set(TURNS, []);
      app.store.set(INPUT, null);
      app.store.set(QUEUE, []);
      app.store.set(CHAT_URI, chat);
      subscription = host.subscribe(uri, (event) => {
        model = applyEvent(app.store, event, model);
        if (event.type === 'status') refreshSoon();
      }, chat);
    },

    async createChat(first) {
      const uri = app.store.get<SessionUri>(OPEN);
      if (!uri) return;
      try {
        const chat = await host.createChat(uri, first);
        controller.openChat(chat);
      } catch (error) { failed(error); }
    },

    async disposeChat(chat) {
      try {
        await host.disposeChat(chat);
      } catch (error) { failed(error); return; }
      // Whatever is left. The host moves its own default; this client only
      // has to stop reading a chat that is gone.
      const left = (app.store.get<{ resource: string }[]>(CHATS) ?? [])
        .map((entry) => entry.resource)
        .filter((resource) => resource !== chat);
      const next = left[0];
      if (next) controller.openChat(next);
    },

    open(uri) {
      // Closing drops this consumer only. Unsubscribing the channel to shed a
      // duplicate is what silently kills the stream everything else reads.
      subscription?.close();
      model = [];
      // Reading it is what makes it read, and the host tells every other
      // client so. Nobody marks their own mail by hand.
      host.setRead(uri, true);
      app.store.set(OPEN, uri);
      app.store.set(TURNS, []);
      app.store.set(INPUT, null);
      // Null rather than empty: the skills are this session's, and two
      // sessions on the same host in different directories are handed
      // different ones. An empty list would say "the host gave it none",
      // which is an answer, and this is "nobody has asked yet".
      app.store.set(CUSTOMIZATIONS, null);
      app.store.set(CHATS, []);
      app.store.set(HAS_CHATS, false);
      app.store.set(CAN_ADD_CHAT, canAddChat(uri));
      app.store.set(OPEN_FILE, null);
      subscription = host.subscribe(uri, (event) => {
        model = applyEvent(app.store, event, model);
        // The open session's own status still refreshes the list here: the
        // catalogue watch below covers what the *host* says moved, and this
        // covers what this client is watching happen.
        if (event.type === 'status') refreshSoon();
      });

      // The composer's row is about the next message, so on an open session it
      // has to describe *that* session: its harness, its workspace, the
      // permission mode in force and what its last turn ran on. Left alone it
      // would keep describing whatever was chosen on the new-session screen,
      // which is a row of confident, wrong answers.
      const summary = sessions(app.store).find((found) => found.resource === uri);
      if (summary) {
        app.store.set(PROVIDER, summary.provider);
        app.store.set(WORKSPACE, (summary.workingDirectories[0] ?? '').replace(/^file:\/\//, ''));
      }
      app.store.set(CHAT_URI, null);
      void host.detail(uri).then((detail) => {
        if (app.store.get<SessionUri>(OPEN) !== uri) return;
        app.store.set(SETTINGS, detail.config.values);
        app.store.set(CHAT_URI, detail.chat);
        if (detail.model) app.store.set(MODEL, detail.model);
        offer(detail.config, uri);
      }).catch(failed);
    },

    close() {
      subscription?.close();
      subscription = null;
      app.store.set(OPEN, null);
      app.store.set(TURNS, []);
      app.store.set(INPUT, null);
      app.store.set(CUSTOMIZATIONS, null);
      app.store.set(CHATS, []);
      app.store.set(HAS_CHATS, false);
      app.store.set(CAN_ADD_CHAT, false);
      app.store.set(OPEN_FILE, null);
      // Idle, because nothing is open. A status that outlived the conversation
      // it described is a header saying "running" over an empty screen.
      writeStatus(app.store, 1);
    },

    send(text) {
      const uri = app.store.get<SessionUri>(OPEN);
      const trimmed = text.trim();
      if (!uri || trimmed === '') return;

      app.store.set(DRAFT, '');
      const history = app.store.get<string[]>('$/chat/ui/history') ?? [];
      app.store.set('$/chat/ui/history', [...history, trimmed]);

      // The model rides on the turn, not on the session: AHP hangs it on the
      // message, so the composer's choice is applied here rather than being
      // set on the session once.
      const chosen = app.store.get<string>(MODEL);

      // A turn is already running: this is a queued message, not a second
      // turn. Sending it anyway is how two turns end up interleaved in one
      // chat, and the host is not the thing that stops you.
      //
      // Queued *on the host*, which is the whole difference between a queue
      // and a list. Held here it was never sent - nothing in this client was
      // watching for the turn to end, so a message typed while the agent was
      // working sat under the transcript saying `queued` until the session was
      // closed. The host starts the next turn from the head as soon as it goes
      // idle, and every client watching this chat sees the same queue.
      if (turns(app.store).some((turn) => turn.state === 'running')) {
        host.queue(uri, trimmed, chosen || undefined);
        return;
      }
      host.say(uri, trimmed, chosen || undefined);
    },

    unqueue(id) {
      const uri = app.store.get<SessionUri>(OPEN);
      if (!uri) return;
      host.unqueue(uri, id);
    },

    stop() {
      const uri = app.store.get<SessionUri>(OPEN);
      if (uri) host.stopTurn(uri);
    },

    approve(optionId) {
      const uri = app.store.get<SessionUri>(OPEN);
      const input = pendingInput(app.store);
      if (!uri || input?.kind !== 'toolConfirmation') return;
      host.confirmToolCall(uri, input.call.id, true, optionId);
    },

    deny() {
      const uri = app.store.get<SessionUri>(OPEN);
      const input = pendingInput(app.store);
      if (!uri || input?.kind !== 'toolConfirmation') return;
      host.confirmToolCall(uri, input.call.id, false);
    },

    answer(answers, accepted = true) {
      const uri = app.store.get<SessionUri>(OPEN);
      const input = pendingInput(app.store);
      if (!uri || input?.kind !== 'chatInput') return;
      // An accept with no answers resumes the agent on the answers it already
      // had, which for a question it has just asked is none.
      const missing = input.questions.filter((q) => q.required && !answers[q.id]);
      if (accepted && missing.length > 0) return;
      host.completeInput(uri, input.id, accepted, answers);
    },

    setArchived(uri, archived) {
      host.setArchived(uri, archived);
      void controller.refresh();
    },

    setRead(uri, read) {
      host.setRead(uri, read);
      void controller.refresh();
    },

    async disposeSession(uri) {
      try {
        await host.disposeSession(uri);
      } catch (error) { failed(error); }
      if (app.store.get<SessionUri>(OPEN) === uri) controller.close();
      await controller.refresh();
    },

    async create({ provider, workingDirectory, first }) {
      // Not caught here: the caller is a screen that navigates on success, and
      // navigating into a session the host refused to create is worse than the
      // failure. It catches, and reports through `report`.
      // What the control row was set to rides on the creation. Most of what a
      // schema offers is not `sessionMutable`, so a session created without it
      // is one that can never be told.
      const config = app.store.get<Record<string, string>>(SETTINGS) ?? {};
      const uri = await host.createSession({
        provider,
        ...(workingDirectory ? { workingDirectory } : {}),
        ...(Object.keys(config).length > 0 ? { config } : {}),
      });
      await controller.refresh();
      controller.open(uri);
      // The provider is lazy: a session sits in `creating` and emits nothing
      // until there is a turn to run, so waiting for `ready` before the first
      // dispatch is a deadlock - the dispatch is what causes it.
      if (first) controller.send(first);
      return uri;
    },

    agents: () => host.agents(),
    detail: (uri) => host.detail(uri),
    config: (uri) => host.config(uri),
    customizations: (uri) => host.customizations(uri),
    harnessCommands: () => host.harnessCommands(),
    setCustomizationEnabled: (uri, id, enabled) => host.setCustomizationEnabled(uri, id, enabled),
    content: (ref) => host.content(ref),
    files: async (uri) => (await host.resourceList?.(uri)) ?? [],
    file: async (uri) => {
      if (!host.resourceRead) throw new Error('This host serves no files.');
      return await host.resourceRead(uri);
    },
    automations: async () => {
      if (!host.automations) throw new Error('This host serves no automations.');
      return await host.automations();
    },
    onAutomations: (observer) => host.onAutomations?.(observer) ?? { close: () => {} },
    createAutomation: async (definition) => {
      if (!host.createAutomation) throw new Error('This host serves no automations.');
      return await host.createAutomation(definition);
    },
    runAutomation: async (uri) => { await host.runAutomation?.(uri); },
    setAutomationEnabled: async (uri, enabled) => { await host.setAutomationEnabled?.(uri, enabled); },
    removeAutomation: async (uri) => { await host.removeAutomation?.(uri); },
    changesets: async (uri) => (await host.changesets?.(uri)) ?? [],
    changesAt: (uri, changeset) => host.changes(uri, changeset),
    review: (changeset, files, isReviewed) => { host.review?.(changeset, files, isReviewed); },

    async settings() {
      const uri = app.store.get<SessionUri>(OPEN) ?? null;
      const config = uri
        ? await host.config(uri)
        : await host.resolveConfig({
          provider: app.store.get<string>(PROVIDER) ?? 'claude',
          ...(app.store.get<string>(WORKSPACE) ? { workingDirectory: app.store.get<string>(WORKSPACE) as string } : {}),
          values: app.store.get<Record<string, string>>(SETTINGS) ?? {},
        });
      // The host had the last word: `resolveSessionConfig` echoes what it was
      // given with its own defaults filled in, so this is what is in force
      // rather than what was asked for.
      app.store.set(SETTINGS, config.values);
      offer(config, uri);
      return config;
    },

    setConfig: (uri, key, value) => host.setConfig(uri, key, value),

    pump: () => host.pump?.() ?? false,
  };

  bag.add({ dispose: () => subscription?.close() });
  // The terminal's subscription is the controller's, not a screen's - which is
  // the point of the split, and means it has to be let go here.
  bag.add({ dispose: () => { terminals.dispose(); } });
  // What the host says about sessions this client is not watching: one
  // appearing, one finishing, one starting to wait. Without it the catalogue
  // is only ever as fresh as the last time somebody navigated to it.
  const watching = host.onSessions(refreshSoon);
  bag.add({ dispose: () => watching.close() });
  for (const command of commands(app, controller, host)) bag.add(app.commands.register(command));
  for (const binding of keys()) bag.add(app.keybindings.register(binding));

  return Object.assign(controller, { dispose: () => bag.dispose() });
}

// ------------------------------------------------------------------- commands

/** What to put back when a preview is abandoned. Only this knows what it changed. */
const previous: { theme: string | null; shell: string | null } = { theme: null, shell: null };

/**
 * The composer's chips, as commands.
 *
 * Each one is a command with a single argument that has `choices`, which is
 * what lets the palette ask about it - anchored above the chip rather than in
 * the middle of the screen, but the same overlay, the same drill-in and the
 * same "an argument with no choices is answered by typing". A chip that offers
 * a list of workspaces later is this same command with a `choices` function
 * added, and no change to anything that draws it.
 *
 * The palette hands back the *label*, because labels are what a person picked
 * from: a live host's ids are opaque and sometimes whole sentences. So each
 * command resolves the label to the value the host wants, from the same list
 * it offered.
 */
interface Catalogue {
  agents: Agent[];
}

function commands(
  app: TextUIApp,
  controller: Controller,
  /*
   * The connection, for the one command that needs it directly.
   *
   * Everything else here goes through the controller, and should: it is what
   * keeps the commands from knowing there is a protocol. `changes.run` is the
   * exception because `operate` is the negotiation - a refusal, a question,
   * a retry - and wrapping that in a controller method would be hiding the
   * question, which is the part a person has to answer.
   */
  connection: HostConnection,
): CommandDefinition[] {
  const selected = (): SessionUri | null => app.store.get<SessionUri>(SELECTED) ?? null;
  const openUri = (): SessionUri | null => app.store.get<SessionUri>(OPEN) ?? null;

  /**
   * Which session a command acts on.
   *
   * The one being read, when a conversation is on screen; otherwise the one
   * selected in the catalogue. A command that only ever read the catalogue's
   * selection would archive the row you opened this from rather than the
   * session you are looking at.
   */
  const target = (): SessionUri | null =>
    (app.screens.current()?.id === 'chat' ? openUri() : null) ?? selected() ?? openUri();
  const running = (): boolean => turns(app.store).some((turn) => turn.state === 'running');

  /**
   * The catalogue, one screen above the composer.
   *
   * Reset-then-push rather than push: the catalogue is reachable from the
   * composer, from a conversation and from the palette, and pushing from each
   * of those would stack three copies of it that escape then walks back
   * through one at a time.
   */
  const toSessions = (): void => {
    app.screens.reset('new');
    app.screens.push('sessions');
    void controller.refresh();
  };

  /**
   * What the host last said it offers.
   *
   * Filled by the `choices` functions, which the palette calls when it opens
   * one of these - so the labels a person is choosing from and the list a
   * choice is resolved against are always the same fetch.
   */
  const known: Catalogue = { agents: [] };

  /*
   * Asked once at boot, not only when a palette opens one of the pickers.
   *
   * The chat commands are gated on what the agent says it can do, and a gate
   * that answers "no" until somebody happens to open an unrelated picker is a
   * command that is missing for no reason anybody can see.
   */
  const provider = (): string => app.store.get<string>(PROVIDER) ?? 'claude';
  const agent = (): Agent | undefined => known.agents.find((found) => found.provider === provider());

  const listAgents = async (): Promise<ArgChoices> => {
    try {
      known.agents = await controller.agents();
    } catch (error) { controller.report(error); }
    // The provider id is what the command is answered with, and the harness's
    // own description is what tells two of them apart - a person choosing
    // between "Copilot" and "Claude" is choosing between two sentences.
    return known.agents.map((found) => ({
      value: found.provider,
      label: found.displayName,
      ...(found.description ? { description: found.description } : {}),
    }));
  };

  const listModels = async (): Promise<ArgChoices> => {
    if (known.agents.length === 0) await listAgents();
    // The id under the name: `claude-sonnet-4-5-20250929` is what a person
    // recognises from a config file, and what they would search for.
    return (agent()?.models ?? []).map((model) => ({
      value: model.id,
      label: model.displayName,
      ...(model.displayName === model.id ? {} : { description: model.id }),
    }));
  };

  return [
    {
      /**
       * The creature, on and off, without editing a file.
       *
       * `boodFloat` in the config says what it is on startup; this says what
       * it is now. A mascot that can only be turned off by quitting, editing
       * JSON and starting again is one somebody keeps off.
       */
      id: 'bood.toggle',
      title: 'Show the creature',
      category: 'View',
      slots: ['palette'],
      run: () => {
        const showing = app.store.get<boolean>(BOOD_FLOAT) ?? false;
        app.store.set(BOOD_FLOAT, !showing);
      },
    },
    {
      id: 'app.palette',
      title: 'Command Palette',
      category: 'Navigation',
      slots: [],
      run: () => {
        app.layers.open({
          id: 'palette',
          layer: 'modal',
          scrim: true,
          trapFocus: true,
          dismissOnEscape: true,
          node: {
            component: 'CommandPalette',
            width: 62,
            commands: app.commands.list({ slot: 'palette', enabledOnly: true }),
            onClose: { handler: () => app.layers.close('palette') },
          },
        });
      },
    },
    {
      id: 'go.back',
      title: 'Back',
      category: 'Navigation',
      description: 'Return to the previous screen',
      slots: ['palette'],
      run: () => {
        // The composer is the root, so there is nothing under it to pop to -
        // and escape on the one screen that has no way back would do nothing
        // at all. From there it means "show me what already exists".
        if (app.screens.current()?.id === 'new') { toSessions(); return; }
        app.screens.pop();
      },
    },
    {
      /*
       * The other half of what a host holds.
       *
       * Not gated on a session being open, unlike `go.changes`: an automation
       * belongs to the host and outlives every session it starts, so it is
       * reachable from anywhere - including from a client that has opened
       * nothing at all.
       */
      id: 'go.automations',
      title: 'What the host runs on its own',
      category: 'Screens',
      description: 'Show the automations',
      slots: ['palette'],
      run: () => { app.screens.push('automations'); },
    },
    {
      id: 'automation.new',
      title: 'Write a new automation',
      category: 'Automations',
      description: 'A session the host starts without being asked',
      slots: ['palette'],
      run: () => { app.screens.push('automation.new'); },
    },
    {
      id: 'automation.run',
      title: 'Run this automation now',
      category: 'Automations',
      description: 'Start a run, whatever the schedule says',
      slots: ['palette'],
      when: `${AUTOMATION_ROW}`,
      run: async () => {
        const uri = app.store.get<string>(AUTOMATION_ROW) ?? '';
        const found = (app.store.get<Automation[]>(AUTOMATIONS) ?? []).find((one) => one.resource === uri);
        // The host says which verbs it will accept, and a client that pressed
        // one it did not offer would be asking to be refused. A switched-off
        // automation offers no `run`.
        if (!found?.operations.includes('run')) return;
        try { await controller.runAutomation(uri); }
        catch (error) { controller.report(error); }
      },
    },
    {
      id: 'automation.toggle',
      title: 'Switch this automation on or off',
      category: 'Automations',
      description: 'Stop it firing, or let it fire again',
      slots: ['palette'],
      when: `${AUTOMATION_ROW}`,
      run: async () => {
        const uri = app.store.get<string>(AUTOMATION_ROW) ?? '';
        const found = (app.store.get<Automation[]>(AUTOMATIONS) ?? []).find((one) => one.resource === uri);
        if (!found?.operations.includes('update')) return;
        try { await controller.setAutomationEnabled(uri, !found.enabled); }
        catch (error) { controller.report(error); }
      },
    },
    {
      id: 'automation.remove',
      title: 'Forget this automation',
      category: 'Automations',
      description: 'Delete it and everything it has done',
      slots: ['palette'],
      when: `${AUTOMATION_ROW}`,
      run: async () => {
        const uri = app.store.get<string>(AUTOMATION_ROW) ?? '';
        const found = (app.store.get<Automation[]>(AUTOMATIONS) ?? []).find((one) => one.resource === uri);
        if (!found?.operations.includes('remove')) return;
        /*
         * Asked, because nothing gives it back.
         *
         * The protocol has no confirmation on this the way a changeset
         * operation carries one, so the question is this client's own - which
         * is the right way round: the host cannot know that a person is about
         * to lose the only copy of a schedule they wrote.
         */
        const yes = await confirm(app.layers, {
          title: 'Forget this automation?',
          message: `${found.title} and its history go, and nothing here brings them back.`,
          confirmLabel: 'Forget it',
          cancelLabel: 'Keep it',
          tone: 'danger',
        });
        if (!yes) return;
        try {
          await controller.removeAutomation(uri);
          app.store.set(AUTOMATION_ROW, '');
        }
        catch (error) { controller.report(error); }
      },
    },
    {
      id: 'go.sessions',
      title: 'Sessions',
      category: 'Screens',
      description: 'List all sessions',
      slots: ['palette'],
      run: () => toSessions(),
    },
    {
      id: 'go.new',
      title: 'New session',
      category: 'Screens',
      description: 'Start a new conversation',
      slots: ['palette'],
      run: () => { app.screens.reset('new'); app.focus.focus('chat.composer'); },
    },
    {
      id: 'go.changes',
      title: 'What this session changed',
      category: 'Screens',
      description: 'Show the files',
      slots: ['palette'],
      when: `${OPEN}`,
      // Always the list, never wherever it was left. A screen that reopens on
      // the one file somebody read an hour ago hides the other nineteen.
      run: () => { app.store.set(OPEN_FILE, null); app.screens.push('changes'); },
    },
    {
      /*
       * The host's filesystem, which is where the project actually is.
       *
       * Beside the changes screen rather than under it: what changed and what
       * is there are different questions, and a browser that only ever showed
       * the changed files would be a changeset with a worse name.
       */
      id: 'go.files',
      title: 'Browse the host\'s files',
      category: 'Screens',
      description: 'The project, as the host sees it',
      slots: ['palette'],
      when: `${OPEN}`,
      run: () => {
        // Always back at the top. A browser that reopens six directories deep
        // is one nobody can tell from a broken one.
        app.store.set(FILES_OPEN, '');
        app.store.set(FILES_AT, '');
        app.screens.push('files');
      },
    },
    {
      id: 'go.skills',
      title: 'Skills and commands',
      category: 'Screens',
      description: 'What plugins and directories gave this session',
      slots: ['palette'],
      when: `${OPEN}`,
      run: () => app.screens.push('skills'),
    },
    {
      id: 'go.mcp',
      title: 'MCP servers',
      category: 'Screens',
      description: 'Which servers this session has, and whether they answered',
      slots: ['palette'],
      when: `${OPEN}`,
      run: () => app.screens.push('mcp'),
    },
    {
      /*
       * The next changeset this session offers.
       *
       * One key rather than a picker widget, because the list is short and
       * every entry is a whole screen: cycling is what a person does to see
       * the other three, and a menu to choose between four things you are
       * about to look at anyway is a step in the way.
       *
       * Only the ones that are already URIs. A template with `{turnId}` still
       * in it is a question about a turn, and there is nothing on this screen
       * to answer it from - which is why the greyed rows say so rather than
       * being silently dropped.
       */
      id: 'changes.scope',
      title: 'Next changeset',
      category: 'Changes',
      run: () => {
        const offered = (app.store.get<ChangesetScope[]>(CHANGE_SCOPES) ?? [])
          .filter((scope) => scope.variables.length === 0);
        if (offered.length === 0) return;
        const at = app.store.get<string>(CHANGE_AT) ?? '';
        const seen = offered.findIndex((scope) => scope.uriTemplate === at);
        const next = offered[(seen + 1) % offered.length];
        app.store.set(CHANGE_AT, next?.uriTemplate ?? '');
        // The open file belongs to the changeset it came from.
        app.store.set(OPEN_FILE, null);
      },
    },
    {
      /*
       * Ticking the row off, which is a note about reading rather than a change.
       *
       * The host keeps it and tells every client, so nothing is written here -
       * what redraws the tick is the changeset coming back. That is the whole
       * reason it is worth having: two people reading one diff can see which
       * files the other has been through.
       */
      id: 'changes.review',
      title: 'Mark this file read',
      category: 'Changes',
      run: () => {
        const at = app.store.get<string>(CHANGE_AT) ?? '';
        const row = app.store.get<string>(CHANGE_ROW) ?? '';
        if (!at || !row) return;
        const held = app.store.get<Changeset>(CHANGES_AT_PATH);
        const file = held?.files.find((one) => one.uri === row);
        controller.review(at, [row], file?.reviewed !== true);
      },
    },
    {
      /*
       * Run the verb the changeset offers, asking first where the host said to.
       *
       * One command rather than one per verb, with the id as an argument, for
       * the reason the config settings are registered the other way round: the
       * *settings* are a fixed schema a host publishes once, and these change
       * with every changeset - a command per operation would be registering
       * and disposing three of them each time the scope moves.
       *
       * The confirmation is not optional. The protocol says a client MUST
       * display it before invoking, and its presence is also how the host says
       * the operation is destructive - so this is the screen's half of what
       * `--yes` is in the shell.
       */
      id: 'changes.run',
      title: 'Do something with these changes',
      category: 'Changes',
      when: `${SCREEN} == 'changes'`,
      args: [{
        name: 'operation',
        type: 'string' as const,
        required: true,
        description: 'Which of the verbs this changeset offers',
        // What the changeset advertises, now. An id that was not offered is
        // one the host will refuse, so there is nothing to gain by listing
        // more than it says.
        choices: () => {
          const held = app.store.get<Changeset>(CHANGES_AT_PATH);
          return (held?.operations ?? [])
            .filter((one) => one.status !== 'disabled')
            .map((one) => ({ value: one.id, label: one.label, description: one.description ?? '' }));
        },
      }],
      run: async (given?: Record<string, unknown>) => {
        const at = app.store.get<string>(CHANGE_AT) ?? '';
        const held = app.store.get<Changeset>(CHANGES_AT_PATH);
        const wanted = String(given?.operation ?? '');
        const operation = (held?.operations ?? []).find((one) => one.id === wanted);
        if (!at || !operation) return;
        const row = app.store.get<string>(CHANGE_ROW) ?? '';
        const onFile = !operation.scopes.includes('changeset');
        if (onFile && !row) return;

        if (operation.confirmation !== undefined) {
          const yes = await confirm(app.layers, {
            title: operation.label,
            message: operation.confirmation,
            confirmLabel: operation.label,
            cancelLabel: 'Leave it',
            // The presence of a confirmation is the host calling this
            // destructive, so the button is styled as one.
            tone: 'danger',
          });
          if (!yes) return;
        }
        try {
          const done = await operate(connection, at, wanted, {
            ...(onFile ? { target: { kind: 'resource' as const, resource: row } } : {}),
            /*
             * Asked here as well, and separately.
             *
             * "Discard this file" and "let this host write to your repository"
             * are two different questions, and answering the first is not
             * answering the second. A client that took the grant silently
             * would be one where saying yes to a diff quietly hands over the
             * working tree.
             */
            ask: (request: { uri: string }) => confirm(app.layers, {
              title: 'Let the host write?',
              message: `${operation.label} needs write access to ${request.uri.replace(/^file:\/\//, '')}.`,
              confirmLabel: 'Allow',
              cancelLabel: 'No',
              tone: 'danger',
            }),
          });
          // The host's own sentence about what it did, shown where a refusal
          // would be. A silent success on a destructive verb reads as one that
          // did not happen.
          if (done.message !== undefined) app.store.set(HOST_ERROR, done.message);
        }
        catch (error) { controller.report(error); }
      },
    },
    {
      id: 'changes.close',
      title: 'Back to the file list',
      category: 'Screens',
      description: 'Close the open file',
      // Not in the palette: it is what escape does on one screen, and a
      // palette entry for it would be offering "go back" as a command.
      slots: [],
      when: `${OPEN_FILE}`,
      run: () => app.store.set(OPEN_FILE, null),
    },
    {
      id: 'go.settings',
      title: 'Session settings',
      category: 'Screens',
      description: 'Settings for this session',
      slots: ['palette'],
      when: `${OPEN}`,
      run: () => app.screens.push('settings'),
    },
    {
      id: 'go.hosts',
      title: 'Hosts',
      category: 'Screens',
      description: 'Manage all hosts',
      slots: ['palette'],
      run: () => app.screens.push('hosts')
    },

    /**
     * Markdown, or the characters the agent typed.
     *
     * An agent writes markdown, so drawing it is the default - reading
     * `**this**` is reading the punctuation instead of the sentence. Off is
     * for when the punctuation *is* what you are after: copying a fenced
     * block out with its fence, checking whether a table is a table or four
     * lines with pipes in them, reading a link's target rather than its
     * label.
     *
     * A toggle rather than two commands, because there are two states and the
     * screen shows you which one you are in.
     */
    {
      id: 'view.markdown',
      title: 'Markdown or raw text',
      category: 'View',
      description: 'Draw what the agent said as markdown, or as it typed it',
      slots: ['palette'],
      run: () => {
        const on = app.store.get<boolean>(MARKDOWN) ?? true;
        app.store.set(MARKDOWN, !on);
      },
    },
    // Appearance is a registration, not a rewrite. The same graph is mounted
    // under whichever theme and shell are chosen, which is the claim the
    // runtime makes and the one an example is meant to be evidence for.
    {
      id: 'view.theme',
      title: 'Theme',
      category: 'View',
      description: 'Change the colors and shapes',
      slots: ['palette'],
      // The command says what it needs and the palette asks. Wearing it while
      // the highlight moves is what makes a theme choosable at all: the names
      // mean nothing until the screen is in one.
      args: [{
        name: 'id',
        type: 'string' as const,
        required: true,
        choices: app.themes.list().map((theme) => theme.id),
        default: app.theme.id,
        preview: (value: string | null) => {
          previous.theme ??= app.theme.id;
          if (value === null) {
            if (previous.theme) app.setTheme(previous.theme);
            previous.theme = null;
            return;
          }
          app.setTheme(value);
        },
      }],
      run: (args: Record<string, unknown>) => {
        previous.theme = null;
        if (args.id) app.setTheme(String(args.id));
      },
    },
    {
      id: 'view.shell',
      title: 'Layout',
      category: 'View',
      description: 'Change the layout and controls',
      slots: ['palette'],
      args: [{
        name: 'id',
        type: 'string' as const,
        required: true,
        choices: app.shells.list().map((shell) => shell.id),
        default: app.activeShell(),
        preview: (value: string | null) => {
          previous.shell ??= app.activeShell();
          if (value === null) {
            if (previous.shell) app.setShell(previous.shell);
            previous.shell = null;
            return;
          }
          app.setShell(value);
        },
      }],
      run: (args: Record<string, unknown>) => {
        previous.shell = null;
        if (args.id) app.setShell(String(args.id));
      },
    },

    // The composer's control row. Four questions about what the next message
    // will be sent as, each asked by the palette, anchored above its chip.
    {
      id: 'compose.harness',
      title: 'Harness',
      category: 'Compose',
      description: 'Select the agent harness',
      slots: ['palette'],
      // Fixed once a session exists: it is the process the conversation is
      // running in, and a chip offering to change it would be offering a lie.
      when: `!${OPEN}`,
      args: [{
        name: 'id',
        type: 'string' as const,
        required: true,
        description: 'Which agent runs this',
        choices: listAgents,
      }],
      run: (args: Record<string, unknown>) => {
        const chosen = known.agents.find((found) => found.provider === String(args.id));
        if (!chosen) return;
        app.store.set(PROVIDER, chosen.provider);
        // A model belongs to a harness. Kept across a change it names one the
        // new harness has never heard of, and the host refuses the turn.
        app.store.set(MODEL, '');
      },
    },
    {
      id: 'compose.model',
      title: 'Model',
      category: 'Compose',
      description: 'Select the model',
      slots: ['palette'],
      args: [{
        name: 'id',
        type: 'string' as const,
        required: true,
        description: 'What the next message runs on',
        choices: listModels,
      }],
      run: (args: Record<string, unknown>) => {
        // The id, not the label. AHP hangs the model on the message, so this
        // is what rides on the next `chat/turnStarted`.
        const chosen = agent()?.models.find((model) => model.id === String(args.id));
        if (chosen) app.store.set(MODEL, chosen.id);
      },
    },
    /*
     * A session holds chats, and these are how a person moves between them.
     *
     * Gated on the agent advertising `multipleChats`: a host that does not is
     * one where `createChat` MUST NOT be called, so the command is not
     * offered rather than offered and refused.
     */
    {
      id: 'chat.new',
      title: 'New chat here',
      category: 'Session',
      description: 'Open another conversation in this session',
      slots: ['palette'],
      when: CAN_ADD_CHAT,
      run: () => void controller.createChat(),
    },
    {
      id: 'chat.switch',
      title: 'Chat',
      category: 'Session',
      description: 'Read a different conversation in this session',
      slots: ['palette'],
      when: HAS_CHATS,
      args: [{
        name: 'chat',
        type: 'string' as const,
        required: true,
        description: 'Which conversation to read',
        get default(): string | undefined {
          return app.store.get<string>(CHAT_URI) ?? undefined;
        },
        choices: () => (app.store.get<{ resource: string; title: string }[]>(CHATS) ?? [])
          .map((entry, index) => ({
            value: entry.resource,
            // The title, and its place in the session: two chats begun from
            // the same first message are two rows reading the same thing.
            label: `${String(index + 1)}. ${entry.title}`,
          })),
      }],
      run: (args: Record<string, unknown>) => { controller.openChat(String(args.chat)); },
    },
    {
      id: 'chat.close',
      title: 'Close this chat',
      category: 'Session',
      description: 'Dispose the conversation being read',
      slots: ['palette'],
      when: HAS_CHATS,
      run: () => {
        const chat = app.store.get<string>(CHAT_URI);
        if (chat) void controller.disposeChat(chat);
      },
    },
    /*
     * A shell on the host machine.
     *
     * Not gated: a host that runs none answers an empty list and refuses to
     * open one, and the screen says so - which is a better answer than a
     * command that is missing for a reason nobody can see.
     */
    {
      id: 'terminal.new',
      title: 'Open a terminal',
      category: 'Terminal',
      description: 'Start a shell on the host, in a directory it serves',
      slots: ['palette'],
      run: () => {
        const where = app.store.get<string>(WORKSPACE);
        void controller.terminals.open(where ? { cwd: where } : {}).then(() => {
          app.screens.push('terminal');
          app.focus.focus('terminal.input');
        });
      },
    },
    {
      id: 'terminal.interrupt',
      title: 'Interrupt',
      category: 'Terminal',
      description: 'Send ctrl+c to the shell',
      slots: ['palette'],
      when: OPEN_TERMINAL,
      // `\u0003` is what a terminal sends for ctrl+c, and the shell is what
      // decides what to do with it - which is the point: stopping a command
      // is the shell's job, not this client's.
      run: () => { controller.terminals.write('\u0003'); },
    },
    {
      id: 'terminal.close',
      title: 'Close this terminal',
      category: 'Terminal',
      description: 'Kill the shell being read',
      slots: ['palette'],
      when: OPEN_TERMINAL,
      run: () => void controller.terminals.close(),
    },
    {
      id: 'go.terminal',
      title: 'Terminals',
      category: 'Go',
      description: 'The shells running on the host',
      slots: ['palette'],
      run: () => { app.screens.push('terminal'); },
    },
    {
      id: 'compose.workspace',
      title: 'Workspace',
      category: 'Compose',
      description: 'Select the workspace',
      slots: ['palette'],
      when: `!${OPEN}`,
      // No `choices`, so the palette asks for it as text - the same overlay,
      // with its field as the answer rather than as a filter. Give it a
      // `choices` function later and the same chip becomes a list of
      // workspaces without anything else changing.
      args: [{
        name: 'path',
        type: 'string' as const,
        required: true,
        description: 'Where the agent works. A path on the host, not on this machine.',
      }],
      run: (args: Record<string, unknown>) => {
        const path = String(args.path ?? '').trim();
        if (path) app.store.set(WORKSPACE, path);
      },
    },
    {
      id: 'compose.start',
      title: 'Start a session with what has been typed',
      category: 'Compose',
      slots: ['palette'],
      when: `!${OPEN}`,
      run: () => {
        const first = (app.store.get<string>(DRAFT) ?? '').trim();
        if (!first) return;
        void controller.create({
          provider: provider(),
          ...(app.store.get<string>(WORKSPACE) ? { workingDirectory: app.store.get<string>(WORKSPACE) as string } : {}),
          first,
        })
          .then(() => app.screens.push('chat'))
          .catch((error: unknown) => controller.report(error));
      },
    },

    {
      id: 'session.open',
      title: 'Open session',
      category: 'Session',
      description: 'Show the conversation',
      slots: ['palette'],
      run: (args: Record<string, unknown>) => {
        const uri = (typeof args.uri === 'string' ? args.uri : null) ?? selected();
        if (!uri) return;
        controller.open(uri);
        app.screens.push('chat');
      },
      args: [{ name: 'uri', type: 'string' as const }],
    },
    {
      id: 'session.new',
      title: 'New session',
      category: 'Session',
      description: 'Start a new conversation',
      slots: ['palette'],
      run: () => {
        // Nothing open, so the control row describes a session that does not
        // exist yet rather than the one that was on screen a moment ago.
        controller.close();
        app.screens.reset('new');
        app.focus.focus('chat.composer');
      },
    },
    {
      id: 'session.refresh',
      title: 'Refresh the catalogue',
      category: 'Session',
      description: 'Reload list from the host',
      slots: ['palette'],
      keepOpen: true,
      run: () => void controller.refresh(),
    },
    {
      id: 'session.archive',
      title: 'Archive / unarchive',
      category: 'Session',
      description: 'Hide or show this session',
      slots: ['palette'],
      run: () => {
        const uri = target();
        // Every session, not the visible ones. An archived session is hidden
        // by default, so reading the flag off the filtered list found nothing,
        // fell back to a status of zero, and archived it a second time - which
        // is a toggle that only ever goes one way.
        const session = sessions(app.store).find((found) => found.resource === uri);
        if (!uri || !session) return;
        controller.setArchived(uri, (session.status & SessionFlag.IsArchived) === 0);
      },
    },
    {
      id: 'session.read',
      title: 'Mark read / unread',
      category: 'Session',
      description: 'Mark this session read or unread',
      slots: ['palette'],
      run: () => {
        const uri = target();
        const session = sessions(app.store).find((found) => found.resource === uri);
        if (!uri || !session) return;
        controller.setRead(uri, (session.status & SessionFlag.IsRead) === 0);
      },
    },
    {
      id: 'session.dispose',
      title: 'Dispose session',
      category: 'Session',
      description: 'Delete this session',
      slots: ['palette'],
      run: async () => {
        const uri = target();
        if (!uri) return;
        // The host frees the session and tells every other client. Ending
        // somebody else's conversation is not an undo, so it is asked for.
        const yes = await confirm(app.layers, {
          title: 'Dispose session',
          message: 'The host ends this session for every client watching it. The record of what happened stays.',
          confirmLabel: 'Dispose',
          cancelLabel: 'Keep',
          tone: 'danger',
        });
        if (yes) await controller.disposeSession(uri);
      },
    },
    {
      id: 'session.toggleArchived',
      title: 'Show archived sessions',
      category: 'Session',
      description: 'List archived sessions',
      slots: ['palette'],
      keepOpen: true,
      run: () => app.store.set(ARCHIVED, !(app.store.get<boolean>(ARCHIVED) ?? false)),
    },

    {
      id: 'chat.stop',
      title: 'Stop the turn',
      category: 'Chat',
      description: 'Force session to stop running',
      slots: ['palette'],
      // On the screen that is showing the turn. A session left open behind
      // you keeps its status - a blocked one reads 24 for ever - so a clause
      // that only asked "is something running" swallowed `ctrl+c` on every
      // other screen from the moment a session was first opened, and the
      // application could never be closed again.
      when: `${SCREEN} == 'chat' && ${RUNNING}`,
      run: () => controller.stop(),
    },
    {
      id: 'chat.approve',
      title: 'Approve what the agent is waiting on',
      category: 'Chat',
      description: 'Approve the tool call ',
      slots: ['palette'],
      run: (args: Record<string, unknown>) => controller.approve(typeof args.option === 'string' ? args.option : undefined),
      args: [{ name: 'option', type: 'string' as const }],
    },
    {
      id: 'chat.deny',
      title: 'Deny it',
      category: 'Chat',
      description: 'Deny the tool call',
      slots: ['palette'],
      run: () => controller.deny()
    },
    {
      id: 'chat.send',
      title: 'Send a message',
      category: 'Chat',
      description: 'Send a message',
      slots: ['palette'],
      args: [{ name: 'text', type: 'string' as const, required: true, description: 'What to say' }],
      run: (args: Record<string, unknown>) => controller.send(String(args.text ?? '')),
    },
    {
      id: 'chat.focusComposer',
      title: 'Write a message',
      category: 'Chat',
      description: 'Focus the composer',
      slots: ['palette'],
      run: () => app.focus.focus('chat.composer'),
    },
    {
      id: 'session.filter',
      title: 'Filter the catalogue',
      category: 'Session',
      description: 'Filter the catalogue',
      slots: ['palette'],
      run: () => app.focus.focus('chat.filter'),
    },
    /**
     * The detail pane, as a drawer.
     *
     * Right opens it and left puts it away: the key points at the pane. It is
     * on the right of the screen, so right is where you go to read it and
     * left is the way back to the list - which is also what makes the pair
     * work above `splitAt`, where the pane is always out and the same two
     * keys just move the keyboard between the halves.
     *
     * Opening is going there. There is no state where the pane is out and
     * nobody is reading it, because the width follows the focus and a wide
     * pane nobody asked for is the session list being narrow for nothing.
     *
     * Tab still walks the screen. It is the way *out* of a text field, where
     * left and right are letters, and taking it away would strand anyone who
     * had reached the filter box.
     */
    {
      id: 'session.openDetails',
      title: 'Open the session detail',
      category: 'Session',
      description: 'Show the detail pane, and read it',
      slots: ['palette'],
      run: () => {
        app.store.set(SIDEBAR, true);
        app.focus.focus('chat.details');
      },
    },
    {
      id: 'session.closeDetails',
      title: 'Put the session detail away',
      category: 'Session',
      description: 'Hide the detail pane, and give the list the width',
      slots: ['palette'],
      run: () => {
        // The focus first. Unmounting the pane the keyboard is in leaves the
        // focus on a node that is no longer there, and the next key goes
        // nowhere at all.
        app.focus.focus('chat.sessions');
        // Only below the split, where the pane is a drawer. Above it, both
        // panes are always drawn and this key is the way back to the list.
        const width = app.store.get<number>(SPLIT_AT) ?? SPLIT_DEFAULT;
        if (app.size.width <= width) app.store.set(SIDEBAR, false);
      },
    },
    {
      id: 'chat.focusTranscript',
      title: 'Read the transcript',
      category: 'Chat',
      description: 'Focus the transcript',
      slots: ['palette'],
      run: () => app.focus.focus('chat.transcript'),
    },
    {
      id: 'chat.clearQueue',
      title: 'Drop queued messages',
      category: 'Chat',
      description: 'Drop queued messages',
      slots: ['palette'],
      when: `${QUEUE}`,
      // One dispatch each, because that is what the protocol offers - and the
      // list comes back from the host rather than being emptied here, so a
      // message another client queued in the meantime is not silently dropped
      // by a client that never knew about it.
      run: () => {
        for (const message of queue(app.store)) controller.unqueue(message.id);
      },
    },
    {
      id: 'chat.expand',
      title: 'Expand / collapse the selected block',
      category: 'Chat',
      description: 'Expand / collapse the selected block',
      slots: [],
      run: (args: Record<string, unknown>) => {
        const id = String(args.id ?? '');
        if (!id) return;
        const expanded = app.store.get<Record<string, boolean>>(EXPANDED) ?? {};
        app.store.set(EXPANDED, { ...expanded, [id]: !expanded[id] });
      },
      args: [{ name: 'id', type: 'string' as const }],
    },
    {
      id: 'chat.running',
      title: 'Is a turn running',
      category: 'Chat',
      description: 'Is a turn running',
      slots: [],
      run: () => running(),
    },
  ];
}

// ----------------------------------------------------------------------- keys

/**
 * What the keyboard does, and where.
 *
 * Two tiers, and the split is not cosmetic. Modified keys are global because
 * nothing types them. Single letters are registered against the transcript's
 * focus scope, because while the composer has focus they are letters.
 */
function keys(): {
  keys: string;
  commandId: string;
  scopeId?: string;
  when?: string;
  args?: Record<string, unknown>;
  priority?: number;
}[] {
  return [
    // Global: nothing types these, so they are safe wherever focus is.
    { keys: 'ctrl+p', commandId: 'app.palette' },
    { keys: 'ctrl+g', commandId: 'bood.toggle' },
    // The clause is on the *binding*, not only on the command. A binding that
    // matches has handled the key - whether or not the command it names then
    // declines to run - so a `when` that lives only on the command swallows
    // `ctrl+c` and it never reaches the one below that closes the application.
    { keys: 'ctrl+c', commandId: 'chat.stop', when: `${SCREEN} == 'chat' && ${RUNNING}` },
    /*
     * On the terminal screen, `ctrl+c` belongs to the shell.
     *
     * It is how a person stops a command, and it reached the binding below
     * instead - so interrupting a `ping` closed the whole application. The
     * clause is on the binding for the same reason as the one above: a
     * binding that matches has handled the key, and a `when` only on the
     * command swallows it without passing it on.
     */
    { keys: 'ctrl+c', commandId: 'terminal.interrupt', when: `${SCREEN} == 'terminal' && ${OPEN_TERMINAL}` },
    { keys: 'ctrl+n', commandId: 'session.new' },
    { keys: 'ctrl+r', commandId: 'session.refresh' },
    { keys: 'ctrl+t', commandId: 'view.theme' },
    /*
     * Three, and `alt+m` is the one to reach for.
     *
     * Ctrl+M and Return are the same byte. In raw mode the Return key sends
     * CR, `0x0d`, and this decoder names that `enter` - deliberately, and
     * with a comment saying so. A terminal speaking the kitty protocol or
     * xterm's `modifyOtherKeys` sends the two apart and `ctrl+m` arrives as
     * itself; everywhere else it cannot, and no binding here can change that.
     * It is kept for the terminals that can, and it is not the one to
     * document.
     *
     * `alt+m` has no such collision: it arrives as ESC then `m`, which this
     * decoder reads as alt+the key - so it works over SSH, in tmux and on a
     * console that has never heard of the kitty protocol. Global, because
     * nothing types it.
     *
     * And `m` on its own in the chat scope, where letters are letters only
     * while the composer holds them - the same bargain `c`, `s` and `t`
     * already made on this screen.
     */
    { keys: 'alt+m', commandId: 'view.markdown' },
    { keys: 'ctrl+m', commandId: 'view.markdown' },
    { keys: 'm', commandId: 'view.markdown', scopeId: CHAT_SCOPE },
    { keys: 'escape', commandId: 'go.back' },

    // The catalogue.
    { keys: 'n', commandId: 'session.new', scopeId: SESSIONS_SCOPE },
    { keys: 'r', commandId: 'session.refresh', scopeId: SESSIONS_SCOPE },
    { keys: 'a', commandId: 'session.archive', scopeId: SESSIONS_SCOPE },
    { keys: 'u', commandId: 'session.read', scopeId: SESSIONS_SCOPE },
    { keys: 'x', commandId: 'session.toggleArchived', scopeId: SESSIONS_SCOPE },
    { keys: 'd', commandId: 'session.dispose', scopeId: SESSIONS_SCOPE },
    // The key somebody reaches for without being told, beside the letter they
    // had to be. Both, because `delete` is the guess and `d` is what the
    // footer has room to name. It confirms either way - ending somebody
    // else's conversation is not an undo.
    { keys: 'delete', commandId: 'session.dispose', scopeId: SESSIONS_SCOPE },
    { keys: '/', commandId: 'session.filter', scopeId: SESSIONS_SCOPE },
    // Scoped, not global, and after the focused node has had its turn: while
    // the filter box has the keyboard these two are caret movement, and the
    // runtime offers the key there first.
    { keys: 'right', commandId: 'session.openDetails', scopeId: SESSIONS_SCOPE },
    { keys: 'left', commandId: 'session.closeDetails', scopeId: SESSIONS_SCOPE },

    // The conversation. `i` is the one that gets you into the composer, and
    // out of it is escape - the pair that makes every other letter reachable.
    { keys: 'c', commandId: 'go.changes', scopeId: CHAT_SCOPE },
    { keys: 'f', commandId: 'go.files', scopeId: CHAT_SCOPE },
    /*
     * On the changes screen, and nowhere else.
     *
     * `]` rather than `tab`, which was the obvious choice and does not work:
     * tab is how focus moves and the runtime has already spent it before any
     * binding sees it. `]` is typed by nothing here and reads as "the next
     * one", which is what it does.
     *
     * `r` is a letter, so it lives in the changes scope for the same reason
     * `c` lives in the chat one - it must not fire while something is being
     * typed on another screen.
     */
    { keys: ']', commandId: 'changes.scope', scopeId: CHANGES_SCOPE },
    { keys: 'r', commandId: 'changes.review', scopeId: CHANGES_SCOPE },
    // `x` for "do something to this". The command takes which one as an
    // argument, so the key opens the picker rather than committing to a verb -
    // which is right, because the verbs differ per changeset and per host.
    { keys: 'x', commandId: 'changes.run', scopeId: CHANGES_SCOPE },
    // Scoped to the screen, so a letter is a letter everywhere else. `enter`
    // runs one and is the list's own, which leaves the switch and the
    // one that does not come back.
    { keys: 'n', commandId: 'automation.new', scopeId: AUTOMATIONS_SCOPE },
    { keys: 'e', commandId: 'automation.toggle', scopeId: AUTOMATIONS_SCOPE },
    { keys: 'd', commandId: 'automation.remove', scopeId: AUTOMATIONS_SCOPE },
    { keys: 's', commandId: 'go.settings', scopeId: CHAT_SCOPE },
    { keys: 't', commandId: 'chat.stop', scopeId: CHAT_SCOPE },
    { keys: 'k', commandId: 'go.skills', scopeId: CHAT_SCOPE },
    { keys: 'p', commandId: 'go.mcp', scopeId: CHAT_SCOPE },

    /**
     * An open file closes before the screen does.
     *
     * Two bindings on `escape`, and the priority is what decides between
     * them rather than the order they happen to be written in - the registry
     * sorts by priority and leaves ties in insertion order, which is a rule
     * about this array that nothing in this array says.
     *
     * The clause is on the binding as well as on the command, for the reason
     * given above `ctrl+c`: a binding that matches has handled the key even
     * when the command declines, so an escape with no file open would be
     * swallowed here and never reach `go.back`.
     */
    { keys: 'escape', commandId: 'changes.close', when: `${OPEN_FILE}`, priority: 10 },
  ];
}
