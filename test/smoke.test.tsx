import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CREATURES, MOODS, creatureMotion, drawCreature } from '../src/view/creature.js';
import { BOOD, BOOD_FLOAT, BOOD_FLOOR, FILTER, SESSIONS, visibleSessions } from '../src/state.js';
import { CONTROLLER } from '../src/control.js';
import { fakeHost } from '../src/ahp/fake.js';
import type { FakeHost } from '../src/ahp/fake.js';
import { decodeStatus } from '../src/ahp/status.js';
import { SessionFlag } from '../src/ahp/types.js';
import { CLIPBOARD_PATH, layoutMarkdown, wrapRuns } from '@textui/core';
import { toBlocks } from '../src/blocks.js';
import {
  CHATS, CHAT_URI, DRAFT, HOST_ERROR, INPUT, INPUT_STATUS, OPEN, OPEN_TERMINAL, PROVIDER, QUEUE,
  SELECTED, SETTINGS, SIDEBAR, TURNS, WORKSPACE, writeSessions,
} from '../src/state.js';
import type { InputStatus } from '../src/state.js';
import type { SessionSummary, Turn } from '../src/ahp/types.js';
import { PICKER, openPicker } from '../src/view/picker.js';

/**
 * The example, mounted.
 *
 * What is worth checking is what a screenshot cannot tell you: that a turn
 * arriving one word at a time is one growing bubble rather than a new one per
 * word, that a blocked agent is answerable, that a question is not rendered as
 * a confirmation, and that a letter typed into the composer is a letter.
 *
 * Time is the host's `pump`, so none of this waits on a clock.
 */

const SIZES = [
  { width: 100, height: 30 },
  { width: 76, height: 20 },
];

const SEEDED = 'ahp-session:/1f0a';
const IDLE = 'ahp-session:/9c74';

interface Mounted { t: Harness; host: FakeHost }

async function open(size = SIZES[0] as { width: number; height: number }): Promise<Mounted> {
  const host = fakeHost();
  const t = await renderApp({
    ...size,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return { t, host };
}

/**
 * The catalogue, which is no longer where the application starts.
 *
 * It opens on the composer with nothing open - the first message is what
 * creates a session - and the list of what already exists is one screen above
 * it. Every test about rows, keys and archiving comes through here.
 */
async function catalogue(size?: { width: number; height: number }): Promise<Mounted> {
  const m = await open(size);
  await m.t.app.execute('go.sessions');
  for (let i = 0; i < 6; i++) await m.t.settle();
  return m;
}

/** What is waiting to be sent, in order. */
function queuedText(m: Mounted): string[] {
  return (m.t.store.get<{ text: string }[]>(QUEUE) ?? []).map((message) => message.text);
}

/** How many turns the open session has, which is what "sent" looks like. */
function turnsIn(m: Mounted): number {
  return (m.t.store.get<Turn[]>(TURNS) ?? []).length;
}

/** Run the script to where it needs an answer, rendering as it goes. */
/**
 * Settle until it is true, or give up and let the assertion say what it saw.
 *
 * A fixed count of settles is a wait calibrated on the machine that wrote it:
 * enough while one test file is running and not enough while thirteen are, so
 * the test starts reporting how loaded the box is rather than what the client
 * drew.
 */
async function until(m: Mounted, ready: () => boolean, tries = 40): Promise<void> {
  for (let i = 0; i < tries; i++) {
    if (ready()) return;
    await m.t.settle();
  }
}

async function run(m: Mounted, steps = 100_000): Promise<void> {
  for (let i = 0; i < steps; i++) if (!m.host.pump()) break;
  for (let i = 0; i < 6; i++) await m.t.settle();
}

async function conversation(size?: { width: number; height: number }): Promise<Mounted> {
  const m = await open(size);
  m.t.app.services.require(CONTROLLER).open(SEEDED);
  m.t.app.screens.push('chat');
  for (let i = 0; i < 6; i++) await m.t.settle();
  return m;
}

/**
 * A session with nothing waiting on it.
 *
 * The seeded one is blocked on a confirmation - deliberately, so that the row
 * saying a person is wanted is a row where one is - and while a turn is
 * running a message is queued rather than sent, the composer does not take the
 * keyboard, and escape belongs to the block. None of which is what a test
 * about sending, typing or leaving means to exercise.
 */
async function idle(size?: { width: number; height: number }): Promise<Mounted> {
  const m = await open(size);
  m.t.app.services.require(CONTROLLER).open(IDLE);
  m.t.app.screens.push('chat');
  for (let i = 0; i < 6; i++) await m.t.settle();
  return m;
}

describe.each(SIZES.map((s) => [`${s.width}x${s.height}`, s] as const))('at %s', (_name, size) => {
  it('opens on a composer, with nothing open', async () => {
    const { t } = await open(size);
    // Not a catalogue. Talking to an agent is the thing this is for, and a
    // first screen that lists what already exists makes it a two-step errand.
    expect(t.app.screens.current()?.id).toBe('new');
    expect(t.app.focus.focused()).toBe('chat.composer');
    expect(t.hasText('The first message is what starts it.')).toBe(true);
    await t.unmount();
  });

  it('lists what already exists, urgent first', async () => {
    const { t } = await catalogue(size);
    expect(t.app.screens.current()?.id).toBe('sessions');
    // The session waiting on a person is the first row, whatever it was
    // called or when it last moved. Asserted on the order rather than on a
    // whole title being legible: which pane has the room depends on which one
    // has the keyboard, and a title is what truncates first.
    expect(visibleSessions(t.app.store)[0]?.resource).toBe(SEEDED);
    expect(t.hasText('Kqueue events')).toBe(true);
    await t.unmount();
  });

  it('draws every row inside the frame it was given', async () => {
    const { t } = await conversation(size);
    expect(t.lines().every((line) => line.length <= size.width)).toBe(true);
    await t.unmount();
  });
});

describe('the transcript', () => {
  it('renders a conversation from a snapshot, not only from deltas', async () => {
    const { t } = await conversation();
    // At the top of it: the seeded session has a blocked turn at the bottom,
    // and a transcript that follows the tail is showing that instead.
    t.focus('chat.transcript');
    // `home` is the top of the feed, and the top of the feed is the caption
    // saying what this session is. One down is the first thing said in it.
    t.press('home');
    t.press('down');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('EVFILT_FS never fires')).toBe(true);
    // The prose is in `content`, not `markdown` or `text`. Reading the wrong
    // field costs every word the agent said and nothing else.
    expect(t.hasText('libkqueue')).toBe(true);

    // And the tool call is a row of its own, never rendered as text - one
    // block further down, which is where it is rather than where it happened
    // to fit. Asserting it from the top made this test a hostage to the row
    // budget: anything else the screen grew - a divider, a caption - pushed it
    // out of view and failed a test about *parsing a snapshot*.
    for (let i = 0; i < 4; i++) { t.press('down'); await t.settle(); }
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Search')).toBe(true);
    await t.unmount();
  });

  it('grows one bubble as the words arrive', async () => {
    const m = await idle();
    m.t.app.services.require(CONTROLLER).send('run the input router tests');
    await run(m, 40);

    const turns = m.t.store.get<Turn[]>(TURNS) ?? [];
    const running = turns.filter((turn) => turn.state === 'running');
    // One running turn, whatever number of deltas landed in it. The running
    // turn is `activeTurn` and is not in the history until it finishes.
    expect(running).toHaveLength(1);
    expect(m.t.hasText('Two things')).toBe(true);
    await m.t.unmount();
  });

  it('expands a tool call in place', async () => {
    const m = await conversation();
    // The call's output is not on screen until it is asked for.
    expect(m.t.hasText('#define EVFILT_FS')).toBe(false);
    m.t.app.store.set('$/chat/ui/expanded', { c1: true });
    // Onto the call itself, which is the fifth block. Two past it also
    // happened to work while the transcript had two more rows to give - the
    // output stayed on screen from below - and that is luck rather than a
    // test: the cursor belongs on the thing being expanded.
    m.t.focus('chat.transcript');
    m.t.press('home');
    for (let i = 0; i < 4; i++) { m.t.press('down'); await m.t.settle(); }
    for (let i = 0; i < 4; i++) await m.t.settle();
    expect(m.t.hasText('#define EVFILT_FS')).toBe(true);
    await m.t.unmount();
  });
});

describe('when the agent is waiting', () => {
  it('blocks on a tool confirmation and answers it', async () => {
    const m = await conversation();
    m.t.app.services.require(CONTROLLER).send('run the tests');
    await run(m);

    // `InputNeeded` is 24 and carries `InProgress`: a client that tests the
    // wrong one first reports this session as merely running.
    const status = m.t.store.get<number>('$/chat/conv/status') ?? 0;
    expect(decodeStatus(status).activity).toBe('input');
    expect(m.t.hasText('Run a command in')).toBe(true);
    expect(m.t.hasText('Approve')).toBe(true);

    m.t.app.services.require(CONTROLLER).approve();
    await run(m, 1);
    expect(m.t.store.get(INPUT)).toBeNull();
    await m.t.unmount();
  });

  /**
   * The row above the composer, and the reason it is there.
   *
   * "I click Approve and nothing happens" is a report that can be earned two
   * ways - the press never reached anything, or it reached a host that had
   * nothing to say - and a client that draws neither leaves a person with no
   * way to tell them apart. So every way out of `approve` says which one it
   * took, on the row between the block and the composer.
   */
  it('says the answer has gone, where the answer was given', async () => {
    const m = await conversation();
    m.t.app.services.require(CONTROLLER).send('run the tests');
    await run(m);

    // Nothing has been pressed, so there is nothing to say and no row saying
    // it: a status line that is always there is a row of chrome.
    expect(m.t.store.get(INPUT_STATUS) ?? null).toBeNull();

    m.t.app.services.require(CONTROLLER).approve();
    await m.t.settle();
    expect(m.t.store.get<InputStatus>(INPUT_STATUS)?.state).toBe('sending');
    expect(m.t.hasText('Approving...')).toBe(true);

    // The host let go of the question, which is the answer this row was
    // waiting for. It does not stay up over the next one.
    await run(m, 1);
    expect(m.t.store.get(INPUT)).toBeNull();
    expect(m.t.store.get(INPUT_STATUS) ?? null).toBeNull();
    expect(m.t.hasText('Approving...')).toBe(false);
    await m.t.unmount();
  });

  it('says so when there is nothing to approve, rather than nothing at all', async () => {
    const m = await idle();
    // The palette offers `chat.approve` and a key is bound to it, so this is
    // reachable with no block up at all - and it used to return silently,
    // which is a command that does nothing and says nothing about it.
    m.t.app.services.require(CONTROLLER).approve();
    await m.t.settle();

    expect(m.t.store.get<InputStatus>(INPUT_STATUS)?.state).toBe('failed');
    expect(m.t.hasText('Nothing is waiting to be approved')).toBe(true);
    await m.t.unmount();
  });

  it('turns the row red when the host refuses the answer', async () => {
    const m = await conversation();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);

    controller.approve();
    await m.t.settle();
    // What a refusal of the dispatch arrives as: `onRefusal` on the live host
    // is wired straight to this.
    controller.report(new Error('the host stopped answering'));
    await m.t.settle();

    const status = m.t.store.get<InputStatus>(INPUT_STATUS);
    expect(status?.state).toBe('failed');
    expect(status?.text).toContain('the host stopped answering');
    expect(m.t.hasText('the host stopped answering')).toBe(true);
    await m.t.unmount();
  });

  /**
   * The narrow terminal, where a status row is most able to do damage.
   *
   * A host's refusal is a sentence, not a word, and a row that wraps it takes
   * three lines out of a twenty-line screen - which is the composer pushed
   * off the bottom by the message explaining why the last thing you typed did
   * not work.
   */
  it('keeps the refusal to one row on a narrow terminal', async () => {
    const m = await conversation({ width: 76, height: 20 });
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);

    controller.approve();
    await m.t.settle();
    controller.report(new Error(
      'the host refused this confirmation because the tool call it names has already been settled by another client',
    ));
    await m.t.settle();

    // Cut, not wrapped: the tail is off the row rather than on the next one.
    expect(m.t.hasText('the host refused this confirmation')).toBe(true);
    expect(m.t.hasText('settled by another client')).toBe(false);
    // And said once. The footer says what the host refused too, and the same
    // sentence in red on two of twenty rows is the second one wasted.
    const rows = m.t.text().split('\n').filter((row) => row.includes('the host refused'));
    expect(rows).toHaveLength(1);
    await m.t.unmount();
  });

  it('leaves the row alone for a refusal that was not the answer', async () => {
    const m = await conversation();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);

    // Nothing has been answered, so this refusal belongs to some other
    // command. The footer is where it goes; the row above the composer would
    // be blaming the block that is waiting for a failure that is not its own.
    controller.report(new Error('could not list the terminals'));
    await m.t.settle();

    expect(m.t.store.get(INPUT_STATUS) ?? null).toBeNull();
    expect(m.t.store.get<string>(HOST_ERROR)).toContain('could not list the terminals');
    await m.t.unmount();
  });

  it('renders a question as a question, with its choices', async () => {
    const m = await conversation();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);
    controller.approve();
    await run(m);

    // A `chatInput` carries no tool call at all. Read as a confirmation, the
    // options vanish and what is left is a heading and an Approve button.
    expect(m.t.hasText('Where should the single-letter keys')).toBe(true);
    expect(m.t.hasText('1. On the transcript scope')).toBe(true);
    expect(m.t.hasText('Add a test that types into the composer')).toBe(true);
    await m.t.unmount();
  });

  it('gives the keyboard to the question, not the composer behind it', async () => {
    const m = await idle();
    const controller = m.t.app.services.require(CONTROLLER);
    // A question with nothing to choose from: the one kind that has to be
    // typed at, and the one the arrow keys cannot answer.
    controller.send('go look at it');
    await run(m);

    expect(m.t.hasText('Which specific bug, failing test, or file')).toBe(true);
    // Whatever holds focus, it is in the block that is waiting - not the
    // composer, which is what a typed answer used to end up in.
    const focused = m.t.app.focus.focused();
    expect(focused).not.toBeNull();
    expect(m.t.app.focus.scopeOf(focused as string)).toBe('chat.hitl');

    m.t.type('examples/ink/src/fonts.ts');
    await m.t.settle();

    const answers = m.t.store.get<Record<string, Record<string, unknown>>>('$/chat/ui/answers') ?? {};
    const request = m.t.store.get<{ id: string }>(INPUT) as { id: string };
    expect(answers[request.id]?.q1).toEqual({ kind: 'text', value: 'examples/ink/src/fonts.ts' });
    // And not into the composer, which is where every one of those keys went.
    expect(m.t.store.get(DRAFT) ?? '').toBe('');

    // Which is the point of typing it: the answer is now sendable.
    m.t.press('enter');
    await run(m);
    expect(m.t.store.get(INPUT)).toBeNull();
    await m.t.unmount();
  });

  it('takes a second line of an answer, and sends on a bare enter', async () => {
    const m = await idle();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('go look at it');
    await run(m);

    m.t.type('the fonts example');
    // What a host asks for in words is answered in words, and an answer worth
    // two lines was impossible in a field that had only one.
    m.t.press('alt+enter');
    m.t.type('and the ink one');
    await m.t.settle();

    const request = m.t.store.get<{ id: string }>(INPUT) as { id: string };
    const answers = m.t.store.get<Record<string, Record<string, unknown>>>('$/chat/ui/answers') ?? {};
    expect(answers[request.id]?.q1).toEqual({
      kind: 'text', value: 'the fonts example\nand the ink one',
    });

    // The newline is the modified key; the bare one still sends.
    m.t.press('enter');
    await run(m);
    expect(m.t.store.get(INPUT)).toBeNull();
    await m.t.unmount();
  });

  it('answers a choice with the arrow keys', async () => {
    const m = await conversation();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);
    controller.approve();
    await run(m);

    // The first field is the one that has it, so `down` is a choice rather
    // than a scroll of the transcript underneath.
    m.t.press('down');
    await m.t.settle();
    const answers = m.t.store.get<Record<string, Record<string, unknown>>>('$/chat/ui/answers') ?? {};
    const request = m.t.store.get<{ id: string }>(INPUT) as { id: string };
    expect(answers[request.id]?.q1).toEqual({ kind: 'selected', value: 'composer-escape' });
    await m.t.unmount();
  });

  it('will not send while a required question is unanswered', async () => {
    // `idle`, not `conversation`: the seeded session is blocked on a
    // confirmation, so a message sent at it is queued on the host and starts a
    // turn of its own the moment this one ends - which is correct, and is a
    // second confirmation arriving in the middle of a test about a question.
    const m = await idle();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);
    controller.approve();
    await run(m);

    // An accept with no answers resumes the agent on the answers it already
    // had, which for a question it has just asked is none.
    controller.answer({}, true);
    await run(m, 1);
    expect(m.t.store.get(INPUT)).not.toBeNull();

    controller.answer({ q1: { kind: 'selected', value: 'transcript-scope' } }, true);
    await run(m);
    expect(m.t.store.get(INPUT)).toBeNull();
    expect(m.t.hasText('transcript-scope')).toBe(true);
    await m.t.unmount();
  });
});

