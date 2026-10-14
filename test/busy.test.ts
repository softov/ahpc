/*
 * A turn that is already running, and what is done about it.
 *
 * `prompt` used to send regardless, which starts a second turn on a session
 * that is in one - and a host answers that by dropping the first turn from the
 * conversation. So the message now waits for the session to say what it is
 * doing, and there are three answers: refuse, `--queue` behind it, or `--steer`
 * into it.
 *
 * `connect` is replaced so the host under test is one this file holds and can
 * pump: the scripted host's time is a pump, so a `prompt` against it would
 * otherwise wait for a turn that never takes a step. The live host is used
 * directly for the one question about the wire - which action a steer becomes -
 * because the scripted host is not what puts anything on one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHAT, SESSION as LIVE, connect, settle } from './scenario.js';
import type { FakeHost } from '../src/ahp/fake.js';
import type { HostEvent } from '../src/ahp/connection.js';

const held = vi.hoisted(() => ({ host: undefined as FakeHost | undefined }));

vi.mock('../src/connect.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/connect.js')>();
  const { fakeHost } = await import('../src/ahp/fake.js');
  return { ...real, connect: async () => { held.host = fakeHost(); return held.host; } };
});

/** A session blocked on a confirmation, with a turn still running. */
const BUSY = 'ahp-session:/1f0a';
/** A session mid-answer, with nothing waiting on a person. */
const RUNNING = 'ahp-session:/6b21';
/** A session with nothing running at all. */
const IDLE = 'ahp-session:/9c74';
/** The turn `RUNNING` already has, which a steering message goes into. */
const RUNNING_TURN = 's2-t2';
/** The tool call `BUSY`'s running turn stopped on. */
const BLOCKED_CALL = 'seed-c2';
/** What a person is told when the session is already in a turn. */
const REFUSED = 'A turn is running. Use --queue or --steer.';

let home: string;
let had: { XDG_CONFIG_HOME?: string; AHPC_HOST?: string };

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ahpc-busy-'));
  had = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, AHPC_HOST: process.env.AHPC_HOST };
  process.env.XDG_CONFIG_HOME = home;
  delete process.env.AHPC_HOST;
});

