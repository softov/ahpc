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
  /** Whether `initialize` advertises the automations capability. */
  automations = false;
  /** Turns this host is holding behind the window, oldest last. */
  behind: unknown[] = [];
  /** The cursor sent with each `fetchTurns`, in order. */
  readonly fetched: string[] = [];
  /**
   * Channels whose `subscribe` is held until `release`, as a restore from
   * disk is, and which cancel one another the way the reference host does.
   */
  readonly slow = new Set<string>();
  /** The held `subscribe` for each slow channel, by request id. */
  private readonly holding = new Map<string, number | string>();
  /** The channel a `createResourceWatch` is answered with. Receiver-assigned. */
  watchChannel = 'ahp-resource-watch:/default';
  /** What `initialize` advertises under `telemetry`, if anything. */
  telemetry: Record<string, string> | null = null;
  /** An error to refuse a subscribe with, in place of the plain `-32001`. */
  refuseWith: Record<string, unknown> | null = null;
  /** What `resourceResolve` answers. */
  resolveWith: Record<string, unknown> = { uri: 'file:///x', type: 'file' };
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

  /**
   * The channels this host would still be sending on.
   *
   * Every `subscribe` this client sent that it has not since released, in the
   * order it took them. Derived from the frames rather than kept as state, so
   * what it reports is what the client actually said: a reader whose release
   * lost its `unsubscribe` leaves its channel here for the rest of the run,
   * which a per-method count cannot show.
   */
  stillOpen(): string[] {
    const held: string[] = [];
    for (const frame of this.asked) {
      // The handshake opens channels without a `subscribe` of their own -
      // that saved round trip is the point of `initialSubscriptions` - so a
      // count that reads only `subscribe` frames misses the catalogue.
      if (frame.method === 'initialize') {
        for (const channel of (frame.params?.initialSubscriptions as string[] | undefined) ?? []) {
          if (!held.includes(channel)) held.push(channel);
        }
      }
      const channel = frame.params?.channel;
      if (typeof channel !== 'string') continue;
      if (frame.method === 'subscribe' && !held.includes(channel)) held.push(channel);
      if (frame.method === 'unsubscribe' && held.includes(channel)) held.splice(held.indexOf(channel), 1);
    }
    return held;
  }

  /** Every frame of one method, for asserting how many times it was sent. */
  timesAsked(method: string, channel?: string): number {
    return this.asked.filter((frame) => frame.method === method
      && (channel === undefined || frame.params?.channel === channel)).length;
  }

  /** Emit one OTLP log batch, in the shape the specification's example has. */
  async logs(): Promise<void> {
    await this.send({
      jsonrpc: '2.0',
      method: 'otlp/exportLogs',
      params: {
        channel: 'ahp-otlp://logs',
        payload: {
          resourceLogs: [{
            resource: { attributes: [{ key: 'service.name', value: { stringValue: 'ahp-agent-host' } }] },
            scopeLogs: [{
              scope: { name: 'agent-host.tools' },
              logRecords: [{
                timeUnixNano: '1736870400000000000',
                severityNumber: 9,
                severityText: 'INFO',
                body: { stringValue: 'tool call started' },
                attributes: [{ key: 'tool.name', value: { stringValue: 'read_file' } }],
              }],
            }],
          }],
        },
      },
    });
  }

  /** Say a protected resource needs a token, as `auth/required` does. */
  async authRequired(resource: string, reason?: string): Promise<void> {
    await this.send({
      jsonrpc: '2.0',
      method: 'auth/required',
      params: { channel: ROOT, resource: { resource }, ...(reason === undefined ? {} : { reason }) },
    });
  }

  /** Say how far along a piece of work is, against the token a client sent. */
  async progress(token: string, progress: number, total?: number, message?: string): Promise<void> {
    await this.send({
      jsonrpc: '2.0',
      method: 'root/progress',
      params: {
        channel: ROOT,
        progressToken: token,
        progress,
        ...(total === undefined ? {} : { total }),
        ...(message === undefined ? {} : { message }),
      },
    });
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

  /**
   * Refuse an action a client dispatched, the way a host answers one it will
   * not take: the action it did *not* apply, and its words for why.
   *
   * `serverSeq` deliberately does not move, because no state did.
   */
  async reject(
    channel: string,
    action: Record<string, unknown>,
    reason: string,
    clientId = 'ahpc-test',
  ): Promise<void> {
    await this.send({
      jsonrpc: '2.0',
      method: 'action',
      params: {
        channel,
        action,
        serverSeq: this.seq,
        origin: { clientId, clientSeq: 1 },
        rejectionReason: reason,
      },
    });
  }

  /** The counter this host has reached, which a reconnect is measured against. */
  get serverSeq(): number { return this.seq; }

  /** Answer every `subscribe` this host is holding. */
  async release(): Promise<void> {
    const waiting = [...this.holding];
    this.holding.clear();
    for (const [channel, id] of waiting) {
      await this.send({
        jsonrpc: '2.0',
        id,
        result: { snapshot: { resource: channel, state: this.states.get(channel) ?? {}, fromSeq: this.seq } },
      });
    }
  }

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
      // What `lifecycle.md` says the handshake answers with: a snapshot for
      // every channel named in `initialSubscriptions`, in the same round trip.
      const asked = (message.params?.initialSubscriptions as string[] | undefined) ?? [];
      await reply({
        protocolVersion: '0.9.0',
        serverSeq: this.seq,
        snapshots: asked.map((channel) => ({
          resource: channel,
          state: this.states.get(channel) ?? {},
          fromSeq: this.seq,
        })),
        ...(this.automations ? { automations: {} } : {}),
        ...(this.telemetry === null ? {} : { telemetry: this.telemetry }),
      });
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
          await this.send({
            jsonrpc: '2.0',
            id,
            error: this.refuseWith ?? { code: -32001, message: said },
          });
        }
        return;
      }
      if (this.slow.has(channel) && id !== undefined) {
        /*
         * What the reference host does with two subscribes to one channel.
         *
         * It puts a pending marker under the channel while it restores, and a
         * subscribe arriving before that one resolves replaces the marker - so
         * the first finds itself no longer current and is answered `Resource
         * not found`, naming a channel that is there. Held here for the same
         * reason: it is the overlap that collides, and a re-subscribe to a
         * channel already open is idempotent there.
         */
        const earlier = this.holding.get(channel);
        this.holding.set(channel, id);
        if (earlier !== undefined) {
          await this.send({
            jsonrpc: '2.0',
            id: earlier,
            error: { code: -32001, message: `Resource not found: ${channel}` },
          });
        }
        return;
      }
      await reply({ snapshot: { resource: channel, state: this.states.get(channel) ?? {}, fromSeq: this.seq } });
      return;
    }
    if (method === 'fetchTurns') {
      this.fetched.push(String(message.params?.cursor ?? ''));
      const chat = this.states.get(CHAT) ?? {};
      const loaded = (chat.turns as unknown[] | undefined) ?? [];
      const page = this.behind.splice(-2);
      // A host inserts the turns into state and updates the cursor *before*
      // it answers, which is the whole reason the result is empty.
      // Rebuilt rather than spread over: the host MUST *clear* the cursor when
      // the last page has gone, and spreading the old state carries it.
      const { turnsNextCursor: _gone, ...rest } = chat as Record<string, unknown>;
      this.states.set(CHAT, {
        ...rest,
        turns: [...page, ...loaded],
        ...(this.behind.length > 0 ? { turnsNextCursor: `c${this.behind.length}` } : {}),
      });
      await reply({});
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
    if (method === 'createSession') { await reply(null); return; }
    if (method === 'authenticate') { await reply({}); return; }
    if (method === 'createResourceWatch') { await reply({ channel: this.watchChannel }); return; }
    if (method === 'resourceResolve') { await reply(this.resolveWith); return; }
    if (method !== undefined && method.startsWith('resource')) { await reply({}); return; }
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
    lingerMs: 0,
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
    // And nothing but the catalogue is left open, which the counts above
    // cannot say: they are about two channels this test named, and a leak is
    // a channel nobody thought to name.
    expect(scripted.stillOpen()).toEqual([ROOT]);

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
    expect(scripted.stillOpen()).toEqual([ROOT]);

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

describe('an expected answer is not reported as a fault', () => {
  it('does not ask for automations a host never advertised', async () => {
    const { host, scripted } = await connect();
    await settle();

    // Presence of `InitializeResult.automations` is what permits the channel,
    // so its absence is the answer and asking anyway is a known refusal.
    expect(scripted.timesAsked('subscribe', AUTOMATIONS)).toBe(0);

    await host.close();
  });

  it('asks where the host did advertise them', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      scripted.automations = true;
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
    });
    await settle();

    expect(scripted.timesAsked('subscribe', AUTOMATIONS)).toBe(1);

    await host.close();
  });

  it('keeps a refusal a reader claimed out of the connection report', async () => {
    const reported: string[] = [];
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      // A session in the catalogue whose channel the host will not serve -
      // which is the ordinary case against a host that lists more than it
      // will open.
      scripted.refuse.set(SESSION, 'No agent for session: ' + SESSION);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted',
      clientId: 'ahpc-test',
      connect: open,
      backoff: [0],
      keepaliveMs: 0,
      onRefusal: (_uri, message) => reported.push(message),
    });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();

    // The transcript says so, because that is where a person is looking.
    expect(seen.some((event) => event.type === 'error')).toBe(true);
    // The connection does not, because it was not the connection's to report.
    expect(reported).toEqual([]);

    await host.close();
  });
});

