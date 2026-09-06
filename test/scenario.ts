/*
 * A host and a client, run against each other with nothing in between.
 *
 * The suites that use this drive `liveHost` itself - the protocol half, not
 * the `HostConnection` seam `fakeHost` implements - over an in-memory
 * transport, against a host scripted frame by frame. What that buys is the
 * interleavings: a snapshot held while its reader leaves, a socket dropped
 * mid-turn, two readers on one channel. None of those are reachable through a
 * fake that answers immediately, and each of them has been a defect here.
 *
 * The controls are the four a lifecycle needs. `slow` and `release` hold and
 * then answer a subscribe. `holdHandshake` does the same to `initialize`, so
 * a client can be caught before it has a connection at all. `drop` hangs up
 * the way a killed daemon does, and `reopen` is what it reconnects to.
 * Everything else is state: set `states`, `catalogue` or `behind`, and the
 * host answers out of them.
 *
 * Not a test file. `vitest` collects `*.test.ts`, and this is imported by the
 * suites that are.
 */

import { InMemoryTransport, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import { liveHost } from '../src/ahp/live.js';
import type { HostEvent } from '../src/ahp/connection.js';

export const ROOT = 'ahp-root://';
export const AUTOMATIONS = 'ahp-automations://';
export const SESSION = 'ahp-session:/s1';
export const CHAT = 'ahp-chat:/s1';

export interface Frame {
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
export class Scripted {
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
  /** The id of a handshake being held, and the channels it asked for. */
  private handshake: number | string | undefined;
  private opening: string[] = [];
  /** What arrived while the handshake was held, to be answered in order after it. */
  private queued: Frame[] = [];
  /** Whether the held exchange was a `reconnect`, which answers differently. */
  private resuming = false;
  /** The channel a `createResourceWatch` is answered with. Receiver-assigned. */
  watchChannel = 'ahp-resource-watch:/default';
  /** What `initialize` advertises under `telemetry`, if anything. */
  telemetry: Record<string, string> | null = null;
  /** An error to refuse a subscribe with, in place of the plain `-32001`. */
  refuseWith: Record<string, unknown> | null = null;
  /**
   * Hold the opening exchange instead of answering it.
   *
   * `initialize` on a first connection and `reconnect` on a later one, because
   * a client that has been dropped resumes rather than introducing itself
   * again. Either way it is a client that has spoken and been told nothing,
   * which is where every connection starts and is the moment a reader arriving
   * has no test of its own. `releaseHandshake` answers whichever is held.
   */
  holdHandshake = false;
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

  /**
   * Answer the handshake this host has been sitting on.
   *
   * `holdHandshake` goes down with it: what is under test is the wait, and a
   * client that reconnects into a second silent handshake is a different
   * scenario, which sets the flag again itself.
   */
  async releaseHandshake(): Promise<void> {
    const id = this.handshake;
    if (id === undefined) return;
    this.handshake = undefined;
    this.holdHandshake = false;
    const waiting = this.queued;
    this.queued = [];
    await this.send(this.resuming ? {
      jsonrpc: '2.0',
      id,
      result: this.reconnectWith,
    } : {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '0.9.0',
        serverSeq: this.seq,
        snapshots: this.opening.map((channel) => ({
          resource: channel,
          state: this.states.get(channel) ?? {},
          fromSeq: this.seq,
        })),
        ...(this.automations ? { automations: {} } : {}),
        ...(this.telemetry === null ? {} : { telemetry: this.telemetry }),
      },
    });
    if (this.resuming) this.announceReconnect({ method: 'reconnect' });
    this.resuming = false;
    for (const message of waiting) await this.answer(message);
  }

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
    /*
     * Nothing is answered before the handshake is.
     *
     * A host that answered a `subscribe` while still deciding whether it can
     * speak the client's protocol version would be answering for a session
     * on a connection that may yet be refused. Held in order and drained by
     * `releaseHandshake`, so what a scenario measures is the wait rather than
     * a host that half exists.
     */
    if (this.handshake !== undefined && method !== 'initialize' && method !== 'reconnect') {
      this.queued.push(message);
      return;
    }
    const reply = async (result: unknown): Promise<void> => {
      if (id === undefined) return;
      await this.send({ jsonrpc: '2.0', id, result });
    };

    if ((method === 'initialize' || method === 'reconnect') && this.holdHandshake) {
      this.opening = (message.params?.initialSubscriptions as string[] | undefined) ?? [];
      this.resuming = method === 'reconnect';
      if (id !== undefined) this.handshake = id;
      return;
    }
    if (method === 'initialize') {
      // What `lifecycle.md` says the handshake answers with: a snapshot for
      // every channel named in `initialSubscriptions`, in the same round trip.
      const asked = (message.params?.initialSubscriptions as string[] | undefined) ?? [];
      this.opening = asked;
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
/**
 * A reader of one session, and everything it was told.
 *
 * The views are kept rather than the last one: what a lifecycle test asserts
 * is usually that something did *not* happen in between - a view that went
 * empty and filled again, a status that flickered - and only the sequence
 * says so.
 */
export interface Reader {
  /** Every event this reader was given, oldest first. */
  readonly seen: HostEvent[];
  /** The last snapshot, which is what a screen would be showing. */
  view(): Extract<HostEvent, { type: 'snapshot' }> | undefined;
  /** How much conversation it is showing, counting the running turn. */
  turns(): number;
  close(): void;
}

/**
 * A live client against a scripted host, with the waiting turned off.
 *
 * `setup` runs against every host this client connects to, including the ones
 * it reconnects to, and runs before the first frame is read. That is the only
 * place a reconnect can be arranged from: a dropped socket brings up a new
 * host, and a flag set on the old one applies to a host that has gone.
 */
export async function connect(setup?: (scripted: Scripted) => void): Promise<{
  host: Awaited<ReturnType<typeof liveHost>>;
  scripted: Scripted;
  read(uri?: string): Reader;
  reopen(): Scripted;
}> {
  let scripted!: Scripted;
  const open = async (): Promise<AhpTransport> => {
    const [mine, theirs] = InMemoryTransport.pair();
    scripted = new Scripted(theirs);
    setup?.(scripted);
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
  /**
   * Open a session and record what the reader is told.
   *
   * Named because a scenario usually has two of them on one channel, and
   * `one` and `two` in an assertion failure is the whole difference between
   * a message that locates the fault and one that says a number is wrong.
   */
  const read = (uri: string = SESSION): Reader => {
    const seen: HostEvent[] = [];
    const view = host.subscribe(uri as never, (event) => { seen.push(event); });
    return {
      seen,
      view: () => [...seen].reverse().find((event) => event.type === 'snapshot') as
        Extract<HostEvent, { type: 'snapshot' }> | undefined,
      turns() {
        const last = this.view();
        return last === undefined ? 0 : last.turns.length + (last.active === undefined ? 0 : 1);
      },
      close: () => { view.close(); },
    };
  };

  return { host, scripted, read, reopen: () => scripted };
}

/**
 * What the host is holding for a chat, counted the way a reader counts it.
 *
 * The comparison a scenario ends with: a reader that agrees with the host has
 * neither dropped an action nor invented one, and the two numbers are the only
 * part of that both sides can state independently. `transcript` splits a turn
 * carrying a user message into two rows, so a turn with one counts twice.
 */
export function heldByHost(scripted: Scripted, channel = CHAT): number {
  const chat = scripted.states.get(channel) ?? {};
  const rows = (value: unknown): number => {
    const turn = (value ?? {}) as { message?: { text?: string } };
    return (turn.message?.text ? 1 : 0) + 1;
  };
  const turns = (chat.turns as unknown[] | undefined) ?? [];
  return turns.reduce<number>((total, one) => total + rows(one), 0)
    + (chat.activeTurn === undefined ? 0 : rows(chat.activeTurn));
}
/** Let the microtasks and the zero-delay timers behind a reconnect run out. */
export async function settle(times = 12): Promise<void> {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => { setTimeout(resolve, 1); });
}