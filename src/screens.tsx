import type { BindingPath, RenderOutput, SemanticVariant, TextUIApp } from '@textui/core';
import {
  defineComponent,
  useApp,
  useCapabilities,
  useEffect,
  useFocusScope,
  useMemo,
  useRequiredService,
  useSize,
  useState,
  useStore,
  useStoreSubtree,
  useStoreValue,
  useTheme,
} from '@textui/core';
import { Badge, Column, Divider, EmptyState, Marquee, Panel, RadioGroup, Row, SearchBox, argumentOf } from '@textui/widgets';
import {
  CHANGES_SCOPE, CHAT_SCOPE, CONTROLLER, MCP_SCOPE, SESSIONS_SCOPE, SKILLS_SCOPE, settingCommand,
} from './control.js';
import { branchName,
  ARCHIVED, CHANGES, CUSTOMIZATIONS, DRAFT, EXPANDED, FILTER, FOCUS, HISTORY, HOST, INPUT,
  CHANGE_AT, CHANGE_ROW, CHANGE_SCOPES, FILES_AT, FILES_ENTRIES, FILES_OPEN,
  MODEL, OPEN, OPEN_FILE, CHAT_URI, PROVIDER, QUEUE, SELECTED, SESSIONS, SETTINGS, SIDEBAR,
  CHATS, OPEN_TERMINAL, SPLIT_AT, SPLIT_DEFAULT, TERMINAL, TERMINALS, TURNS, WORKSPACE,
  openSession, visibleSessions, workspaceName,
} from './state.js';
import type { HostState } from './state.js';
import { toBlocks } from './blocks.js';
import type {
  Agent, Changeset, ChangesetScope, Completion, ContentRef, Customization, FileContent, PendingInput, QueuedMessage, ResourceEntry,
  TerminalRow, TerminalState,
  SessionConfig, SessionDetail, SessionSummary, SlashCommand, Turn,
} from './ahp/types.js';
import { decodeStatus } from './ahp/status.js';
import { ChatTranscript } from './view/transcript.js';
import { ChatComposer } from './view/composer.js';
import { ChatSessionHead } from './view/sessionhead.js';
import { Creature } from './view/creature.js';
import { settingIcon, valueIcon } from './view/icons.js';
import { ChatHitl } from './view/hitl.js';
import { ChangesList } from './view/changes.js';
import { FileList } from './view/files.js';
import { CustomizationList } from './view/customizations.js';
import { TerminalView } from './view/terminal.js';
import { FileDiff } from './view/filediff.js';
import { diffLines } from './diff.js';
import { ConnectionBadge, SessionList } from './view/sessions.js';
import { SessionDetails } from './view/details.js';
import type { DetailField } from './view/details.js';
import { openPicker } from './view/picker.js';
import type { ComposerOption } from './view/controls.js';


/**
 * The screens.
 *
 * Eight, and each is a different question: which conversation, the
 * conversation itself, starting one, what it changed, how it is configured,
 * which host any of it is on, what the host handed it, and which of its tools
 * are answering. Anything else that came up - a tool call's full output, the
 * command palette, a confirm - is a layer or an expansion inside one of these,
 * because none of them is a place you navigate *to*.
 *
 * Every screen is composition. The parts are in `view/`, the actions are in
 * `control.ts`, and what is left here is which part goes where.
 */

/**
 * Everything the catalogue knows about one session, as rows.
 *
 * Two sources, and they are not interchangeable: the summary is what
 * `listSessions` returns and the detail is the session channel's own state -
 * the chat URI, the lifecycle and the settings in force are only ever on the
 * second. A pane that showed the summary alone could not answer "which chat is
 * this" or "what may it do without asking", which are the two questions
 * somebody reading a catalogue of agents actually has.
 */
