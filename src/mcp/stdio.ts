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

/**
 * Serve until stdin closes.
 *
 * Sequential rather than concurrent: `send_turn` blocks for as long as a model
 * takes, and running the next message while it waits would answer out of
 * order. A client that wants two things at once opens two sessions.
 */
export async function stdio(
  host: HostConnection,
  options: { name: string; version: string; groups?: readonly string[]; onProblem?(said: string): void },
): Promise<void> {
  const say = (value: unknown): void => { process.stdout.write(`${JSON.stringify(value)}\n`); };
  let rest = '';

  await new Promise<void>((done) => {
    let running: Promise<void> = Promise.resolve();

    const take = (line: string): void => {
      const said = line.trim();
      if (said === '') return;
      running = running.then(async () => {
        let message: Incoming;
        try { message = JSON.parse(said) as Incoming; }
        catch {
          // No id to answer against, so there is nobody to tell. Said on
          // stderr, where a person debugging their client will find it.
          options.onProblem?.(`Not JSON: ${said.slice(0, 200)}`);
          return;
        }
        const reply = await answer(host, message, {
          ...options,
          // A notification mid-request is free here: stdout is a stream and
          // the client is already reading lines off it. The HTTP half has to
          // choose a response type before it can say anything at all.
          notify: (notification) => say({ jsonrpc: '2.0', ...notification }),
        });
        if (reply !== undefined) say(reply);
      }).catch((error: unknown) => {
        options.onProblem?.(error instanceof Error ? error.message : String(error));
      });
    };

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      rest += chunk;
      for (;;) {
        const at = rest.indexOf('\n');
        if (at === -1) break;
        take(rest.slice(0, at));
        rest = rest.slice(at + 1);
      }
    });
    process.stdin.on('end', () => { take(rest); rest = ''; void running.then(() => done()); });
    process.stdin.on('close', () => { void running.then(() => done()); });
  });
}
