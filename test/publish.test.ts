/*
 * What this client answers when a host asks it for something.
 *
 * AHP is symmetrical - `subscriptions.md` lists the nine `resource*` methods
 * plus `createResourceWatch` as server-initiable - and the reverse direction
 * had no implementation here at all. These drive the handlers the protocol
 * client is given, which is where a host-initiated request lands.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publish, publishedUnder } from '../src/ahp/publish.js';

/** The authority a host routes on is the client's own id. */
const PUBLISH_PREFIX = publishedUnder('ahpc');

let root = '';

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'ahpc-publish-'));
  await writeFile(path.join(root, 'note.txt'), 'hello');
  await mkdir(path.join(root, 'sub'));
  await writeFile(path.join(root, 'sub', 'deep.txt'), 'inside');
});

afterAll(async () => { await rm(root, { recursive: true, force: true }); });

/** The refusal code, or nothing where the call succeeded. */
async function refused(run: () => Promise<unknown>): Promise<number | undefined> {
  try { await run(); return undefined; }
  catch (error) { return (error as { code?: number }).code; }
}

describe('a client that published nothing refuses everything', () => {
  it('answers -32009 rather than letting the method not exist', async () => {
    const handlers = publish().handlers();
    // Not `-32601`: the method is implemented and the answer is no. A host
    // told "no such method" learns something different from one told it may
    // not.
    expect(await refused(() => handlers.resourceRead?.({ uri: `${PUBLISH_PREFIX}note.txt` }) as Promise<unknown>))
      .toBe(-32009);
  });
});

describe('a published directory serves what is inside it', () => {
  it('reads a file, as text', async () => {
    const handlers = publish({ root }).handlers();
    const answer = await handlers.resourceRead?.({ uri: `${PUBLISH_PREFIX}note.txt` });
    expect(answer).toEqual({ data: 'hello', encoding: 'utf-8' });
  });

  it('sends binary as base64, which the protocol says it MUST', async () => {
    await writeFile(path.join(root, 'blob.bin'), Buffer.from([0, 1, 2, 250]));
    const handlers = publish({ root }).handlers();
    const answer = await handlers.resourceRead?.({ uri: `${PUBLISH_PREFIX}blob.bin` }) as { encoding: string };
    expect(answer.encoding).toBe('base64');
  });

  it('lists a directory in URIs the host can ask back for', async () => {
    const handlers = publish({ root }).handlers();
    const answer = await handlers.resourceList?.({ uri: PUBLISH_PREFIX }) as { entries: { uri: string }[] };
    // A listing whose entries cannot be handed straight back is a listing you
    // have to assemble paths out of by hand.
    expect(answer.entries.some((one) => one.uri === `${PUBLISH_PREFIX}sub`)).toBe(true);
  });

  it('refuses a path outside what was published', async () => {
    const handlers = publish({ root }).handlers();
    // Resolved before it is checked: `sub/../../etc/passwd` is only visibly
    // outside once the `..` have been applied.
    expect(await refused(() => handlers.resourceRead?.({
      uri: `${PUBLISH_PREFIX}sub/../../etc/passwd`,
    }) as Promise<unknown>)).toBe(-32009);
  });

  it('refuses a scheme that is not the one it publishes under', async () => {
    const handlers = publish({ root }).handlers();
    expect(await refused(() => handlers.resourceRead?.({ uri: 'file:///etc/passwd' }) as Promise<unknown>))
      .toBe(-32009);
  });

  it('says a file that is not there is not there', async () => {
    const handlers = publish({ root }).handlers();
    // `-32008`, which is a different answer from "you may not".
    expect(await refused(() => handlers.resourceRead?.({ uri: `${PUBLISH_PREFIX}missing.txt` }) as Promise<unknown>))
      .toBe(-32008);
  });
});

