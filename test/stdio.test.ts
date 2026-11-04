/*
 * MCP over stdio, driven through streams a test holds.
 *
 * The transport reads `process.stdin` and writes `process.stdout` when it is
 * given nothing else, and a test cannot take the runner's own streams to
 * write to them. So `stdio` takes the two streams it reads and writes, and
 * these cases hand it a `PassThrough` for each.
 *
 * What is under test is the order the answers come out in, which is why the
 * scripted host is pumped from here: a `send_turn` against it waits for a turn
 * that happens only while somebody advances the script, exactly as a person's
 * screen does with its ticker.
 */

import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { fakeHost, type FakeHost } from '../src/ahp/fake.js';
import { SERVER } from '../src/mcp/serve.js';
import { stdio } from '../src/mcp/stdio.js';

/** A session with nothing running, so a message said to it starts a turn. */
const IDLE = 'ahp-session:/9c74';

/** One answer, as far as these cases read one. */
interface Reply {
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/** `stdio` on streams this test owns. */
interface Running {
  host: FakeHost;
  input: PassThrough;
  /** The answers written so far, oldest first. */
  said: Reply[];
  /** Write one message as one line, which is what a client does. */
  send(message: unknown): void;
  /** Settles when `stdio` has resolved, which is only after the input ends. */
  done: Promise<void>;
}

function start(host = fakeHost(), onProblem?: (said: string) => void): Running {
  const input = new PassThrough();
  const output = new PassThrough();
  output.setEncoding('utf8');
  const said: Reply[] = [];
  let rest = '';
  output.on('data', (chunk: string) => {
    rest += chunk;
    for (;;) {
      const at = rest.indexOf('\n');
      if (at === -1) break;
      said.push(JSON.parse(rest.slice(0, at)) as Reply);
      rest = rest.slice(at + 1);
    }
  });
  const done = stdio(host, {
    ...SERVER,
    input,
    output,
    ...(onProblem === undefined ? {} : { onProblem }),
  });
  return {
    host,
    input,
    said,
    send: (message) => { input.write(`${JSON.stringify(message)}\n`); },
    done,
  };
}

/** Let the promises and the scripted host settle. */
const tick = (): Promise<void> => new Promise((done) => { setTimeout(done, 0); });

/** Drive the scripted host until a predicate holds, as the screen's ticker does. */
async function pumpUntil(host: FakeHost, done: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !done(); i += 1) {
    host.drain();
    await tick();
  }
}

/** One `tools/call`, as a client puts it on the wire. */
const call = (id: number, name: string, arguments_: Record<string, unknown>): Record<string, unknown> => ({
  jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: arguments_ },
});

/** What a `tools/call` answer carries as the tool's own object. */
const structured = (reply: Reply | undefined): Record<string, unknown> =>
  (reply?.result as { structuredContent?: Record<string, unknown> } | undefined)?.structuredContent ?? {};

/** Whether the host is holding a confirmation or a question for this session. */
function waitingOn(host: FakeHost, uri: string): boolean {
  let held = false;
  host.subscribe(uri, (event) => {
    if (event.type === 'snapshot' && event.input !== undefined) held = true;
  }).close();
  return held;
}

