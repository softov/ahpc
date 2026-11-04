/*
 * Making, changing, copying and moving an automation from the shell.
 *
 * `connect` is replaced so every command in a test talks to one scripted host,
 * which is what lets a test make an automation and then read it back.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FakeHost } from '../src/ahp/fake.js';

const held = vi.hoisted(() => ({ host: undefined as FakeHost | undefined }));

vi.mock('../src/connect.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/connect.js')>();
  const { fakeHost } = await import('../src/ahp/fake.js');
  return { ...real, connect: async () => { held.host ??= fakeHost(); return { ...held.host, close: () => {} }; } };
});

const OWN = readFileSync(new URL('fixtures/automation.md', import.meta.url), 'utf8');
const VSCODE = readFileSync(new URL('fixtures/automation-vscode.md', import.meta.url), 'utf8');

let home: string;
let had: { XDG_CONFIG_HOME?: string; AHPC_HOST?: string };

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ahpc-automation-'));
  had = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, AHPC_HOST: process.env.AHPC_HOST };
  process.env.XDG_CONFIG_HOME = home;
  delete process.env.AHPC_HOST;
});

afterEach(() => {
  for (const [key, value] of Object.entries(had)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(home, { recursive: true, force: true });
  held.host = undefined;
});

/** One command, with both streams caught rather than written. */
const run = async (...words: string[]): Promise<{ code: number; out: string; err: string }> => {
  const { cli, Fault } = await import('../src/cli/main.js');
  let out = '';
  let err = '';
  const outWrite = process.stdout.write.bind(process.stdout);
  const errWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array) => { out += String(chunk); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => { err += String(chunk); return true; }) as typeof process.stderr.write;
  try {
    return { code: await cli(words[0] as string, words.slice(1)), out, err };
  }
  catch (error) {
    if (error instanceof Fault) return { code: 1, out, err: `${err}${error.message}` };
    throw error;
  }
  finally {
    process.stdout.write = outWrite;
    process.stderr.write = errWrite;
  }
};

/** The automation the host holds at a URI. */
const automation = async (uri: string) => (await held.host?.automations?.() ?? []).find((one) => one.resource === uri);

describe('automation new', () => {
  it('makes one with the schedule and zone given', async () => {
    const made = await run('automation', 'new', '--prompt', 'Tidy the notes', '--schedule', '0 9 * * 1-5', '--time-zone', 'UTC', '--folder', '/srv/demo');
    expect(made.code).toBe(0);
    const uri = made.out.trim();
    const found = await automation(uri);
    expect(found?.enabled).toBe(true);
    expect(found?.schedule).toEqual({ expression: '0 9 * * 1-5', timeZone: 'UTC' });
    expect(found?.workingDirectories).toEqual(['file:///srv/demo']);
    expect(found?.prompt).toBe('Tidy the notes');
  });

  it('makes an event trigger from --on', async () => {
    const made = await run('automation', 'new', '--prompt', 'Say what changed', '--on', 'sessionFinished:turnCompleted');
    expect(made.code).toBe(0);
    const triggers = (await automation(made.out.trim()))?.definition?.triggers as Record<string, unknown>[];
    expect(triggers).toEqual([{
      id: 'e1', kind: 'event', type: 'sessionFinished', title: 'When a session finishes',
      events: [{ id: 'turnCompleted', title: 'A turn finished' }], config: {},
    }]);
  });

  it('refuses an event the trigger does not list', async () => {
    const refused = await run('automation', 'new', '--prompt', 'x', '--on', 'sessionFinished:nope');
    expect(refused.err).toBe('sessionFinished has no event called nope. It has turnCompleted.');
  });

  it('refuses without a prompt or a trigger', async () => {
    expect((await run('automation', 'new', '--schedule', '0 9 * * *')).err).toBe('automation new needs --prompt: what each run says.');
    expect((await run('automation', 'new', '--prompt', 'x')).err).toBe('automation new needs --schedule <cron> or --on <type>:<event>.');
  });
});

