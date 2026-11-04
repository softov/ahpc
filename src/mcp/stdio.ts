/*
 * MCP over the process's own standard streams.
 *
 * The transport a client that launched this process uses: one JSON-RPC
 * message per line on stdin, one per line on stdout, and nothing else on
 * stdout ever - a stray `console.log` here is a parse error at the other end,
 * which is why everything this says goes to stderr.
 */

import type { HostConnection } from '../ahp/connection.js';
import { answer, type Incoming } from './serve.js';

/** A request being answered, and how to stop it. */
interface InFlight {
  controller: AbortController;
  /**
   * What the request asked for.
   *
   * Kept because MCP says a cancellation of `initialize` MUST be ignored, and
   * the id alone does not say which method it belonged to.
   */
  method: string;
  /** Settles when the answer has gone out, or has been dropped as cancelled. */
  answered: Promise<void>;
}

/**
 * Serve until stdin closes.
 *
 * Each request starts as its line arrives, and is answered when it is done, in
 * whatever order that turns out to be. JSON-RPC carries the id of its request
 * in the response, so a client matches the two by id rather than by order -
 * and holding a `ping` behind a `send_turn` that blocks for as long as a model
 * takes would be a wait nobody asked for. It is also what lets a client answer
 * a confirmation while the call that stopped on it is still open.
 *
 * Every response is one write of one whole line, so two of them meeting on
 * stdout cannot mix. At the end of the input, what was already started is
 * waited for: an answer that was begun is owed.
 *
 * A `notifications/cancelled` stops the request it names through an
 * `AbortController`, and that request then sends nothing at all - a client
 * that cancelled is not waiting for an answer, and one arriving anyway is a
 * response to a request it has already let go of.
 */
export async function stdio(
  host: HostConnection,
  options: {
    name: string;
    version: string;
    groups?: readonly string[];
    /** Where the messages are read from. `process.stdin` unless given. */
    input?: NodeJS.ReadableStream;
    /** Where the answers are written. `process.stdout` unless given. */
    output?: NodeJS.WritableStream;
    onProblem?(said: string): void;
  },
): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const say = (value: unknown): void => { output.write(`${JSON.stringify(value)}\n`); };
  let rest = '';
  /** The requests being answered, by the id their client used. */
  const inFlight = new Map<number | string, InFlight>();

  /**
   * Stop the request a cancellation names.
   *
   * An id that is not in flight is ignored rather than reported: a client is
   * entitled to cancel a request whose answer is already on its way, and by
   * then there is nothing left to stop. `initialize` is ignored because MCP
   * says it MUST NOT be cancelled at all.
   */
  const cancel = (message: Incoming): void => {
    const params = typeof message.params === 'object' && message.params !== null
      ? message.params as Record<string, unknown>
      : {};
    const wanted = params.requestId;
    const held = typeof wanted === 'number' || typeof wanted === 'string' ? inFlight.get(wanted) : undefined;
    if (held !== undefined && held.method !== 'initialize') held.controller.abort();
  };

  const take = (line: string): void => {
    const said = line.trim();
    if (said === '') return;
    let message: Incoming;
    try { message = JSON.parse(said) as Incoming; }
    catch {
      // No id to answer against, so there is nobody to tell. Said on
      // stderr, where a person debugging their client will find it.
      options.onProblem?.(`Not JSON: ${said.slice(0, 200)}`);
      return;
    }
    // Cancellation is the one notification with something to do here, and a
    // notification is never answered whatever it says.
    if (message.method === 'notifications/cancelled') { cancel(message); return; }

    const controller = new AbortController();
    const id = typeof message.id === 'number' || typeof message.id === 'string' ? message.id : undefined;
    const answered = answer(host, message, {
      ...options,
      signal: controller.signal,
      // A notification mid-request is free here: stdout is a stream and
      // the client is already reading lines off it. The HTTP half has to
      // choose a response type before it can say anything at all.
      notify: (notification) => say({ jsonrpc: '2.0', ...notification }),
    })
      .then((reply) => {
        if (controller.signal.aborted) return;
        if (reply !== undefined) say(reply);
      })
      .catch((error: unknown) => {
        options.onProblem?.(error instanceof Error ? error.message : String(error));
      });

    if (id === undefined) return;
    inFlight.set(id, { controller, method: typeof message.method === 'string' ? message.method : '', answered });
    void answered.then(() => {
      // Only the request that filled a slot may empty it. A client should not
      // reuse an id, but one that did must not drop the newer request from
      // the set when the older one settles.
      if (inFlight.get(id)?.answered === answered) inFlight.delete(id);
    });
  };

  await new Promise<void>((done) => {
    const wait = (): void => {
      void Promise.all([...inFlight.values()].map((one) => one.answered)).then(() => done());
    };
    input.setEncoding('utf8');
    input.on('data', (chunk: string) => {
      rest += chunk;
      for (;;) {
        const at = rest.indexOf('\n');
        if (at === -1) break;
        take(rest.slice(0, at));
        rest = rest.slice(at + 1);
      }
    });
    input.on('end', () => { take(rest); rest = ''; wait(); });
    input.on('close', wait);
  });
}
