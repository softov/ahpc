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
import { readFile } from 'node:fs/promises';
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
