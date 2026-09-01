import type { BoxProps, Disposable, TextUIApp } from '@textui/core';
import {
  createBag,
  defineComponent,
  useApp,
  useTheme,
  useStoreSubtree,
  useStoreValue,
} from '@textui/core';
import { KeyHints, Row, registerBuiltins } from '@textui/widgets';
import { CONTROLLER, createController } from './control.js';
import { fakeHost } from './ahp/fake.js';
import type { HostConnection } from './ahp/connection.js';
import {
  BOOD, BOOD_FLOAT, BOOD_FLOOR, BOOD_INLINE, FOCUS, HOST, HOST_ERROR, INPUT, INPUT_STATUS, OPEN, RUNNING, SCREEN,
  SESSIONS,
  SPLIT_AT, SPLIT_DEFAULT, STATUS, WORKSPACE, boodFloor, openSession, workspaceName,
} from './state.js';
import type { HostState, InputStatus } from './state.js';
import { decodeStatus } from './ahp/status.js';
import {
  AutomationsScreen, ChangesScreen, ChatScreen, FilesScreen, HostsScreen, McpScreen, NewAutomationScreen, NewSessionScreen, SessionsScreen, TerminalScreen,
  SettingsScreen, SkillsScreen,
} from './screens.js';
import { ChatBubble, ReasoningBlock, StreamingText } from './view/bubble.js';
import { ChatComposer } from './view/composer.js';
import { ChatHitl } from './view/hitl.js';
import { ChatTranscript } from './view/transcript.js';
import { BoodSprite, Creature, moodOf, pickBood } from './view/creature.js';
import { ChangesList } from './view/changes.js';
import { FileList } from './view/files.js';
import { AutomationList } from './view/automations.js';
import { ConnectionBadge, SessionList } from './view/sessions.js';
import { ToolCallRow } from './view/toolcall.js';

/**
 * A chat client for an agent host.
 *
 * What it is here to find out is which components a chat application needs
 * that a terminal UI catalog does not already have. The answer, by the end of
 * writing it, is in `README.md` - and the shape of the answer is that the
 * conversation is one component the catalog cannot stand in for, the composer
 * is a second, and everything else is composition.
 *
 * The application takes a host rather than making one, so a test can mount it
 * against a scripted one and drive time by hand.
 */

/**
 * The creature, over the whole application.
 *
 * Mounted on the `floating` layer rather than inside a screen, so navigating
 * moves the screen out from under it instead of unmounting it: escape from a
 * session leaves the figure exactly where it was standing. This is the only
 * place that knows both the store and the bood, which is what keeps
 * `view/bood/` from having an opinion about sessions.
 *
 * The floor is the top of whatever the screen keeps at the bottom. A screen
 * with a composer keeps a lot more of it than one with only a status bar, so
 * the inset follows the screen rather than being one number that is wrong on
 * half of them.
 */
/**
 * What the bottom keeps when nothing down there has said otherwise.
 *
 * The hints row, the shell's own edge, and the closing border of whatever
 * panel is there. Standing on that border put the figure through it and
 * through the row above it; a row clear of it is the ground.
 */
const BOTTOM_CHROME = 3;

const BoodOverlay = defineComponent<Record<string, never>>('BoodOverlay', () => {
  const app = useApp();
  const name = useStoreValue<string>(BOOD);
  const roaming = useStoreValue<boolean>(BOOD_FLOAT, false) ?? false;
  useStoreSubtree(BOOD_FLOOR);
  // Whatever is standing at the bottom says where it starts; the creature gets
  // the row above the highest of them. Nothing down there and it takes the
  // bottom of the terminal, less the chrome that is on every screen.
  const standing = boodFloor(app.store);
  const status = useStoreValue<number>(STATUS, 1) ?? 1;
  useStoreSubtree(SESSIONS);
  const session = openSession(app.store);
  if (!roaming || !name) return null;

  /*
   * Out of the way of anything that was opened on purpose.
   *
   * A terminal has no per-cell transparency, so the figure writes over
   * whatever it is standing on - which is a fair price for a mascot wandering
   * across a list, and not a fair price for a menu. The completion popup is a
   * layer, the palette is a layer, a dialog is a layer: if anything else is
   * open, the creature is not on top of it.
   */
  if (app.layers.entries().some((entry) => entry.id !== 'bood')) return null;

  return (
    <BoodSprite
      name={name}
      mood={session ? moodOf(decodeStatus(status).activity) : 'happy'}
      floor={standing !== undefined ? standing - 1 : undefined}
      inset={BOTTOM_CHROME}
    />
  );
});

