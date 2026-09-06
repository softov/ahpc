/*
 * Lifecycles, end to end, with the timing under the test's control.
 *
 * The unit suites each hold one thing still and vary another. These hold
 * nothing still: a session is created, spoken to and read back; a snapshot is
 * held while the reader that asked for it leaves and another arrives; a socket
 * drops in the middle of a turn and comes back. Every one of those is a real
 * sequence a person can produce in a minute of use, and none of them is
 * reachable through a fake that answers immediately.
 *
 * Each ends by comparing the reader against what the host is holding, because
 * a client that agrees with the host has neither dropped an action nor
 * invented one, and that is the property all three are really about.
 */

import { describe, expect, it } from 'vitest';
import { CHAT, ROOT, SESSION, connect, heldByHost, settle } from './scenario.js';

/** A turn the host has started and not finished, as a streaming reply is. */
const running = (id: string, said: string): Record<string, unknown> => ({
  type: 'chat/turnStarted',
  turnId: id,
  startedAt: new Date().toISOString(),
  message: { text: said, origin: { kind: 'user' } },
});

describe('a session is created, spoken to, and read back', () => {
  it('shows the turn the host started, and agrees with it on how much there is', async () => {
    const { host, scripted, read } = await connect();

    /*
     * The client names it, not the host.
     *
     * `createSession` carries the new session's URI as the channel it is
     * addressed to, so what comes back is what this client chose. A scenario
     * that set up state under a URI of its own would be scripting a session
     * nobody opened.
     */
    const made = await host.createSession({ provider: 'claude', workingDirectory: '/work' });
    expect(made.startsWith('claude:/')).toBe(true);
    const chat = `ahp-chat:/${made.slice(made.lastIndexOf('/') + 1)}`;
    scripted.states.set(made, { defaultChat: chat, chats: [{ resource: chat, title: 'Chat' }], status: 1 });
    scripted.states.set(chat, { turns: [] });

    const reader = read(made);
    await settle();
    // Nothing said yet, and a client that shows a row here is showing one the
    // host does not have.
    expect(reader.turns()).toBe(0);

    host.say(made as never, 'what is in this directory');
    scripted.states.set(chat, {
      turns: [{
        id: 't1',
        startedAt: new Date().toISOString(),
        state: 'complete',
        message: { text: 'what is in this directory', origin: { kind: 'user' } },
        responseParts: [{ kind: 'markdown', id: 'p1', content: 'four files' }],
      }],
    });
    await scripted.act(chat, {
      type: 'chat/turnsLoaded',
      turns: (scripted.states.get(chat)?.turns as unknown[]),
      cursor: undefined,
    });
    await settle();

    // What the host holds, counted the way a reader counts it: the question is
    // one row and the answer is another.
    expect(reader.turns()).toBe(heldByHost(scripted, chat));
    expect(reader.view()?.turns.some((turn) => turn.message === 'what is in this directory')).toBe(true);

    reader.close();
    await host.close();
  });
});

describe('a snapshot held while its reader leaves', () => {
  it('is released to the reader that arrived after it, not lost with the one that left', async () => {
    const { host, scripted, read } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
    scripted.states.set(CHAT, { turns: [] });
    // The subscribe goes out and is not answered, which is a host that has to
    // restore a session before it can say anything about it. The chat answers
    // normally: what is under test is the reader that arrives while the
    // session is still being restored, not a host that is slow twice.
    scripted.slow.add(SESSION);

    const leaving = read();
    await settle();
    leaving.close();

    // Arriving into the gap: the request is already in flight, so this reader
    // is waiting on an answer it did not ask for.
    const staying = read();
    await settle();
    expect(staying.turns()).toBe(0);

    await scripted.release();
    await settle();

    // The one that left is told nothing more, and the one that stayed sees the
    // conversation - the failure this covers is the opposite of both.
    expect(staying.view()).toBeDefined();
    expect(leaving.seen.filter((event) => event.type === 'snapshot')).toHaveLength(0);
    expect(staying.turns()).toBe(heldByHost(scripted));

    staying.close();
    await settle();
    // And nothing is left subscribed but the catalogue, which is what says the
    // held request was released rather than leaked.
    expect(scripted.stillOpen()).toEqual([ROOT]);

    await host.close();
  });
});

describe('a reader that arrives while the socket is down', () => {
  /*
   * The reader nobody had written a test for.
   *
   * This used to subscribe to nothing: the channel went into the reconnect's
   * list of subscriptions to resume, the host had never been sent one for it,
   * and the replay that came back was taken as covering it - so it was marked
   * open, never asked for, and its reader waited for a snapshot nobody was
   * going to send. `state()` said `connected` throughout. A person produces
   * it by pressing enter on a session while the daemon is restarting.
   */
  it('is subscribed once the connection comes back', async () => {
    const { host, reopen, read } = await connect((one) => {
      one.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
      one.states.set(CHAT, { turns: [{
        id: 't0',
        startedAt: new Date().toISOString(),
        state: 'complete',
        message: { text: 'from before', origin: { kind: 'user' } },
        responseParts: [{ kind: 'markdown', id: 'p0', content: 'an answer' }],
      }] });
    });

    await reopen().drop();
    const reader = read();
    // Long enough for the reconnect and then some: what this is asserting is
    // that the reader is never subscribed, not that it is slow.
    await settle(200);

    expect(host.state()).toBe('connected');
    expect(reader.turns()).toBe(heldByHost(reopen()));

    reader.close();
    await host.close();
  });
});

describe('a socket that drops in the middle of a turn', () => {
  it('comes back holding what the turn had reached, with nothing counted twice', async () => {
    const { host, scripted, read } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 30 });
    scripted.states.set(CHAT, { turns: [] });

    const reader = read();
    await settle();

    await scripted.act(CHAT, running('t1', 'summarise this repository'));
    await settle();
    const during = reader.turns();
    expect(during).toBeGreaterThan(0);

    /*
     * The host's own view moves on while the client is not listening, which is
     * the case a replay has to get right: the actions the client missed are
     * the ones between the sequence it last saw and the one it comes back to.
     */
    scripted.states.set(CHAT, {
      turns: [],
      activeTurn: {
        id: 't1',
        startedAt: new Date().toISOString(),
        state: 'running',
        message: { text: 'summarise this repository', origin: { kind: 'user' } },
        responseParts: [{ kind: 'markdown', id: 'p1', content: 'reading the files' }],
      },
    });
    await scripted.drop();
    await settle();
    await settle();

    // Back, and holding what the host holds. A replay applied twice would
    // count the turn twice, and a snapshot that replaced the view would drop
    // what arrived before the drop; the same number covers both.
    expect(reader.turns()).toBe(heldByHost(scripted));
    expect(reader.view()?.active?.message ?? reader.view()?.turns.at(-1)?.message).toBeDefined();

    reader.close();
    await host.close();
  });
});