describe('history is read past the window a host opened with', () => {
  const turn = (n: number): Record<string, unknown> => ({
    id: `t${n}`,
    startedAt: new Date().toISOString(),
    message: { text: `turn ${n}`, origin: { kind: 'user' } },
  });

  it('asks for the page behind the window, carrying the host cursor', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [turn(9)], turnsNextCursor: 'c4' });
    scripted.behind = [turn(5), turn(6), turn(7), turn(8)];

    // Two behind remain after one page of two, so it says there is more.
    expect(await host.loadOlderTurns(SESSION as never)).toBe(true);
    expect(scripted.fetched).toEqual(['c4']);

    // And nothing remains after the second, so it says so.
    expect(await host.loadOlderTurns(SESSION as never)).toBe(false);
    expect(scripted.fetched.length).toBe(2);

    await host.close();
  });

  it('asks once on opening when the host sent an empty window', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    // What VS Code's host does: the channel resolves, the window is empty,
    // and a cursor says the conversation is there for the asking.
    scripted.states.set(CHAT, { turns: [], turnsNextCursor: 'c2' });
    scripted.behind = [turn(1), turn(2)];

    host.subscribe(SESSION as never, () => undefined);
    await settle();

    // Without this the transcript is blank and no amount of waiting fills it.
    expect(scripted.fetched).toEqual(['c2']);

    await host.close();
  });

  it('leaves a chat that arrived with turns alone', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [turn(9)], turnsNextCursor: 'c1' });
    scripted.behind = [turn(8)];

    host.subscribe(SESSION as never, () => undefined);
    await settle();

    // Reading further back is the person's business, not this client's.
    expect(scripted.fetched).toEqual([]);

    await host.close();
  });
});

describe('the one thing that moved between 0.9.0 and 1.0.0', () => {
  /*
   * Everything else this client reads is byte-identical across the two
   * versions - 96 action types, 41 method names, and the fields of
   * `ChatState`, `Turn`, `ActiveTurn`, `SessionState` and `RootState`. What
   * moved is the automations catalogue: `entries` under 0.9.0 and
   * `automations` under 1.0.0, holding the very same automation shape.
   */
  const one = {
    resource: 'ahp-automation:/a1',
    definition: { name: 'Nightly', enabled: true, trigger: { kind: 'schedule', expression: '0 2 * * *' } },
    runs: [],
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };

  const open = (state: Record<string, unknown>) => async (): Promise<AhpTransport> => {
    const [mine, theirs] = InMemoryTransport.pair();
    const scripted = new Scripted(theirs);
    scripted.automations = true;
    scripted.states.set(AUTOMATIONS, state);
    return mine;
  };

  it('reads a 0.9.0 catalogue', async () => {
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open({ entries: [one] }),
      backoff: [0], keepaliveMs: 0,
    });
    await settle();
    expect((await host.automations?.() ?? []).length).toBe(1);
    await host.close();
  });

  it('reads a 1.0.0 catalogue, which is the one this client negotiates with VS Code', async () => {
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open({ automations: [one] }),
      backoff: [0], keepaliveMs: 0,
    });
    await settle();
    expect((await host.automations?.() ?? []).length).toBe(1);
    await host.close();
  });
});

