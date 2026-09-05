/*
 * What this client serves back to a host.
 *
 * AHP is symmetrical: `subscriptions.md` says the same nine `resource*`
 * methods plus `createResourceWatch` may be initiated by the server, and the
 * registry's example of what they are for is fetching a client-published URI -
 * `virtual://my-client/...`. The .NET conformance test publishes
 * `virtual://native-aot/resource` and the TypeScript one `virtual://client/thing`,
 * so the scheme shape is the specification's rather than one chosen here.
 *
 * Nothing is served unless a directory was named on the command line. A client
 * that offered its filesystem to whatever host it happened to connect to would
 * be a mistake rather than a feature, and `-32009 PermissionDenied` is the
 * declared refusal - the receiver enforcing access, which the specification
 * says is the receiver's job whichever peer initiated.
 */

import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The authority a client publishes under is its own `clientId`.
 *
 * `<scheme>://<clientId>/…` is how the reference host addresses a
 * client-served resource, and a host routes by reading the authority and
 * matching it against the connection that sent it - so a fixed authority
 * reaches nothing. The scheme is `virtual:`, which is what the specification's
 * examples and both conformance suites use.
 */
export function publishedUnder(clientId: string): string {
  return `virtual://${clientId}/`;
}

/** JSON-RPC codes this answers with, as `commands.ts` declares them. */
const NOT_FOUND = -32008;
const PERMISSION_DENIED = -32009;

export interface Published {
  /** The directory served, or null when nothing was published. */
  readonly root: string | null;
  /** Whether a host may write into it. Off unless asked for. */
  readonly writable: boolean;
  /** The prefix this is addressed under, once a client id is known. */
  readonly prefix: string;
  /** Say which connection this is, so the URIs a host routes on are right. */
  as(clientId: string): Published;
  /** Per-method handlers, in the shape the protocol client composes. */
  handlers(): Record<string, (params: unknown) => Promise<unknown>>;
}

/** A refusal carrying the code the protocol declares for it. */
export class PublishRefusal extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
    this.name = 'PublishRefusal';
  }
}

/**
 * A published directory, or one that refuses everything.
 *
 * `root` null is the default and the safe one: every method answers `-32009`
 * naming what would be needed, which is a refusal rather than an absence - the
 * host asked something this client understands and declined.
 */
export function publish(options: { root?: string; writable?: boolean; clientId?: string } = {}): Published {
  const root = options.root === undefined ? null : path.resolve(options.root);
  const writable = options.writable === true;
  /*
   * Until a connection exists there is no id to publish under.
   *
   * `ahpc` is the placeholder and is deliberately one a host will not route:
   * `as()` is called with the real `clientId` before anything can be asked
   * for, and a prefix that happened to work without it would hide the day it
   * was not called.
   */
  const PREFIX = publishedUnder(options.clientId ?? 'ahpc');

  /**
   * The file a `virtual://<clientId>/...` names, or a refusal.
   *
   * Resolved and then checked to be inside the published directory, because
   * `..` in a URI is a host asking for the rest of the disk. The check is on
   * the resolved path rather than on the text: `a/../../etc` is only visibly
   * outside once it has been resolved.
   */
  const where = (uri: unknown): string => {
    if (root === null) {
      throw new PublishRefusal(PERMISSION_DENIED, 'This client publishes nothing. Start it with --publish.');
    }
    if (typeof uri !== 'string' || !uri.startsWith(PREFIX)) {
      throw new PublishRefusal(PERMISSION_DENIED, `This client serves only ${PREFIX}`);
    }
    const inside = path.resolve(root, decodeURIComponent(uri.slice(PREFIX.length)));
    if (inside !== root && !inside.startsWith(`${root}${path.sep}`)) {
      throw new PublishRefusal(PERMISSION_DENIED, 'That is outside what this client published.');
    }
    return inside;
  };

  const mutable = (): void => {
    if (!writable) throw new PublishRefusal(PERMISSION_DENIED, 'What this client published is read-only.');
  };

  const gone = (uri: unknown): never => {
    throw new PublishRefusal(NOT_FOUND, `${String(uri)} is not there.`);
  };

  return {
    root,
    writable,
    prefix: PREFIX,
    as: (clientId) => publish({
      ...(root === null ? {} : { root }),
      ...(writable ? { writable } : {}),
      clientId,
    }),
    handlers: () => ({
      resourceRead: async (params: unknown) => {
        const uri = (params as { uri?: unknown }).uri;
        const at = where(uri);
        let body: Buffer;
        try { body = await readFile(at); }
        catch { return gone(uri); }
        // Binary MUST be base64 and text MAY be utf-8. A NUL byte is the cheap
        // test, and a host handed a PNG as utf-8 receives something that is
        // not the file.
        return body.includes(0)
          ? { data: body.toString('base64'), encoding: 'base64' }
          : { data: body.toString('utf8'), encoding: 'utf-8' };
      },

      resourceList: async (params: unknown) => {
        const uri = (params as { uri?: unknown }).uri;
        const at = where(uri);
        try {
          const found = await readdir(at, { withFileTypes: true });
          return {
            entries: found.map((entry) => ({
              uri: `${PREFIX}${path.relative(root as string, path.join(at, entry.name))}`,
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
            })),
          };
        }
        catch { return gone(uri); }
      },

      resourceResolve: async (params: unknown) => {
        const uri = (params as { uri?: unknown }).uri;
        const at = where(uri);
        try {
          const found = await stat(at);
          return {
            uri: String(uri),
            type: found.isDirectory() ? 'directory' : 'file',
            size: found.size,
            mtime: new Date(found.mtimeMs).toISOString(),
          };
        }
        catch { return gone(uri); }
      },

      /*
       * The one method that answers without touching the disk.
       *
       * `resourceRequest` is how a peer asks for access it does not have. This
       * client has no way to put the question to whoever started it - it may
       * be a pipe in a script - so the honest answer is that the grant is a
       * flag rather than a conversation.
       */
      resourceRequest: async () => ({
        granted: false,
        reason: writable
          ? 'This client grants only what --publish named.'
          : 'This client published its directory read-only. Restart it with --publish-writable.',
      }),

      resourceWrite: async (params: unknown) => {
        const { uri, data, encoding } = params as { uri?: unknown; data?: unknown; encoding?: unknown };
        mutable();
        const at = where(uri);
        await writeFile(at, encoding === 'base64'
          ? Buffer.from(String(data), 'base64')
          : Buffer.from(String(data), 'utf8'));
        return {};
      },

      resourceDelete: async (params: unknown) => {
        const { uri, recursive } = params as { uri?: unknown; recursive?: unknown };
        mutable();
        await rm(where(uri), { recursive: recursive === true });
        return {};
      },

      resourceMkdir: async (params: unknown) => {
        mutable();
        await mkdir(where((params as { uri?: unknown }).uri), { recursive: true });
        return {};
      },

      resourceMove: async (params: unknown) => {
        const { source, destination } = params as { source?: unknown; destination?: unknown };
        mutable();
        await rename(where(source), where(destination));
        return {};
      },

      resourceCopy: async (params: unknown) => {
        const { source, destination } = params as { source?: unknown; destination?: unknown };
        mutable();
        await copyFile(where(source), where(destination));
        return {};
      },
    }),
  };
}