describe('the root is the root with or without its slash', () => {
  /*
   * RFC 3986 6.2.3 - an empty path with an authority present is `/`. Anything
   * composing the root out of a client id read off `initialize` produces the
   * bare form, so refusing it made the publication unlistable to every caller
   * that had not thought to append a slash.
   */
  const bare = PUBLISH_PREFIX.slice(0, -1);

  it('lists the publication addressed without a trailing slash', async () => {
    const handlers = publish({ root }).handlers();
    const listed = await handlers.resourceList?.({ uri: bare }) as { entries: { name: string }[] };
    const withSlash = await handlers.resourceList?.({ uri: PUBLISH_PREFIX }) as { entries: { name: string }[] };
    expect(listed.entries.map((one) => one.name).sort())
      .toEqual(withSlash.entries.map((one) => one.name).sort());
    expect(listed.entries.length).toBeGreaterThan(0);
  });

  it('resolves it as the directory it is', async () => {
    const handlers = publish({ root }).handlers();
    const found = await handlers.resourceResolve?.({ uri: bare }) as { type: string };
    expect(found.type).toBe('directory');
  });

  it('does not let the bare form match a longer client id', async () => {
    // `virtual://ahpc` and `virtual://ahpc-other` share a prefix and are two
    // different clients. Equality rather than a prefix test is what keeps them
    // apart.
    const handlers = publish({ root }).handlers();
    expect(await refused(() => handlers.resourceList?.({ uri: `${bare}-other/` }) as Promise<unknown>))
      .toBe(-32009);
  });

  it('still refuses an absolute path smuggled in after the authority', async () => {
    // `virtual://ahpc//etc/passwd` leaves `/etc/passwd`, which `path.resolve`
    // returns unchanged rather than joining. The containment check is what
    // catches it, and it is the reason that check reads the resolved path.
    const handlers = publish({ root }).handlers();
    expect(await refused(() => handlers.resourceRead?.({ uri: `${bare}//etc/passwd` }) as Promise<unknown>))
      .toBe(-32009);
  });

  it('reads through a dot segment, which resolves to the same file', async () => {
    const handlers = publish({ root }).handlers();
    const answer = await handlers.resourceRead?.({ uri: `${PUBLISH_PREFIX}./note.txt` });
    expect(answer).toEqual({ data: 'hello', encoding: 'utf-8' });
  });
});

