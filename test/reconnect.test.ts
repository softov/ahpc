/*
 * What happens to a client when the socket goes.
 *
 * Everything else in this suite drives `fakeHost`, which implements the seam
 * `live.ts` produces rather than the protocol underneath it - so a defect in
 * the protocol half is invisible to all of it. These tests drive `liveHost`
 * itself over an in-memory transport, with a host scripted frame by frame, and
 * assert on the frames rather than on the screen.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryTransport, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import { liveHost } from '../src/ahp/live.js';
import type { HostEvent } from '../src/ahp/connection.js';

const ROOT = 'ahp-root://';
const AUTOMATIONS = 'ahp-automations://';
const SESSION = 'ahp-session:/s1';
const CHAT = 'ahp-chat:/s1';

interface Frame {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * A host, scripted frame by frame.
 *
 * It answers only what these tests need and records everything it was asked,
 * which is the point: `unsubscribe` is a notification with no reply, so the
 * only way to know it was sent is to have been the thing it was sent to.
 */
class Scripted {
  /** Every request and notification this host was sent, in order. */
  readonly asked: Frame[] = [];
  /** The state each channel answers a `subscribe` with. */
  readonly states = new Map<string, Record<string, unknown>>();
  /** Channels to refuse, and the words to refuse them in. */
  readonly refuse = new Map<string, string>();
  /** The catalogue this host answers `listSessions` from, in pages of fifty. */
  catalogue: Record<string, unknown>[] = [];
  /** What the next `reconnect` answers. */
  reconnectWith: Record<string, unknown> = { type: 'replay', actions: [], missing: [] };
  /** An error to answer `reconnect` with instead, as a restarted host does. */
  refuseReconnect: { code: number; message: string } | null = null;
  /** Resolved once a `reconnect` has been answered. */
  reconnected: Promise<Frame>;
  private announceReconnect!: (frame: Frame) => void;
  private seq = 10;
  private running = true;

  constructor(private readonly transport: AhpTransport) {
    this.reconnected = new Promise((resolve) => { this.announceReconnect = resolve; });
    this.states.set(ROOT, { agents: [], terminals: [] });
    this.states.set(AUTOMATIONS, { entries: [] });
    void this.run();
  }

  /** Every frame of one method, for asserting how many times it was sent. */
  timesAsked(method: string, channel?: string): number {
    return this.asked.filter((frame) => frame.method === method
      && (channel === undefined || frame.params?.channel === channel)).length;
  }

  /** Push a state action at the client, as a host does between requests. */
  async act(channel: string, action: Record<string, unknown>): Promise<void> {
    this.seq += 1;
    await this.send({
      jsonrpc: '2.0',
      method: 'action',
      params: { channel, action, serverSeq: this.seq },
    });
  }

  /** The counter this host has reached, which a reconnect is measured against. */
  get serverSeq(): number { return this.seq; }

  /** Hang up, the way a daemon that has been killed does. */
  async drop(): Promise<void> {
    this.running = false;
    await this.transport.close();
  }

  private async send(message: Record<string, unknown>): Promise<void> {
    await this.transport.send(JSON.stringify(message));
  }

  private async run(): Promise<void> {
    while (this.running) {
      let frame: Awaited<ReturnType<AhpTransport['recv']>>;
      try { frame = await this.transport.recv(); }
      catch { return; }
      if (frame === null) return;
      const text = frame.kind === 'text' ? frame.text
        : frame.kind === 'parsed' ? JSON.stringify(frame.message) : '';
      const message = JSON.parse(text) as Frame;
      this.asked.push(message);
      await this.answer(message);
    }
  }

