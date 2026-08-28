import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { CONTROLLER } from '../src/control.js';
import { fakeHost } from '../src/ahp/fake.js';
import { CUSTOMIZATIONS, DRAFT } from '../src/state.js';
import type { Customization } from '../src/ahp/types.js';

/**
 * What the host handed the session, and what a client does with it.
 *
 * The protocol's answer to "which skills does this session have" is a nested
 * customization tree on the session channel, and the three things a client can
 * get wrong about it are all here: reading a child's own `enabled` flag as the
 * answer when the plugin that brought it is switched off, offering a skill the
 * host has marked as the agent's alone, and treating an MCP server that only
 * needs signing in as one that failed.
 */

const SEEDED = 'ahp-session:/1f0a';

async function open(screen: string): Promise<Harness> {
  const host = fakeHost();
  const t = await renderApp({
    width: 100,
    height: 30,
    shell: 'workbench',
    theme: 'workbench',
    onBoot: (app) => { registerChat(app, { host }); },
  });
  for (let i = 0; i < 8; i++) await t.settle();
  t.app.services.require(CONTROLLER).open(SEEDED);
  for (let i = 0; i < 6; i++) await t.settle();
  t.app.screens.push(screen);
  for (let i = 0; i < 8; i++) await t.settle();
  return t;
}

const loaded = (t: Harness): Customization[] =>
  t.app.store.get<Customization[]>(CUSTOMIZATIONS) ?? [];

describe('the skills panel', () => {
  it('lists what plugins and directories contributed, and where from', async () => {
    const t = await open('skills');
    expect(t.hasText('Skills and commands')).toBe(true);
    expect(t.hasText('review')).toBe(true);
    expect(t.hasText('linux-build')).toBe(true);
    // The container it came from, on the second line. Two plugins can each
    // contribute a `review`, and the name alone does not say which this is.
    expect(t.hasText('code-review')).toBe(true);
    await t.unmount();
  });

  it('keeps the containers, because a plugin is one switch for its six skills', async () => {
    const t = await open('skills');
    const kinds = new Set(loaded(t).map((item) => item.kind));
    expect(kinds.has('plugin')).toBe(true);
    expect(kinds.has('directory')).toBe(true);
    await t.unmount();
  });

  it('leaves the MCP servers to the other panel', async () => {
    const t = await open('skills');
    // Both panels read the same list; what differs is the slice. A server in
    // the skills panel is a row somebody has to scroll past to find a skill.
    expect(t.hasText('google-drive')).toBe(false);
    await t.unmount();
  });

  it('says a plugin that would not load, rather than showing it as empty', async () => {
    const t = await open('skills');
    const broken = loaded(t).find((item) => item.name === 'notes-sync');
    expect(broken?.problem).toContain('not valid JSON');
    await t.unmount();
  });
});

describe('the MCP panel', () => {
  it('lists the servers with what each one is doing', async () => {
    const t = await open('mcp');
    expect(t.hasText('MCP servers')).toBe(true);
    expect(t.hasText('tasker')).toBe(true);
    expect(t.hasText('ready')).toBe(true);
    await t.unmount();
  });

  /**
   * Signing in is not a failure.
   *
   * `authRequired` is the host saying the server is reachable and nobody has
   * a token for it - something a person can go and fix. Drawn as an error it
   * reads as broken, and the thing to do about it never gets done.
   */
  it('tells a server waiting to be signed into from one that failed', async () => {
    const t = await open('mcp');
    expect(t.hasText('sign in')).toBe(true);
    expect(t.hasText('failed')).toBe(false);
    await t.unmount();
  });

  it('shows a server the host contributed itself, not only a plugin\'s', async () => {
    const t = await open('mcp');
    const top = loaded(t).filter((item) => item.kind === 'mcpServer' && item.from === undefined);
    expect(top.map((item) => item.name)).toContain('tasker');
    await t.unmount();
  });
});

describe('opening another session', () => {
  /**
   * The list belongs to the session, not to the host.
   *
   * Two sessions on the same host, opened in different directories, are handed
   * different skills. A list left over from the last one is a slash menu
   * offering commands this session does not have, and a panel that answers a
   * question about somewhere else.
   */
  it('forgets what the last one was handed', async () => {
    const t = await open('skills');
    expect(loaded(t).length).toBeGreaterThan(0);

    // Read before settling: the panel is still mounted and asks again as soon
    // as it sees the new session, so what is worth asserting is that the old
    // answer is gone *first* rather than sitting on screen until the new one
    // arrives.
    t.app.services.require(CONTROLLER).open('ahp-session:/9c74');
    // Null, not empty: an empty list is the host saying it gave this session
    // none, and that is an answer. This is nobody having asked yet.
    expect(t.app.store.get<Customization[] | null>(CUSTOMIZATIONS) ?? null).toBe(null);

    // ...and the panel does ask again rather than staying blank.
    for (let i = 0; i < 8; i++) await t.settle();
    expect(loaded(t).length).toBeGreaterThan(0);
    await t.unmount();
  });
});

describe('turning one off', () => {
  it('answers the row now, rather than when the host gets back', async () => {
    const t = await open('skills');
    const before = loaded(t).find((item) => item.name === 'review');
    expect(before?.enabled).toBe(true);

    // Enter on the row under the cursor. The list is focused on open, and the
    // first row is the one it starts on.
    t.press('down');
    await t.settle();
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();

    // The host is told and tells every client back, but the row under the
    // cursor should not sit on the old answer while that arrives.
    expect(loaded(t).find((item) => item.name === 'review')?.enabled).toBe(false);
    await t.unmount();
  });

  it('takes a plugin\'s children with it', async () => {
    const t = await open('skills');
    // The container is the first row.
    t.press('enter');
    for (let i = 0; i < 6; i++) await t.settle();

    const after = loaded(t);
    expect(after.find((item) => item.name === 'code-review')?.enabled).toBe(false);
    // A disabled plugin disables everything it brought, whatever each child's
    // own flag says. A panel that showed the child's flag alone would list a
    // skill as on inside a plugin that is off.
    expect(after.find((item) => item.name === 'review')?.enabled).toBe(false);
    expect(after.find((item) => item.name === 'verify')?.enabled).toBe(false);
    // ...and nothing outside it moved.
    expect(after.find((item) => item.name === 'linux-build')?.enabled).toBe(true);
    await t.unmount();
  });
});

describe('a customization that is off', () => {
  it('is off because of its own flag, inside a container that is on', async () => {
    const t = await open('skills');
    const off = loaded(t).find((item) => item.name === 'deploy');
    expect(off?.enabled).toBe(false);
    expect(loaded(t).find((item) => item.name === '.claude/commands')?.enabled).toBe(true);
    await t.unmount();
  });

  it('is not offered as a slash command', async () => {
    // The conversation, not the panel: the slash menu is the composer's, and
    // the composer with a session behind it is the chat screen's.
    const t = await open('chat');
    // The control first, so this cannot pass by the menu simply not opening:
    // a skill that *is* on, matched by the same prefix rule, is offered.
    t.app.store.set(DRAFT, '/rev');
    for (let i = 0; i < 6; i++) await t.settle();
    expect(t.hasText('/review')).toBe(true);

    t.app.store.set(DRAFT, '/dep');
    for (let i = 0; i < 6; i++) await t.settle();
    // A menu is a list of what can be done. A row that cannot be chosen is a
    // row somebody has to read to find that out.
    expect(t.hasText('/deploy')).toBe(false);
    await t.unmount();
  });
});