describe('the order answers come out in', () => {
  it('answers a ping while a send_turn is still waiting', async () => {
    const run = start();
    run.send(call(1, 'send_turn', { session: IDLE, text: 'hello there', timeoutSeconds: 5 }));
    run.send({ jsonrpc: '2.0', id: 2, method: 'ping' });

    await pumpUntil(run.host, () => run.said.length >= 2);

    // The ping is answered before the turn it does not wait for has finished.
    // By id rather than by arrival, which is what a client does with them.
    expect(run.said.map((one) => one.id)).toEqual([2, 1]);
    // The turn itself, whole: a timeout would be an answer with nothing in it.
    expect(structured(run.said.find((one) => one.id === 1)).state).not.toBe('timeout');
    expect(structured(run.said.find((one) => one.id === 1)).text).toBeTruthy();

    run.input.end();
    await run.done;
  }, 20_000);

  it('answers a confirmation while the send_turn that waits on it is still open', async () => {
    const run = start();
    run.send(call(1, 'send_turn', { session: IDLE, text: 'run the tests', timeoutSeconds: 5 }));
    run.send(call(2, 'wait_for_attention', { session: IDLE, timeoutSeconds: 5 }));

    // The script stops on a confirmation, and the asking for it is a second
    // request answered while the first waits.
    await pumpUntil(run.host, () => run.said.some((one) => one.id === 2));
    const waiting = structured(run.said.find((one) => one.id === 2)) as {
      waitingOn?: { call?: { id?: string } };
    };
    const callId = waiting.waitingOn?.call?.id ?? '';
    expect(callId).not.toBe('');

    // Denied rather than approved: an approval opens the next question the
    // script asks, and this case is about the turn ending when the call it
    // stopped on is answered at all.
    run.send(call(3, 'confirm_tool_call', { session: IDLE, toolCallId: callId, approved: false }));

    await pumpUntil(run.host, () => run.said.some((one) => one.id === 1));
    const turn = structured(run.said.find((one) => one.id === 1)) as { state?: string; text?: string };
    expect(turn.state).not.toBe('timeout');
    expect(turn.text).toContain('Left it alone');
    // The confirmation was answered before the turn that waited on it.
    expect(run.said.map((one) => one.id)).toEqual([2, 3, 1]);

    run.input.end();
    await run.done;
  }, 20_000);

  it('waits for what it started when the input ends', async () => {
    const run = start();
    run.send(call(1, 'send_turn', { session: IDLE, text: 'run the tests', timeoutSeconds: 5 }));

    // Up to the confirmation the turn stops on, so the request is really in
    // flight when the input closes rather than finishing in the same tick.
    await pumpUntil(run.host, () => waitingOn(run.host, IDLE));
    expect(waitingOn(run.host, IDLE)).toBe(true);

    run.input.end();
    let saidWhenDone: number | undefined;
    void run.done.then(() => { saidWhenDone = run.said.length; });
    // It has to hold: nothing has answered the turn yet.
    await tick();
    expect(saidWhenDone).toBeUndefined();

    // Stop the turn, which is the only way this request can finish now.
    await run.host.stopTurn(IDLE);
    await pumpUntil(run.host, () => saidWhenDone !== undefined);
    await run.done;

    // The answer came out before stdio resolved: a request that was started
    // is owed its answer even though nothing more will ever arrive.
    expect(saidWhenDone).toBe(1);
    expect(run.said.map((one) => one.id)).toEqual([1]);
  }, 20_000);

  it('says which line was not JSON, and answers the next one', async () => {
    const problems: string[] = [];
    const run = start(fakeHost(), (said) => problems.push(said));
    run.input.write('this is not JSON\n');
    run.send({ jsonrpc: '2.0', id: 7, method: 'ping' });

    await pumpUntil(run.host, () => run.said.length >= 1);

    expect(problems.some((said) => said.startsWith('Not JSON:'))).toBe(true);
    expect(run.said.map((one) => one.id)).toEqual([7]);

    run.input.end();
    await run.done;
  });
});

describe('a cancelled request', () => {
  /** One cancellation, as a client puts it on the wire. */
  const cancelled = (requestId: number | string): Record<string, unknown> =>
    ({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId } });

  it('stops the turn it named, sends no answer for it, and keeps serving', async () => {
    const run = start();
    run.send(call(1, 'send_turn', { session: IDLE, text: 'run the tests', timeoutSeconds: 5 }));

    // Up to the confirmation, so the request is really in flight when the
    // cancel arrives rather than finishing in the same tick.
    await pumpUntil(run.host, () => waitingOn(run.host, IDLE));
    expect(waitingOn(run.host, IDLE)).toBe(true);

    run.send(cancelled(1));
    // The turn was stopped, which the host's own state says and no answer does.
    await pumpUntil(run.host, () => !waitingOn(run.host, IDLE));
    expect(waitingOn(run.host, IDLE)).toBe(false);
    // Nothing came back for the id the client let go of.
    await tick();
    expect(run.said).toEqual([]);

    // The stream still serves: a cancel stops one request and no more.
    run.send({ jsonrpc: '2.0', id: 2, method: 'ping' });
    await pumpUntil(run.host, () => run.said.some((one) => one.id === 2));
    expect(run.said.map((one) => one.id)).toEqual([2]);

    run.input.end();
    await run.done;
  }, 20_000);

  it('ignores a cancellation of an id that is not in flight', async () => {
    const run = start();
    run.send(call(1, 'send_turn', { session: IDLE, text: 'hello there', timeoutSeconds: 5 }));
    run.send(cancelled(99));

    // The request nobody named still answered, and answered with a turn.
    await pumpUntil(run.host, () => run.said.some((one) => one.id === 1));
    expect(run.said.map((one) => one.id)).toEqual([1]);
    expect(structured(run.said.find((one) => one.id === 1)).state).not.toBe('timeout');

    run.input.end();
    await run.done;
  }, 20_000);
});
