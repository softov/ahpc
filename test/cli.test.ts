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
 * That list lives in `main.tsx` and the flags themselves live in `tui.tsx`, so
 * the two drift silently: a value-less flag missing from it swallows the word
 * after it, and `ahpc --publish-writable status` opens the screen instead.
 */
describe('the entry point knows which flags take a value', () => {
  it('agrees with the screen about every one of them', async () => {
    const source = await readFile('src/tui.tsx', 'utf8');
    const from = source.indexOf('export function parse');
    const to = source.indexOf('default:', from);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);

    /*
     * Read per line, which holds only while every arm is a one-liner. Asserted
     * rather than assumed: a multi-line arm would make this read the wrong
     * body and quietly answer for a flag it never saw.
     */
    const takesValue = new Map<string, boolean>();
    for (const line of source.slice(from, to).split('\n')) {
      const cases = [...line.matchAll(/case '(-[^']+)':/g)].map((one) => one[1] as string);
      if (cases.length === 0) continue;
      expect(line).toContain('break;');
      for (const flag of cases) takesValue.set(flag, line.includes('argv[++i]'));
    }
    // If this finds nothing the slice is wrong and everything below passes for
    // the wrong reason.
    expect(takesValue.size).toBeGreaterThan(15);

    const entry = await readFile('src/main.tsx', 'utf8');
    const listed = entry.slice(entry.indexOf('const SWITCHES'), entry.indexOf(']);', entry.indexOf('const SWITCHES')));
    const switches = new Set([...listed.matchAll(/'(-[^']+)'/g)].map((one) => one[1] as string));
    expect(switches.size).toBeGreaterThan(10);

    const wrong: string[] = [];
    for (const [flag, value] of takesValue) {
      // A flag with a value must not be listed, or the scan stops swallowing
      // the value and reads it as a command.
      if (value && switches.has(flag)) wrong.push(`${flag} takes a value and is listed as a switch`);
      // A flag without one must be, or the scan swallows the word after it.
      if (!value && !switches.has(flag)) wrong.push(`${flag} takes no value and is missing from SWITCHES`);
    }
    expect(wrong).toEqual([]);
  });
});
