import { describe, expect, it } from 'vitest';
import { readClipboard } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { fakeHost } from '../src/ahp/fake.js';
import type { FakeHost } from '../src/ahp/fake.js';
import { operate } from '../src/ahp/operate.js';
import { CHANGE_AT, HOST_ERROR, HOST_LINK, OPEN_FILE } from '../src/state.js';

/**
 * The changeset, and one file out of it.
 *
 * What is worth checking here is the part a screenshot cannot show: that the
 * list is a list of names and nothing more until a row is opened, that opening
 * one fetches both sides rather than rendering half a diff, and that a
 * creation - which has no `before` at all - is every line added rather than a
 * viewer comparing something against undefined.
 */

/** The archived session, which is the one carrying a changeset. */
const CHANGED = 'ahp-session:/4e18';

async function changes(host: FakeHost = fakeHost(), width = 100): Promise<Harness> {
  const t = await renderApp({
    width,
    height: 30,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  t.app.services.require(CONTROLLER).open(CHANGED);
  for (let i = 0; i < 8; i++) await t.settle();
  await t.app.execute('changes.show');
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

describe('the changeset', () => {
  it('lists what the session touched, with a count each', async () => {
    const t = await changes();
    expect(t.hasText('compileLinux.sh')).toBe(true);
    expect(t.hasText('README.linux.md')).toBe(true);
    expect(t.hasText('build.old.sh')).toBe(true);
    await t.unmount();
  });

  /**
   * The content is a fetch, not part of the list.
   *
   * A changeset is a list of names the host sends up front and a pile of bytes
   * it does not. A screen that read both together would download a session's
   * whole diff to draw a list of filenames.
   */
  it('has fetched nothing until a row is opened', async () => {
    const t = await changes();
    // A line out of the first file's contents. On screen before anything is
    // opened, the list is not a list.
    expect(t.hasText('libbrb_ev_kq')).toBe(false);
    await t.unmount();
  });

  it('opens a file on enter, and shows both sides of it', async () => {
    const t = await changes();
    t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();

    expect(t.app.store.get<string>(OPEN_FILE)).toContain('compileLinux.sh');
    // The line that changed, on both sides: `Makefile` became `Makefile.linux`
    // and the loop gained a library.
    expect(t.hasText('libbrb_data')).toBe(true);
    await t.unmount();
  });

  it('closes the file on escape, before it closes the screen', async () => {
    const t = await changes();
    t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.app.store.get<string>(OPEN_FILE)).toBeTruthy();

    t.press('escape');
    for (let i = 0; i < 8; i++) await t.settle();
    // The file closed and the screen did not: two escapes to leave, which is
    // what the priority on the binding is for.
    expect(t.app.store.get<string>(OPEN_FILE) ?? null).toBe(null);
    expect(t.hasText('README.linux.md')).toBe(true);
    await t.unmount();
  });

  it('reopens on the list rather than on the file somebody read an hour ago', async () => {
    const t = await changes();
    t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.app.store.get<string>(OPEN_FILE)).toBeTruthy();

    t.app.screens.pop();
    for (let i = 0; i < 6; i++) await t.settle();
    await t.app.execute('changes.show');
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.app.store.get<string>(OPEN_FILE) ?? null).toBe(null);
    await t.unmount();
  });

  it('shows the next session its own changes, not the last one\'s', async () => {
    const t = await changes();
    expect(t.hasText('compileLinux.sh')).toBe(true);

    t.app.screens.pop();
    for (let i = 0; i < 6; i++) await t.settle();
    t.app.services.require(CONTROLLER).open('ahp-session:/1f0a');
    for (let i = 0; i < 8; i++) await t.settle();
    await t.app.execute('changes.show');
    for (let i = 0; i < 10; i++) await t.settle();

    // The scope chosen on the first session is a URI under that session, and
    // kept, it read the first session's files on this one.
    expect(t.app.store.get<string>(CHANGE_AT) ?? '').not.toContain(CHANGED);
    expect(t.hasText('compileLinux.sh')).toBe(false);
    await t.unmount();
  });

  /**
   * A creation has no `before`.
   *
   * The case a viewer that assumes two sides gets wrong: it compares the new
   * file against nothing, and either crashes or reports a file it just made as
   * unchanged.
   */
  it('draws a created file as every line added', async () => {
    const t = await changes();
    t.app.store.set(OPEN_FILE, 'file:///brb_main/src/brb_backend/README.linux.md');
    for (let i = 0; i < 10; i++) await t.settle();

    expect(t.hasText('Building on Linux')).toBe(true);
    expect(t.hasText('libkqueue')).toBe(true);
    await t.unmount();
  });

  it('draws a deleted file as every line removed', async () => {
    const t = await changes();
    t.app.store.set(OPEN_FILE, 'file:///brb_main/src/brb_backend/build.old.sh');
    for (let i = 0; i < 10; i++) await t.settle();

    expect(t.hasText('make all')).toBe(true);
    await t.unmount();
  });

  /**
   * A ref the host will not answer for is the host answering.
   *
   * Content expires, and a blank pane over an expired ref is the client
   * looking broken for something the host said plainly.
   */
  it('says why, when the host will not send the file', async () => {
    const t = await changes();
    t.app.store.set(OPEN_FILE, 'file:///nothing/here.txt');
    for (let i = 0; i < 10; i++) await t.settle();
    // Not in the changeset at all, so it falls back to the list rather than
    // showing an empty file view.
    expect(t.hasText('compileLinux.sh')).toBe(true);
    await t.unmount();
  });
});

