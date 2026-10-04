/*
 * The two front ends' argument handling, which nothing else reaches.
 *
 * `--publish` was accepted by the CLI and refused by the screen for as long as
 * it existed, and the whole suite stayed green because every test drives the
 * modules underneath a parsed argument list. Green was not runnable. The
 * screen is the front end where publishing means anything - a CLI command
 * answers and exits, so a host has nothing left to ask it for.
 */

import { describe, expect, it, vi } from 'vitest';
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
 * Reading one chat, by its own URI.
 *
 * `chat show` and `chat history` against the scripted host, with stdout caught
 * rather than written. The URIs are the script's own and are stable: a session
 * is seeded as `ahp-session:/1f0a` and its conversation is the chat of the same
 * name, holding two finished turns and one running. Nothing here starts a host,
 * because the point is the reading and the script answers every call the same
 * way.
 */
describe('ahpc chat, reading a conversation rather than listing one', () => {
  const SESSION = 'ahp-session:/1f0a';
  const CHAT = 'ahp-chat:/1f0a';

  /*
   * Against the script, and only the script.
   *
   * `connect` chooses the fake only when nothing named a host, and it looks at
   * the environment and at `~/.config/ahpc/config.json` - so a run that inherited
   * either reached whatever host the machine running the suite happens to be
   * configured for, and answered `-32001` for a chat the script had never heard
   * of. The config directory is thrown away for the length of the run and the
   * environment's own answer is removed, so what is under test is the script.
   */
  const run = async (rest: string[], expectToFail = false): Promise<string> => {
    const home = mkdtempSync(join(tmpdir(), 'ahpc-chat-'));
    const had = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, AHPC_HOST: process.env.AHPC_HOST };
    process.env.XDG_CONFIG_HOME = home;
    delete process.env.AHPC_HOST;
    let out = '';
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => { out += String(chunk); return true; }) as typeof process.stdout.write;
    try {
      const { cli, Fault } = await import('../src/cli/main.js');
      if (expectToFail) {
        const said = await cli('chat', rest).then(() => null, (error: unknown) => error);
        expect(said).toBeInstanceOf(Fault);
        return said instanceof Error ? said.message : '';
      }
      expect(await cli('chat', rest)).toBe(0);
    }
    finally {
      process.stdout.write = write;
      for (const [key, value] of Object.entries(had)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      rmSync(home, { recursive: true, force: true });
    }
    return out;
  };

  it('shows what the host says about the chat, a turn count included', async () => {
    const out = await run(['show', CHAT]);
    expect(out).toContain(CHAT);
    expect(out).toContain('Kqueue events on Linux');
    // The seeded session is holding a tool confirmation, which is what this
    // chat's status says - `mark` draws it the way it does on a session row.
    expect(out).toContain('Status');
    expect(out).toContain('waiting on you');
    // Two finished and one running, which is the whole of the chat's turns.
    expect(out).toMatch(/Turns\s+3/);
  });

  it('carries the state whole under --json, and leaves off what the host said nothing about', async () => {
    const said = JSON.parse(await run(['show', CHAT, '--json'])) as {
      resource: string; title: string; status: number; origin?: unknown; turns: unknown[]; active?: unknown;
    };
    expect(said.resource).toBe(CHAT);
    expect(said.title).toBe('Kqueue events on Linux');
    expect(said.turns).toHaveLength(2);
    // The running turn is not in `turns`, exactly as it is on a session.
    expect(said.active).toBeDefined();
    /*
     * Absent, not empty.
     *
     * This chat was opened by a person, so the host reports no origin for it. An
     * `origin: {}` here would be a reader inventing a provenance for a chat that
     * did not have one, and `show` would print a row about it.
     */
    expect(said).not.toHaveProperty('origin');
    expect(await run(['show', CHAT])).not.toContain('Origin');
  });

  it('prints the turns as session history does, finished and running', async () => {
    const out = await run(['history', CHAT]);
    expect(out).toContain('user');
    expect(out).toContain('EVFILT_FS never fires on Linux');
    expect(out).toContain('agent');
    expect(out).toContain('libkqueue');
  });

  it('carries the turns under --json and --full alike', async () => {
    for (const flag of ['--json', '--full']) {
      const said = JSON.parse(await run(['history', CHAT, flag])) as { id: string }[];
      expect(said.map((one) => one.id)).toEqual(['t1', 't2', 't3']);
    }
  });

  it('takes --all, and stops when the host says there is no more behind it', async () => {
    // The script hands a chat over whole, so `--all` is asked for and answered
    // with "no". The branch that matters is the one that stops rather than
    // walking to the bound.
    expect(await run(['history', CHAT, '--all'])).toContain('libkqueue');
  });

  it('says the host sent no chat state rather than printing an empty one', async () => {
    // A chat URI the host does not have, and a channel it answers with
    // something that is not a chat state, read the same: no state came back.
    // Printing a row of blanks would claim the conversation is empty, which is
    // a different claim and possibly the wrong one.
    expect(await run(['show', 'ahp-chat:/not-a-chat'], true)).toBe('The host sent no chat state for that chat.');
    expect(await run(['history', 'ahp-chat:/not-a-chat'], true)).toBe('The host sent no chat state for that chat.');
  });

  it('still takes a session URI for the verb that asks about a session', async () => {
    // `chat list` is the odd one out and stays on the session, so the two are
    // not interchangeable by accident.
    const items = JSON.parse(await run(['list', SESSION, '--json'])) as { resource: string }[];
    expect(items.map((one) => one.resource)).toContain(CHAT);
  });

  it('refuses a verb it does not have, by name', async () => {
    expect(await run(['poke', CHAT], true)).toContain("No 'chat poke'");
  });
});