describe('a chip on the control row', () => {
  /**
   * The panel a chip opens is the chip's toggle, and it opens on the answer
   * that is in force.
   *
   * Both of those were wrong in the same way: the panel knew which question
   * was being asked and nothing about what it was currently answered with, so
   * it opened at the top of the list and a second click on the chip closed and
   * reopened it - which looks exactly like the click doing nothing.
   */
  const chip = async () => {
    const m = await idle();
    m.t.app.store.set(SETTINGS, { ...(m.t.app.store.get<object>(SETTINGS) ?? {}), permissionMode: 'plan' });
    for (let i = 0; i < 6; i++) await m.t.settle();
    return m;
  };

  const open = (m: Mounted): void => {
    openPicker(m.t.app, { commandId: 'compose.set.permissionMode', anchorId: 'chat.composer' });
  };

  it('opens on the value in force, not on the first one', async () => {
    const m = await chip();
    open(m);
    for (let i = 0; i < 6; i++) await m.t.settle();

    const marked = m.t.lines().find((line) => line.includes('\u25b8') && line.includes('Plan')) ?? '';
    expect(marked).toContain('Plan only');
    await m.t.unmount();
  });

  it('closes when the same chip is clicked again', async () => {
    const m = await chip();
    open(m);
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.app.layers.entries().some((e) => e.id === PICKER)).toBe(true);

    open(m);
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.app.layers.entries().some((e) => e.id === PICKER)).toBe(false);
    await m.t.unmount();
  });

  it('swaps to another chip rather than closing', async () => {
    const m = await chip();
    // A second question, so "the same chip again" and "a different chip" are
    // told apart rather than both reading as a second click.
    m.t.app.commands.register({
      id: 'compose.set.pace',
      title: 'Pace',
      slots: ['palette'],
      args: [{
        name: 'value', type: 'string', required: true,
        choices: [{ value: 'slow', label: 'Deliberate' }, { value: 'fast', label: 'Brisk' }],
      }],
      run: () => {},
    });
    open(m);
    for (let i = 0; i < 6; i++) await m.t.settle();

    openPicker(m.t.app, { commandId: 'compose.set.pace', anchorId: 'chat.composer' });
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.app.layers.entries().some((e) => e.id === PICKER)).toBe(true);
    expect(m.t.hasText('Deliberate')).toBe(true);
    await m.t.unmount();
  });
});

describe('the slash menu', () => {
  /**
   * A slash command of ours is ours.
   *
   * The menu listed the client's own commands and then sent whatever was
   * typed down the session channel, so `/go.sessions` went to the agent as a
   * message - the one place it could not possibly mean anything. Only a slash
   * the menu does not match is the agent's.
   */
  const composing = async (typed: string) => {
    const m = await idle();
    m.t.focus('chat.composer');
    await m.t.settle();
    m.t.type(typed);
    for (let i = 0; i < 4; i++) await m.t.settle();
    return m;
  };

  it('walks the completions with the arrow keys', async () => {
    const m = await composing('/go');
    // The first row is marked; down moves the mark to the second.
    const marked = (): string => m.t.lines().find((line) => line.includes('\u25b8 /go')) ?? '';
    const first = marked();
    expect(first).toContain('/go.back');

    // *A* second row, not a named one. Which command sits under `/go.back` is
    // whatever has been registered, and a test that pinned it would fail every
    // time a screen is added - which is not what this is checking.
    m.t.press('down');
    for (let i = 0; i < 4; i++) await m.t.settle();
    const second = marked();
    expect(second).toContain('/go.');
    expect(second).not.toBe(first);

    m.t.press('up');
    for (let i = 0; i < 4; i++) await m.t.settle();
    expect(marked()).toBe(first);
    await m.t.unmount();
  });

  it('runs the chosen command instead of sending it', async () => {
    const m = await composing('/go.sessions');
    const before = turnsIn(m);

    m.t.press('enter');
    for (let i = 0; i < 8; i++) await m.t.settle();

    expect(m.t.app.screens.current()?.id).toBe('sessions');
    expect(m.t.app.store.get(DRAFT)).toBe('');
    // Nothing went down the channel: the agent was never asked about this.
    expect(turnsIn(m)).toBe(before);
    await m.t.unmount();
  });

  it('runs the row that was clicked', async () => {
    const m = await composing('/go');
    const row = m.t.lines().findIndex((line) => line.includes('/go.new'));
    expect(row).toBeGreaterThan(-1);

    const before = turnsIn(m);
    m.t.click(10, row);
    for (let i = 0; i < 8; i++) await m.t.settle();

    expect(m.t.app.screens.current()?.id).toBe('new');
    expect(turnsIn(m)).toBe(before);
    await m.t.unmount();
  });

  it('sends a slash it does not know, because that one is the agent\'s', async () => {
    const m = await composing('/compact');
    // Nothing of ours matched, so there is no menu to choose from.
    expect(m.t.hasText('/go.back')).toBe(false);
    const before = turnsIn(m);

    m.t.press('enter');
    await run(m);

    expect(turnsIn(m)).toBeGreaterThan(before);
    expect(m.t.hasText('/compact')).toBe(true);
    await m.t.unmount();
  });
});

