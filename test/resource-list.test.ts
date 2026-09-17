/**
 * The URIs a listing hands out, when the host sends names only.
 *
 * The protocol's own listing carries a name per entry; the client derives
 * the URI from the folder it asked about, and a folder picked in the
 * workspace dialog is handed straight back to `createSession`.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryTransport, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import { liveHost } from '../src/ahp/live.js';

const ROOT = 'ahp-root://';

/** Answers `initialize` with an empty root, and a listing with names only. */
function namesOnly(transport: AhpTransport): void {
  void (async () => {
    for (;;) {
      const frame = await transport.recv().catch(() => null);
      if (frame === null) return;
      const text = frame.kind === 'text' ? frame.text : frame.kind === 'parsed' ? JSON.stringify(frame.message) : '';
      let message: { id?: number; method?: string };
      try { message = JSON.parse(text) as { id?: number; method?: string }; }
      catch { continue; }
      if (message.id === undefined || message.method === undefined) continue;
      const result = message.method === 'initialize'
        ? { protocolVersion: '0.9.0', serverSeq: 1, snapshots: [{ resource: ROOT, state: { agents: [], terminals: [] }, fromSeq: 1 }] }
        : message.method === 'resourceList'
          ? { entries: [{ name: 'brb_main', type: 'directory' }, { name: 'README', type: 'file' }] }
          : {};
      await transport.send(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
    }
  })();
}

describe('resourceList', () => {
  it('names the entries of a root under the root, not under its scheme', async () => {
    const host = await liveHost({
      url: 'ws://scripted',
      clientId: 'ahpc-listing',
      backoff: [0],
      keepaliveMs: 0,
      lingerMs: 0,
      connect: async (): Promise<AhpTransport> => {
        const [mine, theirs] = InMemoryTransport.pair();
        namesOnly(theirs);
        return mine;
      },
    });
    try {
      const uris = async (uri: string) => (await host.resourceList!(uri)).map((entry) => entry.uri);
      expect(await uris('file:///')).toEqual(['file:///brb_main', 'file:///README']);
      expect(await uris('file://')).toEqual(['file:///brb_main', 'file:///README']);
      expect(await uris('file:///brb_main')).toEqual(['file:///brb_main/brb_main', 'file:///brb_main/README']);
      expect(await uris('file:///brb_main/')).toEqual(['file:///brb_main/brb_main', 'file:///brb_main/README']);
    }
    finally {
      await host.close?.();
    }
  });
});
