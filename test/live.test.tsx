import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { fakeHost } from '../src/ahp/fake.js';
import { CONTROLLER } from '../src/control.js';
import { sessions } from '../src/state.js';
import { activityOf } from '../src/ahp/live.js';
import { CHAT, SESSION, connect, settle } from './scenario.js';

/*
 * A catalogue is only as fresh as what it was last told.
 *
 * The client subscribed to one session's channel and to nothing else, so a
 * session appearing, finishing or starting to wait was invisible until
 * somebody navigated away and back - a reader doing by hand what the host had
 * already said. A real host says it on its root channel, which was being
 * drained for something else and thrown away.
 */

async function open(height = 26, width = 90) {
  const host = fakeHost();
  const t = await renderApp({
    width, height, shell: 'workbench', theme: 'dark',
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

/*
 * A turn that failed says so in the transcript, not only in its header.
 *
 * 0.9.0 gave the protocol an error response part, and it is a *part* because
 * what came before it still stands - the agent said three things and then hit
 * this. Dropped, the reader gets a turn that simply stops, and a `failed`
 * marker in the header they have to scroll back up to find.
 */
describe('a turn the host could not finish', () => {
  for (const width of [90, 60]) {
    it(`says what went wrong, at ${width} columns`, async () => {
      const { t } = await open(40, width);
      t.app.services.require(CONTROLLER).open('ahp-session:/2d55');
      t.app.screens.push('chat');
      for (let i = 0; i < 12; i++) await t.settle();
      t.focus('chat.transcript');
      t.press('end');
      for (let i = 0; i < 8; i++) await t.settle();

      // The host's own words, and the one thing a reader can act on: whether
      // there is anything left to carry on from.
      //
      // Read across rows rather than on one. The row keeps the column the
      // transcript's cursor is drawn in, so at 60 columns the sentence wraps
      // - and what the test is for is that every word reaches the reader,
      // not which cell the break falls on. The marker on the right of the
      // first row is taken off before the rows are joined, so it does not
      // land in the middle of the sentence.
      const read = t.text().split('\n')
        .map((row) => row.replace(/[│┃]/g, ' ').replace(/\s+resumable\s*$/, '').trim())
        .join(' ')
        .replace(/\s+/g, ' ');
      expect(read).toContain('Sign in on the host, then run this turn again.');
      expect(t.hasText('resumable')).toBe(true);
      await t.unmount();
    });
  }
});

/**
 * What a live session says it is doing.
 *
 * The bits are worked out here rather than read off the session state,
 * because the protocol has no action that moves them: a host says
 * `session/activityChanged` and the reducer files that word under `activity`
 * and leaves `status` alone. The one pair that does move it - input needed,
 * set and removed - only ever goes one way, so a session that was asked a
 * question and answered it kept `InProgress` for the rest of its life.
 */
describe('the state a live session reports', () => {
  const READ = 32;
  const ARCHIVED = 64;

  it('is what the conversation is actually doing', () => {
    expect(activityOf(1, false, false, false)).toBe(1);
    expect(activityOf(1, false, true, false)).toBe(8);
    expect(activityOf(1, true, true, false)).toBe(24);
    expect(activityOf(1, false, false, true)).toBe(2);
    // Something wanted beats something happening, the way the host's own
    // order does: a turn waiting on a person is still a running turn, and the
    // one state that needs somebody is the one that must not be swallowed.
    expect(activityOf(1, true, false, false)).toBe(24);
  });

  /** The one that was wrong: answered, finished, and still saying it works. */
  it('stops saying a session is working once the turn has ended', () => {
    // What the reducer leaves behind after a question is answered - the
    // in-progress bit, with nothing that ever clears it.
    expect(activityOf(8, false, false, false)).toBe(1);
    expect(activityOf(24, false, false, false)).toBe(1);
  });

  /** Read and archived are not about activity, and survive it. */
  it('carries the session flags through untouched', () => {
    expect(activityOf(1 | READ | ARCHIVED, false, true, false)).toBe(8 | READ | ARCHIVED);
    expect(activityOf(2 | READ, false, false, false)).toBe(1 | READ);
  });
});

describe('the config a live session reports', () => {
  it('keeps one-value answers and leaves the objects to the host', async () => {
    const { host, scripted } = await connect();
    // Claude's schema, as ahpd sends it: `permissions` is an object and
    // `shellInitScripts` a list. Stringified, they went back to the host on
    // the next `resolveSessionConfig` and on `createSession` as
    // `[object Object]` - an answer to a question nobody was asked.
    scripted.states.set(SESSION, {
      defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1,
      config: {
        schema: { type: 'object', properties: {
          permissionMode: { type: 'string', enum: ['default', 'plan'], sessionMutable: true },
          permissions: { type: 'object', sessionMutable: true },
          shellInitScripts: { type: 'array', readOnly: true },
        } },
        values: { permissionMode: 'default', permissions: { allow: [], deny: [] }, shellInitScripts: [] },
      },
    });
    scripted.states.set(CHAT, { turns: [] });
    const config = await host.config(SESSION as never);
    expect(config.values).toEqual({ permissionMode: 'default' });
    expect(config.properties.map((property) => property.key)).toEqual(['permissionMode', 'permissions', 'shellInitScripts']);
    await host.close();
  });
});

/*
 * What a dynamic picker is allowed to offer.
 *
 * A row with no `value` is not a row and is dropped. A row whose value is the
 * empty string is a real answer and is kept: `computer` means this host when
 * it is empty, and dropping it both hid that option and left somebody who had
 * picked a machine with no way back out of the choice.
 */
describe('the values a host answers a picker with', () => {
  it('keeps an empty value and drops a missing one', async () => {
    const { host, scripted } = await connect();
    scripted.completionsWith = [
      { value: '', label: 'This host', description: 'Run the session here.' },
      { value: 'computer://box', label: 'box', description: 'debian - Up' },
      // No `value` at all, which is not something to choose.
      { label: 'broken' },
    ];

    const found = await host.configCompletions?.({ property: 'computer', provider: 'claude' });
    expect(found).toEqual([
      { value: '', label: 'This host', description: 'Run the session here.' },
      { value: 'computer://box', label: 'box', description: 'debian - Up' },
    ]);
    await host.close();
  });
});

/*
 * What the last turn was asked for, which reopening a session has to give back.
 *
 * The id alone says which model answered and nothing about the settings it was
 * given, so a session reopened on the id alone sends the next message on the
 * model's defaults rather than on the answers the last turn actually ran with.
 */
describe('the detail a live session reports', () => {
  it('keeps the last turn\'s answers beside the model it ran on', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
    scripted.states.set(CHAT, {
      turns: [{
        id: 't1',
        state: 'complete',
        message: { model: { id: 'claude-opus-5', config: { thinking: 'high' } } },
      }],
    });
    const detail = await host.detail(SESSION as never);
    expect(detail.modelConfig).toEqual({ thinking: 'high' });
    await host.close();
  });

  it('leaves the answers off a turn that recorded none', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
    scripted.states.set(CHAT, {
      turns: [{ id: 't1', state: 'complete', message: { model: { id: 'claude-opus-5' } } }],
    });
    const detail = await host.detail(SESSION as never);
    expect(detail.model?.id).toBe('claude-opus-5');
    expect(detail.modelConfig).toBeUndefined();
    await host.close();
  });
});

/**
 * One finished turn, seeded on the chat a reader subscribes to.
 *
 * The state goes in directly rather than through the host's actions, because
 * what these check is the decoder and not the reducer: the reader is handed
 * the same `responseParts` the host would have reduced.
 */
async function reading(responseParts: Record<string, unknown>[]) {
  const { host, scripted, read } = await connect();
  scripted.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
  scripted.states.set(CHAT, {
    turns: [{ id: 't1', startedAt: new Date().toISOString(), state: 'complete', responseParts }],
  });
  const reader = read();
  await settle();
  return { host, reader };
}

/*
 * A round the host ends with neither text nor a tool call.
 *
 * `responseRoundEnded` arrives as a `systemNotification` with the kind on the
 * open `_meta` map, and the reference host uses it to settle the reasoning
 * section that was streaming above it. Drawn as a notice it leaves an empty
 * row under every answer the agent only thought about.
 */
describe('a round the host ended', () => {
  it('keeps the reasoning part and drops the round-ended notification', async () => {
    const { host, reader } = await reading([
      { kind: 'reasoning', id: 'r1', content: 'weighing it' },
      { kind: 'systemNotification', id: 'n1', content: '', _meta: { kind: 'responseRoundEnded' } },
    ]);
    const parts = reader.view()?.turns[0]?.parts ?? [];
    expect(parts.map((part) => part.kind)).toEqual(['reasoning', 'roundEnded']);
    expect(parts.some((part) => part.kind === 'systemNotification')).toBe(false);
    expect(parts[0]).toMatchObject({ kind: 'reasoning', content: 'weighing it' });
    reader.close();
    await host.close();
  });

  it('still draws a notification of another kind, with its content', async () => {
    const { host, reader } = await reading([
      { kind: 'systemNotification', id: 'n1', content: 'the server restarted' },
    ]);
    const parts = reader.view()?.turns[0]?.parts ?? [];
    expect(parts.map((part) => part.kind)).toEqual(['systemNotification']);
    expect(parts[0]).toMatchObject({ kind: 'systemNotification', content: 'the server restarted' });
    reader.close();
    await host.close();
  });
});

/*
 * What a turn's file edits added and removed.
 *
 * A `fileEdit` tool result carries the counts, and the turn header totals them
 * over the turn's own calls. A host that sends no diff says nothing rather
 * than saying zero, which is why the count is absent and not `+0 -0`.
 */
describe('the edits a turn made', () => {
  it('counts a fileEdit result onto the call', async () => {
    const { host, reader } = await reading([
      { kind: 'toolCall', id: 'c1', toolCall: {
        toolCallId: 'c1', toolName: 'Edit', displayName: 'Edit', status: 'completed',
        content: [{ type: 'fileEdit', diff: { added: 4, removed: 1 } }],
      } },
    ]);
    const call = reader.view()?.turns[0]?.parts[0];
    expect(call?.kind === 'toolCall' ? call.call.edits : undefined).toEqual({ added: 4, removed: 1 });
    reader.close();
    await host.close();
  });

  it('leaves the count off a result that is only text', async () => {
    const { host, reader } = await reading([
      { kind: 'toolCall', id: 'c1', toolCall: {
        toolCallId: 'c1', toolName: 'Read', displayName: 'Read', status: 'completed',
        content: [{ type: 'text', text: 'the file says this' }],
      } },
    ]);
    const call = reader.view()?.turns[0]?.parts[0];
    expect(call?.kind === 'toolCall' ? call.call.edits : undefined).toBeUndefined();
    reader.close();
    await host.close();
  });
});

/*
 * A tool call the MCP server paused for a token.
 *
 * The protocol has a status and a challenge for it, and this client had
 * neither: the string was cast into a union that did not contain it and the
 * challenge was dropped, so the row read as an ordinary call that never
 * finished.
 */
describe('a call waiting on a sign-in', () => {
  it('keeps the status and the challenge the host sent', async () => {
    const { host, reader } = await reading([
      { kind: 'toolCall', id: 'c1', toolCall: {
        toolCallId: 'c1', toolName: 'read_file', displayName: 'read_file', status: 'auth-required',
        auth: {
          reason: 'insufficientScope',
          description: 'the token expired',
          resource: { resource: 'https://api.github.com', resource_name: 'GitHub API' },
        },
      } },
    ]);
    const call = reader.view()?.turns[0]?.parts[0];
    expect(call?.kind === 'toolCall' ? call.call.status : undefined).toBe('auth-required');
    expect(call?.kind === 'toolCall' ? call.call.auth : undefined).toEqual({
      resource: 'https://api.github.com',
      name: 'GitHub API',
      reason: 'insufficientScope',
      description: 'the token expired',
    });
    reader.close();
    await host.close();
  });
});
