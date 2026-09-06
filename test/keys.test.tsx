import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { HOST_ERROR, SCREEN } from '../src/state.js';
import { fakeHost } from '../src/ahp/fake.js';

/*
 * Keys from the config file, over the ones this client ships with.
 *
 * The chords were a table in the source and nothing else, so a person whose
 * terminal eats one of them - or whose muscle memory says another - had to
 * edit this client to change it. `keys` in `config.json` is a chord to a
 * command id, or to `null` to take the chord away.
 */

const running = async (keys?: Record<string, string | null>) => {
  const t = await renderApp({
    width: 100,
    height: 28,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => {
      registerChat(app, { host: fakeHost(), ...(keys ? { keys } : {}) });
    },
  });
  for (let i = 0; i < 8; i += 1) await t.settle();
  return t;
};

describe('the config file can say what a key does', () => {
  it('binds a chord this client ships nothing on', async () => {
    const t = await running({ 'ctrl+y': 'session.new' });
    // `ctrl+y` is unbound by default, so reaching the new-session screen with
    // it is the config file's doing and nothing else's.
    await t.press('ctrl+y');
    for (let i = 0; i < 4; i += 1) await t.settle();
    expect(t.app.store.get<string>(SCREEN)).toBe('new');
    await t.unmount();
  });

  it('replaces what a chord did by default', async () => {
    const t = await running({ 'ctrl+p': 'session.new' });
    // `ctrl+p` opens the palette when nobody has said otherwise.
    await t.press('ctrl+p');
    for (let i = 0; i < 4; i += 1) await t.settle();
    expect(t.app.store.get<string>(SCREEN)).toBe('new');
    await t.unmount();
  });

  it('takes a chord away when it is set to null', async () => {
    const t = await running({ 'ctrl+n': null });
    const before = t.app.store.get<string>(SCREEN);
    await t.press('ctrl+n');
    for (let i = 0; i < 4; i += 1) await t.settle();
    // Not rebound to something else - bound to nothing, so the screen is
    // wherever it already was.
    expect(t.app.store.get<string>(SCREEN)).toBe(before);
    await t.unmount();
  });

  it('leaves every other default alone', async () => {
    const t = await running({ 'ctrl+y': 'session.new' });
    // Naming one chord is not a replacement for the table: `ctrl+n` still
    // does what it always did.
    await t.press('ctrl+n');
    for (let i = 0; i < 4; i += 1) await t.settle();
    expect(t.app.store.get<string>(SCREEN)).toBe('new');
    await t.unmount();
  });
});

describe('the editor command', () => {
  it('is registered, so a chord can name it', async () => {
    const t = await running();
    expect(t.app.commands.get('editor.open')).toBeTruthy();
    await t.unmount();
  });

  it('says so when there is no editor to open', async () => {
    const t = await running();
    const was = { visual: process.env.VISUAL, editor: process.env.EDITOR };
    delete process.env.VISUAL;
    delete process.env.EDITOR;
    try {
      await t.app.commands.get('editor.open')?.run?.({});
      for (let i = 0; i < 4; i += 1) await t.settle();
      // A command that quietly does nothing is one somebody retries.
      expect(t.app.store.get<string>(HOST_ERROR) ?? '').toContain('EDITOR');
    }
    finally {
      if (was.visual !== undefined) process.env.VISUAL = was.visual;
      if (was.editor !== undefined) process.env.EDITOR = was.editor;
      await t.unmount();
    }
  });
});
