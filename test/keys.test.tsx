import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { DRAFT, HOST_ERROR, SCREEN } from '../src/state.js';
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

  it('puts what the editor wrote into the draft', async () => {
    const t = await running();
    const was = { visual: process.env.VISUAL, editor: process.env.EDITOR };
    // An "editor" that writes a message and exits, which is all the command
    // needs one to do: open the file it is handed, and leave it changed.
    process.env.VISUAL = `node -e "require('node:fs').writeFileSync(process.argv[1], 'from the editor\\n')"`;
    delete process.env.EDITOR;
    try {
      t.app.store.set(DRAFT, 'half typed');
      await t.app.commands.get('editor.open')?.run({}, { app: t.app } as never);
      for (let i = 0; i < 6; i += 1) await t.settle();
      // The trailing newline is the editor's convention, not part of what
      // anybody typed.
      expect(t.app.store.get<string>(DRAFT)).toBe('from the editor');
    }
    finally {
      if (was.visual === undefined) delete process.env.VISUAL; else process.env.VISUAL = was.visual;
      if (was.editor !== undefined) process.env.EDITOR = was.editor;
      await t.unmount();
    }
  });

  it('says so when there is no editor to open', async () => {
    const t = await running();
    const was = { visual: process.env.VISUAL, editor: process.env.EDITOR };
    delete process.env.VISUAL;
    delete process.env.EDITOR;
    try {
      // The handler takes the args and a context; neither is read on the
      // path this asserts, which is the one that answers before any of it.
      await t.app.commands.get('editor.open')?.run({}, { app: t.app } as never);
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

/*
 * `/config` and the palette it opens.
 *
 * Typing `/config` used to match no command, so it went out as a message. The
 * commands that configure this client now carry a second slot, and this opens
 * the same palette over that slot rather than a screen of its own - so a
 * command joins the config list by naming the slot and nothing else has to be
 * kept in step.
 */
describe('config is the palette, over the commands that configure the client', () => {
  it('is a command, so a slash finds it instead of sending a message', async () => {
    const t = await running();
    expect(t.app.commands.get('app.config')).toBeTruthy();
    // The slash menu matches on the id, which is how `/config` reaches it.
    expect(t.app.commands.get('app.config')?.id).toContain('config');
    await t.unmount();
  });

  it('lists what this client decides, and not every command', async () => {
    const t = await running();
    const all = t.app.commands.list({ slot: 'palette', enabledOnly: true });
    const config = t.app.commands.list({ slot: 'config', enabledOnly: true });
    expect(config.length).toBeGreaterThan(0);
    // A narrower list, or the slot is doing nothing.
    expect(config.length).toBeLessThan(all.length);
    const ids = config.map((one) => one.id);
    expect(ids).toContain('view.theme');
    expect(ids).toContain('view.shell');
    // Not a thing you configure: it acts on the session in front of you.
    expect(ids).not.toContain('session.dispose');
    await t.unmount();
  });
});

/*
 * A command offered where it cannot work.
 *
 * `session.openDetails` shows the catalogue's detail pane. It was offered on
 * every screen and did nothing on all but one, which from the palette is
 * indistinguishable from the client being broken.
 */
describe('a command is offered where it works', () => {
  const offered = (t: { app: { commands: { list(o: unknown): { id: string }[] } } }): string[] =>
    t.app.commands.list({ slot: 'palette', enabledOnly: true }).map((one) => one.id);

  it('keeps the detail-pane commands to the screen that has one', async () => {
    const t = await running();
    // The client opens on the composer, where there is no detail pane.
    expect(t.app.store.get<string>(SCREEN)).toBe('new');
    expect(offered(t)).not.toContain('session.openDetails');
    expect(offered(t)).not.toContain('session.closeDetails');

    await t.app.commands.get('go.sessions')?.run({}, { app: t.app } as never);
    for (let i = 0; i < 4; i += 1) await t.settle();
    expect(t.app.store.get<string>(SCREEN)).toBe('sessions');
    // On the catalogue, where the pane is, both are there to be picked.
    expect(offered(t)).toContain('session.openDetails');
    expect(offered(t)).toContain('session.closeDetails');
    await t.unmount();
  });
});