describe('the first snapshot is not sent before the conversation is in it', () => {
  const turn = (n: number): Record<string, unknown> => ({
    id: `t${n}`,
    startedAt: new Date().toISOString(),
    message: { text: `turn ${n}`, origin: { kind: 'user' } },
  });

  it('carries the turns, because a reader that takes the first one and stops gets them', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [turn(1), turn(2)] });

    // A session and its chat are two channels and the session answers first.
    // `session history` takes the first snapshot and closes, so a snapshot
    // emitted in between is one that reports an empty conversation.
    const first = await new Promise<HostEvent>((resolve) => {
      const view = host.subscribe(SESSION as never, (event) => {
        if (event.type === 'snapshot') { resolve(event); view.close(); }
      });
    });

    expect(first.type).toBe('snapshot');
    // Not a count: the transcript splits a turn into what was said and what
    // answered. What matters is that it is not empty, which is what it was.
    expect(first.type === 'snapshot' && first.turns.length > 0).toBe(true);

    await host.close();
  });

  it('still answers for a session that has no chat to wait for', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { chats: [] });

    const first = await new Promise<HostEvent>((resolve) => {
      const view = host.subscribe(SESSION as never, (event) => {
        if (event.type === 'snapshot') { resolve(event); view.close(); }
      });
    });
    expect(first.type).toBe('snapshot');

    await host.close();
  });
});

describe('a channel is not let go the instant a screen closes', () => {
  it('keeps it across a close and a reopen, so no unsubscribe lands in between', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open,
      backoff: [0], keepaliveMs: 0, lingerMs: 5_000,
    });
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });

    const first = host.subscribe(SESSION as never, () => undefined);
    await settle();
    first.close();
    await settle();

    /*
     * The reference host evicts a session from memory when its last
     * subscriber leaves and restores it from disk on the next subscribe, so a
     * client that unsubscribes and immediately subscribes again is racing
     * that restore - and losing it looks like `-32001` on a session that was
     * open a moment ago.
     */
    expect(scripted.timesAsked('unsubscribe', SESSION)).toBe(0);

    const second = host.subscribe(SESSION as never, () => undefined);
    await settle();
    expect(scripted.timesAsked('unsubscribe', SESSION)).toBe(0);

    second.close();
    await host.close();
  });

  it('lets it go once nobody has come back for it', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open,
      backoff: [0], keepaliveMs: 0, lingerMs: 20,
    });
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });

    const view = host.subscribe(SESSION as never, () => undefined);
    await settle();
    view.close();
    await new Promise((resolve) => { setTimeout(resolve, 60); });

    // Waiting is a pause before letting go, not a refusal to.
    expect(scripted.timesAsked('unsubscribe', SESSION)).toBe(1);

    await host.close();
  });
});

describe('reading a snapshot and opening the view do not let go in between', () => {
  it('sends no unsubscribe between the detail read and the subscription', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open,
      backoff: [0], keepaliveMs: 0, lingerMs: 5_000,
    });
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });

    // What opening a session does: read what the host says about it, then
    // watch it. The reference host evicts a session when its last subscriber
    // leaves, so an `unsubscribe` in this gap is the session being torn down
    // and rebuilt underneath the view that is about to ask for it.
    await host.detail(SESSION as never);
    const view = host.subscribe(SESSION as never, () => undefined);
    await settle();

    expect(scripted.timesAsked('unsubscribe', SESSION)).toBe(0);

    view.close();
    await host.close();
  });

  it('tries again when a session that was refused is opened on purpose', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      scripted.refuse.set(SESSION, 'Resource not found: ' + SESSION);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open,
      backoff: [0], keepaliveMs: 0, lingerMs: 0,
    });

    const one = host.subscribe(SESSION as never, () => undefined);
    await settle();
    one.close();
    await settle();
    const refusals = scripted.timesAsked('subscribe', SESSION);

    // The host has changed its mind - which is what a momentary eviction is.
    scripted.refuse.delete(SESSION);
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });

    const seen: HostEvent[] = [];
    const two = host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();

    // Asked again rather than replaying the refusal it remembered.
    expect(scripted.timesAsked('subscribe', SESSION)).toBeGreaterThan(refusals);
    expect(seen.some((event) => event.type === 'snapshot')).toBe(true);

    two.close();
    await host.close();
  });
});

describe('an action the host refuses is not an action that happened', () => {
  const started = (id: string): Record<string, unknown> => ({
    type: 'chat/turnStarted',
    turnId: id,
    startedAt: new Date().toISOString(),
    message: { text: `turn ${id}`, origin: { kind: 'user' } },
  });

  /** How much conversation the last snapshot had, which is what a rejection must not change. */
  const counted = (events: HostEvent[]): number => {
    const last = [...events].reverse().find((event) => event.type === 'snapshot');
    if (last?.type !== 'snapshot') return 0;
    return last.turns.length + (last.active === undefined ? 0 : 1);
  };

  async function watching(): Promise<{
    host: Awaited<ReturnType<typeof liveHost>>;
    scripted: Scripted;
    seen: HostEvent[];
    reported: string[];
  }> {
    const reported: string[] = [];
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
      scripted.states.set(CHAT, { turns: [] });
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted',
      clientId: 'ahpc-test',
      connect: open,
      backoff: [0],
      keepaliveMs: 0,
      lingerMs: 0,
      onRefusal: (_uri, message) => reported.push(message),
    });
    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();
    return { host, scripted, seen, reported };
  }

  it('says why, and leaves the state where the host left it', async () => {
    const { host, scripted, seen, reported } = await watching();

    // The same action twice: once refused, once not. Without the second half
    // this asserts nothing - an action that would not have applied anyway
    // looks exactly like one that was correctly dropped.
    await scripted.reject(CHAT, started('t1'), 'This chat is busy.');
    await settle();
    expect(reported).toEqual(['This chat is busy.']);
    expect(counted(seen)).toBe(0);

    await scripted.act(CHAT, started('t2'));
    await settle();
    expect(counted(seen)).toBeGreaterThan(0);

    await host.close();
  });

  it('keeps somebody else\'s refusal to itself', async () => {
    const { host, scripted, seen, reported } = await watching();

    // A host that sends a rejection to everyone watching rather than to the
    // client that dispatched it. Still not applied - it is an action nobody
    // took - and still not shown, because nobody here asked for it.
    await scripted.reject(CHAT, started('t1'), 'This chat is busy.', 'somebody-else');
    await settle();

    expect(reported).toEqual([]);
    expect(counted(seen)).toBe(0);

    await host.close();
  });
});