const Header = defineComponent<Record<string, never>>('ChatHeader', () => {
  const app = useApp();
  const theme = useTheme();
  const host = useStoreValue<HostState>(HOST);
  const status = useStoreValue<number>(STATUS, 1) ?? 1;
  // Subscribed, not asked. `screens.current()` is a method call in the middle
  // of a render: it reads the right answer once and nothing tells this to look
  // again, so a surface that navigating does not remount keeps the last
  // screen's chrome for ever.
  // Subscribed so the title follows what is open, without the header being
  // remounted to notice.
  useStoreValue<string | null>(SCREEN, null);
  useStoreValue<string | null>(OPEN, null);
  // And to the summaries themselves. `openSession` is a plain read, so a
  // title or a status arriving from the host changed the store and left this
  // row showing what it said when the session was opened - which is why the
  // header only caught up when navigating away and back remounted it.
  useStoreSubtree(SESSIONS);
  const session = openSession(app.store);
  const decoded = decodeStatus(status);
  const bood = useStoreValue<string>(BOOD);
  const boodInline = useStoreValue<boolean>(BOOD_INLINE, false) ?? false;
  // Only on a session, because the seven cells are carrying that session's
  // state - on the catalogue there is no one thing for them to be about, and
  // a creature that means nothing where the name used to be is a worse trade.
  // Truthiness, not a comparison with undefined: nothing open is `null` here,
  // and the row beside this one has always tested it the same way.
  const wearsBood = boodInline && Boolean(session);

  return (
    // Only the title gives way. Everything else on this row is fixed-width and
    // says what the application *is* - a header that truncates its own name to
    // "Assist…" in order to fit more of a session title has given up the one
    // part that is the same on every screen. The workspace yields after the
    // title, and the status glyph never does: it is one cell and it is the
    // thing the row is scanned for.
    <Row gap={1}>
      {wearsBood
        ? <Creature name={bood} form="inline" mood={moodOf(decoded.activity)} shrink={0} />
        : <text content="Assistant" bold fg="accent" shrink={0} />}
      <text content={theme.glyphs.separator} fg="subtle" shrink={0} />
      {session ? (
        <>
          <text content={theme.glyphs[decoded.glyph]} fg={decoded.tone} shrink={0} />
          <text content={session.title} flex={1} truncate="end" />
          <text content={workspaceName(session.workingDirectories[0])} fg="muted" shrink={4} truncate="end" />
        </>
      ) : (
        <text content={host?.url ?? 'no host'} fg="muted" flex={1} truncate="end" />
      )}
    </Row>
  );
});

/**
 * The keys, as the reader sees them.
 *
 * They change with where the focus is, because they *are* different there:
 * while the composer has the keyboard, every letter is a letter.
 */