describe('the composer', () => {
  it('takes a letter that is also a command key', async () => {
    const m = await idle();
    m.t.focus('chat.composer');
    await m.t.settle();

    // `c` opens the changes screen while the transcript has the keyboard. In
    // the composer it is a letter, because the focused node is offered a key
    // before any keybinding is.
    m.t.type('check');
    for (let i = 0; i < 4; i++) await m.t.settle();

    expect(m.t.app.screens.current()?.id).toBe('chat');
    expect(m.t.store.get<string>('$/chat/ui/draft')).toBe('check');
    await m.t.unmount();
  });

  it('queues a message rather than starting a second turn', async () => {
    const m = await idle();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m, 6);

    controller.send('and another thing');
    await m.t.settle();

    expect(queuedText(m)).toEqual(['and another thing']);
    const running = (m.t.store.get<Turn[]>(TURNS) ?? []).filter((turn) => turn.state === 'running');
    expect(running).toHaveLength(1);
    expect(m.t.hasText('queued')).toBe(true);
    await m.t.unmount();
  });

  it('sends what was queued once the turn it was waiting on ends', async () => {
    const m = await idle();
    const controller = m.t.app.services.require(CONTROLLER);
    // Three messages that run to the end on their own. "run the tests" stops
    // at a confirmation, and a turn that never finishes is a queue that never
    // gets its go-ahead - which is the fixture's business, not the bug's.
    controller.send('the build fails');
    await run(m, 6);

    controller.send('the linker is broken too');
    controller.send('and this error as well');
    await m.t.settle();
    expect(queuedText(m)).toEqual(['the linker is broken too', 'and this error as well']);

    // A queue held in the client was a list that only ever grew: nothing here
    // was watching for the turn to end, so a message typed while the agent was
    // working sat under the transcript saying `queued` until the session was
    // closed. It is the host's queue now, and the host starts the next turn
    // from the head as soon as it goes idle.
    await run(m);
    expect(queuedText(m)).toEqual([]);
    const said = (m.t.store.get<Turn[]>(TURNS) ?? [])
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.message);
    // In order, and each its own turn: they were written as separate messages
    // and joining them into one is the other way to get a queue wrong.
    expect(said.slice(-3)).toEqual([
      'the build fails', 'the linker is broken too', 'and this error as well',
    ]);
    await m.t.unmount();
  });

  it('takes a queued message back before it is sent', async () => {
    const m = await idle();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('the build fails');
    await run(m, 6);

    controller.send('never mind this broken one');
    controller.send('but send this error');
    await m.t.settle();

    const [first] = m.t.store.get<{ id: string }[]>(QUEUE) ?? [];
    controller.unqueue((first as { id: string }).id);
    await m.t.settle();
    expect(queuedText(m)).toEqual(['but send this error']);

    await run(m);
    const said = (m.t.store.get<Turn[]>(TURNS) ?? [])
      .filter((turn) => turn.role === 'user')
      .map((turn) => turn.message);
    expect(said).not.toContain('never mind this broken one');
    expect(said).toContain('but send this error');
    await m.t.unmount();
  });

  it('makes a newline of ctrl+enter, where the terminal can say it', async () => {
    const m = await idle();
    const before = (m.t.store.get<Turn[]>(TURNS) ?? []).length;
    m.t.focus('chat.composer');
    m.t.type('first line');
    // The kitty protocol's encoding. Two others say the same key - a bare LF
    // and xterm's `CSI 27;5;13~` - and the test below feeds those, because for
    // a long time this one passed while the key did nothing in a real
    // terminal: it was the only encoding the decoder could read.
    m.t.feed('\u001b[13;5u');
    m.t.type('second');
    for (let i = 0; i < 4; i++) await m.t.settle();

    expect(m.t.store.get<string>('$/chat/ui/draft')).toBe('first line\nsecond');
    // And nothing was sent: this is the key that is *not* send.
    expect((m.t.store.get<Turn[]>(TURNS) ?? []).length).toBe(before);
    await m.t.unmount();
  });

  it('makes a newline of ctrl+enter in the two encodings that are not kitty', async () => {
    // A bare LF and xterm's `modifyOtherKeys`. Both used to fail, in different
    // ways: LF was named plain `enter` and sent the message, and `CSI 27;5;13~`
    // matched no branch at all and did nothing.
    for (const bytes of ['\n', '\u001b[27;5;13~']) {
      const m = await idle();
      const before = (m.t.store.get<Turn[]>(TURNS) ?? []).length;
      m.t.focus('chat.composer');
      m.t.type('one');
      m.t.feed(bytes);
      m.t.type('two');
      for (let i = 0; i < 4; i++) await m.t.settle();

      expect(m.t.store.get<string>('$/chat/ui/draft')).toBe('one\ntwo');
      expect((m.t.store.get<Turn[]>(TURNS) ?? []).length).toBe(before);
      await m.t.unmount();
    }
  });

  it('sends on enter, from bytes rather than a synthesised event', async () => {
    const m = await open();
    m.t.app.services.require(CONTROLLER).open(IDLE);
    m.t.app.screens.push('chat');
    for (let i = 0; i < 6; i++) await m.t.settle();

    m.t.focus('chat.composer');
    m.t.type('hello');
    m.t.feed('\r');
    for (let i = 0; i < 4; i++) await m.t.settle();

    expect(m.t.store.get<string>('$/chat/ui/draft')).toBe('');
    await run(m, 3);
    expect(m.t.hasText('hello')).toBe(true);
    await m.t.unmount();
  });
});

describe('the catalogue', () => {
  it('puts the keyboard on the list, not in the filter', async () => {
    const { t } = await catalogue();
    // Every single-letter command depends on this. With focus in the filter,
    // `d` is a letter typed into a text field and the key that disposes a
    // session does nothing - which looks exactly like a key that is missing.
    expect(t.app.focus.focused()).toBe('chat.sessions');
    await t.unmount();
  });

  it('archives the selected session with a key', async () => {
    const { t } = await catalogue();
    t.app.store.set('$/chat/ui/selected', 'ahp-session:/9c74');
    await t.settle();

    t.press('a');
    for (let i = 0; i < 4; i++) await t.settle();
    // Archived is hidden, so the row leaves the list it was in.
    expect(t.hasText('Why does the composer')).toBe(false);
    await t.unmount();
  });

  it('disposes a session after asking', async () => {
    const { t } = await catalogue();
    t.app.store.set('$/chat/ui/selected', 'ahp-session:/9c74');
    await t.settle();

    t.press('d');
    for (let i = 0; i < 4; i++) await t.settle();
    // The host ends the session for every client watching it, so it asks.
    expect(t.hasText('Dispose session')).toBe(true);

    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('Why does the composer')).toBe(false);
    await t.unmount();
  });

  /**
   * The key somebody reaches for without being told.
   *
   * `d` is the letter the footer has room to name and `delete` is the guess,
   * and a catalogue that answers only the first is a catalogue where dismissing
   * a session is something you have to be shown. Both confirm, because ending
   * somebody else's conversation is not an undo.
   */
  it('dismisses a session with the delete key too', async () => {
    const { t } = await catalogue();
    t.app.store.set('$/chat/ui/selected', 'ahp-session:/9c74');
    await t.settle();

    t.press('delete');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Dispose session')).toBe(true);

    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('Why does the composer')).toBe(false);
    await t.unmount();
  });

  it('keeps the session when the confirm is declined', async () => {
    const { t } = await catalogue();
    t.app.store.set('$/chat/ui/selected', 'ahp-session:/9c74');
    await t.settle();

    t.press('delete');
    for (let i = 0; i < 4; i++) await t.settle();
    t.press('escape');
    for (let i = 0; i < 6; i++) await t.settle();
    // Still there. Without this the test above passes on a confirm that
    // disposes whatever is answered.
    expect(t.hasText('Why does the composer')).toBe(true);
    await t.unmount();
  });

  it('focuses the filter by name, which is what a key needs to exist', async () => {
    const { t } = await catalogue();
    await t.app.execute('session.filter');
    await t.settle();
    expect(t.app.focus.focused()).toBe('chat.filter');

    // And typing into it is typing, not commands: `n` would be "new session"
    // one control away.
    t.type('never');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('sessions');
    expect(t.store.get<string>('$/chat/ui/filter')).toBe('never');
    await t.unmount();
  });

  it('hides archived sessions, and says so', async () => {
    const { t } = await catalogue();
    expect(t.hasText('Old build script')).toBe(false);
    await t.app.execute('session.toggleArchived');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Old build script')).toBe(true);
    await t.unmount();
  });

  /**
   * A row is two lines, and the first one is why.
   *
   * A title, a harness, a workspace and a status sharing a pane that is also
   * sharing the terminal with the detail panel leaves all four truncated -
   * and a row reading `Draft replies for desk-produ…` beside
   * `1b444e78-d050-4fb5-a5…` has answered neither of the two questions it was
   * asked. So the title gets the width and what qualifies it goes underneath.
   */
  /** The two lines of one row, read out of the pane it is actually in. */
  const rowOf = (t: Harness, title: string): [string, string] => {
    const rect = t.getByLabel(title).rect;
    if (!rect) throw new Error(`no rect for ${title}`);
    const cut = (y: number): string => t.line(y).slice(rect.x, rect.x + rect.width);
    return [cut(rect.y), cut(rect.y + 1)];
  };

  it('gives the title its own line, and what qualifies it the next one', async () => {
    const { t } = await catalogue();
    expect(t.getByLabel('Kqueue events on Linux').rect?.height).toBe(2);
    const [first, second] = rowOf(t, 'Kqueue events on Linux');

    // The status stays with the title: it is the column the list is scanned
    // for, and it is three words at most.
    expect(first).toContain('Kqueue events on Linux');
    expect(first).toContain('waiting on you');
    // ...and the harness and the workspace are not competing with it.
    expect(first).not.toContain('brb_framework');
    expect(second).toContain('claude');
    expect(second).toContain('brb_framework');
    await t.unmount();
  });

  it('starts the second line under the title, not under the glyph', async () => {
    const { t } = await catalogue();
    const [first, second] = rowOf(t, 'Kqueue events on Linux');
    // The second line qualifies the thing the first one names, so it begins
    // where that thing begins rather than out at the marker's gutter.
    expect(second.indexOf('claude')).toBe(first.indexOf('Kqueue'));
    await t.unmount();
  });

  /**
   * The detail pane, as a drawer.
   *
   * Right opens it and left puts it away: the key points at the pane, which
   * is on the right of the screen.
   *
   * Under `splitAt` it is not drawn at all until it is asked for. Forty cells
   * of detail take the session list down to a column that cuts every title,
   * and the detail pane they were taken for is still too narrow to hold the
   * URIs it exists to show - two truncated halves rather than one whole one.
   */
  it('keeps the detail pane shut on a terminal too narrow to split', async () => {
    const { t } = await catalogue();
    expect(t.hasText('enter copies')).toBe(false);
    expect(t.hasText('ahp-chat:/1f0a')).toBe(false);
    // Which is the whole point: with the pane away, a title is not cut.
    expect(t.hasText('Split the transcript viewport')).toBe(true);
    await t.unmount();
  });

  it('pulls the drawer out with right, and puts it back with left', async () => {
    const { t } = await catalogue();
    expect(t.app.focus.focused()).toBe('chat.sessions');

    t.press('right');
    for (let i = 0; i < 6; i++) await t.settle();
    // Opening it is going to it. A pane that appeared and left the cursor
    // behind is a pane you then have to press something else to read.
    expect(t.app.focus.focused()).toBe('chat.details');
    expect(t.hasText('ahp-chat:/1f0a')).toBe(true);

    t.press('left');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.app.focus.focused()).toBe('chat.sessions');
    expect(t.hasText('ahp-chat:/1f0a')).toBe(false);
    await t.unmount();
  });

  it('draws both panes from the start when the terminal is wide enough', async () => {
    const { t } = await catalogue({ width: 150, height: 30 });
    // Nothing has been pressed. Above the split there is room for both, so
    // the detail is not something you go and fetch.
    expect(t.hasText('ahp-chat:/1f0a')).toBe(true);
    expect(t.app.focus.focused()).toBe('chat.sessions');
    await t.unmount();
  });

  it('takes the width to open on, from wherever it was configured', async () => {
    const host = fakeHost();
    // 100 columns is under the 140 default, so this is only two panes if the
    // option was read - which is the point of it being an option.
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host, splitAt: 80 }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    await t.app.execute('go.sessions');
    for (let i = 0; i < 6; i++) await t.settle();

    expect(t.hasText('ahp-chat:/1f0a')).toBe(true);
    await t.unmount();
  });

  it('leaves left and right to the filter box while it has the keyboard', async () => {
    const { t } = await catalogue();
    await t.app.execute('session.filter');
    await t.settle();
    t.type('brb');
    for (let i = 0; i < 4; i++) await t.settle();

    // In a text field these are caret movement, and the runtime offers the
    // key to the focused node before any binding. A pane key that stole them
    // would make the filter box impossible to edit.
    t.press('left');
    t.press('right');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.focus.focused()).toBe('chat.filter');
    expect(t.store.get<string>('$/chat/ui/filter')).toBe('brb');
    await t.unmount();
  });
});