describe('one channel is asked for once, however many readers want it', () => {
  it('shares a subscribe between a detail read and the view opened on it', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [], lifecycle: 'ready' });
    scripted.states.set(CHAT, { turns: [] });
    // The session restores from disk rather than answering at once, which is
    // the window both readers land in.
    scripted.slow.add(SESSION);

    const reading = host.detail(SESSION as never);
    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle(3);

    // Two would be one refused. This is the whole defect: the host answers a
    // superseded subscribe with `-32001` naming a channel it is serving.
    expect(scripted.timesAsked('subscribe', SESSION)).toBe(1);

    await scripted.release();
    await settle();

    // Both readers are answered from the one subscribe: the pane has the
    // session, and the view has been handed its state rather than left to
    // wait for a snapshot nobody was going to send it.
    expect((await reading).lifecycle).toBe('ready');
    expect(seen.some((event) => event.type === 'snapshot')).toBe(true);
    expect(seen.some((event) => event.type === 'error')).toBe(false);

    await host.close();
  });

  it('reads the same row twice without refusing itself', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [], lifecycle: 'ready' });
    scripted.states.set(CHAT, { turns: [] });
    scripted.slow.add(SESSION);

    // A highlight moved off a row and back while the first read is still out.
    const first = host.detail(SESSION as never);
    const second = host.detail(SESSION as never);
    await settle(3);
    expect(scripted.timesAsked('subscribe', SESSION)).toBe(1);

    await scripted.release();
    await settle();

    expect((await first).lifecycle).toBe('ready');
    expect((await second).lifecycle).toBe('ready');
    // And nothing was cached as refused, which is what made the pane stay
    // broken for the rest of the connection.
    expect((await first).refusal).toBeUndefined();

    await host.close();
  });
});

describe('a model is read as the catalogue sends it', () => {
  const thinking = (levels: string[], labels: string[], fallback?: string): Record<string, unknown> => ({
    type: 'object',
    properties: {
      thinkingLevel: {
        type: 'string',
        title: 'Thinking Level',
        description: 'Controls how much reasoning effort Claude uses.',
        enum: levels,
        enumLabels: labels,
        ...(fallback === undefined ? {} : { default: fallback }),
      },
    },
  });

  async function catalogue(): Promise<Awaited<ReturnType<typeof liveHost>>> {
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      const scripted = new Scripted(theirs);
      scripted.states.set(ROOT, {
        agents: [{
          provider: 'claude',
          displayName: 'Claude Code',
          models: [
            {
              id: 'opus[1m]',
              name: 'Opus',
              provider: 'claude',
              configSchema: thinking(
                ['low', 'medium', 'high', 'xhigh', 'max'],
                ['Low', 'Medium', 'High', 'Extra High', 'Max'],
                'high',
              ),
            },
            // One level, and not the one anything defaults to - so the host
            // sends no `default` at all.
            { id: 'haiku', name: 'Haiku', provider: 'claude', configSchema: thinking(['low'], ['Low']) },
            // None: no schema, rather than an empty one.
            { id: 'sonnet', name: 'Sonnet', provider: 'claude' },
            // What a host that has not filled the required field in yet
            // sends. It was missing until recently, and every row of it is
            // still a model this client has to be able to read.
            { id: 'default', name: 'Default (recommended)' },
          ],
        }],
        terminals: [],
      });
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
    });
    await settle();
    return host;
  }

  it('takes the name, the provider and the levels the host named', async () => {
    const host = await catalogue();
    const [agent] = await host.agents();
    const models = agent?.models ?? [];

    // `name`, not the agent's `displayName` - a host's ids are things like
    // `opus[1m]`.
    expect(models.map((one) => one.displayName)).toEqual(['Opus', 'Haiku', 'Sonnet', 'Default (recommended)']);
    // Required by the protocol, and the agent's own where a host left it out.
    expect(models.every((one) => one.provider === 'claude')).toBe(true);

    // The host's words, by position. Nothing here keeps a list of its own.
    const levels = models[0]?.options?.[0];
    expect(levels?.title).toBe('Thinking Level');
    expect(levels?.values.map((one) => one.label))
      .toEqual(['Low', 'Medium', 'High', 'Extra High', 'Max']);
    expect(levels?.default).toBe('high');

    await host.close();
  });

  it('leaves a level nobody defaulted to without one', async () => {
    const host = await catalogue();
    const models = (await host.agents())[0]?.models ?? [];

    // The case a form that fills the gap in from the top of the list gets
    // wrong: one choice, and the host named no default among it.
    expect(models[1]?.options?.[0]?.values.map((one) => one.value)).toEqual(['low']);
    expect(models[1]?.options?.[0]?.default).toBeUndefined();
    // And a model whose harness reported no levels carries no schema, which
    // is not the same as carrying an empty one.
    expect(models[2]?.options).toBeUndefined();

    await host.close();
  });
});

describe('what a turn ran at is kept, not only which model', () => {
  it('carries the settings the host sent beside the id', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, {
      turns: [{
        id: 't1',
        startedAt: new Date().toISOString(),
        message: {
          text: 'answer',
          origin: { kind: 'agent' },
          // What the protocol calls `ModelSelection`: the model, and the
          // resolved answers to whatever the model's own schema asked.
          model: { id: 'opus[1m]', config: { thinkingLevel: 'xhigh' } },
        },
      }],
    });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();

    const snapshot = seen.find((event) => event.type === 'snapshot');
    const turn = snapshot?.type === 'snapshot'
      ? [...snapshot.turns, ...(snapshot.active ? [snapshot.active] : [])].find((one) => one.model)
      : undefined;
    // The id alone cannot say what an answer cost: a thinking level is chosen
    // per turn and holds from that turn onwards.
    expect(turn?.model?.id).toBe('opus[1m]');
    expect(turn?.model?.config).toEqual({ thinkingLevel: 'xhigh' });

    await host.close();
  });

  it('takes a model that came with nothing beside it', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, {
      turns: [{
        id: 't1',
        startedAt: new Date().toISOString(),
        message: { text: 'answer', origin: { kind: 'agent' }, model: { id: 'haiku' } },
      }],
    });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();

    const snapshot = seen.find((event) => event.type === 'snapshot');
    const turn = snapshot?.type === 'snapshot'
      ? [...snapshot.turns, ...(snapshot.active ? [snapshot.active] : [])].find((one) => one.model)
      : undefined;
    // Absent rather than empty, so nothing downstream has to tell an answer
    // with no settings from one whose settings were an empty object.
    expect(turn?.model?.id).toBe('haiku');
    expect(turn?.model?.config).toBeUndefined();

    await host.close();
  });
});