function describe(session: SessionSummary, detail: SessionDetail | null): DetailField[] {
  const status = decodeStatus(session.status);
  const setting = (key: string): string => {
    const value = detail?.config.values[key];
    if (value === undefined) return '';
    // The host's own wording. `acceptEdits` is an id, "Accept edits" is what
    // the schema calls it, and the provider is the authority on both.
    const property = detail?.config.properties.find((found) => found.key === key);
    return property?.values.find((choice) => choice.value === value)?.label ?? value;
  };
  const changes = session.changes;

  return [
    { id: 'status', label: 'Status', value: status.label, tone: status.tone as SemanticVariant },
    { id: 'activity', label: 'Doing', value: session.activity ?? detail?.activity ?? '', absent: 'nothing it says' },
    { id: 'flags', label: 'Flags', value: [status.read ? 'read' : 'unread', status.archived ? 'archived' : ''].filter(Boolean).join(', ') },
    { id: 'provider', label: 'Harness', value: session.provider },
    { id: 'model', label: 'Model', value: detail?.model ?? '', absent: 'nothing said yet' },
    // The host's own questions, in the host's own order. Naming them here is
    // how the pane came to show a blank "Permissions" against a host whose key
    // for it is `autoApprove`.
    ...(detail?.config.properties ?? [])
      .filter((property) => property.values.length > 0)
      .map((property) => ({
        id: `config.${property.key}`,
        label: property.title,
        value: setting(property.key),
      })),
    { id: 'workspace', label: 'Workspace', value: session.workingDirectories.map((dir) => dir.replace(/^file:\/\//, '')).join(', '), absent: 'the host\'s own directory' },
    { id: 'branch', label: 'Branch', value: branchName(session) ?? '', absent: 'not a repository, or the host does not say' },
    // The identifiers, in full and copyable. A URI you can read half of is
    // worse than one you cannot see at all: it looks like the whole thing.
    { id: 'session', label: 'Session', value: session.resource },
    { id: 'chat', label: 'Chat', value: detail?.chat ?? '', absent: 'no chat yet' },
    // Only when there is more than one. A session with a single chat is a
    // session where the two are the same thing, and a row saying "1 of 1" is
    // a row that tells nobody anything.
    ...((detail?.chats.length ?? 0) > 1
      ? [{ id: 'chats', label: 'Chats', value: String(detail?.chats.length ?? 0) }]
      : []),
    // What the host said when it would not answer. `-32001 No agent for
    // session` is a live catalogue listing something whose agent has exited:
    // the row is real, and everything on the session channel is not there.
    { id: 'lifecycle', label: 'Lifecycle', value: detail?.refusal ?? detail?.lifecycle ?? '', ...(detail?.refusal ? { tone: 'danger' as SemanticVariant } : {}) },
    { id: 'created', label: 'Started', value: session.createdAt.slice(0, 16).replace('T', ' ') },
    { id: 'modified', label: 'Updated', value: session.modifiedAt.slice(0, 16).replace('T', ' ') },
    {
      id: 'changes',
      label: 'Changes',
      value: changes?.files
        ? `${changes.files} files  +${changes.additions ?? 0} -${changes.deletions ?? 0}`
        : '',
      absent: 'nothing yet',
    },
  ];
}

// ---------------------------------------------------------------- 1. sessions

export const SessionsScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('SessionsScreen', () => {
    const app = useApp();
    const theme = useTheme();
    const controller = useRequiredService(CONTROLLER);
    // While this is mounted, `n` `r` `a` `x` `d` mean what the catalogue means
    // by them. On the conversation screen they do not exist.
    useFocusScope({ id: SESSIONS_SCOPE });

    useStoreSubtree(SESSIONS);
    const filter = useStoreValue<string>(FILTER, '') ?? '';
    const archived = useStoreValue<boolean>(ARCHIVED, false) ?? false;
    const selected = useStoreValue<string | null>(SELECTED, null) ?? null;
    const sessions = visibleSessions(app.store);
    const host = useStoreValue<HostState>(HOST);

    // A list with a highlight and nothing selected is a detail panel that is
    // empty until a key is pressed.
    const ids = sessions.map((session) => session.resource).join(',');
    useEffect(() => {
      if (sessions.length === 0) return;
      if (selected && sessions.some((session) => session.resource === selected)) return;
      app.store.set(SELECTED, sessions[0]?.resource ?? null);
    }, [ids]);

    /**
     * The pane with the keyboard is the wide one.
     *
     * A fixed split has to be wrong somewhere: forty cells for the detail pane
     * left a session list too narrow to read a title in, and widening the list
     * would truncate the URIs the detail pane exists to let you copy. Neither
     * of those is a problem while you are looking at the *other* one, so the
     * space follows the reader.
     *
     * Below `splitAt` there is not enough of it to divide at all: forty cells
     * of detail take the list down to a column that cuts every title, and the
     * detail pane they were taken for is still too narrow to hold the URIs it
     * exists to show. Two truncated halves are worse than one whole one, so
     * under that width the catalogue is one pane and the detail is a drawer.
     *
     * Right opens it and left puts it away: the key points at the pane, which
     * is on the right of the screen. Above the split both panes are always
     * drawn and the same two keys only move the keyboard between them.
     */
    const width = useSize().width;
    const splitAt = useStoreValue<number>(SPLIT_AT, SPLIT_DEFAULT) ?? SPLIT_DEFAULT;
    // Three states: out, away, and nobody has said. The last one follows the
    // window, so a terminal being dragged wider opens the pane - and a person
    // who put it away keeps it away, which a plain boolean defaulted from the
    // width could not do.
    const asked = useStoreValue<boolean | null>(SIDEBAR, null);
    const open = asked ?? width > splitAt;

    const focused = useStoreValue<string | null>(FOCUS, null);
    const reading = open && focused === 'chat.details';
    const aside = Math.max(34, Math.min(56, Math.round(width * 0.4)));
    // What the pane without the keyboard keeps: two fifths, and never less
    // than a session title fits in. Capped as the terminal grows, because the
    // pane being read has a use for the rest and this one does not.

    const current = sessions.find((session) => session.resource === selected);
    const status = current ? decodeStatus(current.status) : null;
    const waiting = sessions.filter((session) => decodeStatus(session.status).activity === 'input').length;

    // The channel's own state, asked for one session at a time. Asking for
    // every row would be a round trip per row on a screen that already has
    // everything a row needs.
    const [detail, setDetail] = useState<SessionDetail | null>(null);
    useEffect(() => {
      setDetail(null);
      if (!selected) return;
      let live = true;
      // Caught, not `void`ed. A live catalogue lists sessions whose agent has
      // gone, the host refuses to talk about them, and an unhandled rejection
      // from a highlight moving is an application that exits when you press a
      // down arrow.
      void controller.detail(selected)
        .then((found) => { if (live) setDetail(found); })
        .catch((error: unknown) => controller.report(error));
      return () => { live = false; };
    }, [selected ?? '']);

    return (
      <Row flex={1} gap={1}>
        <Panel
          title="Sessions"
          {...(reading ? { width: aside } : { flex: 1 })}
          meta={waiting > 0 ? `${theme.glyphs.warning} ${waiting} waiting on you` : `${sessions.length} shown`}
        >
          <SearchBox
            value={filter}
            placeholder="title, provider or workspace"
            // Named, so `/` has something to focus. A control whose id comes
            // from its instance cannot be the target of a command.
            focusId="chat.filter"
            onChange={(value: string) => app.store.set(FILTER, value)}
          />
          <SessionList
            sessions={sessions}
            selectedId={selected}
            focusId="chat.sessions"
            // The list, not the filter. Whatever registers first would
            // otherwise hold the keyboard on arrival, and the filter is drawn
            // above the list - which made every single-letter command a letter
            // typed into a text field. `n`, `a` and `d` did nothing at all,
            // which is not what a missing key looks like from the outside.
            autoFocus
            flex={1}
            onSelect={(uri: string) => app.store.set(SELECTED, uri)}
            onOpen={(uri: string) => { controller.open(uri); app.screens.push('chat'); }}
            emptyMessage={filter ? 'Nothing matches' : 'No sessions on this host'}
          />
          {!archived ? <text content="x  show archived" fg="subtle" /> : null}
        </Panel>

        {open ? (
        <Panel
          title="Session"
          {...(reading ? { flex: 1 } : { width: aside })}
          meta={current ? 'enter copies' : ''}
        >
          {current && status ? (
            <Column gap={1} flex={1}>
              <Row gap={1}>
                <text content={theme.glyphs[status.glyph]} fg={status.tone} />
                <text content={current.title} bold wrap="word" flex={1} />
                {status.archived ? <Badge label="archived" tone="muted" /> : null}
              </Row>
              {/* Right arrow reaches this, up and down walk it, enter copies
                  the row. The identifiers are the reason: they are what gets
                  pasted into a shell, and they are exactly what does not fit
                  on one line. */}
              {/* Opened by asking, so the cursor goes with it - and `asked`
                  rather than `open`, so a terminal dragged past the split
                  width reveals the pane without taking the keyboard off
                  whatever was holding it. */}
              <SessionDetails
                fields={describe(current, detail)}
                focusId="chat.details"
                claim={asked === true}
                // Whole, not just the row under the cursor. The values here
                // are the answer - a workspace path, a branch, two URIs - and
                // a pane that shows you the first half of the one you are
                // looking for has made you walk to it to find out it was not
                // the one.
                values="all"
              />
              <text content="" flex={1} />
              <ConnectionBadge
                url={host?.url ?? ''}
                state={host?.state ?? 'offline'}
                sessions={sessions.length}
              />
            </Column>
          ) : (
            <EmptyState title="Nothing selected" message="Choose a session on the left." />
          )}
        </Panel>
        ) : null}
      </Row>
    );
  });

/**
 * The composer's control row, for whichever session it is above.
 *
 * Two of these are the client's own questions - which harness, which model -
 * because the protocol asks them itself. Everything after them is the host's:
 * one chip per property its schema offers, in its order, with its titles. The
 * row used to name `permissionMode`, which is what the *fixture* calls its
 * key, so against a real host - whose keys are `isolation`, `autoApprove` and
 * `mode` - it showed one chip that could answer nothing.
 *
 * Labels, never ids. `acceptEdits` is what the host stores and "Accept edits"
 * is what it calls it, and the schema is the authority on both - so a chip
 * reads as a sentence about what will happen rather than as a config value.
 */
/**
 * What a slash offers with no session open.
 *
 * Asked once and filtered locally as the draft is typed, the same way the
 * chat screen filters a session's own list - a request per keystroke would
 * ask the host the same question forty times to narrow one menu.
 */
/**
 * What the host offers to complete the word the caret is in.
 *
 * Asked of the host on every change to the draft, because that is whose
 * question it is - a path is a path on *its* filesystem, and which of them
 * match what has been typed changes with every keystroke. Only when there is
 * something to complete: a draft with no at-sign in its last word asks
 * nothing, which is most keystrokes.
 *
 * Latest wins. Two answers can be in flight after two quick keystrokes, and
 * the older one arriving second would put the wrong list under the caret.
 */
/**
 * The draft with a completion's range replaced by its text.
 *
 * The range and not an append: what is being completed is a fragment, so
 * `@src/ho` becomes `@src/host.ts` by replacing from the at-sign. Appending
 * would produce `@src/ho@src/host.ts`.
 */
function splice(draft: string, path: Completion): string {
  return `${draft.slice(0, path.rangeStart)}${path.insertText}${draft.slice(path.rangeEnd)}`;
}

function usePathCompletions(draft: string, channel: string | null): Completion[] {
  const controller = useRequiredService(CONTROLLER);
  const [found, setFound] = useState<Completion[]>([]);
  const asking = /(?:^|\s)@\S*$/.test(draft) ? draft : '';
  useEffect(() => {
    if (asking === '' || !channel) { setFound([]); return; }
    let mine = true;
    void controller.completions(channel, asking)
      .then((items) => { if (mine) setFound(items); })
      .catch(() => { if (mine) setFound([]); });
    return () => { mine = false; };
  }, [asking, channel]);
  return asking === '' ? [] : found;
}

/**
 * The terminal screen.
 *
 * Nothing is decided here: which terminals exist, which is open and what
 * happens when a line is sent all live in `terminal.ts`, and this puts them on
 * screen. Unmounting it therefore does not lose the shell, which is the
 * reason for the split.
 */
export const TerminalScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('TerminalScreen', () => {
    const app = useApp();
    const controller = useRequiredService(CONTROLLER);
    useFocusScope({ id: 'chat.terminal' });

    const rows = useStoreValue<TerminalRow[]>(TERMINALS, []) ?? [];
    const open = useStoreValue<string | null>(OPEN_TERMINAL, null) ?? null;
    const state = useStoreValue<TerminalState | null>(TERMINAL, null);
    const [draft, setDraft] = useState('');

    // Asked for on arrival, and only then: a host with no terminals is the
    // ordinary case, and a list polled behind a screen nobody is looking at is
    // a request per second for an answer nobody reads.
    useEffect(() => {
      void controller.terminals.refresh().then(() => {
        if (app.store.get<string>(OPEN_TERMINAL)) return;
        const first = (app.store.get<TerminalRow[]>(TERMINALS) ?? [])[0];
        if (first) controller.terminals.read(first.resource);
      });
    }, []);

    if (rows.length === 0 && open === null) {
      return (
        <EmptyState
          title="No terminals"
          message="ctrl+p, then Open a terminal. The shell runs on the host, in a directory it serves."
          flex={1}
        />
      );
    }

    return (
      <TerminalView
        rows={rows}
        open={open}
        state={state ?? null}
        draft={draft}
        onDraft={setDraft}
        onSend={(line) => { controller.terminals.write(line); setDraft(''); }}
        onSelect={(uri) => { controller.terminals.read(uri); }}
      />
    );
  });

function useHarnessCommands(): Customization[] {
  const controller = useRequiredService(CONTROLLER);
  const [items, setItems] = useState<Customization[]>([]);
  useEffect(() => {
    void controller.harnessCommands().then(setItems)
      .catch((error: unknown) => controller.report(error));
  }, []);
  return items;
}

function useComposerOptions(): ComposerOption[] {
  const unicode = useCapabilities().unicode;
  const controller = useRequiredService(CONTROLLER);
  const open = useStoreValue<string | null>(OPEN, null) ?? null;
  const provider = useStoreValue<string>(PROVIDER, 'claude') ?? 'claude';
  const model = useStoreValue<string>(MODEL, '') ?? '';
  const settings = useStoreValue<Record<string, string>>(SETTINGS, {}) ?? {};
  const workspace = useStoreValue<string>(WORKSPACE, '') ?? '';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [config, setConfig] = useState<SessionConfig | null>(null);
  useEffect(() => {
    void controller.agents().then(setAgents).catch((error: unknown) => controller.report(error));
  }, []);
  // Asking is also what registers a command per property, so the chips below
  // have something to open and the palette has the same questions in it.
  useEffect(() => {
    void controller.settings().then(setConfig)
      .catch((error: unknown) => controller.report(error));
  }, [provider, open]);

  const agent = agents.find((found) => found.provider === provider);
  // A harness with no models is the ordinary answer for one nobody has signed
  // into, so the chip says so rather than opening on an empty list. Until the
  // catalogue has arrived there is no harness to say it about.
  const models = agent ? agent.models : null;

  return [
    {
      id: 'harness',
      // A mark on every chip, and it is not decoration. The row truncates
      // labels from the right as the terminal narrows, and a chip that is only
      // a label truncates to nothing you can identify; one that leads with a
      // mark still says which question it is at four cells wide.
      icon: settingIcon(unicode, 'harness'),
      label: agent?.displayName ?? provider,
      // Fixed once the session exists: it is the process the conversation is
      // running in.
      ...(open ? {} : { commandId: 'compose.harness' }),
    },
    {
      id: 'model',
      icon: settingIcon(unicode, 'model'),
      label: models?.find((found) => found.id === model)?.displayName
        ?? (model || (models !== null && models.length === 0 ? 'no models' : 'default')),
      ...(models !== null && models.length === 0 ? {} : { commandId: 'compose.model' }),
    },
    ...(config?.properties ?? [])
      .filter((property) => property.values.length > 0)
      .map((property): ComposerOption => {
        const value = settings[property.key];
        const chosen = property.values.find((found) => found.value === value);
        return {
          id: property.key,
          // The value's own mark where it has one - which of five approval
          // modes is in force is the thing worth reading from the row itself.
          // The question's mark otherwise, so a branch chip is still a branch.
          icon: (value !== undefined
            ? valueIcon(unicode, value, chosen?.label)
            : undefined)
            ?? settingIcon(unicode, property.key, property.title),
          label: chosen?.label ?? value ?? property.title,
          // The question, for anything showing these with room for the pair.
          title: property.title,
          // Shown but not asked where the host says it cannot be changed on a
          // running session: offering it produces a refusal, not an edit.
          ...(open && !property.sessionMutable ? {} : { commandId: settingCommand(property.key) }),
        };
      }),
    {
      id: 'workspace',
      icon: settingIcon(unicode, 'workspace'),
      label: workspaceName(workspace ? `file://${workspace}` : undefined),
      ...(open ? {} : { commandId: 'compose.workspace' }),
    },
  ];
}

// -------------------------------------------------------------------- 2. chat

/**
 * What goes after a slash, from both places it can come from.
 *
 * The client's own commands are the palette's, so a slash is a second way into
 * the same list rather than a list of its own. The session's are the skills
 * and prompts the host contributed - filtered to the ones a person may invoke,
 * because a skill can be marked as the agent's alone and offering one is
 * offering something the host will refuse.
 *
 * Disabled customizations are left out entirely rather than shown greyed. A
 * menu is a list of what can be done, and a row that cannot be chosen is a row
 * that has to be read to find that out.
 */
function slashCommands(app: TextUIApp, contributed: Customization[]): SlashCommand[] {
  const session: SlashCommand[] = contributed
    .filter((item) => (item.kind === 'skill' || item.kind === 'prompt')
      && item.enabled
      && item.userInvocable !== false)
    .map((item) => ({
      id: item.name,
      kind: 'session' as const,
      title: item.name,
      ...(item.description ? { description: item.description } : {}),
      ...(item.from ? { from: item.from } : {}),
    }));

  const client: SlashCommand[] = app.commands.list({ slot: 'palette', enabledOnly: true })
    .map((command) => ({
      id: command.id,
      kind: 'client' as const,
      title: command.title,
      ...(command.description ? { description: command.description } : {}),
    }));

  return [...session, ...client];
}


const NO_TURNS: Turn[] = [];
const NO_QUEUE: QueuedMessage[] = [];
const NONE_EXPANDED: Record<string, boolean> = {};

export const ChatScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('ChatScreen', () => {
    const app = useApp();
    const controller = useRequiredService(CONTROLLER);
    useFocusScope({ id: CHAT_SCOPE });

    // The empties are shared rather than written out, and it matters: a
    // fallback literal is a new object every render, so a path nothing has
    // written yet reads as *changed* every time it is read. Everything
    // derived from one then changes too, and the memos below never hold.
    const turns = useStoreValue<Turn[]>(TURNS, NO_TURNS) ?? NO_TURNS;
    const input = useStoreValue<PendingInput | null>(INPUT, null) ?? null;
    const queued = useStoreValue<QueuedMessage[]>(QUEUE, NO_QUEUE) ?? NO_QUEUE;
    const draft = useStoreValue<string>(DRAFT, '') ?? '';
    const expanded = useStoreValue<Record<string, boolean>>(EXPANDED, NONE_EXPANDED) ?? NONE_EXPANDED;
    const history = useStoreValue<string[]>(HISTORY, []) ?? [];
    const [recall, setRecall] = useState(history.length);
    // The cursor is state like everything else, and it lives in the screen's
    // own scope - so it survives a trip to the changes list, which is
    // `keepAlive`, and dies with the screen, which is what a scope is for.
    const [cursor, setCursor] = useStore<number>('$/screen.chat/cursor' as BindingPath, 0);

    const session = openSession(app.store);
    const model = useStoreValue<string>(MODEL, '') ?? '';
    const chat = useStoreValue<string | null>(CHAT_URI, null) ?? null;
    const running = turns.some((turn) => turn.state === 'running');
    /*
     * Memoised, and the three below it with it, because of what the
     * transcript does with them.
     *
     * A component whose props are all unchanged is not re-run, and neither is
     * anything under it - so stable props here are what keep a keystroke in
     * the composer from rebuilding every block of the conversation and
     * reconciling the whole feed. Derived fresh they were new objects every
     * time, which is a change as far as anything can tell, and a screen that
     * re-renders for the draft dragged four hundred blocks along with it.
     */
    const blocks = useMemo(() => toBlocks(turns, queued), [turns, queued]);
    const options = useComposerOptions();
    // Read here as well as on the panel, because the slash menu is the other
    // place a skill is reached from and this is the screen it is reached on.
    // The store is shared, so a session already looked at costs nothing.
    const { items: skills } = useCustomizations();
    const paths = usePathCompletions(draft, useStoreValue<string | null>(CHAT_URI, null) ?? null);
    // Which conversation is being read, when there is more than one to read.
    const chats = useStoreValue<{ resource: string; title: string }[]>(CHATS, []) ?? [];
    const reading = chats.findIndex((entry) => entry.resource === chat);
    // The same answers the chips are showing, with the question beside each -
    // read off one source rather than asked for a second time.
    const settingRows = options
      .filter((option) => option.title !== undefined)
      .map((option) => ({ label: option.title as string, value: option.label }));

    // What the caption is made of, as one value that can be compared. The
    // parts are rebuilt every render and the caption they describe is not.
    const headSignature = JSON.stringify([session, model, chat, settingRows, chats.length, reading]);
    const head = useMemo(() => (
      <Column padding={[0, 0, 1, 0]}>
        {session ? (
          <ChatSessionHead
            session={session}
            {...(model ? { model } : {})}
            {...(chat ? { chat } : {})}
            settings={chats.length > 1
              // Where a session holds several, which one is being read is the
              // first thing somebody needs from the header - a transcript
              // that changed under the same title is otherwise unexplained.
              ? [{ label: 'Chat', value: `${String(reading + 1)} of ${String(chats.length)}` }, ...settingRows]
              : settingRows}
          />
        ) : null}
        <Divider dim />
      </Column>
    ), [headSignature]);

    const onToggle = useMemo(() => (id: string) => {
      // A queued message is not something to expand. Enter on one takes it
      // back, which is the only thing there is to do to a message that has
      // not been sent yet.
      const waiting = id.startsWith('queued:') ? id.slice('queued:'.length) : null;
      if (waiting !== null) { controller.unqueue(waiting); return; }
      app.store.set(EXPANDED, { ...expanded, [id]: !expanded[id] });
    }, [expanded, controller, app]);

    // `useStore` hands back a fresh setter every render, which is a changed
    // prop every render.
    const onCursor = useMemo(() => (next: number) => setCursor(next), []);

    if (!session) {
      return <EmptyState title="No session open" message="Open one from the catalogue." flex={1} />;
    }

    return (
      <Column flex={1} gap={1}>
        <ChatTranscript
          // The top of the conversation, inside it. See `head`.
          head={head}
          flex={1}
          blocks={blocks}
          expanded={expanded}
          cursor={cursor ?? 0}
          onCursor={onCursor}
          onToggle={onToggle}
        />

        {/* The block that is waiting on a person sits between the conversation
            and the composer, where it cannot scroll away and cannot be typed
            past. */}
        {input ? (
          <ChatHitl
            input={input}
            onApprove={(option?: string) => controller.approve(option)}
            onDeny={() => controller.deny()}
            onAnswer={(answers, accepted) => controller.answer(answers, accepted)}
            // The block takes keys globally while it is up, escape included -
            // which is right for `a` and `d` and wrong for the one key that is
            // how you leave. Sent back to the transcript unconditionally it
            // read as "escape does nothing", and a session blocked on a
            // confirmation could not be left without answering it. So escape
            // leaves whatever it is in: the block first, then the screen.
            onEscape={() => {
              if (app.focus.focused() === 'chat.transcript') app.screens.pop();
              else app.focus.focus('chat.transcript');
            }}
          />
        ) : null}

        <ChatComposer
          value={draft}
          running={running}
          queued={queued.length}
          options={options}
          onOption={(option, anchorId) => {
            if (option.commandId) openPicker(app, { commandId: option.commandId, anchorId });
          }}
          commands={slashCommands(app, skills)}
          paths={paths}
          onPath={(path) => app.store.set(DRAFT, splice(draft, path))}
          onChange={(value: string) => app.store.set(DRAFT, value)}
          onCommand={(picked: SlashCommand) => {
            /*
             * A skill is typed, not run.
             *
             * There is no "invoke this skill" in the protocol: a host
             * contributes skills as customizations and a person invokes one by
             * sending its name as the message, exactly as they would have
             * typed it. So choosing one completes the draft rather than
             * dispatching anything - and leaves the trailing space, because
             * most of them take an argument and the alternative is a person
             * pressing enter on a bare `/review` to find out.
             */
            if (picked.kind === 'session') {
              app.store.set(DRAFT, `/${picked.id} `);
              app.focus.focus('chat.composer');
              return;
            }

            app.store.set(DRAFT, '');
            const command = app.commands.get(picked.id);
            // A command that still has a question to ask cannot just be run -
            // `execute` refuses a missing required argument, loudly - so it
            // gets its picker, the same one the chip above would have opened.
            if (command && argumentOf(command)) {
              openPicker(app, { commandId: picked.id, anchorId: 'chat.composer' });
              return;
            }
            void app.execute(picked.id, undefined, 'palette');
          }}
          onSubmit={(value: string) => { controller.send(value); setRecall(history.length + 1); }}
          onCancel={() => app.focus.focus('chat.transcript')}
          onHistory={(direction: -1 | 1) => {
            // Up at the top of an empty draft is the last thing you sent. It
            // is the fastest correction there is, and every other client has it.
            const next = Math.max(0, Math.min(history.length, recall + direction));
            setRecall(next);
            app.store.set(DRAFT, history[next] ?? '');
          }}
          onLeave={() => app.focus.focus('chat.transcript')}
          autoFocus={!input}
        />
      </Column>
    );
  });

// --------------------------------------------------------------- 3. new session

export const NewSessionScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('NewSessionScreen', () => {
    const app = useApp();
    const controller = useRequiredService(CONTROLLER);
    const theme = useTheme();

    const draft = useStoreValue<string>(DRAFT, '') ?? '';
    const history = useStoreValue<string[]>(HISTORY, []) ?? [];
    const [recall, setRecall] = useState(history.length);
    const options = useComposerOptions();
    const harnessSkills = useHarnessCommands();
    const newPaths = usePathCompletions(draft, 'ahp-root://');

    return (
      <Column flex={1} gap={1}>
        {/* Nothing has been said, so there is nothing to draw above the field.
            What fills the space is the invitation, and it stays out of the way
            of the one control that matters. */}
        <Column flex={1} justify="center" align="center" gap={0}>
          {/* One of six, picked when the screen mounts. Only here: an empty
              screen is the one place a client can afford a figure, and every
              other screen has a conversation to show instead. */}
          <Creature mood="happy" margin={[0, 0, 1, 0]} />
          <text content="A new session" fg="muted" />
          <text content="The first message is what starts it." fg="subtle" />
          <text content={`${theme.glyphs.chevronLeft} esc for the sessions you already have`} fg="subtle" />
        </Column>

        <ChatComposer
          value={draft}
          options={options}
          onOption={(option, anchorId) => {
            if (option.commandId) openPicker(app, { commandId: option.commandId, anchorId });
          }}
          // The harness's as well as ours. A skill chosen here completes the
          // draft to `/name `, and the message that creates the session is
          // then the one that invokes it - which is where somebody most often
          // wants a skill, and the only place it used to be unreachable.
          commands={slashCommands(app, harnessSkills)}
          // The root channel, since there is no session yet: a host answers
          // for its own default directory, which is where this one would go.
          paths={newPaths}
          onPath={(path) => app.store.set(DRAFT, splice(draft, path))}
          onChange={(value: string) => app.store.set(DRAFT, value)}
          // Chosen here rather than sent. Without this the menu listed the
          // client's own commands and pressing enter on one created a session
          // whose first message was the literal text `/theme`.
          onCommand={(picked: SlashCommand) => {
            // A skill is typed, not run - the same as on an open session.
            // There is no "invoke this skill" in the protocol: a person
            // invokes one by sending its name, and here that name is also
            // what creates the session.
            if (picked.kind === 'session') {
              app.store.set(DRAFT, `/${picked.id} `);
              app.focus.focus('chat.composer');
              return;
            }
            app.store.set(DRAFT, '');
            const command = app.commands.get(picked.id);
            if (command && argumentOf(command)) {
              openPicker(app, { commandId: picked.id, anchorId: 'chat.composer' });
              return;
            }
            void app.execute(picked.id, undefined, 'palette');
          }}
          // The message *is* the session. Nothing is created until there is
          // something to say, which is why there is no Start button to leave
          // pressed by mistake - and why the provider being lazy costs nothing:
          // it does not attach until there is a turn to run, and this is one.
          onSubmit={(value: string) => {
            const first = value.trim();
            if (!first) return;
            setRecall(history.length + 1);
            const workspace = app.store.get<string>(WORKSPACE) ?? '';
            void controller.create({
              provider: app.store.get<string>(PROVIDER) ?? 'claude',
              ...(workspace ? { workingDirectory: workspace } : {}),
              first,
            })
              .then(() => app.screens.push('chat'))
              // Stay here. A host that refused to create the session has left
              // nothing to navigate to, and the draft is still in the field.
              .catch((error: unknown) => controller.report(error));
          }}
          onCancel={() => app.execute('go.sessions')}
          // Left off the front of the field, twice over, is the same thought as
          // escape: out of here, back to what already exists.
          onLeave={() => app.execute('go.sessions')}
          onHistory={(direction: -1 | 1) => {
            const next = Math.max(0, Math.min(history.length, recall + direction));
            setRecall(next);
            app.store.set(DRAFT, history[next] ?? '');
          }}
          autoFocus
        />
      </Column>
    );
  });

// ----------------------------------------------------------------- 4. changes

/**
 * The changeset, and one file out of it.
 *
 * Two states of one screen rather than two screens, because opening a file is
 * not somewhere you navigate to: escape goes back to the list and then out,
 * the way it does everywhere else here. Which file is in the store so that
 * leaving for the conversation and coming back arrives where it was.
 *
 * The content is fetched when a row opens and never before. A changeset is a
 * list of names the host sends up front and a pile of bytes it does not, and
 * a screen that read both together would download a session's whole diff to
 * draw a list of filenames.
 */
export const ChangesScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('ChangesScreen', () => {
    const app = useApp();
    const controller = useRequiredService(CONTROLLER);
    const changes = useStoreValue<Changeset>(CHANGES, { status: 'complete', files: [] })
      ?? { status: 'complete', files: [] };
    const open = useStoreValue<string | null>(OPEN_FILE, null) ?? null;
    const session = openSession(app.store);
    const file = changes.files.find((found) => found.uri === open) ?? null;
    // Letters mean things here, so the scope is on while this screen is.
    useFocusScope({ id: CHANGES_SCOPE });

    /*
     * Which changesets this session offers, and which of them is on screen.
     *
     * Asked of the host rather than assumed: a session advertises what it
     * advertises, and a client that offered the four the protocol names would
     * have three that are refused. Nothing is chosen here at first - an empty
     * `CHANGE_AT` means whichever the host would pick, which is what this
     * screen did before there was any way to ask for another.
     */
    const scopes = useStoreValue<ChangesetScope[]>(CHANGE_SCOPES, []) ?? [];
    const at = useStoreValue<string>(CHANGE_AT, '') ?? '';
    const uri = session?.resource ?? '';

    useEffect(() => {
      if (!uri) return;
      void controller.changesets(uri)
        .then((found) => {
          app.store.set(CHANGE_SCOPES, found);
          /*
           * Settle on one, rather than leaving "whichever the host would pick".
           *
           * The screen can draw the default without naming it, but nothing
           * else can act on it: ticking a file off needs the changeset's own
           * URI, and "the one you would have chosen" is not a URI. So the
           * first reachable scope becomes the chosen one the moment the list
           * arrives, and every key after that has something concrete to work
           * with.
           */
          if ((app.store.get<string>(CHANGE_AT) ?? '') !== '') return;
          const first = found.find((scope) => scope.variables.length === 0);
          if (first) app.store.set(CHANGE_AT, first.uriTemplate);
        })
        .catch((error: unknown) => controller.report(error));
    }, [uri]);

    // The chosen one, re-read when the choice moves. The default arrives on
    // the session channel already, so only a named scope is fetched here.
    useEffect(() => {
      if (!uri || !at) return;
      void controller.changesAt(uri, at)
        .then((found) => app.store.set(CHANGES, found))
        .catch((error: unknown) => controller.report(error));
    }, [uri, at]);

    const chosen = scopes.find((scope) => scope.uriTemplate === at)
      ?? scopes.find((scope) => scope.variables.length === 0);

    /*
     * Which row the cursor is on, kept in step with the list.
     *
     * `onSelect` fires when the selection *moves*, and the list arrives with
     * its first row already selected - so without this, a key acting on "this
     * file" does nothing until somebody has pressed an arrow, which reads as a
     * key that works the second time.
     */
    const row = useStoreValue<string>(CHANGE_ROW, '') ?? '';
    useEffect(() => {
      if (changes.files.some((one) => one.uri === row)) return;
      app.store.set(CHANGE_ROW, changes.files[0]?.uri ?? '');
    }, [changes.files.map((one) => one.uri).join('\u0000')]);

    const [loaded, setLoaded] = useState<{
      uri: string; before: string; after: string; binary?: { bytes: number; contentType?: string };
    } | null>(null);
    const [failure, setFailure] = useState<string | null>(null);

    useEffect(() => {
      if (!file) { setLoaded(null); setFailure(null); return; }
      // Both sides at once. They are two fetches and one answer, and rendering
      // half a diff while the other half is in flight makes every line of a
      // file look added for as long as the second request takes.
      let live = true;
      setLoaded(null);
      setFailure(null);
      const side = async (ref: ContentRef | undefined): Promise<FileContent> =>
        (ref ? controller.content(ref) : { text: '' });
      void Promise.all([side(file.content?.before), side(file.content?.after)])
        .then(([before, after]) => {
          if (!live) return;
          setLoaded({
            uri: file.uri,
            before: before.text,
            after: after.text,
            ...(before.binary ?? after.binary
              ? { binary: (before.binary ?? after.binary) as { bytes: number; contentType?: string } }
              : {}),
          });
        })
        .catch((error: unknown) => {
          if (!live) return;
          // The host's own words. A blank pane over a ref that expired is the
          // client looking broken for something the host said plainly.
          setFailure(error instanceof Error ? error.message : String(error));
        });
      return () => { live = false; };
    }, [file?.uri ?? '']);

    const title = `Changes ${session ? `- ${session.title}` : ''}`;

    if (file) {
      const kind = !file.before ? 'new' : !file.after ? 'deleted' : 'edited';
      return (
        <Panel title={title} flex={1}>
          {failure !== null ? (
            <EmptyState title="The host would not send it" message={failure} flex={1} />
          ) : !loaded ? (
            <EmptyState title="Reading the file" flex={1} />
          ) : (
            <FileDiff
              path={file.uri.replace(/^file:\/\//, '')}
              kind={kind}
              diff={diffLines(loaded.before, loaded.after)}
              {...(loaded.binary ? { binary: loaded.binary } : {})}
              flex={1}
            />
          )}
        </Panel>
      );
    }

    return (
      <Panel title={title} flex={1}>
        {scopes.length > 1 ? (
          <Row gap={2}>
            {scopes.map((scope) => {
              const here = scope.uriTemplate === (chosen?.uriTemplate ?? '');
              // A template with variables left in it is a question about a
              // turn, and there is nothing on this screen to answer it from.
              // Drawn anyway, dimmed: a scope the host offers and this screen
              // cannot reach is worth saying, and silently dropping it is how
              // somebody concludes their host does not have per-turn diffs.
              const reachable = scope.variables.length === 0;
              return (
                <text
                  key={scope.uriTemplate}
                  content={reachable ? scope.label : `${scope.label} (needs a turn)`}
                  {...(here ? { fg: 'accent' as SemanticVariant, bold: true } : {})}
                  {...(reachable ? {} : { fg: 'muted' as SemanticVariant })}
                />
              );
            })}
          </Row>
        ) : null}
        {(changes.operations ?? []).length > 0 ? (
          <Row gap={2}>
            {(changes.operations ?? []).map((operation) => (
              <text
                key={operation.id}
                content={operation.status === 'idle'
                  ? operation.label
                  : `${operation.label} (${operation.status})`}
                fg={operation.status === 'error' ? 'danger' : operation.status === 'idle' ? 'muted' : 'warning'}
              />
            ))}
          </Row>
        ) : null}
        <ChangesList
          changes={changes}
          reviewable={chosen?.reviewable === true}
          onOpen={(found: string) => app.store.set(OPEN_FILE, found)}
          onSelect={(found: string) => app.store.set(CHANGE_ROW, found)}
          autoFocus
          flex={1}
        />
      </Panel>
    );
  });

// ------------------------------------------------------------- 6b. the files

/**
 * The host's filesystem, browsed.
 *
 * `resourceList` and `resourceRead` were on the connection and behind
 * `ahpc resource`, and the only place a host's files were *drawn* was the `@`
 * completion in the composer - so a host that serves a project made people
 * type paths they could not see.
 *
 * One directory at a time rather than a tree: `resourceList` answers about one
 * directory, and an expanding tree would be a request per node with nothing on
 * screen meanwhile. Opening a file reads it and shows it; nothing here writes,
 * though the host would now allow it - see the roadmap.
 */
export const FilesScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('FilesScreen', () => {
    const app = useApp();
    const controller = useRequiredService(CONTROLLER);
    const session = openSession(app.store);
    /*
     * The session's own directory, until somebody moves.
     *
     * The only directory a client can name without having listed something
     * first: everything else it knows about the host's filesystem it learned
     * from an answer.
     */
    const root = session?.workingDirectories[0] ?? '';
    const at = (useStoreValue<string>(FILES_AT, '') ?? '') || root;
    const entries = useStoreValue<ResourceEntry[]>(FILES_ENTRIES, []) ?? [];
    const open = useStoreValue<string>(FILES_OPEN, '') ?? '';

    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const [body, setBody] = useState<{ uri: string; text: string; binary?: boolean } | null>(null);

    useEffect(() => {
      if (!at) return;
      let live = true;
      setLoading(true);
      setFailure(null);
      void controller.files(at)
        .then((found) => { if (live) { app.store.set(FILES_ENTRIES, found); setLoading(false); } })
        .catch((error: unknown) => {
          if (!live) return;
          setLoading(false);
          setFailure(error instanceof Error ? error.message : String(error));
        });
      return () => { live = false; };
    }, [at]);

    useEffect(() => {
      if (!open) { setBody(null); return; }
      let live = true;
      setBody(null);
      void controller.file(open)
        .then((found) => {
          if (!live) return;
          // The encoding is *reported* by the host rather than assumed here: a
          // pane that rendered base64 as text would print a PNG to a terminal.
          setBody(found.encoding === 'base64'
            ? { uri: open, text: '', binary: true }
            : { uri: open, text: found.data });
        })
        .catch((error: unknown) => {
          if (live) setFailure(error instanceof Error ? error.message : String(error));
        });
      return () => { live = false; };
    }, [open]);

    const title = `Files ${session ? `- ${session.title}` : ''}`;

    if (open) {
      const name = open.replace(/^file:\/\//, '');
      return (
        <Panel title={title} flex={1}>
          {body === null ? (
            <EmptyState title="Reading the file" message={name} flex={1} />
          ) : body.binary === true ? (
            <EmptyState title="Not text" message={`${name} came back as bytes, so there is nothing to show.`} flex={1} />
          ) : (
            <Column flex={1}>
              <Marquee content={name} truncate="start" fg="muted" />
              <text content={body.text} flex={1} />
            </Column>
          )}
        </Panel>
      );
    }

    return (
      <Panel title={title} flex={1}>
        <FileList
          at={at}
          entries={entries}
          loading={loading}
          {...(failure !== null ? { failure } : {})}
          // Never above the directory the session is in. The host refuses
          // anything outside what it serves anyway, and offering the step is
          // offering a refusal.
          {...(at !== root && at.length > root.length
            ? { onUp: () => app.store.set(FILES_AT, at.slice(0, at.lastIndexOf('/'))) }
            : {})}
          onOpen={(entry: ResourceEntry) => {
            if (entry.kind === 'directory') app.store.set(FILES_AT, entry.uri);
            else app.store.set(FILES_OPEN, entry.uri);
          }}
          autoFocus
          flex={1}
        />
      </Panel>
    );
  });

// ------------------------------------------------------------------ 7. skills

/**
 * What the host handed this session, in two panels.
 *
 * Two rather than one with a filter, because they answer different questions.
 * "What can I ask for" is a list of skills and prompts and it is read while
 * composing; "why is that tool missing" is a list of MCP servers and their
 * states and it is read when something did not work. A single list sorted by
 * kind makes each of those a scroll past the other.
 */
function useCustomizations(): { items: Customization[]; loading: boolean } {
  const app = useApp();
  const controller = useRequiredService(CONTROLLER);
  const uri = useStoreValue<string>(OPEN, '') ?? '';
  const items = useStoreValue<Customization[] | null>(CUSTOMIZATIONS, null);

  useEffect(() => {
    if (!uri) return;
    void controller.customizations(uri)
      .then((found) => app.store.set(CUSTOMIZATIONS, found))
      .catch((error: unknown) => controller.report(error));
  }, [uri]);

  return { items: items ?? [], loading: items === null };
}

/** A panel over one slice of the list, with the switch on each row live. */
function CustomizationPanel(props: {
  title: string;
  scopeId: string;
  empty: { title: string; message: string };
  keep(item: Customization): boolean;
}): RenderOutput {
  const app = useApp();
  const controller = useRequiredService(CONTROLLER);
  const uri = useStoreValue<string>(OPEN, '') ?? '';
  const { items, loading } = useCustomizations();
  const shown = items.filter(props.keep);

  if (!uri) {
    return <EmptyState title="No session open" message="Open one from the catalogue." flex={1} />;
  }
  if (loading) return <EmptyState title="Asking the host" flex={1} />;
  if (shown.length === 0) {
    return <EmptyState title={props.empty.title} message={props.empty.message} flex={1} />;
  }

  return (
    <Panel title={props.title} flex={1}>
      <CustomizationList
        items={shown}
        autoFocus
        focusId="customizations.list"
        onToggle={(item: Customization) => {
          controller.setCustomizationEnabled(uri, item.id, !item.enabled);
          // Answered locally as well as dispatched. The host tells every
          // client when it has decided, but the row under the cursor should
          // not sit on the old answer while that arrives.
          app.store.set(CUSTOMIZATIONS, items.map((found) => (
            found.id === item.id ? { ...found, enabled: !item.enabled }
              : found.from === item.name ? { ...found, enabled: !item.enabled }
                : found
          )));
        }}
        flex={1}
      />
    </Panel>
  );
}

export const SkillsScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('SkillsScreen', () => {
    useFocusScope({ id: SKILLS_SCOPE });
    return CustomizationPanel({
      title: 'Skills and commands',
      scopeId: SKILLS_SCOPE,
      empty: {
        title: 'Nothing contributed',
        message: 'No plugin or directory gave this session a skill, a prompt or an agent.',
      },
      // The containers too, because turning a plugin off is how you turn off
      // the six skills it brought, and a list of only the leaves offers six
      // switches where the host has one.
      keep: (item) => item.kind === 'skill' || item.kind === 'prompt' || item.kind === 'agent'
        || item.kind === 'plugin' || item.kind === 'directory',
    });
  });

// --------------------------------------------------------------------- 8. mcp

export const McpScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('McpScreen', () => {
    useFocusScope({ id: MCP_SCOPE });
    return CustomizationPanel({
      title: 'MCP servers',
      scopeId: MCP_SCOPE,
      empty: {
        title: 'No MCP servers',
        message: 'This session was given none, by the host or by a plugin.',
      },
      keep: (item) => item.kind === 'mcpServer',
    });
  });

// ---------------------------------------------------------------- 5. settings

export const SettingsScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('SettingsScreen', () => {
    const controller = useRequiredService(CONTROLLER);
    const uri = useStoreValue<string>(OPEN, '');
    const [config, setConfig] = useState<SessionConfig | null>(null);

    useEffect(() => {
      if (!uri) return;
      void controller.config(uri).then(setConfig)
        .catch((error: unknown) => controller.report(error));
    }, [uri ?? '']);

    if (!config) return <EmptyState title="Reading the session" flex={1} />;

    return (
      <Panel title="Session settings" flex={1}>
        <Column gap={1} flex={1}>
          {config.properties.map((property) => (
            <Column key={property.key} gap={0}>
              <Row gap={1}>
                <text content={property.title} bold />
                {!property.sessionMutable ? <text content="fixed for this session" fg="subtle" /> : null}
              </Row>
              {property.description ? <text content={property.description} fg="muted" wrap="word" /> : null}
              <RadioGroup
                options={property.values.map((value) => ({ value: value.value, label: value.label }))}
                value={config.values[property.key] ?? ''}
                disabled={!property.sessionMutable}
                onChange={(value: string) => {
                  if (!uri) return;
                  controller.setConfig(uri, property.key, value);
                  setConfig({ ...config, values: { ...config.values, [property.key]: value } });
                }}
              />
            </Column>
          ))}
          <text content="" flex={1} />
          <text
            content="Only what the schema marks changeable on a running session is offered. The action merges one key - sending the whole object writes back what another client just changed."
            fg="subtle"
            wrap="word"
          />
        </Column>
      </Panel>
    );
  });

// ------------------------------------------------------------------- 6. hosts

export const HostsScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('HostsScreen', () => {
    const app = useApp();
    const host = useStoreValue<HostState>(HOST);
    const [agents, setAgents] = useState<Agent[]>([]);

    useEffect(() => {
      void app.services.require(CONTROLLER).agents().then(setAgents);
    }, []);

    return (
      <Panel title="Hosts" flex={1}>
        <Column gap={1} flex={1}>
          <ConnectionBadge url={host?.url ?? ''} state={host?.state ?? 'offline'} />
          <text content="An agent host is a sessions server. Several clients watch and drive the same sessions; none of them owns the process running the agent." fg="muted" wrap="word" />
          {/* Which of the two is answering, and how to ask for the other. The
              seam is one interface, so this is the only screen that has any
              reason to mention that there are two implementations of it. */}
          {host?.id === 'fake' ? (
            <text
              content="This is the scripted host: five seeded sessions and an agent that answers four ways. Start with --host ws://… to drive a real one instead."
              fg="subtle"
              wrap="word"
            />
          ) : (
            <text
              content="A live host. What it says is what it sent."
              fg="subtle"
              wrap="word"
            />
          )}
          {agents.map((agent) => (
            <Column key={agent.provider} gap={0}>
              <Row gap={1}>
                <text content={agent.displayName} bold />
                <Badge label={agent.provider} tone="muted" />
              </Row>
              {agent.description ? <text content={agent.description} fg="muted" /> : null}
              {agent.models.map((model) => (
                <text key={model.id} content={`  ${model.displayName}  (${model.id})`} fg="subtle" />
              ))}
            </Column>
          ))}
        </Column>
      </Panel>
    );
  });