describe('writing is a second decision, not part of publishing', () => {
  it('refuses a write into a read-only publication', async () => {
    const handlers = publish({ root }).handlers();
    expect(await refused(() => handlers.resourceWrite?.({
      uri: `${PUBLISH_PREFIX}note.txt`, data: 'no', encoding: 'utf-8',
    }) as Promise<unknown>)).toBe(-32009);
  });

  it('takes one where the directory was published writable', async () => {
    const handlers = publish({ root, writable: true }).handlers();
    await handlers.resourceWrite?.({ uri: `${PUBLISH_PREFIX}written.txt`, data: 'yes', encoding: 'utf-8' });
    expect(await readFile(path.join(root, 'written.txt'), 'utf8')).toBe('yes');
  });

  it('honours write modes and preconditions', async () => {
    const handlers = publish({ root, writable: true }).handlers();
    const uri = `${PUBLISH_PREFIX}write-semantics.txt`;
    await writeFile(path.join(root, 'write-semantics.txt'), 'ABCDEFGH');
    await handlers.resourceWrite?.({ uri, data: 'xy', encoding: 'utf-8', mode: 'insert', position: 3 });
    expect(await readFile(path.join(root, 'write-semantics.txt'), 'utf8')).toBe('ABCxyDEFGH');
    await handlers.resourceWrite?.({ uri, data: '!', encoding: 'utf-8', mode: 'append', position: 2 });
    expect(await readFile(path.join(root, 'write-semantics.txt'), 'utf8')).toBe('ABCxyDEF!GH');
    await handlers.resourceWrite?.({ uri, data: '.', encoding: 'utf-8', mode: 'truncate', position: 4 });
    expect(await readFile(path.join(root, 'write-semantics.txt'), 'utf8')).toBe('ABCx.');

    expect(await refused(() => handlers.resourceWrite?.({
      uri, data: 'no', encoding: 'utf-8', createOnly: true,
    }) as Promise<unknown>)).toBe(-32010);
    // The code says it was refused; only the file says the refusal happened
    // before anything was written, which is the whole point of the flag.
    expect(await readFile(path.join(root, 'write-semantics.txt'), 'utf8')).toBe('ABCx.');
    const { etag } = await handlers.resourceResolve?.({ uri }) as { etag: string };
    await handlers.resourceWrite?.({ uri, data: 'new', encoding: 'utf-8', ifMatch: etag });
    expect(await refused(() => handlers.resourceWrite?.({
      uri, data: 'stale', encoding: 'utf-8', ifMatch: etag,
    }) as Promise<unknown>)).toBe(-32011);
    expect(await readFile(path.join(root, 'write-semantics.txt'), 'utf8')).toBe('new');
  });

  it('allows only one simultaneous createOnly or matching-etag write', async () => {
    const handlers = publish({ root, writable: true }).handlers();
    const created = `${PUBLISH_PREFIX}competing-create.txt`;
    const creates = await Promise.allSettled(Array.from({ length: 8 }, (_, number) =>
      handlers.resourceWrite?.({ uri: created, data: String(number), encoding: 'utf-8', createOnly: true })));
    expect(creates.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of creates.filter((result) => result.status === 'rejected')) {
      expect((result.reason as { code: number }).code).toBe(-32010);
    }
    // Eight writers, eight different digits: a file holding one of them whole
    // is what says the seven that were refused wrote nothing.
    expect(['0', '1', '2', '3', '4', '5', '6', '7'])
      .toContain(await readFile(path.join(root, 'competing-create.txt'), 'utf8'));

    const uri = `${PUBLISH_PREFIX}competing-etag.txt`;
    await writeFile(path.join(root, 'competing-etag.txt'), 'before');
    const { etag } = await handlers.resourceResolve?.({ uri }) as { etag: string };
    const updates = await Promise.allSettled(Array.from({ length: 8 }, (_, number) =>
      handlers.resourceWrite?.({ uri, data: String(number), encoding: 'utf-8', ifMatch: etag })));
    expect(updates.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of updates.filter((result) => result.status === 'rejected')) {
      expect((result.reason as { code: number }).code).toBe(-32011);
    }
    // As above, and here a lost update would leave 'before' or a mixture.
    expect(['0', '1', '2', '3', '4', '5', '6', '7'])
      .toContain(await readFile(path.join(root, 'competing-etag.txt'), 'utf8'));
  });

  it('says why a directory or a link is refused, rather than reporting an errno', async () => {
    /*
     * Both refusals are the open flags' doing - `O_NOFOLLOW` answers `ELOOP`
     * and a directory opened for writing answers `EISDIR` - and both used to
     * reach the host as the raw error. The code alone is the same either way,
     * which is how it went unnoticed, so this asserts the words.
     */
    const handlers = publish({ root, writable: true }).handlers();
    await mkdir(path.join(root, 'adir'), { recursive: true });
    const said = async (name: string): Promise<string> => {
      try {
        await handlers.resourceWrite?.({ uri: `${PUBLISH_PREFIX}${name}`, data: 'x', encoding: 'utf-8' });
        return '';
      }
      catch (error) { return String((error as { message?: string }).message ?? ''); }
    };
    const directory = await said('adir');
    expect(directory).toContain('is a directory');
    expect(directory).not.toContain('EISDIR');

    /*
     * The link half, and a link that stays inside the publication.
     *
     * Refused all the same. The boundary is not what is being enforced here -
     * the destination is published and readable - it is that a host asking to
     * write `X` and having the bytes land in `Y` is a surprise, and that
     * `ahpd` refuses the same write. Reading through a link is still allowed
     * at both ends.
     */
    await writeFile(path.join(root, 'link-target.txt'), 'target');
    await symlink(path.join(root, 'link-target.txt'), path.join(root, 'inside-write-link.txt'));
    const inside = await said('inside-write-link.txt');
    expect(inside).toContain('is a symbolic link');
    expect(inside).not.toContain('ELOOP');
    expect(await readFile(path.join(root, 'link-target.txt'), 'utf8')).toBe('target');
  });

  it('refuses a copy or a move onto a link, and honours failIfExists', async () => {
    /*
     * The destination half, which the source does not share.
     *
     * A destination that is a link would carry the bytes wherever it points,
     * which is the hole `O_NOFOLLOW` closes for a write; and `failIfExists`
     * is the caller saying it does not want an overwrite, which was being
     * read off the wire and dropped. `ahpd` refuses both.
     */
    const handlers = publish({ root, writable: true }).handlers();
    await writeFile(path.join(root, 'pair-source.txt'), 'source');
    await writeFile(path.join(root, 'pair-target.txt'), 'target');
    await symlink(path.join(root, 'pair-target.txt'), path.join(root, 'pair-link.txt'));

    for (const method of ['resourceCopy', 'resourceMove'] as const) {
      expect(await refused(() => handlers[method]?.({
        source: `${PUBLISH_PREFIX}pair-source.txt`, destination: `${PUBLISH_PREFIX}pair-link.txt`,
      }) as Promise<unknown>)).toBe(-32009);
    }
    // Neither the link nor what it points at moved, and the source is still
    // where it was - a refused move that had already renamed would be a file
    // nobody can find.
    expect(await readFile(path.join(root, 'pair-target.txt'), 'utf8')).toBe('target');
    expect(await readFile(path.join(root, 'pair-source.txt'), 'utf8')).toBe('source');

    await writeFile(path.join(root, 'pair-there.txt'), 'already');
    expect(await refused(() => handlers.resourceCopy?.({
      source: `${PUBLISH_PREFIX}pair-source.txt`,
      destination: `${PUBLISH_PREFIX}pair-there.txt`,
      failIfExists: true,
    }) as Promise<unknown>)).toBe(-32010);
    expect(await readFile(path.join(root, 'pair-there.txt'), 'utf8')).toBe('already');

    // And without the flag it is an ordinary overwrite, which is the default
    // the protocol gives these two.
    await handlers.resourceCopy?.({
      source: `${PUBLISH_PREFIX}pair-source.txt`, destination: `${PUBLISH_PREFIX}pair-there.txt`,
    });
    expect(await readFile(path.join(root, 'pair-there.txt'), 'utf8')).toBe('source');
  });

  it('will not write outside the directory even when writable', async () => {
    const handlers = publish({ root, writable: true }).handlers();
    expect(await refused(() => handlers.resourceWrite?.({
      uri: `${PUBLISH_PREFIX}../escaped.txt`, data: 'no', encoding: 'utf-8',
    }) as Promise<unknown>)).toBe(-32009);
    await expect(readFile(path.join(root, '..', 'escaped.txt'))).rejects.toThrow();
  });

  it('answers a request for access with what would grant it', async () => {
    const handlers = publish({ root }).handlers();
    const answer = await handlers.resourceRequest?.({ uri: `${PUBLISH_PREFIX}note.txt` }) as
      { granted: boolean; reason: string };
    // This client cannot put the question to whoever started it - it may be a
    // pipe in a script - so the grant is a flag and the refusal says so.
    expect(answer.granted).toBe(false);
    // The whole sentence: a refusal that names the flag is only useful if
    // the rest of it says what the flag would do.
    expect(answer.reason).toBe('This client published its directory read-only. Restart it with --publish-writable.');
  });
});