describe('leaving', () => {
  it('gives ctrl+c to the turn while one is running, and to quit when none is', async () => {
    const quits: string[] = [];
    const host = fakeHost();
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => {
        registerChat(app, { host });
        app.commands.register({ id: 'app.quit', title: 'Quit', run: () => quits.push('quit') });
        app.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
      },
    });
    for (let i = 0; i < 6; i++) await t.settle();

    // Nothing is running: the stop binding does not apply and the key falls
    // through. A `when` on the command alone would swallow it here.
    t.press('ctrl+c');
    await t.settle();
    expect(quits).toEqual(['quit']);

    const controller = t.app.services.require(CONTROLLER);
    controller.open(SEEDED);
    t.app.screens.push('chat');
    for (let i = 0; i < 4; i++) await t.settle();
    controller.send('go');
    for (let i = 0; i < 20; i++) host.pump();
    for (let i = 0; i < 4; i++) await t.settle();

    t.press('ctrl+c');
    for (let i = 0; i < 4; i++) await t.settle();
    // Still one: this one stopped the turn instead.
    expect(quits).toEqual(['quit']);
    expect(t.store.get<Turn[]>(TURNS)?.some((turn) => turn.state === 'running')).toBe(false);
    await t.unmount();
  });
});

describe('the catalogue tells the truth about what is waiting', () => {
  it('has something to answer on the session that says a person is wanted', async () => {
    // The status is a bitset the host derives from its own state, and a seeded
    // one that claimed `InputNeeded` while holding no pending input looked
    // exactly like a client that drops the request when you leave the screen.
    // Opening the row that says "waiting on you" must produce something to
    // answer, or the row is a lie.
    const { t } = await catalogue();
    expect(t.hasText('waiting on you')).toBe(true);

    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.store.get(INPUT)).not.toBeNull();
    expect(t.hasText('Approve')).toBe(true);
    await t.unmount();
  });

  it('still asks after you leave it and come back', async () => {
    const { t } = await catalogue();
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();

    t.press('escape');
    t.press('escape');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('sessions');

    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    // Unanswered is unanswered. The host holds it, the snapshot carries it,
    // and coming back is not answering it.
    expect(t.hasText('Approve')).toBe(true);
    await t.unmount();
  });

  it('lets the transcript be read while it is blocked', async () => {
    // The block used to trap focus, which is defensible until you notice that
    // approving a command is a decision about what is written above it - and
    // that the trap also ate the escape the block itself advertises.
    const { t } = await catalogue();
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();

    t.focus('chat.transcript');
    // `home` is the top of the feed, and the top of the feed is the caption
    // saying what this session is. One down is the first thing said in it.
    t.press('home');
    t.press('down');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('EVFILT_FS never fires')).toBe(true);
    await t.unmount();
  });
});

describe('sessions are not all one session', () => {
  it('opens each on its own conversation', async () => {
    const m = await open();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.open('ahp-session:/9c74');
    m.t.app.screens.push('chat');
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.hasText('that is the focus model working')).toBe(true);
    expect(m.t.hasText('EVFILT')).toBe(false);
    await m.t.unmount();
  });

  it('answers differently depending on what was said', async () => {
    const m = await idle();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.send('run the tests');
    await run(m);
    // A command that asks first.
    expect(m.t.store.get(INPUT)).not.toBeNull();

    const other = await idle();
    other.t.app.services.require(CONTROLLER).send('is that the focus model');
    await run(other);
    // Prose, no tool call, nothing to answer. One canned reply to everything
    // only ever proves the client can render that one reply.
    expect(other.t.store.get(INPUT)).toBeNull();
    await m.t.unmount();
    await other.t.unmount();
  });
});

describe('what a session actually is', () => {
  it('shows the chat, the permissions and the model, not just the session id', async () => {
    const { t } = await catalogue();
    t.app.store.set(SELECTED, 'ahp-session:/6b21');
    // At this width the pane is a drawer, so it has to be pulled out first.
    await t.app.execute('session.openDetails');
    for (let i = 0; i < 6; i++) await t.settle();

    // A session is not a conversation: it holds chats, and the chat URI is
    // what a turn is dispatched to. It is on the session channel, never in the
    // catalogue's summary.
    expect(t.hasText('ahp-chat:/6b21')).toBe(true);
    // The host's own wording for its own setting, not the id it stores.
    expect(t.hasText('Accept edits')).toBe(true);
    // The catalogue's name for it, resolved from the id a turn rides on -
    // a host's ids are things like `claude-sonnet-4-5-20250929`.
    expect(t.hasText('Sonnet 5')).toBe(true);
    await t.unmount();
  });

  /**
   * The branch, under whichever name the host gives it.
   *
   * `_meta.git` is convention rather than specification - an open map with a
   * well-known key - so the names in it are not declared anywhere and there
   * are two of them in the wild. Reading only the one this client met first
   * made the row say "the host does not say" against hosts that were saying
   * it in the other spelling.
   */
  it('reads the branch under either name a host uses for it', async () => {
    const { t } = await catalogue({ width: 140, height: 30 });
    t.app.store.set(SELECTED, 'ahp-session:/6b21');
    await t.app.execute('session.openDetails');
    for (let i = 0; i < 6; i++) await t.settle();

    expect(t.hasText('main')).toBe(true);
    expect(t.hasText('not a repository')).toBe(false);
    await t.unmount();
  });

  /**
   * What this model takes, which is not what the harness takes.
   *
   * The session-wide thinking level is one setting, and the model running
   * under it accepts some of the levels or none - so a person choosing one had
   * no way to know whether it would be honoured except by trying it. The
   * levels are the host's own words and are drawn in the host's own order.
   */
  it('says which thinking levels the model it ran on accepts', async () => {
    const { t } = await catalogue({ width: 140, height: 30 });
    t.app.store.set(SELECTED, 'ahp-session:/6b21');
    await t.app.execute('session.openDetails');
    for (let i = 0; i < 6; i++) await t.settle();

    // The host's own title for its own property, alongside the settings it
    // asks about - the pane already draws those, and a model's options are
    // the same document in the same shape.
    expect(t.hasText('Thinking Level')).toBe(true);
    // Sonnet takes one level in the fixture, and the host named no default
    // among it - so nothing is marked, rather than the first one guessed at.
    expect(t.hasText('Medium')).toBe(true);
    expect(t.hasText('(default)')).toBe(false);
    await t.unmount();
  });

  /**
   * What the answer above was asked for.
   *
   * A thinking level is chosen per turn and holds from that turn onwards, so
   * an id alone cannot say what any given answer cost - two answers from one
   * model are two different questions. The values are the host's own, and the
   * key is not drawn: `medium` is what a person reads, `thinkingLevel medium`
   * is twice as long and no clearer.
   */
  it('says what the turn was asked for, beside the model that answered', async () => {
    const { t } = await catalogue({ width: 140, height: 30 });
    t.app.store.set(SELECTED, 'ahp-session:/1f0a');
    await t.app.execute('session.open');
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.hasText('medium')).toBe(true);
    await t.unmount();
  });

  /**
   * The same rows on a terminal half as wide.
   *
   * Not a duplicate. The label column used to be a constant eleven on the
   * grounds that the labels were this client's own, which stopped being true
   * when a host's titles started arriving in it - `Thinking Level` is
   * fourteen, and it drew as `Thinking L…` at every width there is. What has
   * to hold on a narrow terminal is that the column grew for the label and
   * the value is still there beside it.
   */
  it('names the property in full on a narrow terminal too', async () => {
    const { t } = await catalogue({ width: 100, height: 30 });
    t.app.store.set(SELECTED, 'ahp-session:/6b21');
    await t.app.execute('session.openDetails');
    for (let i = 0; i < 6; i++) await t.settle();

    expect(t.hasText('Thinking Level')).toBe(true);
    expect(t.hasText('Medium')).toBe(true);
    await t.unmount();
  });

  /**
   * The pane you are reading is the wide one.
   *
   * A fixed split has to be wrong somewhere. Forty cells for the detail pane
   * left the session list too narrow to read a title in, and giving the list
   * the space instead truncates the URIs the detail pane exists to let you
   * copy. Neither matters while you are looking at the other one.
   */
  it('gives the width to whichever pane has the keyboard', async () => {
    const { t } = await catalogue();
    t.app.store.set(SELECTED, SEEDED);
    // The drawer out, and the keyboard put back on the list: this is about
    // which pane is the wide one, which only means anything once both of them
    // are drawn. Wider than the split there is room for the workspace either
    // way, and the test would pass without proving anything.
    t.app.store.set(SIDEBAR, true);
    for (let i = 0; i < 6; i++) await t.settle();
    t.focus('chat.sessions');
    for (let i = 0; i < 4; i++) await t.settle();

    // The list has the keyboard, so the workspace does not fit.
    expect(t.hasText('/brb_main/src/brb_framework')).toBe(false);

    t.focus('chat.details');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('/brb_main/src/brb_framework')).toBe(true);

    // And walking back out gives the list its width back on the way past.
    t.focus('chat.sessions');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('/brb_main/src/brb_framework')).toBe(false);
    expect(t.hasText('Kqueue events on Li')).toBe(true);
    await t.unmount();
  });

  it('copies the value under the cursor', async () => {
    const { t } = await catalogue();
    t.app.store.set(SELECTED, 'ahp-session:/9c74');
    await t.app.execute('session.openDetails');
    for (let i = 0; i < 6; i++) await t.settle();

    t.focus('chat.details');
    // Down to the row that holds the session URI. Which is the point of it
    // being walkable: the identifier is what gets pasted into a shell, and it
    // is exactly what does not fit on one line of a 40-column pane.
    for (let i = 0; i < 9; i++) { t.press('down'); await t.settle(); }
    t.press('enter');
    for (let i = 0; i < 4; i++) await t.settle();

    expect(t.store.get<string>(CLIPBOARD_PATH)).toBe('ahp-session:/9c74');
    expect(t.hasText('copied')).toBe(true);
    await t.unmount();
  });
});

