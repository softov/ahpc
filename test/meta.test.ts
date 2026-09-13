/*
 * What the reference host says in `_meta`, and this client reads.
 *
 * `_meta` is an open map on most protocol objects, and the protocol says only
 * that a client MAY look for well-known keys in it. The keys here are the ones
 * VS Code's agent host puts on the wire and its own window reads; a client
 * that ignores them draws a poorer row than the host paid for. Each is read
 * at the projection, never at the view, so a host that spells one differently
 * costs one line here rather than a hunt through the screens.
 */

import { describe, expect, it } from 'vitest';
import { CHAT, SESSION, connect, settle } from './scenario.js';
import type { ToolCall } from '../src/ahp/types.js';

/** The tool call a reader is showing, by id, running turn first. */
const callOf = (
  view: ReturnType<ReturnType<Awaited<ReturnType<typeof connect>>['read']>['view']>,
  id: string,
): ToolCall | undefined => {
  const turns = [...(view?.active === undefined ? [] : [view.active]), ...(view?.turns ?? [])];
  for (const turn of turns) {
    for (const part of turn.parts) {
      if (part.kind === 'toolCall' && part.call.id === id) return part.call;
    }
  }
  return undefined;
};

describe('a running tool call with a progress line', () => {
  const start = {
    type: 'chat/toolCallStart',
    turnId: 't1',
    toolCallId: 'c1',
    toolName: 'Task',
    displayName: 'Explore',
    intention: 'look for the bug',
    _meta: { toolKind: 'subagent' },
  };
  /** Auto-confirmed: the call goes from `streaming` straight to `running`. */
  const ready = {
    type: 'chat/toolCallReady', turnId: 't1', toolCallId: 'c1',
    invocationMessage: 'look for the bug', confirmed: 'not-needed',
    _meta: { toolKind: 'subagent' },
  };

  it('reads it while the call runs', async () => {
    const { host, scripted, read } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
    scripted.states.set(CHAT, { turns: [] });
    const reader = read();
    await settle();

    await scripted.act(CHAT, {
      type: 'chat/turnStarted', turnId: 't1', startedAt: new Date().toISOString(),
      message: { text: 'find it', origin: { kind: 'user' } },
    });
    await scripted.act(CHAT, start);
    await scripted.act(CHAT, ready);
    await settle();
    expect(callOf(reader.view(), 'c1')?.status).toBe('running');
    expect(callOf(reader.view(), 'c1')?.progress).toBeUndefined();

    await scripted.act(CHAT, {
      type: 'chat/toolCallContentChanged', turnId: 't1', toolCallId: 'c1', content: [],
      _meta: { toolKind: 'subagent', progressMessage: 'Grep: reading input.c' },
    });
    await settle();
    expect(callOf(reader.view(), 'c1')?.progress).toBe('Grep: reading input.c');

    reader.close();
    await host.close();
  });

  it('drops it once the call is over, whatever the host left on the call', async () => {
    const { host, scripted, read } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
    scripted.states.set(CHAT, { turns: [] });
    const reader = read();
    await settle();

    await scripted.act(CHAT, {
      type: 'chat/turnStarted', turnId: 't1', startedAt: new Date().toISOString(),
      message: { text: 'find it', origin: { kind: 'user' } },
    });
    await scripted.act(CHAT, start);
    await scripted.act(CHAT, ready);
    await scripted.act(CHAT, {
      type: 'chat/toolCallContentChanged', turnId: 't1', toolCallId: 'c1', content: [],
      _meta: { toolKind: 'subagent', progressMessage: 'Grep: reading input.c' },
    });
    // A host that forgets to strip the line when the call ends: the line
    // describes a state the call is no longer in, and is not shown.
    await scripted.act(CHAT, {
      type: 'chat/toolCallComplete', turnId: 't1', toolCallId: 'c1',
      result: { success: true, pastTenseMessage: 'looked', content: [] },
      _meta: { toolKind: 'subagent', progressMessage: 'Grep: reading input.c' },
    });
    await settle();
    const call = callOf(reader.view(), 'c1');
    expect(call?.status).toBe('completed');
    expect(call?.progress).toBeUndefined();

    reader.close();
    await host.close();
  });
});
