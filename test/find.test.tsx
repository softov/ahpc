import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { fakeHost } from '../src/ahp/fake.js';
import { FINDING, FIND_AT, SCREEN } from '../src/state.js';

/*
 * Find, in the conversation that is open.
 *
 * `ctrl+f` is the key a person reaches for to search, and what it searches is
 * whatever is in front of them: the catalogue on the catalogue screen, the
 * conversation on the conversation screen. The matches are block indices and
 * the transcript cursor is a block index, so going to one is moving the
 * cursor - the feed then scrolls to it and draws it selected, the same as
 * when the arrow keys walk the conversation.
 */

const inSession = async (width = 100, height = 30): Promise<Harness> => {
  const t = await renderApp({
    width, height, shell: 'workbench', theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host: fakeHost() }); },
  });
  for (let i = 0; i < 8; i += 1) await t.settle();
  await t.app.execute('go.sessions');
  for (let i = 0; i < 6; i += 1) await t.settle();
  await t.press('enter');
  for (let i = 0; i < 10; i += 1) await t.settle();
  return t;
};

const settle = async (t: Harness, times = 8): Promise<void> => {
  for (let i = 0; i < times; i += 1) await t.settle();
};

describe('ctrl+f searches whatever screen you are on', () => {
  it('opens the find box in a conversation, with the keyboard in it', async () => {
    const t = await inSession();
    expect(t.app.store.get<string>(SCREEN)).toBe('chat');
    await t.press('ctrl+f');
    await settle(t);
    expect(t.app.store.get<boolean>(FINDING)).toBe(true);
    // The command that opens the box cannot focus it - the field is a child
    // and does not exist yet when the command runs.
    expect(t.app.focus.focused()).toBe('chat.find');
    await t.unmount();
  });

  it('is the catalogue filter on the catalogue, and not this', async () => {
    const t = await inSession();
    // Two: the first leaves the field, the second leaves the screen.
    await t.press('escape');
    await t.press('escape');
    await settle(t);
    expect(t.app.store.get<string>(SCREEN)).toBe('sessions');
    await t.press('ctrl+f');
    await settle(t);
    expect(t.app.store.get<boolean>(FINDING) ?? false).toBe(false);
    expect(t.app.focus.focused()).toBe('chat.filter');
    await t.unmount();
  });
});

describe('the find box walks the matches', () => {
  const search = async (term: string): Promise<Harness> => {
    const t = await inSession();
    await t.press('ctrl+f');
    await settle(t);
    t.type(term);
    await settle(t);
    return t;
  };

  it('counts them, and starts on the first', async () => {
    const t = await search('linux');
    expect(t.hasText('1 of')).toBe(true);
    expect(t.app.store.get<number>(FIND_AT)).toBe(0);
    await t.unmount();
  });

  it('says so when there is nothing to find', async () => {
    const t = await search('zzzzzz');
    expect(t.hasText('no match')).toBe(true);
    await t.unmount();
  });

  it('goes to the next on enter and on down, and back on up', async () => {
    const t = await search('linux');
    await t.press('enter');
    await settle(t);
    expect(t.app.store.get<number>(FIND_AT)).toBe(1);
    await t.press('down');
    await settle(t);
    expect(t.app.store.get<number>(FIND_AT)).toBe(2);
    await t.press('up');
    await settle(t);
    expect(t.app.store.get<number>(FIND_AT)).toBe(1);
    await t.unmount();
  });

  it('wraps at the end rather than going quiet', async () => {
    // Pressing on at the last match means "keep going". A find that stops
    // answering at the end of the conversation reads as broken.
    const t = await search('linux');
    await t.press('up');
    await settle(t);
    const last = t.app.store.get<number>(FIND_AT) ?? -1;
    expect(last).toBeGreaterThan(0);
    await t.press('down');
    await settle(t);
    expect(t.app.store.get<number>(FIND_AT)).toBe(0);
    await t.unmount();
  });

  it('escape closes it and leaves the screen where it was', async () => {
    const t = await search('linux');
    await t.press('escape');
    await settle(t);
    expect(t.app.store.get<boolean>(FINDING)).toBe(false);
    // The screen, not the one behind it: escape closed the box in front of
    // the reader rather than walking back out of the conversation.
    expect(t.app.store.get<string>(SCREEN)).toBe('chat');
    await t.unmount();
  });

  it('colours the term where it appears in the conversation', async () => {
    const t = await search('linux');
    const lines = t.lines();
    // A row of the transcript holding the term, not the find box's own field.
    const y = lines.findIndex((line, i) => i > 5 && /linux/i.test(line));
    expect(y).toBeGreaterThan(-1);
    const row = lines[y] as string;
    const x = row.toLowerCase().indexOf('linux');
    const hit = t.app.buffer().get(x, y);
    const before = t.app.buffer().get(x - 1, y);
    expect(JSON.stringify(hit?.bg)).not.toBe(JSON.stringify(before?.bg));
    await t.unmount();
  });
});

describe('the find box on a short terminal', () => {
  it('still leaves a conversation under it', async () => {
    const t = await inSession(80, 20);
    await t.press('ctrl+f');
    await settle(t);
    t.type('linux');
    await settle(t);
    // The box is one row above the transcript, so the transcript is still
    // most of the screen rather than being pushed off by it.
    expect(t.hasText('1 of')).toBe(true);
    expect(t.lines().filter((line) => line.trim() !== '').length).toBeGreaterThan(8);
    await t.unmount();
  });
});