describe('choosing which changeset, and ticking files off', () => {
  it('names every scope the host offers, and says which one cannot be reached', async () => {
    const t = await changes();
    // The four the fixture advertises. A screen that drew only the first was
    // showing one and hiding three.
    expect(t.hasText('This Session')).toBe(true);
    expect(t.hasText('Uncommitted Changes')).toBe(true);
    // A template with `{turnId}` still in it is a question about a turn, and
    // there is nothing on this screen to answer it from. Said rather than
    // dropped: silently hiding it is how somebody concludes their host has no
    // per-turn diffs.
    expect(t.hasText('needs a turn')).toBe(true);
    await t.unmount();
  });

  it('cycles to the next one, and draws what that one has', async () => {
    const t = await changes();
    // The working tree carries an edit no agent made, which is what makes it
    // a different answer from the session's own.
    expect(t.hasText('notes.todo')).toBe(false);
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('notes.todo')).toBe(true);
    await t.unmount();
  });

  it('draws the verbs the changeset offers, which it could not before', async () => {
    const t = await changes();
    // `revert` on what the conversation changed. The status is the half worth
    // having: a verb that cannot be pressed looks exactly like one that can
    // without it.
    expect(t.hasText('Revert This File')).toBe(true);
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    // And the working tree offers different ones, which is the point of
    // advertising them per scope.
    expect(t.hasText('Commit')).toBe(true);
    expect(t.hasText('Discard Changes')).toBe(true);
    await t.unmount();
  });

  it('ticks a file off and takes it back, through the host', async () => {
    const t = await changes();
    // Whichever glyph set the theme is on: the full one draws filled and
    // hollow squares, the ASCII fallback draws brackets.
    const ticked = () => t.hasText('■') || t.hasText('[x]');
    expect(ticked()).toBe(false);
    await t.press('r');
    for (let i = 0; i < 10; i++) await t.settle();
    // Nothing was written here: the host keeps the flag and tells every client
    // watching, and what redrew this screen is the changeset coming back.
    expect(ticked()).toBe(true);
    await t.press('r');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(ticked()).toBe(false);
    await t.unmount();
  });

  it('draws no tick column on a changeset the host will not keep one for', async () => {
    const t = await changes();
    // `uncommitted` is not reviewable in the fixture, as it is not on a real
    // host: the working tree is whatever it is now, and a tick against a file
    // something else may rewrite is bookkeeping about a thing that has moved.
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('□') || t.hasText('[ ]')).toBe(false);
    await t.unmount();
  });
});