describe('the authority is the client id a host routes on', () => {
  it('publishes under the connection\'s own id, not a fixed name', async () => {
    const served = publish({ root }).as('ahpc-3f2a1b0c');
    expect(served.prefix).toBe('virtual://ahpc-3f2a1b0c/');

    // And answers for it. A fixed authority reaches nothing: a host reads the
    // authority out of the URI and matches it against the connection that
    // sent it, so `virtual://ahpc/` from a client called `ahpc-3f2a1b0c` is
    // addressed to a client that is not there.
    const answer = await served.handlers().resourceRead?.({ uri: 'virtual://ahpc-3f2a1b0c/note.txt' });
    expect(answer).toEqual({ data: 'hello', encoding: 'utf-8' });
  });

  it('refuses a URI under somebody else\'s id', async () => {
    const served = publish({ root }).as('ahpc-3f2a1b0c');
    expect(await refused(() => served.handlers().resourceRead?.({
      uri: 'virtual://another-client/note.txt',
    }) as Promise<unknown>)).toBe(-32009);
  });

  it('lists in URIs addressed the same way, so a host can ask back', async () => {
    const served = publish({ root }).as('ahpc-3f2a1b0c');
    const answer = await served.handlers().resourceList?.({ uri: 'virtual://ahpc-3f2a1b0c/' }) as
      { entries: { uri: string }[] };
    expect(answer.entries.every((one) => one.uri.startsWith('virtual://ahpc-3f2a1b0c/'))).toBe(true);
  });

  it('is shaped the way a host parses it', () => {
    // What the routing actually does: scheme, then authority, and neither
    // `file:` nor an `ahp-` channel is a client.
    const found = /^([a-zA-Z][\w+.-]*):\/\/([^/]+)/.exec(publishedUnder('ahpc-3f2a1b0c'));
    expect(found?.[1]).toBe('virtual');
    expect(found?.[2]).toBe('ahpc-3f2a1b0c');
  });
});