const Hints = defineComponent<BoxProps>('ChatHints', (props) => {
  const theme = useTheme();
  /**
   * Which key makes a newline.
   *
   * `ctrl+enter`, and no longer conditionally. This used to be gated on the
   * kitty protocol on the belief that it was the only encoding able to express
   * the key - "without it a terminal sends 0x0d for both". That is not true:
   * most terminals send a bare LF, xterm sends `CSI 27;5;13~`, and the
   * decoder reads all three. The gate was hiding a key that worked, and
   * naming `alt+enter` instead sent people to the fallback.
   */
  const newline = 'ctrl+enter';
  const waiting = useStoreValue<{ kind: string } | null>(INPUT, null);
  const upDown = `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown}`;
  const leftRight = `${theme.glyphs.arrowLeft}${theme.glyphs.arrowRight}`;
  // Which keys exist is a property of where you are, not of what is open: a
  // session stays open while its changes are on screen, and `i write` there
  // is an offer nothing honours.
  const screen = useStoreValue<string | null>(SCREEN, 'sessions') ?? 'sessions';
  // Not `status > 1`: the bitset carries "a client has read this" in the same
  // number, so an idle session somebody looked at is 33 and every hint would
  // read "stop".
  const running = useStoreValue<boolean>(RUNNING, false) ?? false;
  // Where the keyboard is decides what the keys mean. While the composer has
  // it, escape leaves the field; from the transcript, escape leaves the
  // screen - and a hint row that said one of those in both places is wrong
  // half the time.
  const focused = useStoreValue<string | null>(FOCUS, null);
  const composing = focused === 'chat.composer';

  // A question is not a confirmation, and the keys are not the same either.
  // Offering "a approve" over an elicitation is the same mistake as rendering
  // one as the other, made in the one row that is supposed to explain it.
  if (screen === 'chat' && waiting?.kind === 'toolConfirmation') {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'a', label: 'approve' },
          { keys: 'd', label: 'deny' },
          { keys: '1-9', label: 'option' },
          { keys: 'esc', label: 'read' },
        ]}
      />
    );
  }

  if (screen === 'chat' && waiting) {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'tab', label: 'next question' },
          { keys: 'space', label: 'choose' },
          { keys: 'enter', label: 'send answers' },
          { keys: 'esc', label: 'read' },
        ]}
      />
    );
  }

  if (screen === 'chat') {
    return (
      <KeyHints
        {...props}
        hints={composing
          ? [
            { keys: 'enter', label: 'send' },
            { keys: newline, label: 'newline' },
            { keys: 'esc', label: 'read' },
            { keys: 'ctrl+c', label: running ? 'stop' : 'quit' },
          ]
          : [
            { keys: upDown, label: 'move' },
            { keys: 'enter', label: 'expand' },
            { keys: 'i', label: 'write' },
            { keys: 'G', label: 'follow' },
            { keys: 'c', label: 'changes' },
            { keys: 'k', label: 'skills' },
            { keys: 'esc', label: 'back' },
            // The same key, and it says which: while a turn is running it
            // stops it, and when none is it leaves. A hint that always read
            // "stop" is wrong most of the time.
            { keys: 'ctrl+c', label: running ? 'stop' : 'quit' },
          ]}
      />
    );
  }

  if (screen === 'new') {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'enter', label: 'start' },
          { keys: newline, label: 'newline' },
          { keys: 'tab', label: 'options' },
          { keys: 'esc', label: 'sessions' },
          { keys: 'ctrl+c', label: 'quit' },
        ]}
      />
    );
  }

  // On the terminal, `ctrl+c` is the shell's - it is how a command is
  // stopped, and saying "quit" there is how somebody closes the application
  // trying to interrupt a `ping`.
  if (screen === 'terminal') {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'enter', label: 'run' },
          { keys: 'ctrl+c', label: 'interrupt' },
          { keys: 'esc', label: 'back' },
          { keys: 'ctrl+p', label: 'commands' },
        ]}
      />
    );
  }

  // The list screens. `tab move` is a form's answer and these are
  // lists: what moves is the cursor, and enter is what a row is for.
  if (screen === 'changes' || screen === 'skills' || screen === 'mcp' || screen === 'files'
    || screen === 'automations') {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: upDown, label: 'move' },
          { keys: 'enter', label: screen === 'changes' || screen === 'files' ? 'open' : screen === 'automations' ? 'run' : 'on / off' },
          // Only where they do something. A hint for a key that is inert on
          // this screen is worse than no hint.
          ...(screen === 'changes'
            ? [{ keys: ']', label: 'changeset' }, { keys: 'r', label: 'read' }, { keys: 'x', label: 'do' }]
            : []),
          // Named only where they do something. `enter` already runs one, so
          // what is left is the switch and the one that does not come back.
          ...(screen === 'automations'
            ? [{ keys: 'n', label: 'new' }, { keys: 'e', label: 'on / off' }, { keys: 'd', label: 'forget' }]
            : []),
          { keys: 'esc', label: 'back' },
          { keys: 'ctrl+p', label: 'commands' },
          { keys: 'ctrl+c', label: 'quit' },
        ]}
      />
    );
  }

  if (screen !== 'sessions') {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'tab', label: 'move' },
          { keys: 'esc', label: 'back' },
          { keys: 'ctrl+p', label: 'commands' },
          { keys: 'ctrl+c', label: 'quit' },
        ]}
      />
    );
  }

  return (
    <KeyHints
      {...props}
      hints={[
        { keys: upDown, label: 'move' },
        // Which one it is depends on where the detail pane is, and the pane is
        // right there on the screen saying so. Naming both is what fits.
        { keys: leftRight, label: 'detail' },
        { keys: 'enter', label: 'open' },
        { keys: 'n', label: 'new' },
        { keys: 'a', label: 'archive' },
        { keys: '/', label: 'filter' },
        { keys: 'ctrl+p', label: 'commands' },
        { keys: 'ctrl+c', label: 'quit' },
      ]}
    />
  );
});