describe('automation edit and duplicate', () => {
  it('changes the title and nothing else', async () => {
    const uri = (await run('automation', 'new', '--prompt', 'Tidy', '--schedule', '0 9 * * *', '--time-zone', 'UTC')).out.trim();
    const before = await automation(uri);
    expect((await run('automation', 'edit', uri, '--title', 'Renamed')).code).toBe(0);
    const after = await automation(uri);
    expect(after?.title).toBe('Renamed');
    expect({ ...after?.definition, title: undefined }).toEqual({ ...before?.definition, title: undefined });
  });

  it('moves a schedule to another zone with --time-zone alone', async () => {
    const uri = (await run('automation', 'new', '--prompt', 'Tidy', '--schedule', '0 9 * * *', '--time-zone', 'UTC')).out.trim();
    await run('automation', 'edit', uri, '--time-zone', 'Europe/Lisbon');
    expect((await automation(uri))?.schedule).toEqual({ expression: '0 9 * * *', timeZone: 'Europe/Lisbon' });
  });

  it('makes a switched-off copy', async () => {
    const uri = (await run('automation', 'new', '--title', 'Tidy', '--prompt', 'Tidy', '--schedule', '0 9 * * *')).out.trim();
    const copy = (await run('automation', 'duplicate', uri)).out.trim();
    expect(copy).not.toBe(uri);
    const found = await automation(copy);
    expect(found?.title).toBe('Tidy (copy)');
    expect(found?.enabled).toBe(false);
    expect(found?.schedule).toEqual((await automation(uri))?.schedule);
  });
});

describe('automation export and import', () => {
  it("writes ahpd's file, and reads it back as a switched-off copy with the same triggers", async () => {
    const uri = (await run('automation', 'new', '--title', 'Tidy', '--prompt', 'Tidy', '--schedule', '0 9 * * 1-5', '--time-zone', 'UTC', '--folder', '/srv/demo')).out.trim();
    const file = join(home, 'tidy.automation.md');
    const wrote = await run('automation', 'export', uri, '--out', file);
    expect(wrote.out).toBe(`Wrote ${file}.\n`);
    const imported = await run('automation', 'import', file);
    expect(imported.out).toMatch(/^Imported Tidy as ahp-automation:\/\S+\. It is switched off\.\n$/);
    const copy = await automation(imported.out.split(' as ')[1]?.split('. It')[0] as string);
    expect(copy?.enabled).toBe(false);
    expect(copy?.definition?.triggers).toEqual((await automation(uri))?.definition?.triggers);
    expect(copy?.workingDirectories).toEqual(['file:///srv/demo']);
  });

  it("imports ahpd's own fixture, in the folder the file names", async () => {
    const file = join(home, 'own.automation.md');
    writeFileSync(file, OWN);
    const imported = await run('automation', 'import', file);
    expect(imported.code).toBe(0);
    const uri = imported.out.split(' as ')[1]?.split('. It')[0] as string;
    expect((await automation(uri))?.workingDirectories).toEqual(['file:///srv/demo']);
  });

  it("imports VS Code's fixture with --vscode and --folder, and refuses it without --vscode", async () => {
    const file = join(home, 'tidy.automation.md');
    writeFileSync(file, VSCODE);
    expect((await run('automation', 'import', file)).err).toBe(`${file}: This is a VS Code automation file. Add --vscode.`);
    expect((await run('automation', 'import', file, '--vscode')).err).toBe('automation import needs --folder: the file names no folder to run in.');
    const imported = await run('automation', 'import', file, '--vscode', '--folder', '/srv/demo');
    const uri = imported.out.split(' as ')[1]?.split('. It')[0] as string;
    const found = await automation(uri);
    expect(found?.title).toBe('Tidy the notes');
    expect(found?.schedule?.expression).toBe('0 9 * * 1-5');
  });

  it('writes VS Code\'s file with --vscode, and refuses an event trigger', async () => {
    const scheduled = (await run('automation', 'new', '--title', 'Tidy the notes', '--prompt', 'Read every note in the folder.\n\nSort them by name, and say which ones are empty.', '--schedule', '0 9 * * 1-5')).out.trim();
    expect((await run('automation', 'export', scheduled, '--vscode')).out).toBe(VSCODE);
    const evented = (await run('automation', 'new', '--prompt', 'x', '--on', 'sessionFinished:turnCompleted')).out.trim();
    const refused = await run('automation', 'export', evented, '--vscode');
    expect(refused.err).toContain('has an event trigger, and a VS Code automation file holds only a schedule.');
  });
});
