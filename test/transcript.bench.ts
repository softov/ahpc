/*
 * What one streamed action costs, at four history sizes.
 *
 * A live subscription applies the action and then rebuilds the whole
 * user-facing view: `transcript` walks every turn the chat holds, and the
 * observer is called with the result. So the work per token may be a function
 * of how long the conversation already is, and nobody had measured it.
 *
 * This is a measurement, not a defect and not an optimisation. Run it with
 * `npm run bench`. The number to read is not the absolute one - it is how the
 * four sizes compare: flat means the projection is not the cost, and linear
 * means it is, and only the second is worth caching for.
 *
 * Deliberately not part of `npm test`: `vitest run` collects `*.test.ts`, and
 * a benchmark in the suite is thirty seconds nobody asked for on every run.
 */

import { bench, describe } from 'vitest';
import { InMemoryTransport, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import * as ahp from '@microsoft/agent-host-protocol';
import type { ChatState } from '@microsoft/agent-host-protocol';
import { liveHost, applyAction } from '../src/ahp/live.js';

const ROOT = 'ahp-root://';
const SESSION = 'ahp-session:/s1';
const CHAT = 'ahp-chat:/s1';

/** How long a conversation is, in turns, before a single action arrives into it. */
const SIZES = [10, 100, 500, 2000];

/** One finished exchange, of the shape `Turn` declares and `transcript` walks. */
const turnAt = (index: number): Record<string, unknown> => ({
  id: `t${index}`,
  startedAt: new Date(index * 1000).toISOString(),
  duration: 500,
  state: 'complete',
  message: { text: `question ${index}`, origin: { kind: 'user' } },
  responseParts: [{ kind: 'markdown', id: `t${index}-p1`, content: `answer ${index} `.repeat(8) }],
});

/** The turn a token is streaming into, which is the one the host has not ended. */
const active = (): Record<string, unknown> => ({
  id: 'live',
  startedAt: new Date().toISOString(),
  state: 'running',
  message: { text: 'the question being answered', origin: { kind: 'user' } },
  responseParts: [{ kind: 'markdown', id: 'live-p1', content: '' }],
});

/** A chat holding `size` finished turns and one still streaming. */
const chatOf = (size: number): ChatState => ({
  resource: CHAT,
  title: 'Chat',
  status: 30,
  modifiedAt: new Date().toISOString(),
  turns: Array.from({ length: size }, (_, index) => turnAt(index)),
  activeTurn: active(),
} as unknown as ChatState);

/**
 * One token of a streamed reply.
 *
 * `chat/delta` and not a whole part: this is the action a host sends per
 * chunk, so it is the one whose cost is multiplied by how fast a model talks.
 */
const token = (index: number): Record<string, unknown> => ({
  type: 'chat/delta',
  turnId: 'live',
  partId: 'live-p1',
  content: `chunk ${index} `,
});

/**
 * A host that answers the handshake and nothing else.
 *
 * Enough to get `liveHost` to open the two channels and start reducing, which
 * is the path under measurement. Everything a real host does after that is
 * driven from the benchmark rather than scripted here.
 */
class Minimal {
  private seq = 10;
  constructor(private readonly transport: AhpTransport, private readonly chat: ChatState) {
    void this.run();
  }

  private async send(frame: Record<string, unknown>): Promise<void> {
    await this.transport.send(JSON.stringify(frame));
  }

  /** Push one action onto the chat channel, as a host streaming a reply does. */
  async act(action: Record<string, unknown>): Promise<void> {
    this.seq += 1;
    await this.send({ jsonrpc: '2.0', method: 'action', params: { channel: CHAT, action, serverSeq: this.seq } });
  }

  private state(channel: string): unknown {
    if (channel === SESSION) return { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 };
    if (channel === CHAT) return this.chat;
    return { agents: [], terminals: [] };
  }

  private async run(): Promise<void> {
    for (;;) {
      let frame: Awaited<ReturnType<AhpTransport['recv']>>;
      try { frame = await this.transport.recv(); }
      catch { return; }
      if (frame === null) return;
      const text = frame.kind === 'text' ? frame.text
        : frame.kind === 'parsed' ? JSON.stringify(frame.message) : '';
      const message = JSON.parse(text) as { id?: number | string; method?: string; params?: Record<string, unknown> };
      if (message.id === undefined) continue;
      const result = message.method === 'initialize'
        ? { protocolVersion: '0.9.0', serverInfo: { name: 'bench', version: '0' }, capabilities: {} }
        : message.method === 'subscribe'
          ? {
            snapshot: {
              resource: String(message.params?.channel ?? ROOT),
              state: this.state(String(message.params?.channel ?? ROOT)),
              fromSeq: this.seq,
            },
          }
          : {};
      await this.send({ jsonrpc: '2.0', id: message.id, result });
    }
  }
}

/** A connected client with a session open, its view already emitted once. */
async function opened(size: number): Promise<{
  close(): Promise<void>;
  act(action: Record<string, unknown>): Promise<void>;
  emitted(): number;
}> {
  let scripted!: Minimal;
  const chat = chatOf(size);
  const host = await liveHost({
    url: 'ws://bench',
    clientId: 'ahpc-bench',
    connect: async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      scripted = new Minimal(theirs, chat);
      return mine;
    },
    backoff: [0],
    keepaliveMs: 0,
    lingerMs: 0,
  });
  let emitted = 0;
  const view = host.subscribe(SESSION as never, () => { emitted += 1; });
  for (let i = 0; i < 12; i += 1) await new Promise((resolve) => { setTimeout(resolve, 1); });
  return {
    act: (action) => scripted.act(action),
    emitted: () => emitted,
    close: async () => { view.close(); await host.close(); },
  };
}

/*
 * The reducer alone, at the same sizes.
 *
 * `chatReducer` is the protocol package's, and it is the half that is not
 * this client's to make faster. Measured separately so the difference between
 * these two describes is the projection - which is the half that could be
 * cached, and the only half worth measuring before deciding to.
 */
describe('the reducer alone', () => {
  for (const size of SIZES) {
    let state: ChatState = chatOf(size);
    let index = 0;
    bench(`one action into ${size} turns`, () => {
      index += 1;
      // Reassigned, because the reducer is immutable: keeping the answer is
      // what makes this the same work the live path does rather than the same
      // action applied to the same state a thousand times.
      state = applyAction(ahp.chatReducer, state, token(index), (said) => { throw new Error(said); });
    });
  }
});

describe('the reducer and the view it rebuilds', () => {
  for (const size of SIZES) {
    let live: Awaited<ReturnType<typeof opened>> | undefined;
    let index = 0;
    bench(`one action into ${size} turns`, async () => {
      index += 1;
      await live?.act(token(index));
    }, {
      setup: async () => { live = await opened(size); },
      teardown: async () => { await live?.close(); live = undefined; },
    });
  }
});
