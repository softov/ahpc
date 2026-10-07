/*
 * A turn that failed, and the sentence the host sent with it.
 *
 * Three surfaces read the same part: `prompt` prints it for a person, the
 * tool server hands it to a model as `error`, and `session show` draws it
 * under the status that says the session failed. `spoken` cannot carry it -
 * an error part is not markdown and is dropped - so before this a caller was
 * given a turn that simply stopped.
 *
 * `connect` is replaced so the host under test is one this file holds and can
 * pump. The scripted host's time is a `pump`: the screen drives one from a
 * ticker and a shell run drives none, so a `prompt` against it would wait for
 * a turn that never takes a step. Everything else is the real command.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const held = vi.hoisted(() => ({ host: undefined as { drain(limit?: number): void } | undefined }));

vi.mock('../src/connect.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/connect.js')>();
  const { fakeHost } = await import('../src/ahp/fake.js');
  return { ...real, connect: async () => { held.host = fakeHost(); return held.host; } };
});

/**
 * The scripted session a prompt is said to, and the one already failed.
 *
 * The first is idle with nothing waiting on a person: a session holding a
 * tool confirmation reports what it is waiting on, which would put a second
 * line on stderr and blur what this is measuring.
 */
const SESSION = 'ahp-session:/9c74';
const STOPPED = 'ahp-session:/2d55';
/** What the scripted `fail` turn says went wrong. */
const MESSAGE = 'The turn failed: the tool call to buildbox timed out.';
/** What the seeded failed turn of `STOPPED` says. */
const SEEDED = 'Sign in on the host, then run this turn again.';

let home: string;
let had: { XDG_CONFIG_HOME?: string; AHPC_HOST?: string };

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ahpc-failure-'));
  had = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, AHPC_HOST: process.env.AHPC_HOST };
  // The scripted host is chosen only when nothing named one, and a run that
  // inherited a host would answer about a session the script never heard of.
  process.env.XDG_CONFIG_HOME = home;
  delete process.env.AHPC_HOST;
});

afterEach(() => {
  for (const [key, value] of Object.entries(had)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(home, { recursive: true, force: true });
  held.host = undefined;
});

/** One command, with both streams caught rather than written. */
const capture = async (what: () => Promise<number>): Promise<{ code: number; out: string; err: string }> => {
  let out = '';
  let err = '';
  const outWrite = process.stdout.write.bind(process.stdout);
  const errWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array) => { out += String(chunk); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { err += String(chunk); return true; }) as typeof process.stderr.write;
  try {
    return { code: await what(), out, err };
  }
  finally {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
  }
};

/** The row of a table whose label is this one, or undefined where it is absent. */
const row = (out: string, label: string): string | undefined => out.split('\n').find((one) => one.startsWith(`${label} `));

describe('a failed turn, as a person at a shell sees it', () => {
  it('writes the host sentence on stderr and exits 1, leaving stdout the answer', async () => {
    const { cli } = await import('../src/cli/main.js');
    let finished = false;
    const answering = capture(() => cli('prompt', [SESSION, 'the build fails', '--timeout', '10']));
    void answering.then(() => { finished = true; }, () => { finished = true; });
    // The turn is scripted, and steps only while something pumps it - which is
    // the ticker the screen runs for a person watching one happen.
    for (let i = 0; i < 400 && !finished; i += 1) {
      held.host?.drain();
      await new Promise((tick) => { setTimeout(tick, 0); });
    }
    const { code, out, err } = await answering;

    expect(code).toBe(1);
    // The host's own sentence, one line, with nothing added around it.
    expect(err.trimEnd().split('\n')).toEqual([MESSAGE]);
    // And stdout is the answer that came before it: what the agent said still
    // stands, and the reason it stopped is not part of it.
    expect(out).toContain('The box did not answer on 22.');
    expect(out).not.toContain(MESSAGE);
  }, 30_000);
});

describe('a failed turn, as a model reading the tool server sees it', () => {
  it('carries the sentence as `error`, and keeps it out of `text`', async () => {
    const { fakeHost } = await import('../src/ahp/fake.js');
    const { named } = await import('../src/mcp/tools.js');
    const read = await named('session_history')!.run(fakeHost(), { session: STOPPED }) as {
      turns: { state: string; text: string; error?: string }[];
    };
    const failed = read.turns.find((one) => one.state === 'failed');
    expect(failed?.error).toBe(SEEDED);
    // `text` is the markdown alone, so a caller reading only that has a turn
    // that stops with no cause.
    expect(failed?.text).not.toContain(SEEDED);
  });

  it('says nothing where the turn did not fail', async () => {
    const { fakeHost } = await import('../src/ahp/fake.js');
    const { named } = await import('../src/mcp/tools.js');
    const read = await named('session_history')!.run(fakeHost(), { session: SESSION }) as {
      turns: { error?: string }[];
    };
    expect(read.turns.length).toBeGreaterThan(0);
    expect(read.turns.every((one) => one.error === undefined)).toBe(true);
  });
});

describe('a failed session, as `session show` reads it', () => {
  it('draws the sentence in an Error row under the status', async () => {
    const { cli } = await import('../src/cli/main.js');
    const { code, out } = await capture(() => cli('session', ['show', STOPPED]));
    expect(code).toBe(0);
    expect(row(out, 'Status')).toContain('error');
    expect(row(out, 'Error')).toContain(SEEDED);
  });

  it('leaves the row out for a session that did not fail', async () => {
    const { cli } = await import('../src/cli/main.js');
    const { out } = await capture(() => cli('session', ['show', SESSION]));
    expect(row(out, 'Status')).toBeDefined();
    expect(row(out, 'Error')).toBeUndefined();
  });
});
