/*
 * The two front ends' argument handling, which nothing else reaches.
 *
 * `--publish` was accepted by the CLI and refused by the screen for as long as
 * it existed, and the whole suite stayed green because every test drives the
 * modules underneath a parsed argument list. Green was not runnable. The
 * screen is the front end where publishing means anything - a CLI command
 * answers and exits, so a host has nothing left to ask it for.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from '../src/tui.js';
import { SWITCHES, commandIn } from '../src/flags.js';

describe('the screen reads the flags it documents', () => {
  it('takes a directory to publish, read-only by default', () => {
    expect(parse(['--publish', '/srv/x']).publish).toBe('/srv/x');
    expect(parse(['--publish', '/srv/x']).publishWritable).toBeUndefined();
    expect(parse(['--publish', '/srv/x', '--publish-writable']).publishWritable).toBe(true);
    // Absent is the default, and it is the one that serves nothing.
    expect(parse([]).publish).toBeUndefined();
  });

  it('documents them where somebody refused by the parser would look', async () => {
    const usage = (await import('../src/tui.js')).USAGE;
    expect(usage).toContain('--publish <dir>');
    expect(usage).toContain('--publish-writable');
  });
});

/*
 * The entry point scans argv for a command word, and to do that it has to know
 * which flags take a value - `--path status` must not make `status` a command.
 * Held as a table per component that was three vocabularies: seven flags the
 * CLI knew and the router did not each swallowed the command after them.
 */
describe('one flag vocabulary, read by everything that parses one', () => {
  it('routes a command that follows a valueless flag', () => {
    // The seven that did not, each a real invocation.
    for (const flag of ['--force', '--recursive', '--all', '--claude', '--create-only', '--fail-if-exists', '--follow']) {
      expect(commandIn([flag, 'resource'])).toBe('resource');
    }
    // ...while a flag that does take a value still swallows it, which is the
    // reason the set exists at all.
    expect(commandIn(['--path', 'status'])).toBeUndefined();
    expect(commandIn(['--publish', 'session'])).toBeUndefined();
    expect(commandIn(['--host', 'ws://x', 'status'])).toBe('status');
    // A word that is not a command opens the screen rather than guessing.
    expect(commandIn(['--force', 'nonsense'])).toBeUndefined();
  });

  it('agrees with the screen about every flag it parses', async () => {
    const source = await readFile('src/tui.tsx', 'utf8');
    const from = source.indexOf('export function parse');
    const to = source.indexOf('default:', from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);

    /*
     * Read per line, which holds only while every arm is a one-liner.
     * Asserted rather than assumed: a multi-line arm would make this read the
     * wrong body and quietly answer for a flag it never saw.
     */
    const wrong: string[] = [];
    let seen = 0;
    for (const line of source.slice(from, to).split('\n')) {
      const cases = [...line.matchAll(/case '(-[^']+)':/g)].map((one) => one[1] as string);
      if (cases.length === 0) continue;
      expect(line).toContain('break;');
      for (const flag of cases) {
        seen += 1;
        const takesValue = line.includes('argv[++i]');
        if (takesValue && SWITCHES.has(flag)) wrong.push(`${flag} takes a value and is listed as a switch`);
        if (!takesValue && !SWITCHES.has(flag)) wrong.push(`${flag} takes no value and is missing from SWITCHES`);
      }
    }
    expect(seen).toBeGreaterThan(15);
    expect(wrong).toEqual([]);
  });

  it('agrees with the shell about every flag it reads', async () => {
    /*
     * The CLI asks two different questions of a flag, and which one it asks
     * says whether the flag has a value: `args.has` is a switch, `args.value`
     * is not. So its own source states the same fact the set does, and the two
     * can be held against each other without a third table to maintain.
     */
    const source = await readFile('src/cli/main.ts', 'utf8');
    const wrong: string[] = [];
    let seen = 0;
    for (const hit of source.matchAll(/args\.(has|value)\('(--[\w-]+)'\)/g)) {
      seen += 1;
      const [, how, flag] = hit as unknown as [string, string, string];
      if (how === 'has' && !SWITCHES.has(flag)) wrong.push(`${flag} is read as a switch and is missing from SWITCHES`);
      if (how === 'value' && SWITCHES.has(flag)) wrong.push(`${flag} is read for a value and is listed as a switch`);
    }
    expect(seen).toBeGreaterThan(15);
    expect(wrong).toEqual([]);
  });
});