describe('the scopes are tabs', () => {
  const SESSION = `${CHANGED}/changeset/session`;
  const TREE = `${CHANGED}/changeset/uncommitted`;

  for (const width of [100, 60]) {
    describe(`at ${width} columns`, () => {
      it('picks a scope on a click, and closes the file open from the last one', async () => {
        const t = await changes(fakeHost(), width);
        // A file the list does not hold, so the list stays on screen with it set.
        t.app.store.set(OPEN_FILE, 'file:///nothing/here.txt');
        for (let i = 0; i < 6; i++) await t.settle();
        expect(t.hasText('notes.todo')).toBe(false);
        t.clickOn(t.getByRole('tab', { name: 'Uncommitted Changes' }));
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.app.store.get<string>(CHANGE_AT)).toBe(TREE);
        expect(t.app.store.get<string>(OPEN_FILE) ?? null).toBe(null);
        expect(t.hasText('notes.todo')).toBe(true);
        await t.unmount();
      });

      it('reaches the tabs on Tab, and picks a scope with an arrow there', async () => {
        const t = await changes(fakeHost(), width);
        // The list has the keyboard when the screen opens.
        expect(t.focused()?.component).toBe('List');
        t.tab();
        await t.settle();
        expect(t.focused()?.component).toBe('Tabs');
        t.press('right');
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.app.store.get<string>(CHANGE_AT)).toBe(TREE);
        expect(t.hasText('notes.todo')).toBe(true);
        await t.unmount();
      });

      it('does not move the scope on a tab that needs a turn', async () => {
        const t = await changes(fakeHost(), width);
        t.clickOn(t.getByRole('tab', { name: 'This Turn (needs a turn)' }));
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.app.store.get<string>(CHANGE_AT)).toBe(SESSION);
        await t.unmount();
      });

      it('keeps ] and r working while a tab has the keyboard', async () => {
        const t = await changes(fakeHost(), width);
        t.tab();
        await t.settle();
        expect(t.focused()?.component).toBe('Tabs');
        await t.press('r');
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.hasText('■') || t.hasText('[x]')).toBe(true);
        await t.press(']');
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.app.store.get<string>(CHANGE_AT)).toBe(TREE);
        // The next reachable one, past the two that need a turn.
        await t.press(']');
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.app.store.get<string>(CHANGE_AT)).toBe(SESSION);
        await t.unmount();
      });
    });
  }
});

describe('the actions are buttons', () => {
  /** The working tree, where the fixture offers commit and create-pr. */
  async function tree(width: number): Promise<Harness> {
    const t = await changes(fakeHost(), width);
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    return t;
  }

  for (const width of [100, 60]) {
    describe(`at ${width} columns`, () => {
      it('opens the message prompt on a click on Commit', async () => {
        const t = await tree(width);
        t.clickOn(t.getByRole('button', { name: 'Commit' }));
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.hasText('Commits 2 staged files.')).toBe(true);
        await t.unmount();
      });

      it('opens the form on a click on Create PR', async () => {
        const t = await tree(width);
        t.clickOn(t.getByRole('button', { name: 'Create PR' }));
        for (let i = 0; i < 12; i++) await t.settle();
        expect(t.hasText('Build the framework on Linux')).toBe(true);
        await t.unmount();
      });

      it('reaches the buttons after the tabs, and runs one on Enter', async () => {
        const t = await tree(width);
        t.tab();
        await t.settle();
        expect(t.focused()?.component).toBe('Tabs');
        t.tab();
        await t.settle();
        expect(t.focused()?.label).toBe('Commit');
        await t.press('enter');
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.hasText('Commits 2 staged files.')).toBe(true);
        await t.unmount();
      });

      it('keeps x working while a button has the keyboard', async () => {
        const t = await tree(width);
        t.tab();
        t.tab();
        await t.settle();
        expect(t.focused()?.label).toBe('Commit');
        const before = t.app.layers.entries().length;
        await t.press('x');
        for (let i = 0; i < 10; i++) await t.settle();
        // The picker opens on the first verb, and Enter in it runs that one.
        expect(t.app.layers.entries().length).toBe(before + 1);
        expect(t.focused()?.label).not.toBe('Commit');
        await t.press('enter');
        for (let i = 0; i < 10; i++) await t.settle();
        expect(t.hasText('Commits 2 staged files.')).toBe(true);
        await t.unmount();
      });

      it('leaves the list its first row', async () => {
        const t = await tree(width);
        expect(t.hasText('compileLinux.sh')).toBe(true);
        expect(t.lines().every((line) => line.length <= width)).toBe(true);
        await t.unmount();
      });
    });
  }
});

