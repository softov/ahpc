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
import { SPOKEN, answer, call, listing, type Incoming } from './serve.js';

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
  /**
   * Browser origins allowed to reach this, beyond its own.
   *
   * Empty is the safe default and the usual answer: a shell script, a webhook
   * and an MCP client send no `Origin` at all, so nothing legitimate is turned
   * away by allowing none. This is for a page somebody serves themselves.
   */
  origins?: readonly string[];
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

/**
 * Whether a browser may talk to this.
 *
 * The transport says a server **MUST** validate `Origin` to stop DNS
 * rebinding, and the reason it says so is that binding to loopback is not the
 * protection it looks like: a page on any website can POST to
 * `http://127.0.0.1:7431` from inside the browser of the person running this,
 * and the request arrives from their own machine looking exactly like theirs.
 * Without this, opening a tab would be enough to drive every session on the
 * host.
 *
 * No header at all is allowed. A browser always sends one on a request like
 * these; a program does not, and refusing those would refuse every real
 * caller to guard against a thing that cannot happen.
 */
const sameOrigin = (request: IncomingMessage, url: URL, extra: readonly string[]): boolean => {
  const said = request.headers.origin;
  if (typeof said !== 'string' || said === '') return true;
  if (extra.includes(said)) return true;
  try {
    const from = new URL(said);
    // The host and port this request came in on, whatever name was used to
    // reach it - `localhost` and `127.0.0.1` are the same server and a person
    // typing either should not be told no.
    return from.host === url.host;
  }
  catch { return false; }
};

/**
 * Whether this can speak the version the client says it is using.
 *
 * The transport says an invalid or unsupported `MCP-Protocol-Version` **MUST**
 * be a 400. Absent is not unsupported: the same paragraph says to assume
 * `2025-03-26` where there is no header, which is a client from before it
 * existed.
 */
const speakable = (request: IncomingMessage): boolean => {
  const said = request.headers['mcp-protocol-version'];
  if (said === undefined) return true;
  return typeof said === 'string' && SPOKEN.includes(said);
};

/** Start listening. Answers once the socket is up. */
export async function serve(host: HostConnection, options: ServeOptions): Promise<Serving> {
  const server: Server = createServer((request, response) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
        const path = url.pathname.replace(/\/+$/, '') || '/';

        if (!sameOrigin(request, url, options.origins ?? [])) {
          // 403 rather than 401: a token would not make this request
          // acceptable, so inviting one would be the wrong thing to say.
          send(response, 403, { error: `This server does not serve requests from ${String(request.headers.origin)}.` });
          return;
        }
        if (!speakable(request)) {
          send(response, 400, {
            error: `This server does not speak MCP ${String(request.headers['mcp-protocol-version'])}. It speaks ${SPOKEN.join(', ')}.`,
          });
          return;
        }
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