describe('ahpc status, and whether a newer release is out', () => {
  /*
   * Against the scripted host, with `update.json` under a throwaway
   * `XDG_CONFIG_HOME`, and stdout caught rather than written. The command
   * never asks the registry, so there is no server here to answer one.
   */
  const run = async (rest: string[], env: Record<string, string> = {}, config?: string): Promise<string> => {
    const home = mkdtempSync(join(tmpdir(), 'ahpc-status-'));
    const had = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, CI: process.env.CI, NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER };
    process.env.XDG_CONFIG_HOME = home;
    delete process.env.CI;
    delete process.env.NO_UPDATE_NOTIFIER;
    Object.assign(process.env, env);
    mkdirSync(join(home, 'ahpc'), { recursive: true });
    writeFileSync(join(home, 'ahpc', 'update.json'), JSON.stringify({ name: '@softov/ahpc', latest: '9.9.9', checkedAt: '2026-09-18T12:00:00Z' }));
    if (config !== undefined) writeFileSync(join(home, 'ahpc', 'config.json'), config);
    let out = '';
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => { out += String(chunk); return true; }) as typeof process.stdout.write;
    try {
      const { cli } = await import('../src/cli/main.js');
      expect(await cli('status', rest)).toBe(0);
    }
    finally {
      process.stdout.write = write;
      for (const [key, value] of Object.entries(had)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      rmSync(home, { recursive: true, force: true });
    }
    return out;
  };

  it('prints the sentence as a third line, from the file', async () => {
    const out = await run([]);
    expect(out.split('\n')[2]).toMatch(/^@softov\/ahpc 9\.9\.9 is on npm, this is \d+\.\d+\.\d+$/);
  });
  it('carries it under --json, as the version alone', async () => {
    const said = JSON.parse(await run(['--json'])) as { update?: { latest: string } };
    expect(said.update).toEqual({ latest: '9.9.9' });
  });
  it('says nothing under --no-update-check, CI, NO_UPDATE_NOTIFIER or updateCheck: false', async () => {
    expect((await run(['--no-update-check'])).split('\n')).toHaveLength(3);
    expect((await run([], { CI: '1' })).split('\n')).toHaveLength(3);
    expect((await run([], { NO_UPDATE_NOTIFIER: '' })).split('\n')).toHaveLength(3);
    expect((await run([], {}, '{"updateCheck": false}')).split('\n')).toHaveLength(3);
    expect(JSON.parse(await run(['--json'], { CI: '1' })) as object).not.toHaveProperty('update');
  });
});

/*
 * The secret this client presents to open a connection.
 *
 * One resolution for both front ends, because a screen and a shell that
 * disagreed about which credential to send would disagree silently. The file
 * half is the other end of the host's own `--connection-token-file`, so what
 * is asserted here is that this reads what that writes.
 */
describe('the connection token, and the file the host keeps it in', () => {
  const held = process.env.AHPC_TOKEN;
  const clean = (): void => { delete process.env.AHPC_TOKEN; };
  const restore = (): void => {
    if (held === undefined) delete process.env.AHPC_TOKEN;
    else process.env.AHPC_TOKEN = held;
  };

  it('reads a token file the way the host writes one', async () => {
    const { connectionToken } = await import('../src/config.js');
    clean();
    const dir = mkdtempSync(join(tmpdir(), 'ahpc-token-'));
    try {
      // The host writes the secret with a trailing newline, and reads its own
      // file back trimmed. Anything else here would present a token with a
      // newline on the end of it.
      const at = join(dir, 'host.token');
      writeFileSync(at, 'e6c1f0a94b6d4e2f8a3c5d7e9f0b1c2d\n');
      expect(connectionToken({ tokenFile: at }, {})).toBe('e6c1f0a94b6d4e2f8a3c5d7e9f0b1c2d');
    } finally { rmSync(dir, { recursive: true, force: true }); restore(); }
  });

  it('refuses the two flags together, as the host does', async () => {
    const { connectionToken } = await import('../src/config.js');
    expect(() => connectionToken({ token: 'a', tokenFile: '/nowhere' }, {}))
      .toThrow('not both');
  });

  it('refuses a file that is missing or empty, and never writes one', async () => {
    const { connectionToken } = await import('../src/config.js');
    clean();
    const dir = mkdtempSync(join(tmpdir(), 'ahpc-token-'));
    try {
      const missing = join(dir, 'absent.token');
      // The host owns this secret: a client that made one up would be
      // presenting a credential nobody agreed to.
      expect(() => connectionToken({ tokenFile: missing }, {})).toThrow('No connection token at');
      expect(existsSync(missing)).toBe(false);

      const empty = join(dir, 'empty.token');
      writeFileSync(empty, '\n');
      expect(() => connectionToken({ tokenFile: empty }, {})).toThrow('is empty');
    } finally { rmSync(dir, { recursive: true, force: true }); restore(); }
  });

  it('takes the most deliberate source that has one', async () => {
    const { connectionToken } = await import('../src/config.js');
    const dir = mkdtempSync(join(tmpdir(), 'ahpc-token-'));
    try {
      const said = join(dir, 'said.token');
      const configured = join(dir, 'configured.token');
      writeFileSync(said, 'from-the-flag\n');
      writeFileSync(configured, 'from-the-config-file\n');

      clean();
      // This invocation beats this shell beats the file.
      expect(connectionToken({ token: 'typed' }, { token: 'filed' })).toBe('typed');
      expect(connectionToken({ tokenFile: said }, { token: 'filed' })).toBe('from-the-flag');
      process.env.AHPC_TOKEN = 'from-the-shell';
      expect(connectionToken({}, { token: 'filed' })).toBe('from-the-shell');
      expect(connectionToken({ tokenFile: said }, {})).toBe('from-the-flag');

      clean();
      // Within the config file, the path beats the written-down secret.
      expect(connectionToken({}, { connectionTokenFile: configured, token: 'filed' }))
        .toBe('from-the-config-file');
      expect(connectionToken({}, { token: 'filed' })).toBe('filed');
      expect(connectionToken({}, {})).toBeUndefined();
    } finally { rmSync(dir, { recursive: true, force: true }); restore(); }
  });

  it('is a flag both front ends parse and document', async () => {
    expect(parse(['--connection-token-file', '/etc/ahpc.token']).tokenFile).toBe('/etc/ahpc.token');
    // It takes a value, so it must never join the valueless set or the word
    // after it is read as a command.
    expect(SWITCHES.has('--connection-token-file')).toBe(false);
    expect(commandIn(['--connection-token-file', 'status'])).toBeUndefined();
    const usage = (await import('../src/tui.js')).USAGE;
    expect(usage).toContain('--connection-token-file');
  });
});