describe('the model a host actually reports, rather than the one it declares', () => {
  /*
   * Shapes taken from a captured conversation rather than from the
   * declarations. `Message.model` is where the protocol says a turn's model
   * goes and it arrived empty; what was filled in is `usage.model`, a plain
   * string, and `SessionState.model`, which no version of the protocol
   * declares at all. Reading only the declared field showed no model
   * anywhere, against either host, for the life of this client - and every
   * fixture agreed with it, because they were written from the same
   * declarations as the code.
   */
  it('takes the model out of usage when the message carries none', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [], lifecycle: 'ready' });
    scripted.states.set(CHAT, {
      turns: [{
        id: 't1',
        startedAt: new Date().toISOString(),
        state: 'complete',
        message: { text: 'hello', origin: { kind: 'user' }, model: null },
        usage: { inputTokens: 2, outputTokens: 3, cacheReadTokens: 11174, model: 'claude-opus-5' },
      }],
    });

    const detail = await host.detail(SESSION as never);
    expect(detail.model?.id).toBe('claude-opus-5');
    // Usage records what answered, not what was asked for, so there is
    // nothing to say about settings and nothing is invented.
    expect(detail.model?.options).toBeUndefined();

    await host.close();
  });

  it('falls back to the session\'s own model, undeclared as it is', async () => {
    const { host, scripted } = await connect();
    // No turns at all - a session opened and not yet spoken to, which is when
    // a person most wants to know what it would run on.
    scripted.states.set(SESSION, {
      defaultChat: CHAT, chats: [], lifecycle: 'ready', model: 'claude-opus-5[1m]',
    });
    scripted.states.set(CHAT, { turns: [] });

    const detail = await host.detail(SESSION as never);
    expect(detail.model?.id).toBe('claude-opus-5[1m]');

    await host.close();
  });

  it('takes the same extension from _meta, where it is moving to', async () => {
    const { host, scripted } = await connect();
    // An extension belongs under `_meta`, and the host that sends this one is
    // moving it there. Both spellings are read for good: every copy of that
    // host already deployed sends the bare field.
    scripted.states.set(SESSION, {
      defaultChat: CHAT, chats: [], lifecycle: 'ready', _meta: { model: 'claude-opus-5[1m]' },
    });
    scripted.states.set(CHAT, { turns: [] });

    const detail = await host.detail(SESSION as never);
    expect(detail.model?.id).toBe('claude-opus-5[1m]');

    await host.close();
  });

  it('prefers what the turn was asked for over what it used', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [], lifecycle: 'ready', model: 'ignored' });
    scripted.states.set(CHAT, {
      turns: [{
        id: 't1',
        startedAt: new Date().toISOString(),
        state: 'complete',
        message: {
          text: 'hello',
          origin: { kind: 'user' },
          model: { id: 'opus[1m]', config: { thinkingLevel: 'max' } },
        },
        usage: { model: 'claude-opus-5' },
      }],
    });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();

    // The request is the better answer where there is one: it is the only
    // one that carries what the turn was asked for besides the model.
    const detail = await host.detail(SESSION as never);
    expect(detail.model?.id).toBe('opus[1m]');
    const snapshot = seen.find((event) => event.type === 'snapshot');
    const turn = snapshot?.type === 'snapshot'
      ? [...snapshot.turns, ...(snapshot.active ? [snapshot.active] : [])].find((one) => one.model)
      : undefined;
    expect(turn?.model?.config).toEqual({ thinkingLevel: 'max' });

    await host.close();
  });
});

describe('the handshake asks for what it needs in one round trip', () => {
  it('subscribes to the root channel in `initialize`, and not again after', async () => {
    const { host, scripted } = await connect();
    await settle();

    const hello = scripted.asked.find((frame) => frame.method === 'initialize');
    // `lifecycle.md`: the client MAY name channels on `initialize` and the
    // root channel's own page says it SHOULD be one of them.
    expect(hello?.params?.initialSubscriptions).toEqual([ROOT]);
    // And having been answered, it is not asked for a second time - which is
    // the round trip this exists to save.
    expect(scripted.timesAsked('subscribe', ROOT)).toBe(0);

    await host.close();
  });

  /**
   * The three variables `locale()` reads, set together and restored together.
   *
   * All three, never one: `LC_ALL` outranks `LC_MESSAGES` and both outrank
   * `LANG`, so a test that sets `LANG` alone asserts about a value the client
   * never looks at on any machine whose shell exports either of the others.
   */
  const withLocale = async (
    wanted: { LC_ALL?: string; LC_MESSAGES?: string; LANG?: string },
    run: () => Promise<void>,
  ): Promise<void> => {
    const names = ['LC_ALL', 'LC_MESSAGES', 'LANG'] as const;
    const was = names.map((name) => [name, process.env[name]] as const);
    const put = (name: typeof names[number], value: string | undefined): void => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    for (const name of names) put(name, wanted[name]);
    try { await run(); }
    finally { for (const [name, value] of was) put(name, value); }
  };

  it('sends a language tag the server can read', async () => {
    await withLocale({ LANG: 'pt_BR.UTF-8' }, async () => {
      const { host, scripted } = await connect();
      await settle();
      const hello = scripted.asked.find((frame) => frame.method === 'initialize');
      // POSIX spells it `pt_BR.UTF-8`; BCP 47 wants `pt-BR`.
      expect(hello?.params?.locale).toBe('pt-BR');
      await host.close();
    });
  });

  it('reads the variables in the order POSIX gives them', async () => {
    await withLocale({ LC_ALL: 'de_DE.UTF-8', LC_MESSAGES: 'fr_FR.UTF-8', LANG: 'pt_BR.UTF-8' }, async () => {
      const { host, scripted } = await connect();
      await settle();
      const hello = scripted.asked.find((frame) => frame.method === 'initialize');
      expect(hello?.params?.locale).toBe('de-DE');
      await host.close();
    });
  });

  it('says nothing where the environment names no language', async () => {
    await withLocale({ LANG: 'C' }, async () => {
      const { host, scripted } = await connect();
      await settle();
      const hello = scripted.asked.find((frame) => frame.method === 'initialize');
      // `C` and `POSIX` name no language. A tag no server can read is worse
      // than no tag at all.
      expect(hello?.params?.locale).toBeUndefined();
      await host.close();
    });
  });
});

