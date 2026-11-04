/*
 * A still with text left in the composer.
 *
 * `--type /` draws the slash menu open, which is a picture of the docs. The
 * text is not sent: a still that sent it would start a turn.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tui } from '../src/tui.js';

let home: string;
let had: { XDG_CONFIG_HOME?: string; AHPC_HOST?: string };

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ahpc-still-type-'));
  had = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, AHPC_HOST: process.env.AHPC_HOST };
  process.env.XDG_CONFIG_HOME = home;
  delete process.env.AHPC_HOST;
});

afterEach(() => {
  for (const [key, value] of Object.entries(had)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(home, { recursive: true, force: true });
  process.exitCode = undefined;
});

/** A still against the scripted host, as text without colour. */
const still = async (...flags: string[]): Promise<{ out: string; err: string }> => {
  let out = '';
  let err = '';
  const outWrite = process.stdout.write.bind(process.stdout);
  const errWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array) => { out += String(chunk); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { err += String(chunk); return true; }) as typeof process.stderr.write;
  try {
    await tui(['--static', '--width', '80', '--height', '20', ...flags]);
  }
  finally {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
  }
  // eslint-disable-next-line no-control-regex
  return { out: out.replace(/\u001b\[[0-9;]*m/g, ''), err };
};

describe('a still with --type', () => {
  it('leaves the text in the composer, unsent', async () => {
    const { out } = await still('--screen', 'new', '--type', 'hello there');
    expect(out).toContain('hello there');
    expect(out).toContain('A new session');
  });

  it('draws the slash menu for a slash', async () => {
    const { out } = await still('--screen', 'new', '--type', '/');
    expect(out).toContain('/config');
  });
});
