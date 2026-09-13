import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import { describer, follow, matches, parseWireLine, rowText } from '../src/wire.js';
import type { WireLine, WireRow } from '../src/wire.js';
import { WIRE_FILTER, WIRE_FOLLOW, WIRE_ROWS, WIRE_SELECTED, registerWire } from '../src/view/wire.js';

/*
 * The wire, read back.
 *
 * What `--wire` writes on either end is one line per frame, and this is the
 * screen that reads it - live, from a file something else is still writing.
 * The reader is checked on a real file because that is what it reads; the
 * screen is checked at two widths because the frame pane is a pane at one
 * and a drawer at the other.
 */

let made: string[] = [];
afterEach(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
  made = [];
});
const capture = (lines: unknown[] = []): string => {
  const dir = mkdtempSync(join(tmpdir(), 'ahpc-wire-'));
  made.push(dir);
  const file = join(dir, 'wire.jsonl');
  writeFileSync(file, lines.map((one) => `${JSON.stringify(one)}\n`).join(''));
  return file;
};

const at = (n: number): string => `2026-09-13T10:00:${String(n).padStart(2, '0')}.000Z`;
const said = (from: 'client' | 'host', frame: unknown, n = 0): WireLine => ({ at: at(n), from, peer: 'ws://127.0.0.1:9187', frame });

const CONVERSATION: WireLine[] = [
  said('client', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientId: 'ahpc', protocolVersions: ['0.9.0'] } }, 1),
  said('host', { jsonrpc: '2.0', id: 1, result: { protocolVersion: '0.9.0', serverSeq: 0, snapshots: [] } }, 2),
  said('client', { jsonrpc: '2.0', method: 'dispatchAction', params: { channel: 'ahp-session:/one', action: { type: 'session/messageSent', message: { text: 'port the kqueue build' } } } }, 3),
  said('host', { jsonrpc: '2.0', method: 'action', params: { channel: 'ahp-session:/one', action: { type: 'chat/turnStarted', turnId: 't1' } } }, 4),
  said('client', { jsonrpc: '2.0', id: 2, method: 'subscribe', params: { channel: 'ahp-session:/two' } }, 5),
  said('host', { jsonrpc: '2.0', id: 2, error: { code: -32002, message: 'No session called ahp-session:/two' } }, 6),
];

describe('reading a capture', () => {
  it('describes each frame, and puts the method on the answer to it', () => {
    const describe_ = describer();
    const rows = CONVERSATION.map((line, index) => describe_(line, index + 1));
    expect(rows.map((row) => [row.kind, row.method, row.type ?? '', row.channel ?? ''])).toEqual([
      ['request', 'initialize', '', ''],
      ['response', 'initialize', '', ''],
      ['notification', 'dispatchAction', 'session/messageSent', 'ahp-session:/one'],
      ['notification', 'action', 'chat/turnStarted', 'ahp-session:/one'],
      ['request', 'subscribe', '', 'ahp-session:/two'],
      ['error', 'subscribe', '', ''],
    ]);
    expect(rows[2]?.detail).toBe('port the kqueue build');
    expect(rows[5]?.detail).toBe('-32002 No session called ahp-session:/two');
    expect(rows[1]?.detail).toBe('protocolVersion, serverSeq, snapshots');
    // A line that is not a capture line is kept as text rather than dropped.
    expect(parseWireLine('not json')).toBeUndefined();
    expect(parseWireLine('{"at":"x"}')).toBeUndefined();
    expect(rowText(rows[3] as WireRow)).toBe('10:00:04.000  <-  action  chat/turnStarted  ahp-session:/one');
    expect(rowText(rows[5] as WireRow)).toBe('10:00:06.000  <-  subscribe error  -32002 No session called ahp-session:/two');
  });

  it('filters the way the catalogue does: a substring of anything a row shows', () => {
    const describe_ = describer();
    const rows = CONVERSATION.map((line, index) => describe_(line, index + 1));
    expect(rows.filter((row) => matches(row, 'session:/one')).length).toBe(2);
    expect(rows.filter((row) => matches(row, 'turnStarted')).length).toBe(1);
    expect(rows.filter((row) => matches(row, 'ERROR')).length).toBe(1);
    expect(rows.filter((row) => matches(row, 'initialize')).length).toBe(2);
    expect(rows.filter((row) => matches(row, '  ')).length).toBe(6);
  });

  it('keeps up with a file still being written, and never hands over half a line', async () => {
    const file = capture(CONVERSATION.slice(0, 2));
    const got: WireRow[] = [];
    const reader = follow(file, (rows) => got.push(...rows), { interval: 10 });
    expect(got.map((row) => row.method)).toEqual(['initialize', 'initialize']);
    // Half a line, then the rest of it.
    const whole = JSON.stringify(CONVERSATION[2]);
    appendFileSync(file, whole.slice(0, 40));
    await new Promise((r) => { setTimeout(r, 40); });
    expect(got.length).toBe(2);
    appendFileSync(file, `${whole.slice(40)}\n${JSON.stringify(CONVERSATION[3])}\n`);
    for (let i = 0; i < 20 && got.length < 4; i++) await new Promise((r) => { setTimeout(r, 10); });
    expect(got.map((row) => row.seq)).toEqual([1, 2, 3, 4]);
    expect(got[3]?.type).toBe('chat/turnStarted');
    // A file started over - which is what a new --wire run does - is read from the top again.
    writeFileSync(file, `${JSON.stringify(CONVERSATION[4])}\n`);
    for (let i = 0; i < 20 && got.length < 5; i++) await new Promise((r) => { setTimeout(r, 10); });
    expect(got[4]?.method).toBe('subscribe');
    reader.close();
  });
});

