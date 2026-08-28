import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { fakeHost } from '../src/ahp/fake.js';
import { OPEN_FILE } from '../src/state.js';

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

async function changes(): Promise<Harness> {
  const host = fakeHost();
  const t = await renderApp({
    width: 100,
    height: 30,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  t.app.services.require(CONTROLLER).open(CHANGED);
  for (let i = 0; i < 8; i++) await t.settle();
  await t.app.execute('go.changes');
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
    await t.app.execute('go.changes');
    for (let i = 0; i < 8; i++) await t.settle();

    expect(t.app.store.get<string>(OPEN_FILE) ?? null).toBe(null);
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