const Status = defineComponent<Record<string, never>>('ChatStatus', () => {
  const screen = useStoreValue<string | null>(SCREEN, 'sessions');
  // What the host last refused, where a person is already looking. A refusal
  // that only reaches a log is a client that appears to have ignored the key
  // you pressed.
  //
  // Unless the row above the composer is already saying it, which it does
  // when the refusal was of an answer given to the block waiting there. Said
  // twice on a narrow terminal it is one sentence in red on two of twenty
  // rows, and the second one adds nothing to the first.
  const said = useStoreValue<InputStatus | null>(INPUT_STATUS, null) ?? null;
  const refusal = useStoreValue<string | null>(HOST_ERROR, null) ?? null;
  const error = said?.state === 'failed' && said.text === refusal ? null : refusal;
  return (
    <Row gap={2}>
      {error
        ? <text content={error} fg="danger" flex={1} truncate="end" />
        : <Hints flex={1} />}
      <text content={screen ?? '-'} fg="muted" />
    </Row>
  );
});

export interface ChatOptions {
  builtins?: boolean;
  /**
   * The header trades its own name for a seven-cell creature, on a session.
   *
   * Off unless asked for, and it is the config file that asks - `boodInline`
   * in `~/.config/ahpc/config.json`.
   */
  boodInline?: boolean;
  /**
   * The creature roams the whole application, on the floating layer.
   *
   * Off unless asked for - `boodFloat` in the config file. A terminal has no
   * per-cell transparency, so a figure that goes everywhere writes over what
   * it stands on: it keeps off the composer and off anything opened on a
   * layer, and a screen whose content runs to the bottom gets a cat on it.
   */
  boodFloat?: boolean;
  /** The host. Omit for the scripted one, which is what the tests use. */
  host?: HostConnection & { pump?(): boolean };
  /**
   * Where a new session works, before anybody chooses otherwise.
   *
   * A path on the **host**, which is not this machine unless the host happens
   * to be. Pass an empty string to say there is none and let the host decide;
   * left out entirely it is the directory this process started in, which is
   * the defensible guess only for a host that is this process.
   */
  workspace?: string;
  /**
   * How wide the terminal has to be before the catalogue shows both panes.
   *
   * Narrower than this and the detail pane starts hidden - left opens it,
   * right puts it away - because a split that leaves both halves truncated is
   * worse than either half whole. Settable here so it can be tuned without a
   * rebuild; `140` is where a session list stops cutting its titles with a
   * detail pane beside it.
   */
  splitAt?: number;
}

