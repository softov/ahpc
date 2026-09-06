import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { INPUT, SCREEN, SELECTED } from '../src/state.js';
import { fakeHost } from '../src/ahp/fake.js';
import type { FakeHost } from '../src/ahp/fake.js';
import type { SessionUri } from '../src/ahp/types.js';

/*
 * What the palette offers, and where.
 *
 * A command with no `when` is offered on every screen, and the ones that act
 * on a session, a selection or a pending question do nothing on the screens
 * that have none - which from the palette is indistinguishable from the
 * client being broken. `session.openDetails` was the one that showed it: the
 * detail pane belongs to the catalogue, and the command was offered on the
 * composer the client opens on.
 *
 * The risk in fixing that is the opposite fault. A `when` gates execution as
 * well as listing, so a clause that is too strict removes a command that
 * would have worked and does it silently. Every guard below is therefore
 * checked in both directions: absent where it cannot work, and present where
 * it can.
 */

const SEEDED = 'ahp-session:/1f0a' as SessionUri;

interface Mounted { t: Harness; host: FakeHost }

const open = async (): Promise<Mounted> => {
  const host = fakeHost();
  const t = await renderApp({
    width: 100, height: 30, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i += 1) await t.settle();
  return { t, host };
};

const offered = (t: Harness): string[] =>
  t.app.commands.list({ slot: 'palette', enabledOnly: true }).map((one) => one.id);

const settle = async (m: Mounted, steps = 100_000): Promise<void> => {
  for (let i = 0; i < steps; i += 1) if (!m.host.pump()) break;
  for (let i = 0; i < 6; i += 1) await m.t.settle();
};

describe('the composer screen, which is where the client opens', () => {
  it('offers what a composer has, and nothing that needs a session', async () => {
    const m = await open();
    expect(m.t.app.store.get<string>(SCREEN)).toBe('new');
    const ids = offered(m.t);

    // There is a composer here, so these work.
    expect(ids).toContain('editor.open');
    expect(ids).toContain('compose.model');
    expect(ids).toContain('chat.focusComposer');

    // There is no session, no transcript, no catalogue and nothing waiting.
    expect(ids).not.toContain('chat.send');
    expect(ids).not.toContain('chat.focusTranscript');
    expect(ids).not.toContain('session.filter');
    expect(ids).not.toContain('chat.approve');
    expect(ids).not.toContain('chat.deny');
    expect(ids).not.toContain('session.openDetails');
    await m.t.unmount();
  });
});

describe('the catalogue', () => {
  it('offers the filter, the detail pane and what acts on a row', async () => {
    const m = await open();
    await m.t.app.commands.get('go.sessions')?.run({}, { app: m.t.app } as never);
    for (let i = 0; i < 6; i += 1) await m.t.settle();
    expect(m.t.app.store.get<string>(SCREEN)).toBe('sessions');
    // A row is under the cursor as soon as the list has one.
    expect(m.t.app.store.get<string>(SELECTED)).toBeTruthy();

    const ids = offered(m.t);
    expect(ids).toContain('session.filter');
    expect(ids).toContain('session.openDetails');
    expect(ids).toContain('session.closeDetails');
    expect(ids).toContain('session.open');
    expect(ids).toContain('session.archive');
    expect(ids).toContain('session.read');
    expect(ids).toContain('session.dispose');

    // Still no transcript here.
    expect(ids).not.toContain('chat.focusTranscript');
    await m.t.unmount();
  });
});

describe('a session that is open', () => {
  it('offers the transcript, sending, and what acts on the session', async () => {
    const m = await open();
    m.t.app.services.require(CONTROLLER).open(SEEDED);
    m.t.app.screens.push('chat');
    for (let i = 0; i < 6; i += 1) await m.t.settle();

    const ids = offered(m.t);
    expect(ids).toContain('chat.focusTranscript');
    expect(ids).toContain('chat.send');
    expect(ids).toContain('chat.focusComposer');
    expect(ids).toContain('editor.open');
    expect(ids).toContain('session.archive');
    expect(ids).toContain('session.dispose');

    // The detail pane is the catalogue's, and this is not it.
    expect(ids).not.toContain('session.openDetails');
    await m.t.unmount();
  });

  it('offers approve and deny only while something is waiting', async () => {
    const m = await open();
    m.t.app.services.require(CONTROLLER).open(SEEDED);
    m.t.app.screens.push('chat');
    for (let i = 0; i < 6; i += 1) await m.t.settle();

    m.t.app.services.require(CONTROLLER).send('run the tests');
    await settle(m);
    // The seeded session blocks on a confirmation, which is the state these
    // two exist for.
    expect(m.t.app.store.get(INPUT)).toBeTruthy();
    expect(offered(m.t)).toContain('chat.approve');
    expect(offered(m.t)).toContain('chat.deny');

    m.t.app.services.require(CONTROLLER).approve();
    await settle(m, 1);
    expect(m.t.app.store.get(INPUT)).toBeNull();
    // Answered, so there is nothing left to answer.
    expect(offered(m.t)).not.toContain('chat.approve');
    expect(offered(m.t)).not.toContain('chat.deny');
    await m.t.unmount();
  });
});

/*
 * A switch says which way it is set.
 *
 * `Show archived sessions` was a title in one direction for a thing with two,
 * and pressing it made the row that offered it disappear - so on a host with
 * nothing archived it changed the list not at all and took away the only
 * sign that anything had happened.
 */
describe('the archived switch reports its own state', () => {
  it('is checked in the palette when archived sessions are showing', async () => {
    const m = await open();
    expect(m.t.app.commands.isChecked('session.toggleArchived')).toBe(false);
    await m.t.app.execute('session.toggleArchived');
    await settle(m);
    expect(m.t.app.commands.isChecked('session.toggleArchived')).toBe(true);
    await m.t.unmount();
  });

  it('counts what it is hiding, and says the other direction once it is on', async () => {
    const m = await open();
    await m.t.app.execute('go.sessions');
    await settle(m);
    // The fake host holds one archived session, so the row has something to
    // offer and says how much.
    expect(m.t.hasText('show archived (1)')).toBe(true);

    m.t.press('x');
    await settle(m);
    expect(m.t.hasText('hide archived')).toBe(true);
    expect(m.t.hasText('show archived')).toBe(false);
    await m.t.unmount();
  });
});