afterEach(() => {
  for (const [key, value] of Object.entries(had)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(home, { recursive: true, force: true });
  held.host = undefined;
});

const tick = (): Promise<void> => new Promise((done) => { setTimeout(done, 0); });

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

/**
 * The host the client connected to, once it has.
 *
 * `connect` is replaced above and holds the fake it made, so this is the
 * session the command is talking to rather than a second one started here.
 */
const connected = async (): Promise<FakeHost> => {
  for (let i = 0; i < 100 && held.host === undefined; i += 1) await tick();
  if (held.host === undefined) throw new Error('the client never connected');
  return held.host;
};

/** The last snapshot a reader of this session is given, read and released. */
const snapshotOf = (host: FakeHost, uri: string): Extract<HostEvent, { type: 'snapshot' }> | undefined => {
  const seen: HostEvent[] = [];
  host.subscribe(uri, (event) => seen.push(event)).close();
  return seen.find((event) => event.type === 'snapshot') as Extract<HostEvent, { type: 'snapshot' }> | undefined;
};

/**
 * Run one command while the scripted host takes its steps.
 *
 * What the screen's ticker does for a person watching a turn happen: a shell
 * run drives no clock, so a turn that is scripted only happens while something
 * pumps it.
 */
const whilePumping = async (what: () => Promise<number>): Promise<{ code: number; out: string; err: string }> => {
  const answering = capture(what);
  let finished = false;
  void answering.then(() => { finished = true; }, () => { finished = true; });
  for (let i = 0; i < 400 && !finished; i += 1) {
    held.host?.drain();
    await tick();
  }
  return answering;
};

describe('a session with a turn already running', () => {
  it('refuses a plain prompt, with one line and nothing sent', async () => {
    const { cli } = await import('../src/cli/main.js');
    const answering = capture(() => cli('prompt', [BUSY, 'and what about the other one?']));
    const host = await connected();

    const { code, out, err } = await answering;

    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err).toBe(`${REFUSED}\n`);
    // Nothing was scripted, so no turn was started; the turn that was running
    // is still running; and the conversation is the two turns it had.
    expect(host.pending()).toBe(0);
    const held_ = snapshotOf(host, BUSY);
    expect(held_?.active?.id).toBe('t3');
    expect(held_?.turns.map((turn) => turn.id)).toEqual(['t1', 't2']);
  });

  it('puts the message behind the running turn with --queue, and answers with the new one', async () => {
    const { cli } = await import('../src/cli/main.js');
    const said = 'and then what?';
    const answering = capture(() => cli('prompt', [BUSY, said, '--queue']));
    let finished = false;
    void answering.then(() => { finished = true; }, () => { finished = true; });
    const host = await connected();

    // Queued, and not sent: the message waits behind the turn that is running.
    let waiting: string[] = [];
    for (let i = 0; i < 400 && waiting.length === 0; i += 1) {
      waiting = (snapshotOf(host, BUSY)?.queued ?? []).map((one) => one.text);
      await tick();
    }
    expect(waiting).toEqual([said]);

    // Answering the confirmation the running turn stopped on lets it end, and
    // the queued message is what the host starts next.
    host.confirmToolCall(BUSY, BLOCKED_CALL, false);
    for (let i = 0; i < 400 && !finished; i += 1) {
      host.drain();
      await tick();
    }
    const { code, out, err } = await answering;

    expect(code).toBe(0);
    // The queued message's own answer, and not the closing sentence of the turn
    // it was sent behind - which is what a wait reading the wrong turn prints.
    expect(out).toContain(said);
    expect(out).not.toContain('Left it alone');
    // And nothing of the running turn either, since its answer is not this
    // caller's to read.
    expect(out).not.toContain('Let me check that the patched header');
    expect(err).toBe('');
  });

  it('sends into the running turn with --steer, and answers with that turn', async () => {
    const { cli } = await import('../src/cli/main.js');
    const said = 'stop and do this instead';
    const answering = capture(() => cli('prompt', [RUNNING, said, '--steer', '--json']));
    let finished = false;
    void answering.then(() => { finished = true; }, () => { finished = true; });
    const host = await connected();

    // Until the text is in that turn, which is where a steering message goes.
    const streamed: string[] = [];
    const watch = host.subscribe(RUNNING, (event) => { if (event.type === 'delta') streamed.push(event.text); });
    for (let i = 0; i < 400 && !streamed.join('').includes(said); i += 1) {
      host.drain();
      await tick();
    }
    watch.close();
    expect(streamed.join('')).toContain(said);

    // And when that turn ends, it is the answer: a steering message starts no
    // turn of its own to wait for.
    host.stopTurn(RUNNING);
    for (let i = 0; i < 400 && !finished; i += 1) {
      host.drain();
      await tick();
    }
    const { code, out } = await answering;

    const answer = JSON.parse(out) as { id: string; parts: { content?: string }[] };
    expect(answer.id).toBe(RUNNING_TURN);
    expect(answer.parts.some((part) => part.content?.includes(said))).toBe(true);
    // Stopped rather than answered, so not a turn that completed.
    expect(code).toBe(1);
  });

  it('refuses --queue and --steer together as a usage mistake', async () => {
    const { cli } = await import('../src/cli/main.js');
    const { code, out, err } = await capture(() => cli('prompt', [BUSY, 'hello', '--queue', '--steer']));
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).not.toBe('');
  });
});

describe('a session with nothing running', () => {
  it('says it as before, with or without either flag', async () => {
    const { cli } = await import('../src/cli/main.js');
    for (const flags of [[], ['--queue'], ['--steer']]) {
      const { code, out, err } = await whilePumping(() => cli('prompt', [IDLE, 'what changed?', ...flags]));
      expect(code).toBe(0);
      expect(out).toContain('what changed?');
      expect(err).toBe('');
    }
  }, 30_000);
});