export function registerChat(app: TextUIApp, options: ChatOptions = {}): Disposable {
  const bag = createBag();
  if (options.builtins !== false) bag.add(registerBuiltins(app));

  const host = options.host ?? fakeHost();
  const controller = createController(app, host);
  app.store.set(WORKSPACE, options.workspace ?? process.cwd());
  app.store.set(SPLIT_AT, options.splitAt ?? SPLIT_DEFAULT);
  // Once, here, rather than per mount: two surfaces drawing two different
  // animals would read as two mascots rather than one that gets about.
  app.store.set(BOOD, pickBood());
  app.store.set(BOOD_INLINE, options.boodInline ?? false);
  app.store.set(BOOD_FLOAT, options.boodFloat ?? false);
  bag.add(controller);
  bag.add(app.services.provide(CONTROLLER, controller));

  for (const [component, render] of [
    ['ChatBubble', ChatBubble],
    ['StreamingText', StreamingText],
    ['ReasoningBlock', ReasoningBlock],
    ['ToolCallRow', ToolCallRow],
    ['ChatTranscript', ChatTranscript],
    ['ChatComposer', ChatComposer],
    ['ChatHitl', ChatHitl],
    ['SessionList', SessionList],
    ['ConnectionBadge', ConnectionBadge],
    ['ChangesList', ChangesList],
    ['FileList', FileList],
    ['AutomationList', AutomationList],
    ['SessionsScreen', SessionsScreen],
    ['ChatScreen', ChatScreen],
    ['NewSessionScreen', NewSessionScreen],
    ['TerminalScreen', TerminalScreen],
    ['ChangesScreen', ChangesScreen],
    ['FilesScreen', FilesScreen],
    ['AutomationsScreen', AutomationsScreen],
    ['NewAutomationScreen', NewAutomationScreen],
    ['SettingsScreen', SettingsScreen],
    ['HostsScreen', HostsScreen],
    ['SkillsScreen', SkillsScreen],
    ['McpScreen', McpScreen],
    ['BoodOverlay', BoodOverlay],
    ['ChatHeader', Header],
    ['ChatStatus', Status],
    ['ChatHints', Hints],
  ] as const) {
    bag.add(app.components.register({
      component,
      category: 'template',
      renderer: { kind: 'function', render: render as never },
    }));
  }

  // Over every screen, for as long as the application is running.
  bag.add(app.layers.open({
    id: 'bood',
    layer: 'floating',
    node: { component: 'BoodOverlay' },
    position: { kind: 'screen', rect: { x: 0, y: 0 } },
  }));
  bag.add(app.surfaces.open({ surface: 'header', key: 'title', target: { component: 'ChatHeader' } }));
  bag.add(app.surfaces.open({ surface: 'status', key: 'status', target: { component: 'ChatStatus' } }));

  for (const screen of [
    { id: 'sessions', component: 'SessionsScreen' },
    // Kept alive: coming back from the changes list to a conversation that
    // had scrolled itself back to the top is losing your place in a document
    // that is still being written.
    { id: 'chat', component: 'ChatScreen', keepAlive: true },
    { id: 'new', component: 'NewSessionScreen' },
    { id: 'changes', component: 'ChangesScreen' },
    { id: 'files', component: 'FilesScreen' },
    { id: 'automations', component: 'AutomationsScreen' },
    { id: 'automation.new', component: 'NewAutomationScreen' },
    { id: 'settings', component: 'SettingsScreen' },
    { id: 'hosts', component: 'HostsScreen' },
    { id: 'skills', component: 'SkillsScreen' },
    { id: 'mcp', component: 'McpScreen' },
    // Kept alive: a shell you scrolled back through and then left is a shell
    // that should still be where you left it.
    { id: 'terminal', component: 'TerminalScreen', keepAlive: true },
  ]) {
    bag.add(app.screens.register(screen));
  }

  void controller.refresh();
  // The composer, with nothing open. A client whose first screen is a
  // catalogue makes "talk to an agent" a two-step errand; the first message is
  // what creates the session, so the field is what the application opens on.
  app.screens.reset('new');
  return bag;
}

export { CONTROLLER } from './control.js';