  private async answer(message: Frame): Promise<void> {
    const { id, method } = message;
    const reply = async (result: unknown): Promise<void> => {
      if (id === undefined) return;
      await this.send({ jsonrpc: '2.0', id, result });
    };

    if (method === 'initialize') {
      await reply({ protocolVersion: '0.9.0', serverSeq: this.seq, snapshots: [] });
      return;
    }
    if (method === 'reconnect') {
      this.announceReconnect(message);
      if (this.refuseReconnect !== null) {
        if (id !== undefined) {
          await this.send({ jsonrpc: '2.0', id, error: this.refuseReconnect });
        }
        return;
      }
      await reply(this.reconnectWith);
      return;
    }
    if (method === 'subscribe') {
      const channel = String(message.params?.channel ?? '');
      const said = this.refuse.get(channel);
      if (said !== undefined) {
        if (id !== undefined) {
          await this.send({ jsonrpc: '2.0', id, error: { code: -32001, message: said } });
        }
        return;
      }
      await reply({ snapshot: { resource: channel, state: this.states.get(channel) ?? {}, fromSeq: this.seq } });
      return;
    }
    if (method === 'listSessions') {
      const cursor = message.params?.cursor as string | undefined;
      const page = cursor === undefined ? 0 : Number(cursor);
      const rows = this.catalogue.slice(page * 50, (page + 1) * 50);
      const next = (page + 1) * 50 < this.catalogue.length ? String(page + 1) : undefined;
      await reply({ items: rows, ...(next === undefined ? {} : { nextCursor: next }) });
      return;
    }
    if (method === 'ping') { await reply(null); return; }
    // `unsubscribe` and `dispatchAction` are notifications: recorded above,
    // and answered with the silence the protocol asks for.
  }
}

/** A live client against a scripted host, with the waiting turned off. */
async function connect(): Promise<{
  host: Awaited<ReturnType<typeof liveHost>>;
  scripted: Scripted;
  reopen(): Scripted;
}> {
  let scripted!: Scripted;
  const open = async (): Promise<AhpTransport> => {
    const [mine, theirs] = InMemoryTransport.pair();
    scripted = new Scripted(theirs);
    return mine;
  };
  const host = await liveHost({
    url: 'ws://scripted',
    clientId: 'ahpc-test',
    connect: open,
    backoff: [0],
    keepaliveMs: 0,
  });
  return { host, scripted, reopen: () => scripted };
}

/** Let the microtasks and the zero-delay timers behind a reconnect run out. */
async function settle(times = 12): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => { setTimeout(resolve, 1); });
}

describe('a channel is let go when the last reader leaves', () => {
  it('unsubscribes the session and its chat once the view closes', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }] });
    scripted.states.set(CHAT, { turns: [] });

    // What the host logs on accept and on departure, so a run on each side
    // names the same connection.
    expect(host.id).toBe('ahpc-test');

    const view = host.subscribe(SESSION as never, () => undefined);
    await settle();
    expect(scripted.timesAsked('subscribe', SESSION)).toBe(1);
    expect(scripted.timesAsked('subscribe', CHAT)).toBe(1);
    expect(scripted.timesAsked('unsubscribe', SESSION)).toBe(0);

    view.close();
    await settle();
    expect(scripted.timesAsked('unsubscribe', SESSION)).toBe(1);
    expect(scripted.timesAsked('unsubscribe', CHAT)).toBe(1);

    await host.close();
  });

  it('holds the channel while a second reader still has it', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });

    const one = host.subscribe(SESSION as never, () => undefined);
    const two = host.subscribe(SESSION as never, () => undefined);
    await settle();
    // One subscribe for two readers: a second is a second answer to a
    // question that is already being answered.
    expect(scripted.timesAsked('subscribe', SESSION)).toBe(1);

    one.close();
    await settle();
    expect(scripted.timesAsked('unsubscribe', SESSION)).toBe(0);

    two.close();
    await settle();
    expect(scripted.timesAsked('unsubscribe', SESSION)).toBe(1);

    await host.close();
  });
});