/*
 * A chat nobody typed into, read by its own URI.
 *
 * Driven against the script's seam rather than through `cli`, because `connect`
 * builds a host per invocation: a chat created in one `cli` run is not in the
 * next one, and no chat the CLI can create carries an origin - `chat new` makes
 * a chat a person opened. So the read a subagent's chat gets is checked here,
 * and the printing of it is checked above on a chat that has no origin.
 */
describe('a chat with an origin, read on its own', () => {
  it('carries what started it and the turns it came with', async () => {
    const { fakeHost } = await import('../src/ahp/fake.js');
    const host = fakeHost();
    const source = { kind: 'fork' as const, chat: 'ahp-chat:/1f0a', turnId: 't2' };
    const chat = await host.createChat('ahp-session:/1f0a', undefined, source);

    const shot = await host.chat(chat);
    // The edge that identifies a conversation nobody opened: the chat it came
    // from and the turn it was made at.
    expect(shot.origin).toEqual({ kind: 'fork', chat: 'ahp-chat:/1f0a', turnId: 't2' });
    // A fork copies the source's history through the named turn, so what came
    // with it is both of the source's.
    expect(shot.turns.map((one) => one.id)).toEqual(['t1', 't2']);
    expect(shot.resource).toBe(chat);
  });

  it('reads the session own chat by its chat URI, and a chat URI that is not one as no state', async () => {
    const { fakeHost } = await import('../src/ahp/fake.js');
    const host = fakeHost();

    const own = await host.chat('ahp-chat:/1f0a');
    expect(own.resource).toBe('ahp-chat:/1f0a');
    expect(own.turns).toHaveLength(2);
    // No origin, because a person opened this one and the host said none.
    expect(own.origin).toBeUndefined();

    // Absent rather than throwing: the live host refuses a channel it does not
    // have and leaves no state behind, and the two must read the same or a
    // refusal would be one word against a socket and a stack against the script.
    const missing = await host.chat('ahp-chat:/not-a-chat');
    expect(missing.resource).toBe('');
    expect(missing.turns).toEqual([]);
  });

  it('answers --all with no when there is no page behind the chat', async () => {
    const { fakeHost } = await import('../src/ahp/fake.js');
    const host = fakeHost();
    expect(await host.loadOlderChatTurns('ahp-chat:/1f0a')).toBe(false);
    // Asking again after a refusal is still an answer, not an error.
    expect(await host.loadOlderChatTurns('ahp-chat:/not-a-chat')).toBe(false);
  });
});

/*
 * What a person is shown when a command is refused.
 *
 * `ahpc session rm claude:/<unknown>` printed `RpcError: RPC error -32001: ...`
 * and four `at AhpClient...` lines, because only `-32007` was ever caught and
 * every other error reached the top as itself. Against the script, hermetic for
 * the same reason the chat tests above are: a run that inherited this machine's
 * own configuration reached whatever host it names.
 */