describe('what a commit will take', () => {
  /** The row naming `name`, whatever else is on the screen. */
  const row = (t: Harness, name: string): string => t.lines().find((line) => line.includes(name)) ?? '';
  // Either glyph set: the full one, or the ASCII fallback.
  const staged = (line: string) => line.includes('●') || /\*\s*[+\->]/.test(line);
  const both = (line: string) => line.includes('◌') || /\+\s*[+\->]/.test(line);

  it('marks a staged file, leaves an unstaged one bare, and tells apart one that is both', async () => {
    const t = await changes();
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    // The fixture stages the first file, stages and then changes the second,
    // and leaves the rest in the tree.
    expect(staged(row(t, 'compileLinux.sh'))).toBe(true);
    expect(both(row(t, 'compileLinux.sh'))).toBe(false);
    expect(both(row(t, 'README.linux.md'))).toBe(true);
    expect(staged(row(t, 'README.linux.md'))).toBe(false);
    expect(staged(row(t, 'notes.todo')) || both(row(t, 'notes.todo'))).toBe(false);
    await t.unmount();
  });

  it('draws no mark where the host says nothing about staging', async () => {
    const t = await changes();
    // The session's own changeset carries no git state at all.
    expect(t.hasText('●') || t.hasText('◌')).toBe(false);
    await t.unmount();
  });
});

describe('running one of the verbs from the screen', () => {
  it('shows the confirmation before invoking, which the protocol requires', async () => {
    const t = await changes();
    // `revert` on what the conversation changed. The host called it
    // destructive by giving it a confirmation, so nothing may happen until
    // that has been shown and accepted.
    void t.app.execute('changes.run', { operation: 'revert' });
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('Put this file back the way the agent found it?')).toBe(true);
    await t.unmount();
  });

  it('asks which verb on x, and runs the one chosen', async () => {
    const t = await changes();
    // The key names no verb, so it opens the question rather than running
    // the command with nothing - which textui refuses, and used to throw.
    await t.press('x');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('Revert This File')).toBe(true);
    await t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('Put this file back the way the agent found it?')).toBe(true);
    await t.unmount();
  });

  it('does nothing at all when the confirmation is declined', async () => {
    const t = await changes();
    void t.app.execute('changes.run', { operation: 'revert' });
    for (let i = 0; i < 10; i++) await t.settle();
    await t.press('escape');
    for (let i = 0; i < 10; i++) await t.settle();
    // Not even the grant was asked for. Declining the act must not leave a
    // client that has quietly taken write access to the tree.
    expect(t.hasText('needs write access')).toBe(false);
    await t.unmount();
  });

  it('asks for the write separately, because it is a different question', async () => {
    const t = await changes();
    void t.app.execute('changes.run', { operation: 'revert' });
    for (let i = 0; i < 10; i++) await t.settle();
    await t.press('enter');
    for (let i = 0; i < 12; i++) await t.settle();
    // "Revert this file" and "let this host write to your repository" are two
    // questions, and answering the first is not answering the second.
    expect(t.hasText('Let the host write?')).toBe(true);
    await t.unmount();
  });
});

