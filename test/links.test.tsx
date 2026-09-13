import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { registerChat } from '../src/app.js';
import { fakeHost } from '../src/ahp/fake.js';
import { CONTROLLER } from '../src/control.js';
import { CHAT_URI, OPEN, TURNS } from '../src/state.js';
import { chatMatches, idOf, linksIn, parseSessionLink, sessionOfLink } from '../src/links.js';
import type { SessionSummary, Turn } from '../src/ahp/types.js';

/*
 * `agent-host-session://` links, followed.
 *
 * The reference host's tools answer with one and its window makes it a
 * click. Here the links in a transcript are a list to pick from, and one
 * picked opens the session - or the chat - it names, whichever scheme the
 * catalogue lists the session under.
 */

describe('reading a link', () => {
  it('takes the provider, the id, and the chat and turn when named', () => {
    expect(parseSessionLink('agent-host-session://claude/4e18')).toEqual({ provider: 'claude', id: '4e18' });
    expect(parseSessionLink('agent-host-session://claude/4e18?chat=side%201&turn=t3')).toEqual({ provider: 'claude', id: '4e18', chatId: 'side 1', turnId: 't3' });
    // The default chat is the session, which is how the reference host builds the link.
    expect(parseSessionLink('agent-host-session://claude/4e18?chat=default')).toEqual({ provider: 'claude', id: '4e18' });
    expect(parseSessionLink('AGENT-HOST-SESSION://copilotcli/9c74#x')).toEqual({ provider: 'copilotcli', id: '9c74' });
    expect(parseSessionLink('ahp-session:/4e18')).toBeUndefined();
    expect(parseSessionLink('agent-host-session://claude/')).toBeUndefined();
    expect(parseSessionLink('https://example.com/agent-host-session://x/y')).toBeUndefined();
  });

  it('matches the row under either scheme, on the id and the provider', () => {
    const rows = [
      { resource: 'ahp-session:/4e18', provider: 'claude' },
      { resource: 'copilotcli:/4e18', provider: 'copilotcli' },
      { resource: 'claude:/aaaa', provider: 'claude' },
    ] as SessionSummary[];
    expect(idOf('ahp-session:/4e18')).toBe('4e18');
    expect(idOf('claude:/aaaa')).toBe('aaaa');
    expect(sessionOfLink({ provider: 'copilotcli', id: '4e18' }, rows)?.resource).toBe('copilotcli:/4e18');
    expect(sessionOfLink({ provider: 'claude', id: '4e18' }, rows)?.resource).toBe('ahp-session:/4e18');
    expect(sessionOfLink({ provider: 'claude', id: 'aaaa' }, rows)?.resource).toBe('claude:/aaaa');
    // A provider the catalogue spells differently still finds the id.
    expect(sessionOfLink({ provider: 'anthropic', id: 'aaaa' }, rows)?.resource).toBe('claude:/aaaa');
    expect(sessionOfLink({ provider: 'claude', id: 'nobody' }, rows)).toBeUndefined();
    expect(chatMatches('ahp-chat://side%201/YWhw', 'side 1')).toBe(true);
    expect(chatMatches('ahp-chat:/f00', 'f00')).toBe(true);
    expect(chatMatches('ahp-chat:/f00', 'bar')).toBe(false);
  });

  it('finds the links a person can see in a transcript, once each, in order', () => {
    const turns: Turn[] = [
      { id: 't1', role: 'user', message: 'Start one for the docs, see agent-host-session://claude/1f0a.', parts: [], state: 'complete', at: '' },
      {
        id: 't2', role: 'agent', parts: [
          { kind: 'toolCall', id: 'c1', call: { id: 'c1', name: 'create_session', toolName: 'create_session', status: 'completed', output: '{"session":"ahp-session:/9c74","openLink":"agent-host-session://copilotcli/9c74?chat=side"}' } },
          { kind: 'markdown', id: 'm1', content: 'Made it: [open](agent-host-session://copilotcli/9c74?chat=side) and again agent-host-session://claude/1f0a' },
          { kind: 'systemNotification', id: 'n1', content: 'Workspace changed; continue in agent-host-session://claude/4e18' },
        ], state: 'complete', at: '',
      },
    ];
    expect(linksIn(turns).map((one) => one.link)).toEqual([
      'agent-host-session://claude/1f0a',
      'agent-host-session://copilotcli/9c74?chat=side',
      'agent-host-session://claude/4e18',
    ]);
    expect(linksIn(turns)[1]?.context).toContain('openLink');
  });
});

describe('following a link on the screen', () => {
  const open = async () => {
    const host = fakeHost();
    const t = await renderApp({
      width: 100, height: 30, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerChat(app, { host }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    return t;
  };

  it('opens the session a link names, from a transcript or typed', async () => {
    const t = await open();
    const controller = t.app.services.require(CONTROLLER);
    controller.open('ahp-session:/4e18');
    for (let i = 0; i < 8; i++) await t.settle();
    t.app.store.set(TURNS, [
      { id: 't1', role: 'agent', parts: [{ kind: 'markdown', id: 'm', content: 'Continue in agent-host-session://copilotcli/9c74' }], state: 'complete', at: '' },
    ]);
    await t.app.execute('chat.openLink', { link: 'agent-host-session://copilotcli/9c74' });
    for (let i = 0; i < 12; i++) await t.settle();
    expect(t.app.store.get<string>(OPEN)).toBe('ahp-session:/9c74');
    expect(t.hasText('Why does the composer eat q')).toBe(true);
    // One the host has no session for is said, and nothing moves.
    expect(await controller.openLink('agent-host-session://claude/nobody')).toBe(false);
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.app.store.get<string>(OPEN)).toBe('ahp-session:/9c74');
    expect(t.hasText('No session on this host matches')).toBe(true);
    await t.unmount();
  });

  it('opens the chat the link names, once the session has said which it has', async () => {
    const t = await open();
    const controller = t.app.services.require(CONTROLLER);
    controller.open('ahp-session:/4e18');
    for (let i = 0; i < 8; i++) await t.settle();
    await controller.createChat('a side chat');
    for (let i = 0; i < 8; i++) await t.settle();
    const side = t.app.store.get<string>(CHAT_URI) ?? '';
    expect(side).not.toBe('');
    const chatId = idOf(side);
    // Away, and back through the link.
    controller.open('ahp-session:/1f0a');
    for (let i = 0; i < 8; i++) await t.settle();
    expect(await controller.openLink(`agent-host-session://claude/4e18?chat=${encodeURIComponent(chatId)}`)).toBe(true);
    for (let i = 0; i < 8; i++) await t.settle();
    expect(t.app.store.get<string>(OPEN)).toBe('ahp-session:/4e18');
    expect(t.app.store.get<string>(CHAT_URI)).toBe(side);
    await t.unmount();
  });
});