describe('work the host is doing gets said out loud', () => {
  it('reads `root/progress`, which the protocol client drops on the floor', async () => {
    const said: (string | null)[] = [];
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
      onProgress: (_token, message) => said.push(message),
    });
    await settle();

    // The package's own notification handler models five methods and
    // discards the rest, `root/progress` among them - so this arrives only
    // because the transport is read on the way past.
    await scripted.progress('t1', 5, 10, 'Downloading Claude agent');
    await settle(2);
    expect(said).toEqual(['Downloading Claude agent 50%']);

    // `progress === total` is the frame that closes a token, and the host
    // MUST send one. Nothing further references it.
    await scripted.progress('t1', 10, 10, 'Downloading Claude agent');
    await settle(2);
    expect(said[said.length - 1]).toBeNull();

    await host.close();
  });

  it('shows no share where the host named no total', async () => {
    const said: (string | null)[] = [];
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
      onProgress: (_token, message) => said.push(message),
    });
    await settle();

    // `total` is present only when the magnitude is known up front. A
    // percentage invented from a number nobody gave is worse than none.
    await scripted.progress('t2', 900, undefined, 'Indexing');
    await settle(2);
    expect(said).toEqual(['Indexing']);

    await host.close();
  });

  it('sends a token with `createSession`, so there is something to report against', async () => {
    const { host, scripted } = await connect();
    await host.createSession({ provider: 'claude' });
    await settle();

    const made = scripted.asked.find((frame) => frame.method === 'createSession');
    expect(typeof made?.params?.progressToken).toBe('string');

    await host.close();
  });
});

describe('a message carries the model it was asked for', () => {
  it('sends `ModelSelection` whole, config and all', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });
    host.subscribe(SESSION as never, () => undefined);
    await settle();

    // `chat-channel.md` puts the selection on the message, and the schema
    // says a model's `configSchema` form comes back in `ModelSelection.config`.
    host.say(SESSION as never, 'hello', { id: 'opus[1m]', config: { thinkingLevel: 'max' } });
    await settle();

    const sent = scripted.asked.filter((frame) => frame.method === 'dispatchAction')
      .map((frame) => frame.params?.action as Record<string, unknown>)
      .find((action) => action?.type === 'chat/turnStarted');
    const message = (sent?.message ?? {}) as Record<string, unknown>;
    expect(message.model).toEqual({ id: 'opus[1m]', config: { thinkingLevel: 'max' } });

    await host.close();
  });

  it('leaves the config off a model that was given no answers', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });
    host.subscribe(SESSION as never, () => undefined);
    await settle();

    host.queue(SESSION as never, 'later', { id: 'haiku' });
    await settle();

    const sent = scripted.asked.filter((frame) => frame.method === 'dispatchAction')
      .map((frame) => frame.params?.action as Record<string, unknown>)
      .find((action) => action?.type === 'chat/pendingMessageSet');
    const message = (sent?.message ?? {}) as Record<string, unknown>;
    // Absent rather than empty: a host cannot tell an empty answer from an
    // unanswered question, and nothing here should make it guess.
    expect(message.model).toEqual({ id: 'haiku' });

    await host.close();
  });
});

describe('the draft is the host\'s, not this screen\'s', () => {
  it('takes the draft the host was holding when the chat opens', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    // What another client typed here, or what this one typed before it was
    // restarted. `chat-channel.md`: clients SHOULD use it to initialise input.
    scripted.states.set(CHAT, { turns: [], draft: { text: 'half a thought', origin: { kind: 'user' } } });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();

    const snapshot = seen.find((event) => event.type === 'snapshot');
    expect(snapshot?.type === 'snapshot' ? snapshot.draft : undefined).toBe('half a thought');

    await host.close();
  });

  it('says the host holds none, rather than saying nothing', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();

    const snapshot = seen.find((event) => event.type === 'snapshot');
    expect(snapshot?.type === 'snapshot' ? snapshot.draft : undefined).toBe('');

    await host.close();
  });

  it('clears the field rather than holding an empty message', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });
    host.subscribe(SESSION as never, () => undefined);
    await settle();

    host.setDraft(SESSION as never, 'typing');
    host.setDraft(SESSION as never, '');
    await settle();

    const sent = scripted.asked.filter((frame) => frame.method === 'dispatchAction')
      .map((frame) => frame.params?.action as Record<string, unknown>)
      .filter((action) => action?.type === 'chat/draftChanged');
    expect((sent[0]?.draft as Record<string, unknown>)?.text).toBe('typing');
    // `undefined` clears it. An empty message is a message.
    expect(sent[1]).not.toHaveProperty('draft');

    await host.close();
  });
});

describe('the client says it is here, and how wide it is drawing', () => {
  const dispatched = (scripted: Scripted, type: string): Record<string, unknown> | undefined =>
    scripted.asked.filter((frame) => frame.method === 'dispatchAction')
      .map((frame) => frame.params?.action as Record<string, unknown>)
      .find((action) => action?.type === type);

  it('adds itself to the session it opens', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
    scripted.states.set(CHAT, { turns: [] });

    host.subscribe(SESSION as never, () => undefined);
    await settle();

    // Host-kept membership: the client adds itself, the host removes it when
    // the last subscription goes. `tools` is required and empty - this client
    // contributes none, and absent is not the same answer.
    const sent = dispatched(scripted, 'session/activeClientSet');
    expect((sent?.activeClient as Record<string, unknown>)?.clientId).toBe('ahpc-test');
    expect((sent?.activeClient as Record<string, unknown>)?.tools).toEqual([]);

    await host.close();
  });

  it('reports who else the host says is there', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(SESSION, {
      defaultChat: CHAT,
      chats: [],
      activeClients: [
        { clientId: 'ahpc-test', displayName: 'ahpc', tools: [] },
        { clientId: 'somebody', displayName: 'VS Code', tools: [] },
      ],
    });
    scripted.states.set(CHAT, { turns: [] });

    const seen: HostEvent[] = [];
    host.subscribe(SESSION as never, (event) => seen.push(event));
    await settle();

    const present = seen.find((event) => event.type === 'present');
    expect(present?.type === 'present' ? present.clients.map((one) => one.displayName) : [])
      .toEqual(['ahpc', 'VS Code']);

    await host.close();
  });

  it('tells the host the terminal size, and the four actions it never sent', async () => {
    const { host, scripted } = await connect();
    const uri = 'ahp-terminal:/t1';
    scripted.states.set(uri, { title: 'bash', content: [] });

    host.resizeTerminal(uri, 132, 40);
    host.clearTerminal(uri);
    host.renameTerminal(uri, 'build');
    host.claimTerminal(uri);
    await settle();

    // `terminal-channel.md` lists all four among the client-dispatched set.
    const resized = dispatched(scripted, 'terminal/resized');
    expect(resized).toMatchObject({ cols: 132, rows: 40 });
    expect(dispatched(scripted, 'terminal/cleared')).toBeTruthy();
    expect(dispatched(scripted, 'terminal/titleChanged')).toMatchObject({ title: 'build' });
    // Required, and an object: `TerminalClaim` is a client claim carrying the
    // connection's own id, or a session claim. Not a name, and not omittable.
    expect(dispatched(scripted, 'terminal/claimed'))
      .toMatchObject({ claim: { kind: 'client', clientId: 'ahpc-test' } });

    await host.close();
  });

  it('has no way to give a terminal back, because the protocol declares none', async () => {
    const { host, scripted } = await connect();
    host.claimTerminal('ahp-terminal:/t1');
    await settle();

    // `claim` is required on the action and there is no release action, so a
    // client that omitted it would be sending something no host can read.
    // This was invented here and a capture of this client's own frames caught
    // it - which is what that check exists for.
    expect(dispatched(scripted, 'terminal/claimed')).toHaveProperty('claim');

    await host.close();
  });
});

