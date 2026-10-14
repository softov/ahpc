/*
 * One page of the catalogue, off the wire.
 *
 * `HostConnection.sessionPage` is what `ahpc session list --limit` and the MCP
 * `list_sessions` tool are built on, and the two halves it has to get right are
 * the ones `listSessions` hides: it sends the `limit` and the opaque `cursor`
 * the caller was given, and it hands back the host's `nextCursor` rather than
 * walking to the end of the catalogue on its own.
 *
 * So this drives the live host over an in-memory transport, against a host
 * scripted frame by frame, and reads what it was sent. Not `test/scenario.ts`:
 * that host pages by fifty of its own accord and reads no `limit`, which is the
 * wrong shape to check a request against.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryTransport, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import { liveHost } from '../src/ahp/live.js';

const ROOT = 'ahp-root://';

interface Asked {
  method: string;
  params: Record<string, unknown>;
}

/**
 * A host that answers `initialize`, `subscribe` and `listSessions`, and
 * records every request it was sent.
 *
 * `answer` is given a `listSessions` request's params and returns the body, so
 * a case states what this host says about the page it was asked for. The other
 * two methods are the least a connection needs to come up.
 */
function scripted(
  transport: AhpTransport,
  answer: (params: Record<string, unknown>) => Record<string, unknown>,
): Asked[] {
  const asked: Asked[] = [];
  void (async () => {
    for (;;) {
      const frame = await transport.recv().catch(() => null);
      if (frame === null) return;
      const text = frame.kind === 'text'
        ? frame.text
        : frame.kind === 'parsed' ? JSON.stringify(frame.message) : '';
      let message: Record<string, unknown>;
      try { message = JSON.parse(text) as Record<string, unknown>; }
      catch { continue; }
      const { id, method } = message as { id?: number; method?: string };
      if (id === undefined || method === undefined) continue;
      const params = (message.params ?? {}) as Record<string, unknown>;
      asked.push({ method, params });
      const channel = typeof params.channel === 'string' ? params.channel : '';
      const result = method === 'initialize'
        ? { protocolVersion: '0.9.0', serverSeq: 1, snapshots: [{ resource: ROOT, state: { agents: [], terminals: [] }, fromSeq: 1 }] }
        : method === 'subscribe' ? { snapshot: { resource: channel, state: {}, fromSeq: 1 } }
          : method === 'listSessions' ? answer(params)
            : {};
      await transport.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
    }
  })();
  return asked;
}

/** A live host over a scripted one, and the frames the scripted one was sent. */
async function connect(
  answer: (params: Record<string, unknown>) => Record<string, unknown>,
): Promise<{ host: Awaited<ReturnType<typeof liveHost>>; asked: Asked[] }> {
  let asked: Asked[] = [];
  const host = await liveHost({
    url: 'ws://scripted',
    clientId: 'ahpc-session-page',
    backoff: [0],
    keepaliveMs: 0,
    lingerMs: 0,
    connect: async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      asked = scripted(theirs, answer);
      return mine;
    },
  });
  return { host, asked };
}

/** A row of the catalogue, with only what a page is read for. */
const row = (id: string, modifiedAt: string): Record<string, unknown> => ({
  resource: id,
  provider: 'claude',
  title: id,
  status: 1,
  createdAt: modifiedAt,
  modifiedAt,
  workingDirectories: ['file:///tmp'],
});

describe('one page of the catalogue', () => {
  it('hands back the rows the host answered with, and its cursor', async () => {
    const { host } = await connect(() => ({
      items: [row('ahp-session:/a', '2026-08-01T00:00:00.000Z'), row('ahp-session:/b', '2026-08-02T00:00:00.000Z')],
      nextCursor: 'c1',
    }));
    const page = await host.sessionPage({ limit: 2 });
    expect(page.rows.map((one) => one.resource)).toEqual(['ahp-session:/a', 'ahp-session:/b']);
    expect(page.nextCursor).toBe('c1');
    await host.close();
  });

  it('sends the limit and the cursor, and neither when it was given neither', async () => {
    const { host, asked } = await connect(() => ({ items: [] }));
    await host.sessionPage({ limit: 2, cursor: 'c1' });
    await host.sessionPage({});
    const sent = asked.filter((one) => one.method === 'listSessions').map((one) => one.params);
    // Asked for as they were given, because the cursor is the host's own and
    // only it can read one back.
    expect(sent[0]).toMatchObject({ channel: ROOT, limit: 2, cursor: 'c1' });
    // And left off rather than sent as `null`: a host reads an absent cursor as
    // the first page, and one it cannot parse as a refusal.
    expect(sent[1]).toMatchObject({ channel: ROOT });
    expect(sent[1]).not.toHaveProperty('limit');
    expect(sent[1]).not.toHaveProperty('cursor');
    await host.close();
  });

  it('answers no cursor when the host offered none', async () => {
    const { host } = await connect(() => ({ items: [row('ahp-session:/a', '2026-08-01T00:00:00.000Z')] }));
    const page = await host.sessionPage({ limit: 2 });
    expect(page.rows).toHaveLength(1);
    // Absent, not empty: the last page is the one with no cursor, and a client
    // that reads `nextCursor: ''` as a page to follow never stops.
    expect('nextCursor' in page).toBe(false);
    await host.close();
  });
});