describe('a refusal the host sent, and a mistake that was ours', () => {
  const SESSION = 'ahp-session:/1f0a';

  const refusing = async (command: string, rest: string[]): Promise<unknown> => {
    const home = mkdtempSync(join(tmpdir(), 'ahpc-fault-'));
    const had = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, AHPC_HOST: process.env.AHPC_HOST };
    process.env.XDG_CONFIG_HOME = home;
    delete process.env.AHPC_HOST;
    try {
      const { cli } = await import('../src/cli/main.js');
      return await cli(command, rest).then(() => null, (error: unknown) => error);
    }
    finally {
      for (const [key, value] of Object.entries(had)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      rmSync(home, { recursive: true, force: true });
    }
  };

  it('says the host words with the code beside them, on one line', async () => {
    const { Fault } = await import('../src/cli/main.js');
    const said = await refusing('session', ['rm', 'ahp-session:/not-a-session']);
    // A `Fault` rather than the `RpcError` it was: the top level writes a
    // Fault as one line on stderr and exits 1, and anything else as a stack.
    expect(said).toBeInstanceOf(Fault);
    expect((said as Error).message).toBe('No session at ahp-session:/not-a-session (-32001)');
    // One line, so the sentence is the whole of what a person reads. The code
    // is in it because a bug report needs it and nobody remembers it.
    expect((said as Error).message.split('\n')).toHaveLength(1);
  });

  it('leaves an error with no code alone, so a bug still looks like a bug', async () => {
    const { Fault } = await import('../src/cli/main.js');
    // The script refuses closing a session's own chat with a bare error: no
    // code means the host did not refuse anything, and calling it a refusal
    // would dress this client going wrong in the host's clothes.
    const said = await refusing('chat', ['rm', 'ahp-chat:/1f0a']);
    expect(said).not.toBeInstanceOf(Fault);
    expect((said as Error).stack).toContain('That is the only chat in this session');
  });
});

/*
 * The entry point, which is what turns a rejection into what a person reads.
 *
 * Driven by importing it rather than by running the built binary: `dist` is not
 * here, and a test that built the whole client to check three lines would be a
 * test about the build. What is under test is the last branch of one `catch`.
 */
describe('the entry point, and what reaches a person on stderr', () => {
  const argv = ['node', 'ahpc', 'chat', 'rm', 'ahp-chat:/1f0a'];

  /*
   * Run the entry point once, over a throwaway config directory, and give back
   * what it wrote to stderr. `AHPC_DEBUG` is set by the call rather than read
   * from here, because the point is that the shell sets it and this never does.
   */
  const entry = async (debug?: string): Promise<string> => {
    const home = mkdtempSync(join(tmpdir(), 'ahpc-entry-'));
    const had = {
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      AHPC_HOST: process.env.AHPC_HOST,
      AHPC_DEBUG: process.env.AHPC_DEBUG,
    };
    const said = { argv: process.argv, code: process.exitCode };
    process.env.XDG_CONFIG_HOME = home;
    delete process.env.AHPC_HOST;
    if (debug === undefined) delete process.env.AHPC_DEBUG;
    else process.env.AHPC_DEBUG = debug;
    process.argv = argv;
    // The module is the program: importing it runs it, so the second run here
    // would be answered out of the cache instead of running at all.
    vi.resetModules();
    let err = '';
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => { err += String(chunk); return true; }) as typeof process.stderr.write;
    try {
      await import('../src/main.js');
      // The entry point sets the code it is exiting with, and a test process
      // that inherited that would fail the run over a deliberate refusal.
      expect(process.exitCode).toBe(1);
    }
    finally {
      process.stderr.write = write;
      process.argv = said.argv;
      process.exitCode = said.code;
      for (const [key, value] of Object.entries(had)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
      rmSync(home, { recursive: true, force: true });
    }
    return err;
  };

  it('prints the sentence, and keeps the stack for a bug report', async () => {
    const plain = await entry();
    // What the host's own words say, and nothing of where they came from.
    expect(plain).toContain('That is the only chat in this session');
    expect(plain).not.toContain('at Object.disposeChat');
    expect(plain.trimEnd().split('\n')).toHaveLength(1);

    // The absent case for the variable itself: set to something other than 1
    // and the stack stays away, because what this reads is a person's decision
    // to go looking rather than the mere presence of a name.
    expect(await entry('')).not.toContain('at Object.disposeChat');

    const debug = await entry('1');
    expect(debug).toContain('That is the only chat in this session');
    expect(debug).toContain('at Object.disposeChat');
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