/*
 * The code a host actually receives, which is not the code that was thrown.
 *
 * Everything above calls the handlers directly, so a refusal was tested by
 * reading `error.code` off a rejected promise. The package answers a
 * host-initiated request by reading a code off its own `RpcError` and calling
 * anything else `-32603 InternalError`, so both refusals arrived as internal
 * errors with their messages intact and their codes gone - a host could read
 * the sentence and not tell "read-only" from "not there". Nothing here saw it,
 * because nothing here went through the wire.
 */
describe('a refusal reaches the host as the code it was refused with', () => {
  /** A host that completes a handshake and can put a question to the client. */
  const hosted = async (options: { root?: string; writable?: boolean }) => {
    const { InMemoryTransport } = await import('@microsoft/agent-host-protocol/client');
    const { liveHost } = await import('../src/ahp/live.js');
    const [mine, theirs] = InMemoryTransport.pair() as [
      { send(text: string): Promise<void>; recv(): Promise<unknown>; close(): Promise<void> },
      { send(text: string): Promise<void>; recv(): Promise<unknown>; close(): Promise<void> },
    ];

    const answers = new Map<number, (message: Record<string, unknown>) => void>();
    let next = 9000;
    void (async () => {
      for (;;) {
        const frame = await theirs.recv().catch(() => null) as
          { kind: string; text?: string; message?: unknown } | null;
        if (frame === null) return;
        const text = frame.kind === 'text' ? frame.text as string : JSON.stringify(frame.message);
        let message: Record<string, unknown>;
        try { message = JSON.parse(text) as Record<string, unknown>; }
        catch { continue; }
        const { id, method } = message as { id?: number; method?: string };
        // The client's answer to something this host asked.
        if (method === undefined && typeof id === 'number') { answers.get(id)?.(message); continue; }
        if (id === undefined || method === undefined) continue;
        const result = method === 'initialize'
          ? { protocolVersion: '0.9.0', serverSeq: 1, snapshots: [] }
          : {};
        await theirs.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
      }
    })();

    const host = await liveHost({
      url: 'ws://scripted',
      clientId: 'ahpc-codes',
      backoff: [0],
      keepaliveMs: 0,
      lingerMs: 0,
      publish: publish({ ...(options.root === undefined ? {} : { root: options.root }), ...(options.writable ? { writable: true } : {}) }),
      connect: async () => mine as never,
    } as never);

    /** Ask the client something, the way a host does, and read its answer. */
    const ask = async (method: string, params: unknown): Promise<{ code?: number; message?: string }> => {
      const id = next += 1;
      const got = new Promise<Record<string, unknown>>((resolve) => answers.set(id, resolve));
      await theirs.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
      const answer = await got;
      return (answer.error ?? {}) as { code?: number; message?: string };
    };

    return { host, ask };
  };

  it('says -32009 for what it will not serve, not -32603', async () => {
    const { host, ask } = await hosted({ root });
    const error = await ask('resourceWrite', {
      uri: `${publishedUnder('ahpc-codes')}note.txt`,
      data: 'x',
      encoding: 'utf-8',
    });
    expect(error.code).toBe(-32009);
    /*
     * The whole message and not a fragment of it. `toContain` passed while
     * the wire carried `RPC error -32009: What this client published is
     * read-only.` - the package's own constructor formats the message it is
     * given and the client sends that formatted string, so the code arrives
     * twice and the receiver prefixes it a third time on the way in.
     */
    expect(error.message).toBe('What this client published is read-only.');
    await host.close();
  });

  it('says -32008 for what is not there', async () => {
    const { host, ask } = await hosted({ root, writable: true });
    const error = await ask('resourceResolve', { uri: `${publishedUnder('ahpc-codes')}absent.txt` });
    expect(error.code).toBe(-32008);
    /*
     * And the sentence, which is the half a reader acts on. The code says a
     * resource is missing; only the message says which, and it crosses the
     * same seam that was prefixing the other one. Asserting the code alone
     * checks the envelope and not what was promised to be inside it.
     */
    expect(error.message).toBe(`${publishedUnder('ahpc-codes')}absent.txt is not there.`);
    await host.close();
  });

  it('still answers -32601 for the method it does not implement', async () => {
    const { host, ask } = await hosted({ root });
    const error = await ask('createResourceWatch', { uri: `${publishedUnder('ahpc-codes')}note.txt` });
    // The code only, deliberately: this message is the package's own wording
    // for a method with no handler, not a sentence this client promises, and
    // pinning it here would assert somebody else's prose across their
    // versions.
    expect(error.code).toBe(-32601);
    await host.close();
  });
});

