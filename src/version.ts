/*
 * What version this is, read from the manifest rather than written twice.
 *
 * A literal in the source is a literal that drifts: the one in `mcp/serve.ts`
 * said 0.1 while the package said 0.2 within a day of being written, and a
 * `--version` that lies is worse than no `--version` at all.
 *
 * Found by walking up from this module rather than by a fixed relative path,
 * because the depth differs: `src/version.ts` in a checkout and
 * `dist/src/version.js` in an install, and neither should have to know which
 * it is. `package.json` is always at the package root and npm always ships
 * it, so the first one above this file is the right one.
 *
 * This file imports nothing but Node, on purpose. The entry point answers
 * `--version` before it decides which front end to load, and loading one to
 * answer it would make the fastest question the slowest.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The name and version in the nearest `package.json`, or `unknown` for each where there is none. */
export const manifest = (): { name: string; version: string } => {
  let at = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      const found = JSON.parse(readFileSync(join(at, 'package.json'), 'utf8')) as { name?: unknown; version?: unknown };
      if (typeof found.version === 'string') {
        return { name: typeof found.name === 'string' ? found.name : 'unknown', version: found.version };
      }
    }
    catch { /* not this directory */ }
    const up = dirname(at);
    // The root of the filesystem, which means there is no manifest anywhere
    // above this file - a bundler inlined it, or something unpacked it wrong.
    if (up === at) return { name: 'unknown', version: 'unknown' };
    at = up;
  }
};

/** The version alone, which is what `--version` prints. */
export const version = (): string => manifest().version;
