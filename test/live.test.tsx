import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { fakeHost } from '../src/ahp/fake.js';
import { CONTROLLER } from '../src/control.js';
import { sessions } from '../src/state.js';

/*
 * A catalogue is only as fresh as what it was last told.
 *
 * The client subscribed to one session's channel and to nothing else, so a
 * session appearing, finishing or starting to wait was invisible until
 * somebody navigated away and back - a reader doing by hand what the host had
 * already said. A real host says it on its root channel, which was being
 * drained for something else and thrown away.
 */

async function open(height = 26) {
  const host = fakeHost();
  const t = await renderApp({
    width: 90, height, shell: 'workbench', theme: 'dark',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  return { t, host };
}

/** The read is coalesced, so let the timer fire and the frame follow it. */
async function quiet(t: Awaited<ReturnType<typeof open>>['t']): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, 250); });
  for (let i = 0; i < 8; i++) await t.settle();
}

describe('the catalogue keeps up', () => {
  it('shows a session that appeared while the list was on screen', async () => {
    const { t, host } = await open();
    await t.app.execute('go.sessions');
    for (let i = 0; i < 6; i++) await t.settle();

    const before = sessions(t.app.store).length;
    // Another client, or the host itself. Nothing here navigated.
    await host.createSession({ provider: 'claude' });
    await quiet(t);

    expect(sessions(t.app.store).length).toBe(before + 1);
    expect(t.hasText('New session')).toBe(true);
    await t.unmount();
  });

  it('picks up a change to a session it is not watching', async () => {
    const { t, host } = await open();
    await t.app.execute('go.sessions');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('Split the transcript viewport')).toBe(true);

    host.rename('ahp-session:/6b21', 'Renamed by the host');
    await quiet(t);

    expect(t.hasText('Renamed by the host')).toBe(true);
    await t.unmount();
  });

  it('updates the header without the session being reopened', async () => {
    const { t, host } = await open();
    t.app.services.require(CONTROLLER).open('ahp-session:/9c74');
    t.app.screens.push('chat');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('Why does the composer eat q')).toBe(true);

    // The header read the summary without subscribing to it, so this only
    // showed up after navigating away and back remounted the row.
    host.rename('ahp-session:/9c74', 'Retitled while open');
    await quiet(t);

    expect(t.hasText('Retitled while open')).toBe(true);
    await t.unmount();
  });
});

describe('the conversation, above and around', () => {
  /*
   * The caption is the first thing *in* the conversation, not a band above it.
   *
   * Pinned outside the scrolling region it costs a row of the conversation on
   * every screen for ever, so it has to earn each one - which forces it down
   * to a line, and then down to less than it was for. Scrolled with the
   * conversation it costs nothing after the first screen and can say the
   * whole thing.
   */
  it('opens the conversation with what the session is', async () => {
    const { t } = await open(40);
    t.app.services.require(CONTROLLER).open('ahp-session:/1f0a');
    t.app.screens.push('chat');
    // Settle first: the transcript is not mounted until the screen is, and
    // focusing a node that does not exist yet focuses nothing.
    for (let i = 0; i < 12; i++) await t.settle();
    t.focus('chat.transcript');
    t.press('home');
    for (let i = 0; i < 8; i++) await t.settle();

    // The title in full - it is not competing with the application's name for
    // one line any more - and every identifier whole.
    expect(t.hasText('Kqueue events on Linux')).toBe(true);
    expect(t.hasText('claude-opus-5')).toBe(true);
    expect(t.hasText('/brb_main/src/brb_framework')).toBe(true);
    expect(t.hasText('ahp-session:/1f0a')).toBe(true);
    expect(t.hasText('ahp-chat:/1f0a')).toBe(true);
    // And the host's own questions, answered - the same answers the chips
    // under the composer are showing.
    expect(t.hasText('Permissions')).toBe(true);
    await t.unmount();
  });

  it('scrolls away, because it is part of the conversation', async () => {
    const { t } = await open(40);
    t.app.services.require(CONTROLLER).open('ahp-session:/1f0a');
    t.app.screens.push('chat');
    // Settle first: the transcript is not mounted until the screen is, and
    // focusing a node that does not exist yet focuses nothing.
    for (let i = 0; i < 12; i++) await t.settle();
    t.focus('chat.transcript');
    t.press('home');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('ahp-session:/1f0a')).toBe(true);

    t.press('end');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.hasText('ahp-session:/1f0a')).toBe(false);
    await t.unmount();
  });

  it('keeps the cursor on the conversation, not on the caption', async () => {
    const { t } = await open(40);
    t.app.services.require(CONTROLLER).open('ahp-session:/1f0a');
    t.app.screens.push('chat');
    // Settle first: the transcript is not mounted until the screen is, and
    // focusing a node that does not exist yet focuses nothing.
    for (let i = 0; i < 12; i++) await t.settle();
    t.focus('chat.transcript');
    t.press('home');
    for (let i = 0; i < 8; i++) await t.settle();

    // Home is the first *block*, not the caption above it. There is nothing
    // to do to a caption, so it sits ahead of the indices rather than in them.
    expect(t.app.store.get('$/screen.chat/cursor')).toBe(0);
    // And enter still opens the block the cursor names.
    for (let i = 0; i < 4; i++) { t.press('down'); await t.settle(); }
    expect(t.app.store.get('$/screen.chat/cursor')).toBe(4);

    // And enter opens the block the cursor names - `c1`, the tool call, not
    // whatever sits one along because a caption took an index.
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.app.store.get('$/chat/ui/expanded')).toEqual({ c1: true });
    await t.unmount();
  });

  it('asks the transcript for the page keys', async () => {
    const { t } = await open();
    t.app.services.require(CONTROLLER).open('ahp-session:/9c74');
    t.app.screens.push('chat');
    for (let i = 0; i < 8; i++) await t.settle();

    // The behaviour itself is `Feed`'s and is tested there against a
    // transcript long enough to scroll; this is the wiring - that the chat's
    // transcript is the one asking for it.
    const feed = t.getByComponent('Feed');
    expect(feed.props.pageKeys).toBe('always');
    await t.unmount();
  });
});