describe('putting a session away, and taking it back', () => {
  it('unarchives what it archived', async () => {
    const { t } = await catalogue();
    t.app.store.set(SELECTED, 'ahp-session:/9c74');
    await t.settle();

    t.press('a');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Why does the composer')).toBe(false);

    // Show them, then take it back. Reading the flag off the *visible* list
    // found nothing, fell back to a status of zero, and archived it again -
    // a toggle that only ever went one way.
    t.press('x');
    for (let i = 0; i < 4; i++) await t.settle();
    t.app.store.set(SELECTED, 'ahp-session:/9c74');
    await t.settle();
    t.press('a');
    for (let i = 0; i < 4; i++) await t.settle();

    t.press('x');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Why does the composer')).toBe(true);
    await t.unmount();
  });

  it('marks a session unread, and reading it marks it read again', async () => {
    const { t } = await catalogue();
    t.app.store.set(SELECTED, 'ahp-session:/9c74');
    // The flags are in the detail pane, which at this width is a drawer. Set
    // rather than pressed, and the keyboard put back where the row keys are:
    // the pane takes focus when it is *asked* for, and `enter` there copies a
    // field rather than opening the session.
    t.app.store.set(SIDEBAR, true);
    for (let i = 0; i < 6; i++) await t.settle();
    t.focus('chat.sessions');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('read')).toBe(true);

    t.press('u');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('unread')).toBe(true);

    // Opening it is what marks it read. Nobody marks their own mail by hand.
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    t.press('escape');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('unread')).toBe(false);
    await t.unmount();
  });
});

describe('the composer is the front door', () => {
  it('starts a session from the first message', async () => {
    const m = await open();
    expect(m.t.app.screens.current()?.id).toBe('new');

    m.t.focus('chat.composer');
    m.t.type('run the tests');
    m.t.feed('\r');
    for (let i = 0; i < 8; i++) await m.t.settle();

    // The message is what creates it. The provider is lazy - it attaches when
    // there is a turn to run - so there is nothing to wait for between the two.
    expect(m.t.app.screens.current()?.id).toBe('chat');
    expect(m.t.store.get(OPEN)).toBeTruthy();
    await run(m, 20);
    expect(m.t.hasText('run the tests')).toBe(true);
    await m.t.unmount();
  });

  it('reaches the control row with tab, and answers it in a panel', async () => {
    const { t } = await open();
    t.press('tab');
    await t.settle();
    expect(t.app.focus.focused()).toBe('chat.option.harness');

    t.press('enter');
    for (let i = 0; i < 8; i++) await t.settle();
    // The palette, anchored above the chip - not a second overlay written for
    // this row. What it is showing is one command's argument.
    expect(t.hasText('Which agent runs this')).toBe(true);
    expect(t.hasText('Copilot CLI')).toBe(true);

    t.press('down');
    t.press('enter');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.store.get<string>(PROVIDER)).toBe('copilotcli');
    // And the keyboard is back where it was, not stranded in a layer that has
    // gone away.
    expect(t.app.focus.focused()).toBe('chat.option.harness');
    await t.unmount();
  });

  it('closes the panel on escape instead of backing out to a list of one', async () => {
    const { t } = await open();
    t.press('tab');
    t.press('enter');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('Which agent runs this')).toBe(true);

    t.press('escape');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('Which agent runs this')).toBe(false);
    expect(t.app.screens.current()?.id).toBe('new');
    await t.unmount();
  });

  it('takes a typed answer where the argument has no choices', async () => {
    const { t } = await open();
    await t.app.execute('compose.workspace', { path: '/brb_main/src/brb_framework' });
    for (let i = 0; i < 6; i++) await t.settle();
    // The same overlay either way: an argument with choices is picked from and
    // one without is typed into, which is what makes a workspace list a later
    // change to the command rather than to anything that draws it.
    expect(t.store.get<string>(WORKSPACE)).toBe('/brb_main/src/brb_framework');
    expect(t.hasText('brb_framework')).toBe(true);
    await t.unmount();
  });

  /**
   * A state that arrives while the conversation is open.
   *
   * `openSession` is a plain read, so a screen that calls it and nothing else
   * never hears about the summary changing underneath it. The caption carries
   * the session's own state, and it went on saying whatever the session said
   * when it was opened - the only way to see the new one was to leave and
   * come back, which remounts the screen and reads the store again.
   */
  it('follows the state of the session it has open', async () => {
    // Tall enough that the caption is on screen. It is the transcript's first
    // entry, and a feed collapses what has scrolled away - so on a short
    // terminal the assertion below would be about virtualisation rather than
    // about the store.
    const m = await conversation({ width: 100, height: 60 });
    const uri = m.t.store.get<string>(OPEN) as string;
    const record = (m.t.store.get<Record<string, SessionSummary>>(SESSIONS) ?? {})[uri] as SessionSummary;
    expect(record).toBeTruthy();
    // Settled until it is on screen rather than a fixed six times: six is
    // enough on an idle machine and is not enough on a loaded one, which is a
    // test that passes or fails on how many other files are running.
    await until(m, () => m.t.getAllByText('waiting on you').length > 0);
    expect(m.t.getAllByText('waiting on you').length).toBeGreaterThan(0);
    expect(m.t.getAllByText('error').length).toBe(0);

    /*
     * Everything the host still owes, before the store is written by hand.
     *
     * `writeSessions` replaces the catalogue, and a `listSessions` still in
     * flight from the mount lands afterwards and puts the host's answer back -
     * so the caption reverts to what the fixture says and the assertion below
     * fails. It depends on how loaded the machine is, which is why this failed
     * about one run in four and passed every time it was looked at.
     */
    await m.host.flush?.();
    for (let i = 0; i < 4; i++) await m.t.settle();

    // What the controller does when the host says something moved, without
    // going anywhere: the same session, in a state it was not in before.
    writeSessions(m.t.app.store, [{ ...record, status: SessionFlag.Error }]);
    await until(m, () => m.t.getAllByText('error').length > 0);

    expect(m.t.getAllByText('error').length).toBeGreaterThan(0);
    await m.t.unmount();
  });

  /**
   * What the host asks about, rather than what this client was written
   * knowing about.
   *
   * The row used to have a chip named `permissionMode`, which is what the
   * *fixture* calls its key. A real host's are `isolation`, `autoApprove` and
   * `mode`, so against one the chip could answer nothing and the detail pane
   * showed a blank "Permissions" beside it. Nothing here names a key: the
   * schema arrives, and a command and a chip exist for each thing in it.
   */
  it('offers a chip for every question the host says it will answer', async () => {
    const { t } = await open();
    // The fake's two, by its own titles rather than by any name in this file.
    expect(t.hasText('Ask each time')).toBe(true);
    expect(t.hasText('Workspace')).toBe(true);
    // And the command that asks about one is registered under the host's key.
    expect(t.app.commands.get('compose.set.isolation')).toBeTruthy();

    // The value, not the label. A host's ids are what it stores and its
    // labels are prose, and resolving one back to the other at the far end is
    // a lookup that can be wrong.
    await t.app.execute('compose.set.isolation', { value: 'worktree' });
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.store.get<Record<string, string>>(SETTINGS)?.isolation).toBe('worktree');
    expect(t.hasText('Worktree')).toBe(true);

    // And asking again does not undo it. `resolveSessionConfig` is iterative:
    // it is told what has been answered and echoes it back with the host's
    // defaults filled in around it, so a client that re-asks on every change
    // of harness keeps the answers rather than resetting them.
    t.store.set(PROVIDER, 'copilotcli');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.store.get<Record<string, string>>(SETTINGS)?.isolation).toBe('worktree');
    await t.unmount();
  });

  it('reaches the chips in the order they are drawn in', async () => {
    const { t } = await open();
    t.focus('chat.composer');
    await t.settle();
    const walked: (string | null)[] = [];
    for (let i = 0; i < 5; i++) { t.press('tab'); await t.settle(); walked.push(t.app.focus.focused()); }
    // Which chips exist is the host's answer, and it arrives a round trip
    // after the row is first drawn - so tab order is stated rather than left
    // to the order things happened to mount in.
    expect(walked).toEqual([
      'chat.option.harness',
      'chat.option.model',
      'chat.option.permissionMode',
      'chat.option.isolation',
      'chat.option.workspace',
    ]);
    await t.unmount();
  });

  /**
   * A harness with nothing to run on.
   *
   * This is the ordinary answer for a harness nobody has signed into: the host
   * advertises it and enumerates no models until it has a token for the
   * resources the harness declares. A client that reads an empty list as "not
   * loaded yet" offers a chip that opens on an empty panel, forever.
   */
  it('says a harness has no models rather than offering none', async () => {
    const { t } = await open();
    t.store.set(PROVIDER, 'copilotcli');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('no models')).toBe(true);

    // And it is not a stop on the way: tab goes past it to the next question
    // that has an answer.
    t.focus('chat.composer');
    await t.settle();
    t.press('tab');
    await t.settle();
    t.press('tab');
    await t.settle();
    expect(t.app.focus.focused()).toBe('chat.option.permissionMode');
    await t.unmount();
  });

  it('walks out of the field to the left', async () => {
    const { t } = await open();
    t.focus('chat.composer');
    await t.settle();
    // Nothing typed, so the caret is already at the front: one more left is
    // "out of here", which is the same thought as escape and closer to hand.
    t.press('left');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('sessions');
    await t.unmount();
  });

  it('describes the session it is above, once one is open', async () => {
    const m = await catalogue();
    m.t.app.store.set(SELECTED, 'ahp-session:/6b21');
    await m.t.settle();
    m.t.press('enter');
    for (let i = 0; i < 8; i++) await m.t.settle();

    // The row is about the next message, so on an open session it has to
    // describe that session rather than whatever was chosen before it.
    expect(m.t.store.get<Record<string, string>>(SETTINGS)?.permissionMode).toBe('acceptEdits');
    expect(m.t.hasText('Accept edits')).toBe(true);
    expect(m.t.hasText('Sonnet 5')).toBe(true);
    // And the harness is not offered: it is the process this is running in.
    m.t.focus('chat.composer');
    m.t.press('tab');
    await m.t.settle();
    expect(m.t.app.focus.focused()).toBe('chat.option.model');
    await m.t.unmount();
  });
});