it('keeps every publication operation inside the real directory', async () => {
  const outside = await mkdtemp(path.join(tmpdir(), 'ahpc-outside-'));
  try {
    const target = path.join(outside, 'sentinel');
    await writeFile(target, 'outside');
    await symlink(outside, path.join(root, 'outside-dir'));
    await symlink(target, path.join(root, 'outside-file'));
    await symlink(path.join(outside, 'absent'), path.join(root, 'outside-dangling'));
    const uri = (name: string) => `${PUBLISH_PREFIX}${name}`;
    for (const writable of [false, true]) {
      const handlers = publish({ root, writable }).handlers();
      for (const name of ['outside-file', 'outside-dir/sentinel', 'outside-dangling']) {
        for (const method of ['resourceRead', 'resourceResolve', 'resourceWrite', 'resourceDelete', 'resourceMkdir']) {
          expect(await refused(() => handlers[method]!({ uri: uri(name), data: 'changed', recursive: true }))).toBe(-32009);
        }
        for (const method of ['resourceCopy', 'resourceMove']) {
          expect(await refused(() => handlers[method]!({ source: uri('note.txt'), destination: uri(name) }))).toBe(-32009);
          expect(await refused(() => handlers[method]!({ source: uri(name), destination: uri('copy.txt') }))).toBe(-32009);
        }
      }
      expect(await refused(() => handlers.resourceList!({ uri: uri('outside-dir') }))).toBe(-32009);
    }
    expect(await readFile(target, 'utf8')).toBe('outside');
    // The refusals that would have created something rather than changed it:
    // a dangling link written through, and a copy whose source was outside.
    await expect(readFile(path.join(outside, 'absent'))).rejects.toThrow();
    await expect(readFile(path.join(root, 'copy.txt'))).rejects.toThrow();
  } finally { await rm(outside, { recursive: true, force: true }); }
});

it('can read a link whose destination is still published', async () => {
  await symlink(path.join(root, 'note.txt'), path.join(root, 'inside-link'));
  const handlers = publish({ root }).handlers();
  expect(await handlers.resourceRead!({ uri: `${PUBLISH_PREFIX}inside-link` })).toMatchObject({ data: 'hello' });
});