describe('a dropped socket is a pause, not an ending', () => {
  it('asks to resume where it left off, under the same name', async () => {
    const states: string[] = [];
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted',
      clientId: 'ahpc-test',
      connect: open,
      backoff: [0],
      keepaliveMs: 0,
      onState: (state) => states.push(state),
    });
    const first = scripted;
    first.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    first.states.set(CHAT, { turns: [] });
    host.subscribe(SESSION as never, () => undefined);
    await settle();
    await first.act(SESSION, { type: 'session/isReadChanged', isRead: true });
    await settle();

    await first.drop();
    await settle(40);

    const asked = await scripted.reconnected;
    expect(asked.params?.clientId).toBe('ahpc-test');
    // The counter it had reached, not the one it started at: a resume that
    // asks from zero is a client asking to be told everything again.
    expect(asked.params?.lastSeenServerSeq).toBe(first.serverSeq);
    expect(asked.params?.subscriptions).toContain(SESSION);
    expect(asked.params?.subscriptions).toContain(ROOT);
    expect(states).toContain('connecting');
    expect(host.state()).toBe('connected');

    await host.close();
  });

  it('applies what it missed, and does not subscribe again', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      // The second connection answers with the turn that happened while the
      // client was away.
      if (scripted.asked.length === 0 && theirs) {
        scripted.reconnectWith = {
          type: 'replay',
          actions: [{
            channel: CHAT,
            action: { type: 'chat/turnStarted', turnId: 't1', startedAt: new Date().toISOString(), message: { text: 'while you were out', origin: { kind: 'user' } } },
            serverSeq: 99,
          }],
          missing: [],
        };
      }
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
    });
    const first = scripted;
    first.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    first.states.set(CHAT, { turns: [] });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();
    const before = scripted.timesAsked('subscribe', CHAT);

    await first.drop();
    await settle(40);
    await scripted.reconnected;
    await settle();

    // Replay is what a host sends *instead of* a snapshot, so the channels
    // behind it are ones it restored itself.
    expect(scripted.timesAsked('subscribe', CHAT)).toBe(0);
    expect(before).toBe(1);
    expect(seen.length).toBeGreaterThan(0);

    await host.close();
  });

  it('rebuilds from a snapshot when the gap was too long to replay', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      scripted.reconnectWith = {
        type: 'snapshot',
        snapshots: [
          { resource: ROOT, state: { agents: [], terminals: [] }, fromSeq: 500 },
          { resource: SESSION, state: { defaultChat: CHAT, chats: [], status: 2 }, fromSeq: 500 },
        ],
      };
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
    });
    const first = scripted;
    first.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    first.states.set(CHAT, { turns: [] });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();
    seen.length = 0;

    await first.drop();
    await settle(40);
    await scripted.reconnected;
    await settle();

    // The session came back in the snapshot; the chat did not, so it is the
    // one channel that has to be asked for again.
    expect(seen.length).toBeGreaterThan(0);
    expect(scripted.timesAsked('subscribe', CHAT)).toBe(1);

    await host.close();
  });

  it('starts again when the host has never heard of it', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      // A daemon restarted between the drop and now: it holds no state for
      // this client, and says so rather than resuming something it lost.
      scripted.refuseReconnect = { code: -32008, message: 'Unknown client' };
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
    });
    const first = scripted;
    first.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    first.states.set(CHAT, { turns: [] });
    host.subscribe(SESSION as never, () => undefined);
    await settle();

    await first.drop();
    await settle(40);
    await scripted.reconnected;
    await settle();

    // A refused resume is not a dead end: the connection is made again from
    // the beginning, carrying the channels that were being held.
    const hello = scripted.asked.find((frame) => frame.method === 'initialize');
    expect(hello).toBeDefined();
    expect(hello?.params?.initialSubscriptions).toContain(SESSION);
    expect(host.state()).toBe('connected');

    await host.close();
  });

  it('stops trying once it has been closed on purpose', async () => {
    let opened = 0;
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      opened += 1;
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [50], keepaliveMs: 0,
    });
    await settle();
    expect(opened).toBe(1);

    await host.close();
    await settle(40);

    // Hanging up is not a drop. A client that reconnects after being closed
    // is one that will not let a person quit.
    expect(opened).toBe(1);
    expect(host.state()).toBe('offline');
  });
});

describe('the catalogue is walked to its end', () => {
  /** One row in the shape `summary()` reads. */
  const row = (n: number): Record<string, unknown> => ({
    resource: `ahp-session:/s${n}`,
    provider: 'claude',
    title: `Session ${n}`,
    status: 1,
    workingDirectories: ['file:///tmp'],
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  });

  it('follows nextCursor instead of stopping at the first page', async () => {
    const { host, scripted } = await connect();
    // 123 is Softov's own catalogue, and the number this used to show 100 of.
    scripted.catalogue = Array.from({ length: 123 }, (_, i) => row(i));

    const rows = await host.listSessions();
    expect(rows.length).toBe(123);
    // Three pages of fifty, so three requests and no fourth.
    expect(scripted.timesAsked('listSessions')).toBe(3);

    await host.close();
  });

  it('says so when it stops short rather than showing a short list', async () => {
    const said: string[] = [];
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      scripted.catalogue = Array.from({ length: 5000 }, (_, i) => row(i));
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted',
      clientId: 'ahpc-test',
      connect: open,
      backoff: [0],
      keepaliveMs: 0,
      onLimit: (message) => said.push(message),
    });

    const rows = await host.listSessions();
    // Twenty pages of fifty, and a sentence about the rest.
    expect(rows.length).toBe(1000);
    expect(said.length).toBe(1);
    expect(said[0]).toContain('has more');

    await host.close();
  });
});