describe('the scripted host, on a session with a turn running', () => {
  it('refuses a turn said to it, and keeps the one that is running', async () => {
    const { fakeHost } = await import('../src/ahp/fake.js');
    const host = fakeHost();
    const seen: HostEvent[] = [];
    const watch = host.subscribe(BUSY, (event) => seen.push(event));

    host.say(BUSY, 'hello');

    expect(seen.some((event) => event.type === 'error')).toBe(true);
    expect(host.pending()).toBe(0);
    const after = snapshotOf(host, BUSY);
    expect(after?.active?.id).toBe('t3');
    expect(after?.turns.map((turn) => turn.id)).toEqual(['t1', 't2']);
    watch.close();
  });
});

describe('a steering message, as the live host puts it on the wire', () => {
  it('dispatches a pending message of kind steering, with an id of its own', async () => {
    const { host, scripted } = await connect();
    scripted.states.set(LIVE, { defaultChat: CHAT, chats: [{ resource: CHAT, title: 'Chat' }], status: 1 });
    scripted.states.set(CHAT, { turns: [] });
    host.subscribe(LIVE as never, () => undefined);
    await settle();

    host.steer(LIVE as never, 'stop and do this instead');
    await settle();

    const sent = scripted.asked.filter((frame) => frame.method === 'dispatchAction')
      .map((frame) => frame.params?.action as Record<string, unknown>)
      .find((action) => action?.type === 'chat/pendingMessageSet');
    // `steering` and not `queued`: one action carries both kinds, and a message
    // sent under the other one is read back as waiting its turn.
    expect(sent?.kind).toBe('steering');
    expect((sent?.message as { text?: string })?.text).toBe('stop and do this instead');
    expect(typeof sent?.id).toBe('string');

    await host.close();
  });
});

describe('the tool server, on a session with a turn running', () => {
  it('refuses without `busy`, and queues behind the turn with it', async () => {
    const { fakeHost } = await import('../src/ahp/fake.js');
    const { named } = await import('../src/mcp/tools.js');
    const said = 'and then what?';

    const refused = await named('send_turn')!.run(fakeHost(), { session: BUSY, text: said })
      .then(() => undefined, (error: unknown) => error);
    expect(refused).toBeInstanceOf(Error);
    expect((refused as Error).message).toContain('busy');

    const host = fakeHost();
    const answering = named('send_turn')!.run(host, { session: BUSY, text: said, busy: 'queue' });
    let finished = false;
    void answering.then(() => { finished = true; }, () => { finished = true; });

    for (let i = 0; i < 20 && !finished; i += 1) { host.drain(); await tick(); }
    // Behind the turn, so the tool is still waiting rather than answered.
    expect(finished).toBe(false);

    host.confirmToolCall(BUSY, BLOCKED_CALL, false);
    for (let i = 0; i < 400 && !finished; i += 1) { host.drain(); await tick(); }

    const answer = await answering as { state?: string; text?: string };
    expect(answer.state).toBe('complete');
    expect(answer.text).toContain(said);
  }, 30_000);
});

describe('a turn that does not end', () => {
  it('says it stopped waiting, on stderr, in every mode', async () => {
    const { cli } = await import('../src/cli/main.js');
    /** The line about the wait, once, wherever else stderr has been written to. */
    const told = (err: string): string[] => err.split('\n').filter((one) => one.startsWith('Stopped waiting'));
    const line = 'Stopped waiting after 1 seconds. The turn is still running.';

    // The `run` script stops on a confirmation that nothing answers, so the
    // turn is still going when the wait runs out.
    const plain = await whilePumping(() => cli('prompt', [IDLE, 'run the tests', '--timeout', '1']));
    expect(plain.code).toBe(1);
    expect(told(plain.err)).toEqual([line]);
    expect(plain.out).not.toContain(line);

    // And with `--json` the turn is reported as not having ended, which is the
    // same thing said to a program rather than to a person.
    const json = await whilePumping(() => cli('prompt', [IDLE, 'run the tests', '--timeout', '1', '--json']));
    expect(json.code).toBe(1);
    expect(told(json.err)).toEqual([line]);
    expect(JSON.parse(json.out)).toEqual({ state: 'timeout' });
  }, 30_000);
});
