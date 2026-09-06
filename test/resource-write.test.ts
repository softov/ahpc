/*
 * The shared `resourceWrite` conformance fixture, run against this client.
 *
 * `test/fixtures/resource-write.json` is checked into this repository and into
 * `ahpd` byte for byte, and each runs it against its own copy of the
 * algorithm - AHP's write is symmetrical, so a host asks a client for one
 * exactly as a client asks a host, and the two implementations have to agree
 * on every flag, every precondition and every clamp. They were wrong together
 * once and corrected together once; this is what turns the next divergence
 * into a failing build rather than something a review has to notice.
 *
 * The other runner is `ahpd`'s `test/resource-write.test.ts`.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { publish, publishedUnder } from '../src/ahp/publish.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'fixtures/resource-write.json'), 'utf8')) as Fixture;

interface Case {
  name: string;
  path?: string;
  before: 'absent' | 'directory' | { file: string } | { symlinkTo: string };
  write: Record<string, unknown>;
  then: { content?: string; absent?: boolean; refusal?: string; elsewhere?: string };
}
interface Fixture { revision: string; cases: Case[] }

/** The codes this client answers with, under the names the fixture uses. */
const REFUSALS: Record<string, number> = {
  notFound: -32008,
  refused: -32009,
  alreadyExists: -32010,
  conflict: -32011,
};

const ID = 'probe';

let root: string;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ahpc-write-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

/** One method off a published directory, refusing loudly if this build has no such handler. */
const method = (name: string): ((params: unknown) => Promise<unknown>) => {
  const found = publish({ root, writable: true, clientId: ID }).handlers()[name];
  if (found === undefined) throw new Error(`This client publishes no ${name}.`);
  return found;
};

for (const one of fixture.cases) {
  it(one.name, async () => {
    const relative = one.path ?? 'file.txt';
    const at = join(root, relative);
    mkdirSync(dirname(at), { recursive: true });

    if (one.before === 'directory') mkdirSync(at);
    else if (typeof one.before === 'object' && 'file' in one.before) writeFileSync(at, one.before.file);
    else if (typeof one.before === 'object' && 'symlinkTo' in one.before) {
      writeFileSync(join(root, one.before.symlinkTo), 'not this');
      symlinkSync(join(root, one.before.symlinkTo), at);
    }
    // 'absent' leaves nothing, and the parent above is what a case with a
    // path of its own uses to say the *directory* is missing too.
    if (one.before === 'absent' && one.path !== undefined) rmSync(dirname(at), { recursive: true, force: true });

    const uri = `${publishedUnder(ID)}${relative}`;
    /*
     * The etag from this end's own `resourceResolve`.
     *
     * Read rather than computed, because a fixture that carried a literal tag
     * would be a fixture about `stat` output. `stale` is a tag no file has.
     */
    let ifMatch = one.write.ifMatch;
    if (ifMatch === 'current') {
      ifMatch = (await method('resourceResolve')({ uri }) as { etag?: string }).etag;
      expect(ifMatch, 'the fixture asked for the current etag and this end has none').toBeTypeOf('string');
    }
    else if (ifMatch === 'stale') ifMatch = 'W/"0-0"';

    const asked = method('resourceWrite')({
      ...one.write,
      uri,
      ...(ifMatch === undefined ? {} : { ifMatch }),
    });

    if (one.then.refusal !== undefined) {
      const refused = await asked.then(() => undefined, (error: unknown) => error);
      expect(refused, 'this was supposed to be refused').toBeInstanceOf(Error);
      expect((refused as { code?: number }).code).toBe(REFUSALS[one.then.refusal]);
    }
    else await asked;

    if (one.then.content !== undefined) expect(readFileSync(at, 'utf8')).toBe(one.then.content);
    if (one.then.absent === true) expect(existsSync(at)).toBe(false);
    if (one.then.elsewhere !== undefined) {
      // A link that was followed writes through it, and the file it points at
      // is the only place that shows.
      const target = (one.before as { symlinkTo: string }).symlinkTo;
      expect(readFileSync(join(root, target), 'utf8')).toBe(one.then.elsewhere);
    }
  });
}
