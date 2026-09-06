/*
 * The same tools over a socket, twice.
 *
 * `POST /mcp` is MCP's streamable HTTP transport, which for a tools-only
 * server is a JSON-RPC request in and a JSON-RPC response out. `POST
 * /api/<tool>` is the same tool with the arguments as the body and the answer
 * as the body, for everything that is not an MCP client - a shell script, a
 * webhook, a program in another language. `GET /api` lists what there is.
 *
 * One process, one connection to the host, however many callers. That is the
 * difference from `stdio`, and the reason both exist: stdio is owned by the
 * client that launched it, this is shared and outlives any of them.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { HostConnection } from '../ahp/connection.js';
import { answer, call, listing, type Incoming } from './serve.js';

/** How much of a request body is read before it is refused, in bytes. */
const LIMIT = 1_000_000;

export interface ServeOptions {
  host: string;
  port: number;
  name: string;
  version: string;
  /**
   * A bearer token every request must carry, if any.
   *
   * Absent means anybody who can reach the port can drive every session on the
   * host, which is why `--serve-host` defaults to the loopback address. A
   * token is what makes binding anywhere else defensible.
   */
  token?: string;
  onProblem?(said: string): void;
}

/** What this is listening on, and how to stop it. */
export interface Serving {
  host: string;
  port: number;
  close(): Promise<void>;
}

const body = async (request: IncomingMessage): Promise<string> => {
  let read = '';
  for await (const chunk of request) {
    read += String(chunk);
    if (read.length > LIMIT) throw new Error('That request is too big.');
  }
  return read;
};

const send = (response: ServerResponse, code: number, value: unknown): void => {
  const text = JSON.stringify(value);
  response.writeHead(code, {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(text)),
  });
  response.end(text);
};

/**
 * Whether a request carries the token, where one was set.
 *
 * `Authorization: Bearer <token>`, which is what MCP's own HTTP transport
 * says, and what every client that speaks it already sends.
 */
const allowed = (request: IncomingMessage, token: string | undefined): boolean => {
  if (token === undefined) return true;
  const said = request.headers.authorization;
  return typeof said === 'string' && said.trim() === `Bearer ${token}`;
};

/** Start listening. Answers once the socket is up. */
export async function serve(host: HostConnection, options: ServeOptions): Promise<Serving> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
        const path = url.pathname.replace(/\/+$/, '') || '/';

        if (!allowed(request, options.token)) {
          send(response, 401, { error: 'This server needs a bearer token.' });
          return;
        }

        // What is here, for somebody who has just started it and wants to know
        // what to call. Every tool with its schema, which is also what an MCP
        // client gets from `tools/list`.
        if (request.method === 'GET' && (path === '/api' || path === '/')) {
          send(response, 200, listing());
          return;
        }

        if (path === '/mcp') {
          if (request.method !== 'POST') {
            // No SSE stream: this server sends nothing a client did not ask
            // for, so there is nothing for a GET to hold open.
            send(response, 405, { error: 'POST a JSON-RPC message here.' });
            return;
          }
          let message: Incoming;
          try { message = JSON.parse(await body(request)) as Incoming; }
          catch { send(response, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'That is not JSON.' } }); return; }
          const reply = await answer(host, message, options);
          // A notification is answered with 202 and no body, which is what the
          // transport says and what a client waiting on one would hang over.
          if (reply === undefined) { response.writeHead(202); response.end(); return; }
          send(response, 200, reply);
          return;
        }

        if (path.startsWith('/api/')) {
          if (request.method !== 'POST') { send(response, 405, { error: 'POST to call a tool.' }); return; }
          const name = path.slice('/api/'.length);
          const raw = await body(request);
          let input: unknown = {};
          if (raw.trim() !== '') {
            try { input = JSON.parse(raw); }
            catch { send(response, 400, { error: 'That is not JSON.' }); return; }
          }
          const result = await call(host, name, input) as { isError?: boolean; structuredContent?: unknown; content?: { text?: string }[] };
          // Shaped for a program rather than for a model: the answer itself,
          // or the refusal as an error, without MCP's content envelope around
          // it. A caller that wants the envelope has `/mcp`.
          if (result.isError === true) {
            send(response, 400, { error: result.content?.[0]?.text ?? 'That did not work.' });
            return;
          }
          send(response, 200, result.structuredContent ?? {});
          return;
        }

        send(response, 404, { error: `Nothing at ${path}. Try GET /api.` });
      }
      catch (error) {
        options.onProblem?.(error instanceof Error ? error.message : String(error));
        if (!response.headersSent) send(response, 500, { error: 'Something went wrong here.' });
        else response.end();
      }
    })();
  });

  await new Promise<void>((up, fail) => {
    server.once('error', fail);
    server.listen(options.port, options.host, () => { server.off('error', fail); up(); });
  });

  const found = server.address();
  return {
    host: typeof found === 'object' && found !== null ? found.address : options.host,
    port: typeof found === 'object' && found !== null ? found.port : options.port,
    close: () => new Promise<void>((done) => { server.close(() => done()); }),
  };
}
