/*
 * A still that runs a command before its frame.
 *
 * `--command app.palette` draws the palette open, and a command that asks for
 * something, such as `harness.choose`, draws the palette on its question, as
 * a key bound to it does. The pictures of the docs are drawn this way.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tui } from '../src/tui.js';

let home: string;
let had: { XDG_CONFIG_HOME?: string; AHPC_HOST?: string };

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ahpc-still-command-'));
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

describe('a still with --command', () => {
  it('draws the palette open with app.palette', async () => {
    const { out } = await still('--screen', 'sessions', '--command', 'app.palette');
    expect(out).toContain('Type a command');
  });

  it('draws the agent list with harness.choose on the new session screen', async () => {
    const { out } = await still('--screen', 'new', '--command', 'harness.choose');
    expect(out).toContain('Which agent runs this');
    expect(out).toContain('Copilot CLI');
  });

  it('stops with a sentence for a command nobody has', async () => {
    const { out, err } = await still('--screen', 'new', '--command', 'nope');
    expect(err).toBe('No command called nope.\n');
    expect(out).toBe('');
    expect(process.exitCode).toBe(1);
  });
});