describe('the write half of the filesystem, exactly as declared', () => {
  const sentTo = (scripted: Scripted, method: string): Record<string, unknown> | undefined =>
    scripted.asked.find((frame) => frame.method === method)?.params;

  it('sends the parameters the package declares, and no others', async () => {
    const { host, scripted } = await connect();

    await host.resourceWrite?.('file:///x/a.txt', 'body', { createOnly: true });
    await host.resourceDelete?.('file:///x/a.txt', { recursive: true });
    await host.resourceMkdir?.('file:///x/sub');
    await host.resourceMove?.('file:///x/a.txt', 'file:///x/b.txt', { failIfExists: true });
    await host.resourceCopy?.('file:///x/b.txt', 'file:///x/c.txt');
    await settle();

    // `data` and `encoding` are required. `createOnly` refuses a file that has
    // appeared; `ifMatch` refuses one that changed underneath. Two guards, two
    // different guarantees, and both declared.
    expect(sentTo(scripted, 'resourceWrite')).toEqual({
      channel: ROOT, uri: 'file:///x/a.txt', data: 'body', encoding: 'utf-8', createOnly: true,
    });
    expect(sentTo(scripted, 'resourceDelete')).toEqual({ channel: ROOT, uri: 'file:///x/a.txt', recursive: true });
    expect(sentTo(scripted, 'resourceMkdir')).toEqual({ channel: ROOT, uri: 'file:///x/sub' });
    // `source` and `destination`, not `sourceUri`/`targetUri`; `failIfExists`,
    // not an `overwrite` that means the opposite.
    expect(sentTo(scripted, 'resourceMove')).toEqual({
      channel: ROOT, source: 'file:///x/a.txt', destination: 'file:///x/b.txt', failIfExists: true,
    });
    expect(sentTo(scripted, 'resourceCopy')).toEqual({
      channel: ROOT, source: 'file:///x/b.txt', destination: 'file:///x/c.txt',
    });

    await host.close();
  });

  it('reads a resolve as the host typed it', async () => {
    const { host, scripted } = await connect();
    scripted.resolveWith = { uri: 'file:///x/a.txt', type: 'file', size: 4, mtime: '2026-09-05T00:00:00Z' };

    const found = await host.resourceResolve?.('file:///x/a.txt');
    // `type` is the host's `ResourceType` and is passed through: a symlink is
    // neither a file nor a directory, and narrowing it here would be this
    // client answering something the host already did.
    expect(found).toEqual({ uri: 'file:///x/a.txt', type: 'file', size: 4, mtime: '2026-09-05T00:00:00Z' });

    await host.close();
  });
});

describe('signing in to what a host protects', () => {
  async function protecting(): Promise<{ host: Awaited<ReturnType<typeof liveHost>>; scripted: Scripted; asked: { resources: { resource: string }[]; why?: string }[] }> {
    const asked: { resources: { resource: string }[]; why?: string }[] = [];
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      scripted.states.set(ROOT, {
        agents: [{
          provider: 'claude',
            protectedResources: [{ resource: 'https://api.anthropic.com', resource_name: 'Anthropic API' }],
          models: [],
        }],
        terminals: [],
      });
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
      onAuthRequired: (resources, why) => asked.push({ resources, ...(why === undefined ? {} : { why }) }),
    });
    await settle();
    return { host, scripted, asked };
  }

  it('pushes a token for a resource the host advertised', async () => {
    const { host, scripted } = await protecting();

    await host.authenticate?.('https://api.anthropic.com', 'tok', { expiresIn: 3540 });
    const sent = scripted.asked.find((frame) => frame.method === 'authenticate')?.params;
    expect(sent).toEqual({
      channel: ROOT, resource: 'https://api.anthropic.com', token: 'tok', expiresIn: 3540,
    });

    await host.close();
  });

  it('will not name a resource the host never advertised', async () => {
    const { host, scripted } = await protecting();

    // `authentication.md`: the resource MUST match one the server advertised.
    // Refusing here says which names exist; sending it would have the host
    // say no without saying what would work.
    await expect(host.authenticate?.('https://example.test', 'tok')).rejects.toThrow(/api\.anthropic\.com/);
    expect(scripted.asked.some((frame) => frame.method === 'authenticate')).toBe(false);

    await host.close();
  });

  it('leaves out an expiry that is not a positive integer', async () => {
    const { host, scripted } = await protecting();

    // MUST be a positive integer when supplied, and MUST be omitted when the
    // expiry is unknown. Zero is not "already expired", it is not allowed.
    await host.authenticate?.('https://api.anthropic.com', 'tok', { expiresIn: 0 });
    const sent = scripted.asked.find((frame) => frame.method === 'authenticate')?.params;
    expect(sent).not.toHaveProperty('expiresIn');

    await host.close();
  });

  it('reads the resources off a `-32007` from any command', async () => {
    const { host, scripted, asked } = await protecting();
    scripted.refuse.set(SESSION, 'auth');
    scripted.refuseWith = {
      code: -32007,
      message: 'Authentication required',
      data: { resources: [{ resource: 'https://api.anthropic.com', resource_name: 'Anthropic API' }] },
    };

    host.subscribe(SESSION as never, () => undefined);
    await settle();

    // The error MAY come back from any command, and its `data` is what says
    // to what. Dropping it told a person that authentication was required and
    // not what for.
    expect(asked[0]?.resources[0]?.resource).toBe('https://api.anthropic.com');

    await host.close();
  });

  it('says an expired credential is not one to send again', async () => {
    const { host, scripted, asked } = await protecting();

    await scripted.authRequired('https://api.anthropic.com', 'expired');
    await settle(2);

    // MUST acquire a new credential; MUST NOT blindly replay the challenged
    // token. The reason is carried so the layer above can tell them apart.
    expect(asked[asked.length - 1]?.why).toBe('expired');

    await host.close();
  });
});

