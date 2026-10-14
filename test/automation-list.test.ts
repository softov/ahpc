/**
 * The automations a host holds, read right after connecting.
 *
 * `ahpc automation list` asks once and leaves, so it reads before the
 * automations channel has had its first snapshot.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryTransport, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import { liveHost } from '../src/ahp/live.js';

const ROOT = 'ahp-root://';
const AUTOMATIONS = 'ahp-automations://';

const ONE = {
  resource: 'ahp-automation:/one',
  definition: {
    title: 'Review yesterday',
    triggers: [{ kind: 'schedule', schedule: { expression: '0 9 * * *' } }],
  },
};

/** Says it has automations, and answers their subscribe only after a while. */
function slowAutomations(transport: AhpTransport): void {
  void (async () => {
    for (;;) {
      const frame = await transport.recv().catch(() => null);
      if (frame === null) return;
      const text = frame.kind === 'text' ? frame.text : frame.kind === 'parsed' ? JSON.stringify(frame.message) : '';
      let message: { id?: number; method?: string; params?: { channel?: string } };
      try { message = JSON.parse(text) as typeof message; }
      catch { continue; }
      if (message.id === undefined || message.method === undefined) continue;
      const id = message.id;
      if (message.method === 'subscribe' && message.params?.channel === AUTOMATIONS) {
        setTimeout(() => {
          const result = { snapshot: { resource: AUTOMATIONS, state: { entries: [ONE] }, fromSeq: 1 } };
          void transport.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
        }, 50);
        continue;
      }
      const result = message.method === 'initialize'
        ? { protocolVersion: '0.9.0', serverSeq: 1, automations: {}, snapshots: [{ resource: ROOT, state: { agents: [], terminals: [] }, fromSeq: 1 }] }
        : {};
      await transport.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
    }
  })();
}

describe('automations', () => {
  it('waits for the first snapshot rather than answering an empty list', async () => {
    const host = await liveHost({
      url: 'ws://scripted',
      clientId: 'ahpc-automations',
      backoff: [0],
      keepaliveMs: 0,
      lingerMs: 0,
      connect: async (): Promise<AhpTransport> => {
        const [mine, theirs] = InMemoryTransport.pair();
        slowAutomations(theirs);
        return mine;
      },
    });
    try {
      const found = await host.automations!();
      expect(found.map((one) => one.title)).toEqual(['Review yesterday']);
    }
    finally {
      await host.close?.();
    }
  });
});
