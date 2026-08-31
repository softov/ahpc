import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { fakeHost } from '../src/ahp/fake.js';

/**
 * The host's filesystem, browsed.
 *
 * The *host's* is the whole point and the thing a test has to pin: the daemon
 * may be on another machine, and a client that listed its own directory would
 * be showing the right shape and the wrong files. So every name checked here
 * comes from the scripted host's tree and none of them from this repository.
 */

const CHANGED = 'ahp-session:/4e18';

async function files(): Promise<Harness> {
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
  await t.app.execute('go.files');
  for (let i = 0; i < 10; i++) await t.settle();
  return t;
}

describe('browsing the host', () => {
  it('lists the session\'s own directory, since that is the only one it can name', async () => {
    const t = await files();
    expect(t.hasText('src')).toBe(true);
    expect(t.hasText('README.md')).toBe(true);
    expect(t.hasText('package.json')).toBe(true);
    await t.unmount();
  });

  it('descends into a directory and offers the way back out', async () => {
    const t = await files();
    // `..` is a row rather than a key: it is where a person looks for it, and
    // a key that only works sometimes is worse than a row that is always there.
    expect(t.hasText('..')).toBe(false);
    await t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('app.tsx')).toBe(true);
    expect(t.hasText('..')).toBe(true);
    await t.unmount();
  });

  it('reads a file only when one is opened', async () => {
    const t = await files();
    // A line out of README.md's contents. Not on screen while this is a list.
    expect(t.hasText('terminal client')).toBe(false);
    await t.press('down');
    await t.press('down');
    for (let i = 0; i < 4; i++) await t.settle();
    await t.press('enter');
    for (let i = 0; i < 12; i++) await t.settle();
    expect(t.hasText('terminal client')).toBe(true);
    await t.unmount();
  });

  it('opens at the top every time, not where somebody left it', async () => {
    const t = await files();
    await t.press('enter');
    for (let i = 0; i < 10; i++) await t.settle();
    expect(t.hasText('app.tsx')).toBe(true);
    await t.press('escape');
    for (let i = 0; i < 8; i++) await t.settle();
    await t.app.execute('go.files');
    for (let i = 0; i < 10; i++) await t.settle();
    // A browser that reopens six directories deep is one nobody can tell from
    // a broken one.
    expect(t.hasText('package.json')).toBe(true);
    await t.unmount();
  });
});
