/*
 * The commands that send one thing and exit.
 *
 * Each of them hangs up as soon as it returns, so what it sends has to have
 * left before it does. `cancel` did not: it read the running turn's id back
 * from the host and dispatched after that, and the connection was closed by
 * then, so the turn ran on to the end.
 *
 * `connect` is replaced by a live client against a scripted host, because the
 * question is what reaches a socket, and the scripted fake has none. Nothing
 * is settled between the command returning and the frames being read: a send
 * still pending at that point is one the closed client never makes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHAT, SESSION, connect as scripted } from './scenario.js';
import type { Frame, Scripted } from './scenario.js';

const held = vi.hoisted(() => ({
  scripted: undefined as Scripted | undefined,
  /** What the session answers a `subscribe` with, so a test can leave it no chat. */
  session: {} as Record<string, unknown>,
  /** What the chat answers a `subscribe` with, so each test says whether a turn runs. */
  chat: {} as Record<string, unknown>,
}));

vi.mock('../src/connect.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/connect.js')>();
  return {
    ...real,
    connect: async () => {
      const made = await scripted((one) => {
        one.echo = true;
        one.states.set(SESSION, held.session);
        one.states.set(CHAT, held.chat);
      });
      held.scripted = made.scripted;
      return made.host;
    },
  };
});

/** The turn the chat is in, when it is in one. */
const TURN = { id: 't1', startedAt: new Date(0).toISOString(), message: { text: 'count' }, parts: [] };

let home: string;
let had: { XDG_CONFIG_HOME?: string; AHPC_HOST?: string };

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ahpc-oneshot-'));
  had = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, AHPC_HOST: process.env.AHPC_HOST };
  process.env.XDG_CONFIG_HOME = home;
  delete process.env.AHPC_HOST;
  held.session = { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 };
  held.chat = { resource: CHAT, title: 'Chat', turns: [], activeTurn: TURN };
});

afterEach(() => {
  for (const [key, value] of Object.entries(had)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(home, { recursive: true, force: true });
  held.scripted = undefined;
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

/** Every action the command put on the wire, with the channel it went to. */
const dispatched = (): { channel: unknown; action: Record<string, unknown> }[] =>
  (held.scripted?.asked ?? [])
    .filter((frame: Frame) => frame.method === 'dispatchAction')
    .map((frame: Frame) => ({ channel: frame.params?.channel, action: frame.params?.action as Record<string, unknown> }));

describe('cancel', () => {
  it('sends the cancel for the running turn before it exits', async () => {
    const { cli } = await import('../src/cli/main.js');
    const { code, err } = await capture(() => cli('cancel', [SESSION]));

    expect(err).toBe('');
    expect(code).toBe(0);
    const sent = dispatched();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.channel).toBe(CHAT);
    expect(sent[0]?.action.type).toBe('chat/turnCancelled');
    expect(sent[0]?.action.turnId).toBe(TURN.id);
  });

  it('says there is nothing to cancel, and exits 1, on a session with no turn running', async () => {
    held.chat = { resource: CHAT, title: 'Chat', turns: [] };
    const { cli } = await import('../src/cli/main.js');
    const { code, out, err } = await capture(() => cli('cancel', [SESSION]));

    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err).toBe('No turn is running.\n');
    expect(dispatched()).toEqual([]);
  });

  it('says one line, and exits 1, when there is no chat to cancel in', async () => {
    held.session = { chats: [], status: 1 };
    const { cli } = await import('../src/cli/main.js');
    const { code, out, err } = await capture(() => cli('cancel', [SESSION]));

    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err).toBe('This session has no chat to stop a turn in.\n');
    expect(err.split('\n').filter((one) => one !== '')).toHaveLength(1);
  });

  it('says the turn was cancelled, and exits 1, when another client stops it', async () => {
    held.chat = { resource: CHAT, title: 'Chat', turns: [] };
    const { cli } = await import('../src/cli/main.js');

    const answering = capture(() => cli('prompt', [SESSION, 'count']));
    for (let i = 0; i < 400 && !dispatched().some((one) => one.action.type === 'chat/turnStarted'); i += 1) {
      await new Promise((tick) => { setTimeout(tick, 1); });
    }
    const started = dispatched().find((one) => one.action.type === 'chat/turnStarted');
    expect(started).toBeDefined();
    // Another client's cancel, relayed as an action on the chat the way a
    // host relays one it applied.
    await held.scripted?.act(CHAT, {
      type: 'chat/turnCancelled', turnId: String(started?.action.turnId), duration: 1_000,
    });

    const { code, err } = await answering;
    expect(code).toBe(1);
    expect(err).toBe('The turn was cancelled.\n');
  });
});

/*
 * The rest of them, each against the action it is.
 *
 * The ones that wait for the host's answer have it by the time they return;
 * `session set`, `session toggle` and `dispatch` do not wait, and what each
 * must do here is have sent its action before the command returned.
 */
describe('every other command that sends one action', () => {
  const cases: [string, string[], string, string][] = [
    ['queue', [SESSION, 'and then?'], CHAT, 'chat/pendingMessageSet'],
    ['unqueue', [SESSION, 'q1'], CHAT, 'chat/pendingMessageRemoved'],
    ['confirm', [SESSION, 'c1'], CHAT, 'chat/toolCallConfirmed'],
    ['answer', [SESSION, 'r1', '--field', 'name=x'], CHAT, 'chat/inputCompleted'],
    ['session', ['read', SESSION], SESSION, 'session/isReadChanged'],
    ['session', ['archive', SESSION], SESSION, 'session/isArchivedChanged'],
    ['session', ['set', SESSION, 'permissionMode', 'auto'], SESSION, 'session/configChanged'],
    ['session', ['toggle', SESSION, 'skill-1'], SESSION, 'session/customizationToggled'],
    ['dispatch', [SESSION, 'chat/draftChanged', '--chat'], CHAT, 'chat/draftChanged'],
  ];

  for (const [command, rest, channel, type] of cases) {
    it(`${command} ${rest[0] === SESSION ? '' : `${rest[0]} `}sends ${type} before it exits`, async () => {
      const { cli } = await import('../src/cli/main.js');
      const { code, err } = await capture(() => cli(command, rest));

      expect(err).toBe('');
      expect(code).toBe(0);
      expect(dispatched().map((one) => [one.channel, one.action.type])).toEqual([[channel, type]]);
    });
  }
});