describe('the host\'s own log, which the protocol client also drops', () => {
  it('flattens an OTLP batch into records a reader can print', async () => {
    const seen: { severity?: string; body: string; attributes: Record<string, string> }[] = [];
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
      onLog: (record) => seen.push(record),
    });
    await settle();

    await scripted.logs();
    await settle(2);

    // OTLP nests resource by scope by record, and wraps every attribute value
    // in a one-key object naming its type. A reader wants a line.
    expect(seen[0]?.body).toBe('tool call started');
    expect(seen[0]?.severity).toBe('INFO');
    // Resource attributes and record attributes, merged - which is what makes
    // a line say which session it came from.
    expect(seen[0]?.attributes).toEqual({ 'service.name': 'ahp-agent-host', 'tool.name': 'read_file' });

    await host.close();
  });

  it('subscribes with the template expanded, and only where it was advertised', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      scripted.telemetry = { logs: 'ahp-otlp://logs{?level}' };
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
    });
    await settle();

    const watching = await host.watchLogs?.(() => undefined, { level: 'warn' });
    await settle();
    // `{?level}` is form-style and expands to a query. Nothing else in the URI
    // is touched: the specification says it is opaque apart from the
    // well-known variables, of which this is the only one.
    expect(scripted.timesAsked('subscribe', 'ahp-otlp://logs?level=warn')).toBe(1);

    watching?.close();
    await host.close();
  });

  it('expands to nothing where no level was asked for', async () => {
    let scripted!: Scripted;
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Scripted(theirs);
      scripted.telemetry = { logs: 'ahp-otlp://logs{?level}' };
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
    });
    await settle();

    const watching = await host.watchLogs?.(() => undefined);
    await settle();
    // An undefined variable expands to nothing, which RFC 6570 says and which
    // leaves the URI the host advertised.
    expect(scripted.timesAsked('subscribe', 'ahp-otlp://logs')).toBe(1);

    watching?.close();
    await host.close();
  });

  it('says a host that emits none emits none', async () => {
    const { host } = await connect();
    // `telemetry` omitted entirely is how a host says it emits nothing, and
    // guessing a channel would be subscribing to something nobody advertised.
    await expect(host.watchLogs?.(() => undefined)).rejects.toThrow(/no logs/);
    await host.close();
  });
});

describe('a watch instead of a timer', () => {
  it('creates one on the channel the host allocates, and releases it', async () => {
    const { host, scripted } = await connect();
    scripted.watchChannel = 'ahp-resource-watch:/w1';

    const seen: { uri: string; kind: string }[][] = [];
    const watching = await host.watchResource?.('file:///x', (changes) => seen.push(changes));
    await settle();

    // Receiver-assigned and opaque: whatever the host called it is what is
    // subscribed to.
    expect(scripted.timesAsked('subscribe', 'ahp-resource-watch:/w1')).toBe(1);

    await scripted.act('ahp-resource-watch:/w1', {
      type: 'resourceWatch/changed',
      // Wrapped in `items` for forward compatibility, so a reader that took
      // `changes` as the array gets nothing.
      // `type`, which is what `ResourceChange` declares.
      changes: { items: [{ uri: 'file:///x/a.txt', type: 'changed' }] },
    });
    await settle();
    expect(seen[0]).toEqual([{ uri: 'file:///x/a.txt', kind: 'changed' }]);

    // There is no dispose command: releasing the last subscriber is what makes
    // the host let the watcher go.
    watching?.close();
    await settle();
    expect(scripted.timesAsked('unsubscribe', 'ahp-resource-watch:/w1')).toBe(1);

    await host.close();
  });
});

describe('a read-modify-write is guarded by what it read', () => {
  it('carries the etag a resolve returned', async () => {
    const { host, scripted } = await connect();
    scripted.resolveWith = { uri: 'file:///x/a.txt', type: 'file', size: 4, etag: 'v7' };

    const found = await host.resourceResolve?.('file:///x/a.txt');
    expect(found?.etag).toBe('v7');

    await host.resourceWrite?.('file:///x/a.txt', 'next', { ifMatch: found?.etag as string });
    const sent = scripted.asked.find((frame) => frame.method === 'resourceWrite')?.params;
    // The host MUST answer `-32011` when its copy has moved on, which is the
    // whole of what stops this losing somebody else's edit.
    expect(sent).toMatchObject({ ifMatch: 'v7' });

    await host.close();
  });

  it('sends none where the host keeps none', async () => {
    const { host, scripted } = await connect();
    // A directory has no bytes to have been changed under anyone, and a host
    // may simply not keep a token. Absent is not an empty one.
    scripted.resolveWith = { uri: 'file:///x/sub', type: 'directory' };

    const found = await host.resourceResolve?.('file:///x/sub');
    expect(found).not.toHaveProperty('etag');

    await host.resourceWrite?.('file:///x/a.txt', 'next');
    const sent = scripted.asked.find((frame) => frame.method === 'resourceWrite')?.params;
    expect(sent).not.toHaveProperty('ifMatch');

    await host.close();
  });
});

it('gives a late reader the existing conversation and keeps both readers live', async () => {
  const { host, scripted } = await connect();
  scripted.states.set(SESSION, { defaultChat: CHAT, chats: [] });
  scripted.states.set(CHAT, { turns: [{ id: 'kept', message: { text: 'already said', origin: { kind: 'user' } },
    responseParts: [], state: 'complete', startedAt: new Date().toISOString() }] });
  const first: HostEvent[] = []; const second: HostEvent[] = [];
  const one = host.subscribe(SESSION as never, (event) => first.push(event));
  await settle();
  const two = host.subscribe(SESSION as never, (event) => second.push(event));
  await settle();
  const latest = (events: HostEvent[]) => events.filter((event) => event.type === 'snapshot').at(-1);
  expect(latest(second)?.turns).toEqual(latest(first)?.turns);
  expect(latest(second)?.turns.length).toBeGreaterThan(0);
  one.close();
  await scripted.act(CHAT, { type: 'chat/draftChanged', draft: { text: 'still here' } });
  await settle();
  expect(latest(second)?.draft).toBe('still here');
  expect(scripted.timesAsked('unsubscribe', CHAT)).toBe(0);
  two.close(); await host.close();
});

it('gives a late terminal watcher the existing output', async () => {
  const { host, scripted } = await connect();
  const uri = 'ahp-terminal:/late';
  scripted.states.set(uri, { title: 'shell', content: [{ type: 'unclassified', value: 'kept output' }] });
  const one = host.watchTerminal(uri, () => {});
  await settle();
  const output: string[] = [];
  const two = host.watchTerminal(uri, (state) => output.push(state.output));
  await settle();
  expect(output.at(-1)).toBe('kept output');
  one.close(); two.close(); await host.close();
});
