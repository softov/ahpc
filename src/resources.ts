/**
 * The host's filesystem, as a textui resource provider.
 *
 * textui's file picker, its search and its viewers read the resource
 * registry and never `node:fs` - which is the reason they can be pointed at
 * a filesystem on another machine. This is that pointing: `file:` on this
 * client is the host's disk, reached through the protocol's `resource*`
 * requests, so a folder picked in a dialog is a folder the host can start a
 * session in. Read-only here; what writes goes through `ahpc resource`.
 */

import type { Resource, ResourceProvider } from '@textui/core';
import type { HostConnection } from './ahp/connection.js';

const nameOf = (uri: string): string => decodeURIComponent(uri.replace(/\/+$/, '').split('/').pop() ?? '');

export function hostResources(host: HostConnection): ResourceProvider {
  const resource = (uri: string, kind: string, size?: number): Resource => ({
    uri,
    kind: kind === 'directory' ? 'directory' : 'file',
    metadata: { name: nameOf(uri), ...(size === undefined ? {} : { size }), readonly: true },
    capabilities: kind === 'directory' ? ['list'] : ['read'],
  });

  return {
    scheme: 'file',
    // A host without the family answers -32601, which is the same answer as
    // "nothing there" to something asking whether it can list a folder.
    stat: async (uri) => {
      if (!host.resourceResolve) return null;
      try {
        const found = await host.resourceResolve(uri);
        return resource(found.uri, found.type, found.size);
      }
      catch { return null; }
    },
    list: async (uri) => {
      if (!host.resourceList) return [];
      return (await host.resourceList(uri)).map((entry) => resource(entry.uri, entry.kind, entry.size));
    },
    read: async (uri) => {
      if (!host.resourceRead) throw new Error('This host does not serve files.');
      const found = await host.resourceRead(uri);
      return found.encoding === 'base64' ? Uint8Array.from(Buffer.from(found.data, 'base64')) : found.data;
    },
  };
}
