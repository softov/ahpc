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

import { lstat, mkdir, open, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';

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
const ALREADY_EXISTS = -32010;
const CONFLICT = -32011;
const tagOf = (size: number, mtimeMs: number): string => `W/"${size.toString(16)}-${Math.trunc(mtimeMs).toString(16)}"`;

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
  const writes = new Map<string, Promise<void>>();

  /**
   * The file a `virtual://<clientId>/...` names, or a refusal.
   *
   * Resolved and then checked to be inside the published directory, because
   * `..` in a URI is a host asking for the rest of the disk. The check is on
   * the resolved path rather than on the text: `a/../../etc` is only visibly
   * outside once it has been resolved.
   */
  const where = async (uri: unknown, linkItself = false): Promise<string> => {
    if (root === null) {
      throw new PublishRefusal(PERMISSION_DENIED, 'This client publishes nothing. Start it with --publish.');
    }
    /*
     * The publication's own root, with or without the trailing slash.
     *
     * RFC 3986 6.2.3: where an authority is present, an empty path is
     * equivalent to `/`. `virtual://<clientId>` and `virtual://<clientId>/`
     * are one resource, so refusing the first is this publisher being wrong
     * about a URI rather than the caller being sloppy - and a caller cannot
     * fix it, because anything composing the root out of a client id read off
     * `initialize` produces the bare form.
     */
    const bare = PREFIX.slice(0, -1);
    const rest = typeof uri !== 'string' ? null
      : uri === bare ? ''
        : uri.startsWith(PREFIX) ? uri.slice(PREFIX.length)
          : null;
    if (rest === null) {
      throw new PublishRefusal(PERMISSION_DENIED, `This client serves only ${PREFIX}`);
    }
    /*
     * Resolved against the root, and a leading slash is why that is not
     * enough on its own: `virtual://<id>//etc/passwd` leaves `/etc/passwd`,
     * which `path.resolve` treats as absolute and returns unchanged. The
     * containment check below is what refuses it, so it is a guard rather
     * than a tidy-up.
     */
    const inside = path.resolve(root, decodeURIComponent(rest));
    if (inside !== root && !inside.startsWith(`${root}${path.sep}`)) {
      throw new PublishRefusal(PERMISSION_DENIED, 'That is outside what this client published.');
    }
    const boundary = await realpath(root);
    let ancestor = inside;
    const missing: string[] = [];
    for (;;) {
      try {
        const resolved = await realpath(ancestor);
        if (resolved !== boundary && !resolved.startsWith(`${boundary}${path.sep}`)) {
          throw new PublishRefusal(PERMISSION_DENIED, 'That is outside what this client published.');
        }
        if (linkItself && missing.length === 0) {
          return path.join(await realpath(path.dirname(inside)), path.basename(inside));
        }
        return path.join(resolved, ...missing.reverse());
      } catch (error) {
        if (error instanceof PublishRefusal) throw error;
        // A dangling link has a destination too. Never treat it as a new file.
        if (await lstat(ancestor).then((entry) => entry.isSymbolicLink(), () => false)) {
          throw new PublishRefusal(PERMISSION_DENIED, 'That is a dangling symbolic link.');
        }
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) throw error;
        missing.push(path.basename(ancestor));
        ancestor = parent;
      }
    }
  };

  const mutable = (): void => {
    if (!writable) throw new PublishRefusal(PERMISSION_DENIED, 'What this client published is read-only.');
  };

  const gone = (uri: unknown): never => {
    throw new PublishRefusal(NOT_FOUND, `${String(uri)} is not there.`);
  };

  /*
   * `ahpd` carries a second copy of this, in its `resources.ts`.
   *
   * `resourceWrite` is symmetrical - a host asks a client for one exactly as a
   * client asks a host - so both ends need the same flags, the same order of
   * preconditions and the same append and insert arithmetic. This client does
   * not depend on that package and is not going to, so the copy is deliberate.
   * What is not deliberate is fixing one and not the other: everything here
   * was wrong in both at once, and was corrected in both at once.
   */
  const write = async (at: string, uri: unknown, params: {
    data?: unknown; encoding?: unknown; createOnly?: unknown; mode?: unknown;
    position?: unknown; ifMatch?: unknown;
  }): Promise<void> => {
    const before = writes.get(at) ?? Promise.resolve();
    const operation = before.catch(() => {}).then(async () => {
      const mode = params.mode === 'append' || params.mode === 'insert' ? params.mode : 'truncate';
      const position = typeof params.position === 'number' ? params.position : 0;
      const createOnly = params.createOnly === true;
      const ifMatch = typeof params.ifMatch === 'string' ? params.ifMatch : undefined;
      const incoming = params.encoding === 'base64'
        ? Buffer.from(String(params.data), 'base64')
        : Buffer.from(String(params.data), 'utf8');
      let flags = (mode === 'truncate' && position === 0 ? constants.O_WRONLY : constants.O_RDWR) | constants.O_NOFOLLOW;
      if (ifMatch === undefined) flags |= constants.O_CREAT;
      if (createOnly && ifMatch === undefined) flags |= constants.O_EXCL;
      const file = await open(at, flags).catch((error: NodeJS.ErrnoException) => {
        if (createOnly && error.code === 'EEXIST') {
          throw new PublishRefusal(ALREADY_EXISTS, `${String(uri)} already exists.`);
        }
        if (ifMatch !== undefined && error.code === 'ENOENT') {
          throw new PublishRefusal(CONFLICT, `${String(uri)} has changed since ${ifMatch}.`);
        }
        if (error.code === 'ENOENT') return gone(uri);
        // The two refusals the flags produce, said in this client's own words:
        // `O_NOFOLLOW` answers a final link with `ELOOP`, and a directory
        // opened for writing answers `EISDIR`. Both are a refusal to write
        // what was asked for, and neither is useful to a host as an errno.
        if (error.code === 'ELOOP') {
          throw new PublishRefusal(PERMISSION_DENIED, `${String(uri)} is a symbolic link.`);
        }
        if (error.code === 'EISDIR') {
          throw new PublishRefusal(PERMISSION_DENIED, `${String(uri)} is a directory.`);
        }
        throw new PublishRefusal(PERMISSION_DENIED, `Could not write ${String(uri)}: ${error.message}`);
      });
      try {
        if (createOnly && ifMatch !== undefined) {
          throw new PublishRefusal(ALREADY_EXISTS, `${String(uri)} already exists.`);
        }
        if (ifMatch !== undefined) {
          // Off the open descriptor, so what is compared is the file about to
          // be written rather than whatever the name pointed at a moment ago.
          const found = await file.stat();
          if (tagOf(found.size, found.mtimeMs) !== ifMatch) {
            throw new PublishRefusal(CONFLICT, `${String(uri)} has changed since ${ifMatch}.`);
          }
        }
        const held = mode === 'truncate' && position === 0 ? Buffer.alloc(0) : await file.readFile();
        let output: Buffer;
        if (mode === 'append') {
          const cut = Math.max(0, held.length - Math.max(0, position));
          output = Buffer.concat([held.subarray(0, cut), incoming, held.subarray(cut)]);
        }
        else if (mode === 'insert') {
          const cut = Math.min(Math.max(0, position), held.length);
          output = Buffer.concat([held.subarray(0, cut), incoming, held.subarray(cut)]);
        }
        else {
          const cut = Math.min(Math.max(0, position), held.length);
          output = Buffer.concat([held.subarray(0, cut), incoming]);
        }
        let offset = 0;
        while (offset < output.length) {
          const { bytesWritten } = await file.write(output, offset, output.length - offset, offset);
          if (bytesWritten === 0) {
            throw new PublishRefusal(PERMISSION_DENIED, `Could not finish writing ${String(uri)}.`);
          }
          offset += bytesWritten;
        }
        await file.truncate(output.length);
      } finally { await file.close(); }
    });
    writes.set(at, operation);
    try { await operation; }
    finally {
      if (writes.get(at) === operation) writes.delete(at);
    }
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
        const at = await where(uri);
        let body: Buffer;
        try {
          const file = await open(at, constants.O_RDONLY | constants.O_NOFOLLOW);
          try { body = await file.readFile(); } finally { await file.close(); }
        }
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
        const at = await where(uri);
        try {
          const found = await readdir(at, { withFileTypes: true });
          const boundary = await realpath(root as string);
          return {
            entries: found.map((entry) => ({
              uri: `${PREFIX}${path.relative(boundary, path.join(at, entry.name))}`,
              name: entry.name,
              type: entry.isDirectory() ? 'directory' : 'file',
            })),
          };
        }
        catch { return gone(uri); }
      },

      resourceResolve: async (params: unknown) => {
        const uri = (params as { uri?: unknown }).uri;
        const at = await where(uri);
        try {
          const found = await stat(at);
          return {
            uri: String(uri),
            type: found.isDirectory() ? 'directory' : 'file',
            size: found.size,
            mtime: new Date(found.mtimeMs).toISOString(),
            ...(found.isDirectory() ? {} : { etag: tagOf(found.size, found.mtimeMs) }),
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
        const input = params as {
          uri?: unknown; data?: unknown; encoding?: unknown; createOnly?: unknown;
          mode?: unknown; position?: unknown; ifMatch?: unknown;
        };
        mutable();
        await write(await where(input.uri), input.uri, input);
        return {};
      },

      resourceDelete: async (params: unknown) => {
        const { uri, recursive } = params as { uri?: unknown; recursive?: unknown };
        mutable();
        await rm(await where(uri, true), { recursive: recursive === true });
        return {};
      },

      resourceMkdir: async (params: unknown) => {
        mutable();
        await mkdir(await where((params as { uri?: unknown }).uri), { recursive: true });
        return {};
      },

      resourceMove: async (params: unknown) => {
        const { source, destination } = params as { source?: unknown; destination?: unknown };
        mutable();
        await rename(await where(source, true), await where(destination, true));
        return {};
      },

      resourceCopy: async (params: unknown) => {
        const { source, destination } = params as { source?: unknown; destination?: unknown };
        mutable();
        const from = await where(source);
        const to = await where(destination);
        const input = await open(from, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const output = await open(to, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW);
          try {
            const bytes = await input.readFile();
            await output.truncate(0);
            await output.writeFile(bytes);
          } finally { await output.close(); }
        } finally { await input.close(); }
        return {};
      },
    }),
  };
}