describe('the wire screen', () => {
  const open = async (file: string, width: number) => {
    const t = await renderApp({
      width, height: 30, shell: 'workbench', theme: 'workbench',
      onBoot: (app) => { registerWire(app, { file, interval: 10 }); },
    });
    for (let i = 0; i < 8; i++) await t.settle();
    return t;
  };

  for (const width of [120, 70]) {
    it(`lists the frames and follows the newest, at ${width} columns`, async () => {
      const file = capture(CONVERSATION);
      const t = await open(file, width);
      expect(t.hasText('initialize')).toBe(true);
      expect(t.hasText('chat/turnStarted')).toBe(true);
      expect(t.hasText('6 frames')).toBe(true);
      expect(t.hasText('following')).toBe(true);
      // The newest is under the highlight, and on a wide screen its frame is beside the list.
      expect(t.app.store.get<string>(WIRE_SELECTED)).toBe('6');
      if (width >= 100) expect(t.hasText('No session called')).toBe(true);
      // More arrives, and the highlight goes with it.
      appendFileSync(file, `${JSON.stringify(said('host', { jsonrpc: '2.0', method: 'action', params: { channel: 'ahp-session:/one', action: { type: 'chat/turnCompleted', turnId: 't1' } } }, 7))}\n`);
      for (let i = 0; i < 30 && (t.app.store.get<WireRow[]>(WIRE_ROWS) ?? []).length < 7; i++) { await new Promise((r) => { setTimeout(r, 10); }); await t.settle(); }
      for (let i = 0; i < 4; i++) await t.settle();
      expect(t.hasText('7 frames')).toBe(true);
      expect(t.app.store.get<string>(WIRE_SELECTED)).toBe('7');
      await t.unmount();
    });
  }

  it('filters by what a row shows, and says how many it kept', async () => {
    const t = await open(capture(CONVERSATION), 120);
    t.app.store.set(WIRE_FILTER, 'session:/one');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('2 of 6 frames')).toBe(true);
    expect(t.hasText('initialize')).toBe(false);
    expect(t.hasText('chat/turnStarted')).toBe(true);
    t.app.store.set(WIRE_FILTER, 'nobody');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('Nothing matches')).toBe(true);
    await t.unmount();
  });

  it('stops following when told, and opens the frame under the highlight on a narrow screen', async () => {
    const t = await open(capture(CONVERSATION), 70);
    await t.app.execute('wire.follow');
    for (let i = 0; i < 2; i++) await t.settle();
    expect(t.app.store.get<boolean>(WIRE_FOLLOW)).toBe(false);
    t.app.store.set(WIRE_SELECTED, '3');
    for (let i = 0; i < 2; i++) await t.settle();
    // The list alone: the frame is a drawer at this width, and it is closed.
    expect(t.hasText('"channel"')).toBe(false);
    await t.app.execute('wire.openFrame');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('port the kqueue build')).toBe(true);
    expect(t.hasText('"channel": "ahp-session:/one"')).toBe(true);
    await t.app.execute('wire.closeFrame');
    for (let i = 0; i < 4; i++) await t.settle();
    expect(t.hasText('6 frames')).toBe(true);
    await t.unmount();
  });
});
