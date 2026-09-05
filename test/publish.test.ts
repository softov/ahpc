/*
 * What this client answers when a host asks it for something.
 *
 * AHP is symmetrical - `subscriptions.md` lists the nine `resource*` methods
 * plus `createResourceWatch` as server-initiable - and the reverse direction
 * had no implementation here at all. These drive the handlers the protocol
 * client is given, which is where a host-initiated request lands.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
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

  it('will not write outside the directory even when writable', async () => {
    const handlers = publish({ root, writable: true }).handlers();
    expect(await refused(() => handlers.resourceWrite?.({
      uri: `${PUBLISH_PREFIX}../escaped.txt`, data: 'no', encoding: 'utf-8',
    }) as Promise<unknown>)).toBe(-32009);
  });

  it('answers a request for access with what would grant it', async () => {
    const handlers = publish({ root }).handlers();
    const answer = await handlers.resourceRequest?.({ uri: `${PUBLISH_PREFIX}note.txt` }) as
      { granted: boolean; reason: string };
    // This client cannot put the question to whoever started it - it may be a
    // pipe in a script - so the grant is a flag and the refusal says so.
    expect(answer.granted).toBe(false);
    expect(answer.reason).toContain('--publish-writable');
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