describe('when the host says no', () => {
  /**
   * A host that refuses one thing.
   *
   * This is what a live catalogue does: it lists sessions whose agent has
   * exited and then answers `-32001 No agent for session` to anything that
   * asks about one. Every one of those calls is started by an effect or a
   * keypress, so nothing is waiting to catch it - and an unhandled rejection
   * ends the process, from a terminal in its alternate screen.
   */
  const refusing = (): FakeHost => {
    const host = fakeHost();
    return {
      ...host,
      detail: async () => {
        const error = Object.assign(new Error('No agent for session'), { code: -32001 });
        throw error;
      },
    };
  };

  it('stays up, and says what the host said', async () => {
    const host = refusing();
    const t = await renderApp({
      width: 100, height: 30, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    await t.app.execute('go.sessions');
    for (let i = 0; i < 8; i++) await t.settle();

    // The pane asks about whatever is highlighted, so this fires on arrival
    // and again on every arrow key.
    expect(t.store.get<string>(HOST_ERROR)).toContain('No agent for session');
    expect(t.hasText('No agent for session')).toBe(true);

    // And it is still an application: the list still moves.
    t.press('down');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('sessions');
    await t.unmount();
  });

  it('takes an error the host sends mid-session', async () => {
    const host = fakeHost();
    const t = await renderApp({
      width: 100, height: 30, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => {
        registerChat(app, {
          host: {
            ...host,
            subscribe: (uri, observer) => {
              // After the snapshot, which is the honest order: the channel
              // answered, and then something on it was refused. A snapshot
              // clears the last refusal, because it is evidence the channel is
              // working again.
              const handle = host.subscribe(uri, observer);
              observer({ type: 'error', message: 'Authentication is required to use Claude (-32007)' });
              return handle;
            },
          },
        });
      },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    t.app.services.require(CONTROLLER).open(IDLE);
    t.app.screens.push('chat');
    for (let i = 0; i < 6; i++) await t.settle();

    // A refusal is not a dropped connection: the two want opposite things from
    // a person, so the host's own words are what is shown.
    expect(t.hasText('Authentication is required')).toBe(true);
    await t.unmount();
  });
});

describe('the status bar', () => {
  it('follows the screen, rather than keeping the one it was mounted on', async () => {
    const m = await idle();
    m.t.focus('chat.transcript');
    await m.t.settle();
    expect(m.t.hasText('i write')).toBe(true);

    // A surface is not remounted by navigating - that is what a surface is for
    // - so asking `screens.current()` during a render answers once and never
    // again, and the footer keeps offering the keys of the screen you left.
    await m.t.app.execute('go.sessions');
    for (let i = 0; i < 4; i++) await m.t.settle();
    expect(m.t.hasText('i write')).toBe(false);
    expect(m.t.hasText('n new')).toBe(true);
    await m.t.unmount();
  });

  it('says what ctrl+c will do where you are', async () => {
    // An idle session: nothing to stop, so the key leaves instead.
    const m = await open();
    m.t.app.services.require(CONTROLLER).open(IDLE);
    m.t.app.screens.push('chat');
    for (let i = 0; i < 6; i++) await m.t.settle();
    m.t.focus('chat.transcript');
    await m.t.settle();
    expect(m.t.hasText('ctrl+c quit')).toBe(true);

    m.t.app.services.require(CONTROLLER).send('go');
    for (let i = 0; i < 20; i++) m.host.pump();
    for (let i = 0; i < 4; i++) await m.t.settle();
    expect(m.t.hasText('ctrl+c stop')).toBe(true);
    await m.t.unmount();
  });
});

describe('leaving, after a session has been open', () => {
  it('still quits once the conversation is behind you', async () => {
    const quits: string[] = [];
    const host = fakeHost();
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => {
        registerChat(app, { host });
        app.commands.register({ id: 'app.quit', title: 'Quit', run: () => quits.push('quit') });
        app.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
      },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    await t.app.execute('go.sessions');
    for (let i = 0; i < 6; i++) await t.settle();

    // The seeded session is blocked, so its status is 24 and stays there. A
    // stop binding that asked only "is something running" therefore matched
    // for ever after the first session was opened, on every screen, and the
    // application could not be closed again.
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('chat');

    t.press('escape');
    t.press('escape');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.app.screens.current()?.id).toBe('sessions');

    t.press('ctrl+c');
    await t.settle();
    expect(quits).toEqual(['quit']);
    await t.unmount();
  });
});

/**
 * The acceptance test, as this repository states it: the same graph under
 * every shell. If one of them needs something the others cannot use, the
 * boundary is in the wrong place.
 */
describe.each(['plain', 'console', 'paper', 'workbench'])('under the %s shell', (shell) => {
  it('draws the conversation, inside the frame', async () => {
    const host = fakeHost();
    const t = await renderApp({
      width: 92,
      height: 26,
      shell,
      theme: shell === 'plain' ? 'dark' : shell,
      onBoot: (app) => { registerChat(app, { host }); },
    });
    t.app.services.require(CONTROLLER).open(SEEDED);
    t.app.screens.push('chat');
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.hasText('libkqueue')).toBe(true);
    expect(t.lines().every((line) => line.length <= 92)).toBe(true);
    await t.unmount();
  });
});

describe('on a terminal that can only do ASCII', () => {
  const plain = async (): Promise<Harness> => {
    const host = fakeHost();
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'workbench',
      theme: 'workbench',
      capabilities: { unicode: 'ascii', wideChars: false },
      onBoot: (app) => { registerChat(app, { host }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    return t;
  };

  /** Every codepoint the frame used that a Windows console would not draw. */
  const beyondAscii = (t: Harness): string[] =>
    [...new Set([...t.text()].filter((c) => (c.codePointAt(0) as number) > 0x7f))];

  it('draws nothing that terminal cannot draw', async () => {
    const t = await plain();
    t.app.services.require(CONTROLLER).open(SEEDED);
    t.app.screens.push('chat');
    for (let i = 0; i < 8; i++) await t.settle();

    expect(beyondAscii(t)).toEqual([]);
    await t.unmount();
  });

  /**
   * The catalogue too, which the check above never reached.
   *
   * It is the screen with the most glyphs on it - a status per row, a marker,
   * a search, a separator between the harness and the workspace, and a hint
   * row naming four keys - so it is the one where a new glyph is most likely
   * to arrive without a fallback beside it.
   */
  it('draws the catalogue in ASCII as well', async () => {
    const t = await plain();
    await t.app.execute('go.sessions');
    for (let i = 0; i < 6; i++) await t.settle();

    expect(t.hasText('Kqueue events on Linux')).toBe(true);
    expect(beyondAscii(t)).toEqual([]);
    await t.unmount();
  });

  it('names the pane keys with something a console can print', async () => {
    const t = await plain();
    await t.app.execute('go.sessions');
    for (let i = 0; i < 6; i++) await t.settle();
    // `←→ panes` is the hint on a terminal that can draw arrows. This is what
    // it degrades to, and the point is that it degrades at all: a hint row
    // that named a key with a glyph the console renders as a box is a hint
    // row that has told you nothing.
    expect(t.hasText('<> detail')).toBe(true);
    await t.unmount();
  });
});

// The pure parts, checked without a terminal at all.

describe('status is two things in one number', () => {
  it('reads InputNeeded before InProgress', () => {
    expect(decodeStatus(SessionFlag.InputNeeded).activity).toBe('input');
    expect(decodeStatus(40).activity).toBe('running');
    expect(decodeStatus(33)).toMatchObject({ activity: 'idle', read: true });
    expect(decodeStatus(65)).toMatchObject({ activity: 'idle', archived: true });
  });
});

describe('the figure on an empty screen', () => {
  /**
   * Rectangular, every mood.
   *
   * The rows of one drawing have to be the same length or a centred figure
   * leans: the compositor pads to the widest row it was given, and a short
   * row is padded on one side only. This is checked rather than eyeballed
   * because it is invisible until the terminal is a different width.
   */
  it('draws every creature as a block, in every mood', () => {
    for (const name of CREATURES) {
      for (const mood of MOODS) {
        const rows = drawCreature(name, mood);
        expect(rows.length).toBeGreaterThan(2);
        expect(new Set(rows.map((row) => row.length)).size).toBe(1);
      }
    }
  });

  /**
   * Plain ASCII, and it is checked rather than claimed.
   *
   * A glyph whose width the terminal decides is what eats art on a CJK font
   * setting - and art that is one cell wider on somebody else's machine does
   * not look narrow, it looks broken.
   */
  it('uses nothing whose width a terminal gets to decide', () => {
    for (const name of CREATURES) {
      for (const mood of MOODS) {
        for (const row of drawCreature(name, mood)) {
          expect(row).toMatch(/^[\x20-\x7e]*$/);
        }
      }
    }
  });

  /**
   * One creature, over the whole application.
   *
   * It was a widget on a screen twice - the new-session screen, then the
   * catalogue - and both were wrong for the same reason: a figure that belongs
   * to a screen is unmounted by navigating away from it, so pressing escape
   * made it vanish. It lives on the `floating` layer now, which is a plane
   * over every screen rather than a thing on one, and what is asserted is that
   * moving between screens does not lose it.
   */
  it('stays on screen when the screen changes', async () => {
    const host = fakeHost();
    const t = await renderApp({
      width: 100, height: 30, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host, boodFloat: true }); },
    });
    for (let i = 0; i < 8; i += 1) await t.settle();
    t.app.screens.push('sessions');
    for (let i = 0; i < 4; i += 1) await t.settle();
    const m = { t };
    const name = m.t.app.store.get<string>(BOOD) as string;
    const face = drawCreature(name, 'happy', { form: 'inline' })[0] as string;
    expect(creatureMotion(name)).toBeDefined();
    expect(face).toBeTruthy();

    const drawn = (): boolean => {
      const rows = m.t.lines().join('\n');
      return MOODS.some((mood) => rows.includes(creatureMotion(name)?.faces[mood] ?? '\u0000'));
    };
    for (let sample = 0; sample < 10 && !drawn(); sample += 1) { m.t.advance(150); await m.t.settle(); }
    expect(drawn()).toBe(true);

    m.t.app.screens.push('new');
    for (let i = 0; i < 4; i += 1) await m.t.settle();
    for (let sample = 0; sample < 10 && !drawn(); sample += 1) { m.t.advance(150); await m.t.settle(); }
    expect(drawn()).toBe(true);
    await m.t.unmount();
  });

  /**
   * It stands on whatever is at the bottom, and the bottom moves.
   *
   * The composer grows a slash menu upward; the block that asks about a tool
   * appears above the composer and is a sibling of it rather than a part of
   * it. Both say which row they start at, and the creature takes the row above
   * the highest of them - so it is never standing in the question a person is
   * being asked, which is the one thing on the screen that must be readable.
   */
  it('keeps off the block that asks about a tool', async () => {
    const host = fakeHost();
    const t = await renderApp({
      width: 92, height: 26, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host, boodFloat: true }); },
    });
    for (let i = 0; i < 8; i += 1) await t.settle();
    t.app.services.require(CONTROLLER).open(SEEDED);
    t.app.screens.push('chat');
    for (let i = 0; i < 10; i += 1) await t.settle();
    for (let i = 0; i < 10; i += 1) { t.advance(140); await t.settle(); }

    // The question is up, and both of the things at the bottom have said so.
    const tops = t.app.store.get<Record<string, number>>(BOOD_FLOOR) ?? {};
    expect(tops.ask).toBeGreaterThan(0);
    expect(tops.composer).toBeGreaterThan(tops.ask as number);

    // And its title is whole - no creature written through it.
    expect(t.hasText('Run a command in')).toBe(true);
    await t.unmount();
  });

  /** On and off without editing a file, or it is a mascot people keep off. */
  it('takes ctrl+g for the creature', async () => {
    const host = fakeHost();
    const t = await renderApp({
      width: 92, height: 26, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host, boodFloat: true }); },
    });
    for (let i = 0; i < 8; i += 1) await t.settle();
    expect(t.app.store.get<boolean>(BOOD_FLOAT)).toBe(true);

    t.press('ctrl+g');
    for (let i = 0; i < 4; i += 1) await t.settle();
    expect(t.app.store.get<boolean>(BOOD_FLOAT)).toBe(false);

    t.press('ctrl+g');
    for (let i = 0; i < 4; i += 1) await t.settle();
    expect(t.app.store.get<boolean>(BOOD_FLOAT)).toBe(true);
    await t.unmount();
  });

  /**
   * The header's own name, and what it takes to give it up.
   *
   * The leftmost cell is the one part of the row that is the same on every
   * screen, so trading it for a creature is off unless the config file asks -
   * `boodInline` - and even then only on a session, where the seven cells are
   * carrying that session's state rather than standing for nothing.
   */
  it('keeps the header its own name unless the config says otherwise', async () => {
    const m = await conversation();
    expect(m.t.hasText('Assistant')).toBe(true);
    await m.t.unmount();
  });

  it('trades the header name for seven cells when boodInline is on', async () => {
    const host = fakeHost();
    const t = await renderApp({
      ...(SIZES[0] as { width: number; height: number }),
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host, boodInline: true }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();

    // No session yet, so there is nothing for the seven cells to be about.
    expect(t.hasText('Assistant')).toBe(true);

    t.app.services.require(CONTROLLER).open(SEEDED);
    t.app.screens.push('chat');
    for (let i = 0; i < 6; i++) await t.settle();

    expect(t.hasText('Assistant')).toBe(false);
    const name = t.app.store.get<string>(BOOD) as string;
    const inline = MOODS.map((mood) => drawCreature(name, mood, { form: 'inline' })[0] as string);
    expect(inline.some((row) => t.hasText(row))).toBe(true);
    await t.unmount();
  });

  /** A filter that matches nothing is a different sentence, and says so. */
  it('does not answer an empty search with a rabbit', async () => {
    const m = await catalogue();
    m.t.app.store.set(FILTER, 'nothing matches this');
    await m.t.settle();
    expect(m.t.hasText('No sessions on this host')).toBe(false);
    await m.t.unmount();
  });
});