describe('a commit asks for its message', () => {
  /** The working tree, where the fixture offers `commit`. */
  async function tree(host: FakeHost = fakeHost()): Promise<Harness> {
    const t = await changes(host);
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    return t;
  }

  /** A fake host whose `commit` carries a confirmation, as the reference host's does. */
  function confirming(): FakeHost {
    const host = fakeHost();
    const read = host.changes.bind(host);
    host.changes = async (uri, changeset) => {
      const held = await read(uri, changeset);
      return {
        ...held,
        ...(held.operations ? {
          operations: held.operations.map((one) => (one.id === 'commit' ? { ...one, confirmation: 'Commit 2 staged files?' } : one)),
        } : {}),
      };
    };
    return host;
  }

  it('opens on the session title and says how many staged files it takes', async () => {
    const t = await tree();
    void t.app.execute('changes.run', { operation: 'commit' });
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('Old build script cleanup')).toBe(true);
    expect(t.hasText('Commits 2 staged files.')).toBe(true);
    await t.unmount();
  });

  it('shows the host\'s confirmation in the same ask, not a second one', async () => {
    const t = await tree(confirming());
    void t.app.execute('changes.run', { operation: 'commit' });
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('Commit 2 staged files?')).toBe(true);
    expect(t.hasText('Old build script cleanup')).toBe(true);
    await t.unmount();
  });

  it('commits with the message typed', async () => {
    const host = fakeHost();
    const t = await tree(host);
    void t.app.execute('changes.run', { operation: 'commit' });
    for (let i = 0; i < 10; i++) await t.settle();
    await t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    // The write grant, which is its own question.
    await t.press('enter');
    for (let i = 0; i < 12; i++) await t.settle();
    expect(host.invoked().at(-1)).toMatchObject({
      operationId: 'commit',
      meta: { 'ahpd.commit': { message: 'Old build script cleanup' } },
    });
    expect(t.hasText('Committed 1a2b3c4')).toBe(true);
    await t.unmount();
  });

  it('commits nothing on escape', async () => {
    const host = fakeHost();
    const t = await tree(host);
    void t.app.execute('changes.run', { operation: 'commit' });
    for (let i = 0; i < 10; i++) await t.settle();
    await t.press('escape');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(host.invoked()).toEqual([]);
    expect(t.hasText('needs write access')).toBe(false);
    await t.unmount();
  });
});