/**
 * Markdown, and the switch that turns it off.
 *
 * An agent writes markdown, so drawing it is the default - reading
 * `**this**` is reading the punctuation instead of the sentence. Off is for
 * when the punctuation is what you are after: copying a fence out with its
 * fence, or reading a link's target rather than its label.
 */
describe('what the agent said, as markdown or as typed', () => {
  it('draws the emphasis rather than the asterisks', async () => {
    const m = await conversation();
    await run(m);
    // The transcript is scrolled to the newest turn, so this asserts on what
    // is actually on screen there: a code span, drawn as one.
    expect(m.t.hasText('#if 0')).toBe(true);
    expect(m.t.hasText('`#if 0`')).toBe(false);
    await m.t.unmount();
  });

  it('shows the characters that arrived once it is switched off', async () => {
    const m = await conversation();
    await run(m);
    await m.t.app.execute('view.markdown');
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.hasText('`#if 0`')).toBe(true);
    // The list marker too: raw is the characters that arrived, not markdown
    // with some of it left on.
    expect(m.t.hasText('- keep the FreeBSD path')).toBe(true);

    // And back, because it is one command and two states.
    await m.t.app.execute('view.markdown');
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.hasText('`#if 0`')).toBe(false);
    await m.t.unmount();
  });

  /**
   * Ctrl+M and Return are the same byte.
   *
   * In raw mode the Return key sends CR, `0x0d`, and this stack names that
   * `enter` - deliberately, and with a comment in the decoder saying so. Only
   * a terminal speaking the kitty protocol or xterm's `modifyOtherKeys` can
   * send the two apart. So the letter is the binding that always works, and
   * `ctrl+m` is the one for terminals that can express it.
   */
  it('has a letter for it, because ctrl+m is not always a key', async () => {
    const m = await conversation();
    await run(m);
    m.t.focus('chat.transcript');
    for (let i = 0; i < 4; i++) await m.t.settle();

    m.t.press('m');
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.hasText('`#if 0`')).toBe(true);
    await m.t.unmount();
  });

  /**
   * `alt+m` is the one to reach for.
   *
   * It arrives as ESC then `m`, which the decoder reads as alt+the key - so
   * it survives SSH, tmux and a console that has never heard of the kitty
   * protocol, which is exactly where `ctrl+m` cannot work at all.
   */
  it('takes alt+m wherever the keyboard is, composer included', async () => {
    const m = await conversation();
    await run(m);
    m.t.focus('chat.composer');
    for (let i = 0; i < 4; i++) await m.t.settle();

    m.t.press('alt+m');
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.hasText('`#if 0`')).toBe(true);
    // And it did not type anything on the way.
    expect(m.t.store.get<string>(DRAFT) ?? '').toBe('');
    await m.t.unmount();
  });

  it('leaves the letter alone while the composer has the keyboard', async () => {
    const m = await conversation();
    await run(m);
    m.t.focus('chat.composer');
    for (let i = 0; i < 4; i++) await m.t.settle();

    m.t.type('maybe');
    for (let i = 0; i < 6; i++) await m.t.settle();
    // Typed, not toggled. That is the bargain every single letter on this
    // screen makes.
    expect(m.t.store.get<string>(DRAFT)).toBe('maybe');
    expect(m.t.hasText('`#if 0`')).toBe(false);
    await m.t.unmount();
  });
});

describe('markdown', () => {
  it('keeps a fence that has not been closed yet', () => {
    // A turn is streamed. The closing fence may simply not have been said, and
    // a block that flickers between prose and code as the words land is worse
    // than one shown open.
    const rows = layoutMarkdown('here:\n```sh\nmake -f Makefile.linux', { width: 40 });
    expect(rows.map((row) => row.kind)).toEqual(['text', 'fence', 'fence', 'fence']);
  });

  it('wraps styled runs on cells, keeping the styles', () => {
    const lines = wrapRuns([{ text: 'one ' }, { text: 'two', bold: true }, { text: ' three' }], 8);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.flat().some((run) => run.bold)).toBe(true);
  });

  it('keeps the emphasis a document viewer used to strip', () => {
    const [row] = layoutMarkdown('the **composer** owns `enter`', { width: 60 });
    const runs = row?.kind === 'text' ? row.runs : [];
    expect(runs.some((run) => run.bold && run.text === 'composer')).toBe(true);
    expect(runs.some((run) => run.code && run.text === 'enter')).toBe(true);
  });
});

describe('blocks', () => {
  it('keeps prose and tool calls in the order the host sent them', () => {
    const turn: Turn = {
      id: 't', role: 'agent', state: 'complete', at: '', parts: [
        { kind: 'markdown', id: 'm1', content: 'let me look' },
        { kind: 'toolCall', id: 'c1', call: { id: 'c1', name: 'Read', toolName: 'Read', status: 'completed' } },
        { kind: 'markdown', id: 'm2', content: 'found it' },
      ],
    };
    expect(toBlocks([turn]).map((block: { kind: string }) => block.kind))
      .toEqual(['header', 'prose', 'tool', 'prose']);
  });
});

/**
 * A skill, before there is a session to run it in.
 *
 * The menu offered the client's own commands and nothing else here, on the
 * reasoning that nothing had been handed a skill yet. The host knows what its
 * harness contributes without having been asked to run anything, and choosing
 * one fills the draft - so the message that creates the session is the one
 * that invokes it, which is where somebody most often wants a skill.
 */
describe('the slash menu with nothing open', () => {
  const typing = async (typed: string) => {
    const m = await open();
    m.t.focus('chat.composer');
    for (let i = 0; i < 4; i++) await m.t.settle();
    m.t.type(typed);
    for (let i = 0; i < 6; i++) await m.t.settle();
    return m;
  };

  it('offers what the harness contributes, not only what the client owns', async () => {
    const m = await typing('/rev');
    expect(m.t.hasText('/review')).toBe(true);
    await m.t.unmount();
  });

  it('leaves out the ones the agent alone may invoke', async () => {
    const m = await typing('/ver');
    // `verify` is marked as the agent's own. Offering it offers something the
    // host would refuse.
    expect(m.t.hasText('/verify')).toBe(false);
    await m.t.unmount();
  });

  it('types the skill rather than running it', async () => {
    const m = await typing('/rev');
    m.t.press('enter');
    for (let i = 0; i < 6; i++) await m.t.settle();
    // There is no "invoke this skill" in the protocol: a person invokes one by
    // sending its name. The trailing space is because most take an argument.
    expect(m.t.app.store.get(DRAFT)).toBe('/review ');
    await m.t.unmount();
  });
});

/**
 * Where a new session works, against a host that is not this machine.
 *
 * `--path` names a directory on the **host**, and the client defaulted it to
 * its own `process.cwd()` - a path that exists here and, against `--host`,
 * very likely not there. Worse, it did so *after* the flag had been read, so
 * the flag was overwritten by a guess and the composer showed a directory the
 * agent was not in.
 */
describe('the workspace a client offers', () => {
  const mounted = async (workspace?: string) => {
    const host = fakeHost();
    const t = await renderApp({
      ...SIZES[0] as { width: number; height: number },
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host, ...(workspace === undefined ? {} : { workspace }) }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    return t;
  };

  it('offers the one it was given', async () => {
    const t = await mounted('/work/api');
    expect(t.app.store.get(WORKSPACE)).toBe('/work/api');
    await t.unmount();
  });

  it('offers none when told there is none, rather than one of its own', async () => {
    // Empty is an answer: the host decides. Falling back to this process's
    // directory here is how `--path` came to be ignored.
    const t = await mounted('');
    expect(t.app.store.get(WORKSPACE)).toBe('');
    expect(t.hasText('no workspace')).toBe(true);
    await t.unmount();
  });

  it('falls back to this directory only when nobody said', async () => {
    const t = await mounted();
    expect(t.app.store.get(WORKSPACE)).toBe(process.cwd());
    await t.unmount();
  });
});

/**
 * A session holds chats, which is the protocol's shape and was not this
 * client's: it read the session's default chat and had no way to reach
 * another, so a host that could hold several was one it could only see one of.
 */
describe('more than one chat in a session', () => {
  /** A session whose agent advertises it. `IDLE` is a `copilotcli` one, which does not. */
  const open2 = async () => {
    const m = await open();
    m.t.app.services.require(CONTROLLER).open(SEEDED);
    m.t.app.screens.push('chat');
    for (let i = 0; i < 8; i++) await m.t.settle();
    return m;
  };

  it('does not offer it where the agent does not say it can', async () => {
    // `IDLE` is a `copilotcli` session, and that agent advertises no
    // `multipleChats` - which the protocol says means `createChat` MUST NOT
    // be called at all, so the command is absent rather than present and
    // refused.
    const m = await idle();
    m.t.press('ctrl+p');
    for (let i = 0; i < 6; i++) await m.t.settle();
    m.t.type('new chat');
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.hasText('New chat here')).toBe(false);
    await m.t.unmount();
  });

  it('offers to open another where the agent says it can', async () => {
    const m = await open2();
    m.t.press('ctrl+p');
    for (let i = 0; i < 6; i++) await m.t.settle();
    m.t.type('new chat');
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.hasText('New chat here')).toBe(true);
    await m.t.unmount();
  });

  it('opens one, reads it, and says which of the two it is', async () => {
    const m = await open2();
    const controller = m.t.app.services.require(CONTROLLER);
    await controller.createChat();
    for (let i = 0; i < 8; i++) await m.t.settle();

    // The header says which conversation is on screen. Without it a
    // transcript that changed under the same title is unexplained.
    expect(m.t.hasText('2 of 2')).toBe(true);
    // And it is a conversation of its own, not the first one again.
    expect(turnsIn(m)).toBe(0);
    await m.t.unmount();
  });

  it('goes back to the first, with its turns still there', async () => {
    const m = await open2();
    const controller = m.t.app.services.require(CONTROLLER);
    const before = turnsIn(m);
    expect(before).toBeGreaterThan(0);

    await controller.createChat();
    for (let i = 0; i < 8; i++) await m.t.settle();
    expect(turnsIn(m)).toBe(0);

    const chats = m.t.app.store.get<{ resource: string }[]>(CHATS) ?? [];
    controller.openChat(chats[0]?.resource ?? '');
    for (let i = 0; i < 8; i++) await m.t.settle();
    // A whole re-subscribe, so what comes back is that chat's own state
    // rather than the other's left behind under a new name. Asserted on the
    // state and not the header: a transcript this long has scrolled the head
    // off the top, which is the layout doing its job.
    expect(turnsIn(m)).toBe(before);
    expect(m.t.app.store.get(CHAT_URI)).toBe(chats[0]?.resource);
    await m.t.unmount();
  });

  it('closes one and reads what is left', async () => {
    const m = await open2();
    const controller = m.t.app.services.require(CONTROLLER);
    await controller.createChat();
    for (let i = 0; i < 8; i++) await m.t.settle();

    const opened = m.t.app.store.get<string>(CHAT_URI) ?? '';
    await controller.disposeChat(opened);
    for (let i = 0; i < 8; i++) await m.t.settle();

    expect((m.t.app.store.get<{ resource: string }[]>(CHATS) ?? []).length).toBe(1);
    expect(m.t.app.store.get<string>(CHAT_URI)).not.toBe(opened);
    await m.t.unmount();
  });

  it('will not close the only one', async () => {
    const m = await open2();
    const controller = m.t.app.services.require(CONTROLLER);
    const only = m.t.app.store.get<string>(CHAT_URI) ?? '';
    await controller.disposeChat(only);
    for (let i = 0; i < 6; i++) await m.t.settle();
    // The last chat in a session is the session. Said, rather than a close
    // that silently does not take.
    expect(m.t.hasText('only chat')).toBe(true);
    await m.t.unmount();
  });
});

/**
 * A path, completed by the host.
 *
 * `@` is a trigger character the host advertises and the composer could not
 * reach: it filtered its own list of commands and had nowhere to put an
 * answer that has to be *asked for*, since a path is a path on the host's
 * filesystem and only it knows which ones match.
 */
describe('completing an at-sign', () => {
  const typing = async (typed: string) => {
    const m = await open();
    m.t.focus('chat.composer');
    for (let i = 0; i < 4; i++) await m.t.settle();
    m.t.type(typed);
    for (let i = 0; i < 10; i++) await m.t.settle();
    return m;
  };

  it('offers what the host says is there', async () => {
    const m = await typing('look at @sr');
    expect(m.t.hasText('@src/')).toBe(true);
    await m.t.unmount();
  });

  it('replaces the fragment rather than appending to it', async () => {
    const m = await typing('look at @sr');
    m.t.press('enter');
    for (let i = 0; i < 6; i++) await m.t.settle();
    // Appending would leave `look at @sr@src/`, which is what a completion
    // that only knew its text and not its range produces.
    expect(m.t.app.store.get(DRAFT)).toBe('look at @src/');
    await m.t.unmount();
  });

  it('goes into a directory rather than starting again', async () => {
    const m = await typing('@src/ah');
    expect(m.t.hasText('src/ahp/')).toBe(true);
    m.t.press('enter');
    for (let i = 0; i < 6; i++) await m.t.settle();
    expect(m.t.app.store.get(DRAFT)).toBe('@src/ahp/');
    await m.t.unmount();
  });

  it('asks nothing for a draft with no at-sign in its last word', async () => {
    const m = await typing('mail me@example.com and ');
    // An at-sign mid-word is an address, and a draft that has moved past it
    // is not completing anything.
    expect(m.t.hasText('@src/')).toBe(false);
    await m.t.unmount();
  });
});

/**
 * A shell on the host, drawn here.
 *
 * The split is doop's: `terminal.ts` owns which terminals exist, which is
 * open and what happens when a line is sent; the view only draws it. So these
 * drive the controller and read the screen, which is the seam that matters.
 */
describe('a terminal', () => {
  /**
   * Settle until it says something, rather than a fixed number of times.
   *
   * `Feed` measures its entries *after* they are laid out and scrolls by
   * summing those heights, so what it draws is one frame behind what it was
   * given. On a running terminal that is invisible; in a test a fixed count
   * races it, and the race is what makes a passing test fail every other run.
   */
  const until = async (m: Mounted, text: string): Promise<boolean> => {
    for (let i = 0; i < 40; i++) {
      await m.t.settle();
      if (m.t.hasText(text)) return true;
    }
    return false;
  };

  const opened = async () => {
    const m = await open();
    const controller = m.t.app.services.require(CONTROLLER);
    await controller.terminals.open();
    m.t.app.screens.push('terminal');
    for (let i = 0; i < 12; i++) await m.t.settle();
    return m;
  };

  it('says what the shell said, and keeps what it said before', async () => {
    const m = await opened();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.terminals.write('pwd\n');
    expect(await until(m, '/brb_main/src/brb_framework')).toBe(true);

    controller.terminals.write('whoami\n');
    expect(await until(m, 'softov')).toBe(true);
    // The accumulated stream, not the last thing said: a terminal that
    // replaced its contents on every command would be a status line.
    expect(m.t.hasText('$ pwd')).toBe(true);
    await m.t.unmount();
  });

  it('says it is plain text, rather than leaving it to be discovered', async () => {
    const m = await opened();
    // Pipes, not a pseudoterminal. Anything that draws itself with cursor
    // movement will look wrong, and finding that out by rendering it is
    // finding out too late.
    expect(m.t.hasText('plain text')).toBe(true);
    await m.t.unmount();
  });

  it('survives leaving the screen and coming back', async () => {
    const m = await opened();
    const controller = m.t.app.services.require(CONTROLLER);
    controller.terminals.write('ls\n');
    expect(await until(m, 'Makefile.linux')).toBe(true);

    m.t.app.screens.push('sessions');
    for (let i = 0; i < 8; i++) await m.t.settle();
    m.t.app.screens.push('terminal');

    // The subscription is the controller's, not the screen's. A view that
    // held it would lose the shell every time it was unmounted.
    expect(await until(m, 'Makefile.linux')).toBe(true);
    await m.t.unmount();
  });

  it('closes one and says there are none', async () => {
    const m = await opened();
    const controller = m.t.app.services.require(CONTROLLER);
    await controller.terminals.close();
    for (let i = 0; i < 12; i++) await m.t.settle();
    expect(m.t.app.store.get(OPEN_TERMINAL)).toBeFalsy();
    expect(m.t.hasText('No terminals')).toBe(true);
    await m.t.unmount();
  });

  it('says a host that runs none runs none', async () => {
    const m = await open();
    m.t.app.screens.push('terminal');
    for (let i = 0; i < 12; i++) await m.t.settle();
    expect(m.t.hasText('No terminals')).toBe(true);
    await m.t.unmount();
  });
});

/**
 * Two things a terminal has to get right that a transcript does not.
 *
 * Both were found by using it rather than by reading it: the output flickered
 * once per frame, and `ctrl+c` closed the application instead of stopping the
 * command.
 */
describe('the terminal, in use', () => {
  const opened = async () => {
    const m = await open();
    const controller = m.t.app.services.require(CONTROLLER);
    await controller.terminals.open();
    m.t.app.screens.push('terminal');
    for (let i = 0; i < 12; i++) await m.t.settle();
    return m;
  };

  it('draws the same thing on every frame', async () => {
    const m = await opened();
    m.t.app.services.require(CONTROLLER).terminals.write('whoami\n');
    for (let i = 0; i < 12; i++) await m.t.settle();

    // A `Row` holding a `Column` holding the `Feed` alternated between drawing
    // its entries and not, once per frame. Sampled rather than checked once,
    // because a single frame passes half the time either way.
    const frames: boolean[] = [];
    for (let i = 0; i < 20; i++) { await m.t.settle(); frames.push(m.t.hasText('softov')); }
    expect(frames.every(Boolean)).toBe(true);
    await m.t.unmount();
  });

  it('says nothing yet without flickering that either', async () => {
    const m = await opened();
    const frames: boolean[] = [];
    for (let i = 0; i < 20; i++) { await m.t.settle(); frames.push(m.t.hasText('Nothing said yet')); }
    // A feed of nothing is nothing, and a note about that is not a log line -
    // so it is drawn outside the feed, which is also what stops it flickering.
    expect(frames.every(Boolean)).toBe(true);
    await m.t.unmount();
  });

  it('gives ctrl+c to the shell rather than to the application', async () => {
    const m = await opened();
    m.t.focus('terminal.input');
    for (let i = 0; i < 6; i++) await m.t.settle();
    m.t.press('ctrl+c');
    for (let i = 0; i < 8; i++) await m.t.settle();

    // Still here. Interrupting a command is the shell's job, and this closed
    // the whole application instead.
    expect(m.t.app.screens.current()?.id).toBe('terminal');
    // And the hint says so, rather than promising to quit.
    expect(m.t.hasText('interrupt')).toBe(true);
    await m.t.unmount();
  });
});