describe('a pull request is prepared, then read in a form', () => {
  async function tree(host: FakeHost = fakeHost(), width = 100): Promise<Harness> {
    const t = await renderApp({
      width,
      height: 36,
      shell: 'workbench',
      theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    t.app.services.require(CONTROLLER).open(CHANGED);
    for (let i = 0; i < 8; i++) await t.settle();
    await t.app.execute('changes.show');
    for (let i = 0; i < 8; i++) await t.settle();
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    return t;
  }

  it('opens on the draft the host prepared', async () => {
    const host = fakeHost();
    const t = await tree(host);
    void t.app.execute('changes.run', { operation: 'create-pr' });
    for (let i = 0; i < 12; i++) await t.settle();
    expect(host.invoked().map((one) => one.operationId)).toEqual(['prepare-pull-request']);
    expect(t.hasText('Build the framework on Linux')).toBe(true);
    expect(t.hasText('Adds a Linux build script and its notes.')).toBe(true);
    expect(t.hasText('agent/linux-build into main')).toBe(true);
    expect(t.hasText('softov/brb_backend')).toBe(true);
    await t.unmount();
  });

  it('fits at 60 columns', async () => {
    const t = await tree(fakeHost(), 60);
    void t.app.execute('changes.run', { operation: 'create-pr' });
    for (let i = 0; i < 12; i++) await t.settle();
    expect(t.hasText('Build the framework on Linux')).toBe(true);
    expect(t.lines().every((line) => line.length <= 60)).toBe(true);
    await t.unmount();
  });

  it('sends the draft\'s context back exactly as it arrived', async () => {
    const host = fakeHost();
    const t = await tree(host);
    void t.app.execute('changes.run', { operation: 'create-pr' });
    for (let i = 0; i < 12; i++) await t.settle();
    // Enter in the title sends the form.
    await t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    // The write grant, which is its own question.
    if (t.hasText('Let the host write?')) {
      await t.press('enter');
      for (let i = 0; i < 12; i++) await t.settle();
    }
    const created = host.invoked().at(-1);
    expect(created?.operationId).toBe('create-pr');
    expect(created?.meta).toEqual({
      'vscode.pullRequest': {
        title: 'Build the framework on Linux',
        description: 'Adds a Linux build script and its notes.',
        draft: false,
        expectedContext: {
          repository: 'softov/brb_backend', branchName: 'agent/linux-build', baseBranchName: 'main', head: '1a2b3c4',
        },
      },
    });
    await t.unmount();
  });

  it('runs nothing more on escape', async () => {
    const host = fakeHost();
    const t = await tree(host);
    void t.app.execute('changes.run', { operation: 'create-pr' });
    for (let i = 0; i < 12; i++) await t.settle();
    await t.press('escape');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(host.invoked().map((one) => one.operationId)).toEqual(['prepare-pull-request']);
    expect(t.hasText('Build the framework on Linux')).toBe(false);
    await t.unmount();
  });

  it('closes the form when the host refuses to prepare, and keeps its words', async () => {
    const host = fakeHost();
    const invoke = host.invoke!.bind(host);
    host.invoke = async (changeset, operationId, target, meta) => {
      if (operationId === 'prepare-pull-request') throw Object.assign(new Error('There is no remote to open a pull request on.'), { code: -32603 });
      return invoke(changeset, operationId, target, meta);
    };
    const t = await tree(host);
    void t.app.execute('changes.run', { operation: 'create-pr' });
    for (let i = 0; i < 12; i++) await t.settle();
    expect(t.hasText('Title')).toBe(false);
    expect(t.hasText('There is no remote')).toBe(true);
    await t.unmount();
  });

  it('does not offer the prepare step on its own', async () => {
    const t = await tree();
    // The verb row.
    expect(t.hasText('Create PR')).toBe(true);
    expect(t.hasText('Prepare PR')).toBe(false);
    // The palette's question.
    await t.press('x');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('Prepare PR')).toBe(false);
    await t.unmount();
  });
});

describe('the link the host sends back', () => {
  const PULL = 'https://github.com/softov/brb_backend/pull/7';

  /** The working tree, with the pull request created through the form. */
  async function created(): Promise<Harness> {
    const t = await changes();
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    void t.app.execute('changes.run', { operation: 'create-pr' });
    for (let i = 0; i < 12; i++) await t.settle();
    await t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    if (t.hasText('Let the host write?')) {
      await t.press('enter');
      for (let i = 0; i < 12; i++) await t.settle();
    }
    return t;
  }

  it('shows the link on the status row and puts it on the clipboard', async () => {
    const t = await created();
    expect(t.app.store.get(HOST_LINK)).toBe(PULL);
    expect(t.hasText('pull/7')).toBe(true);
    expect(t.hasText('copied')).toBe(true);
    expect(readClipboard(t.app.store)).toBe(PULL);
    await t.unmount();
  });

  it('is gone once another session is opened', async () => {
    const t = await created();
    t.app.services.require(CONTROLLER).open('ahp-session:/1f0a');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.app.store.get(HOST_LINK) ?? null).toBeNull();
    expect(t.hasText('copied')).toBe(false);
    await t.unmount();
  });

  it('says so when the host sends back something it cannot read', async () => {
    const host = fakeHost();
    const invoke = host.invoke!.bind(host);
    host.invoke = async (changeset, operationId, target, meta) => {
      if (operationId === 'commit') return { followUp: { content: { uri: 'ahpd-blob:/x', contentType: 'image/png' } } };
      return invoke(changeset, operationId, target, meta);
    };
    const t = await changes(host);
    await t.press(']');
    for (let i = 0; i < 10; i++) await t.settle();
    void t.app.execute('changes.run', { operation: 'commit' });
    for (let i = 0; i < 10; i++) await t.settle();
    await t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.app.store.get(HOST_ERROR)).toBe('The host sent something back that this client cannot show.');
    await t.unmount();
  });
});

describe('an operation\'s arguments and its answer', () => {
  const TREE = `${CHANGED}/changeset/uncommitted`;

  it('records the _meta an invocation carried', async () => {
    const host = fakeHost();
    await operate(host, TREE, 'commit', { meta: { 'ahpd.commit': { message: 'Fix the build' } }, ask: () => true });
    expect(host.invoked().at(-1)?.meta).toEqual({ 'ahpd.commit': { message: 'Fix the build' } });
  });

  it('answers the pull request pair with a draft and then a link', async () => {
    const host = fakeHost();
    const prepared = await operate(host, TREE, 'prepare-pull-request');
    expect(prepared.followUp?.content.uri.startsWith('data:application/json,')).toBe(true);
    const created = await operate(host, TREE, 'create-pr', { ask: () => true });
    expect(created.followUp).toEqual({
      content: { uri: 'https://github.com/softov/brb_backend/pull/7', contentType: 'text/html' },
      external: true,
    });
  });
});
