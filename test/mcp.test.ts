/*
 * The tool server, on both of its transports.
 *
 * Driven against `fakeHost`, which is the same seam a real connection
 * presents, so what is under test is the table and the two transports rather
 * than a socket. The HTTP half is started on port 0 and asked over a real
 * loopback connection, because the thing that goes wrong with an HTTP server
 * is never the handler.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { fakeHost } from '../src/ahp/fake.js';
import { TOOLS, named } from '../src/mcp/tools.js';
import { PROTOCOL, SERVER, answer, call } from '../src/mcp/serve.js';
import { serve, type Serving } from '../src/mcp/http.js';

let running: Serving | undefined;
afterEach(async () => { await running?.close(); running = undefined; });

const ask = async (message: Record<string, unknown>): Promise<Record<string, unknown> | undefined> => {
  const host = fakeHost();
  return await answer(host, message, SERVER) as Record<string, unknown> | undefined;
};

describe('the table', () => {
  it('names every tool once, in a shape MCP can put on the wire', () => {
    const names = TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of TOOLS) {
      // MCP tool names are not dotted, and a client that sends one this
      // server cannot match is one whose call silently does nothing.
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.input.type).toBe('object');
      // Every required field is one the schema also describes, or a caller
      // reading the schema cannot satisfy it.
      for (const key of tool.input.required ?? []) {
        expect(Object.keys(tool.input.properties)).toContain(key);
      }
    }
  });

  it('refuses a session tool that was given no session, by saying which', async () => {
    const host = fakeHost();
    const said = await call(host, 'session_history', {}) as { isError?: boolean; content: { text: string }[] };
    // A refusal, not a crash: `isError` is what a model reads and acts on,
    // where a JSON-RPC error is a fault it can only give up over.
    expect(said.isError).toBe(true);
    expect(said.content[0]?.text).toContain('No session was given');
  });

  it('says so when the tool does not exist, rather than failing the call', async () => {
    const said = await call(fakeHost(), 'no_such_tool', {}) as { isError?: boolean; content: { text: string }[] };
    expect(said.isError).toBe(true);
    expect(said.content[0]?.text).toContain('tools/list');
  });
});

describe('the protocol', () => {
  it('answers the handshake with the version it speaks', async () => {
    const said = await ask({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect((said?.result as { protocolVersion: string }).protocolVersion).toBe(PROTOCOL);
    expect((said?.result as { capabilities: { tools: unknown } }).capabilities.tools).toBeDefined();
  });

  it('says nothing back to a notification', async () => {
    // A reply to a message with no id is a protocol error on this end, and
    // the client that sent it has nobody waiting for one.
    expect(await ask({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
  });

  it('lists the tools with their schemas', async () => {
    const said = await ask({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const listed = (said?.result as { tools: { name: string; inputSchema: unknown }[] }).tools;
    expect(listed).toHaveLength(TOOLS.length);
    expect(listed.every((one) => one.inputSchema !== undefined)).toBe(true);
  });

  it('refuses a method it does not implement, rather than pretending', async () => {
    const said = await ask({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
    expect((said?.error as { code: number }).code).toBe(-32601);
  });

  it('runs a tool and hands back both the text and the structure', async () => {
    const host = fakeHost();
    const said = await answer(host, {
      jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_agents', arguments: {} },
    }, SERVER) as { result: { content: { text: string }[]; structuredContent: unknown } };
    // Both, because clients differ over which they read.
    expect(said.result.structuredContent).toBeDefined();
    expect(JSON.parse(said.result.content[0]?.text ?? 'null')).toBeDefined();
  });
});

describe('over HTTP', () => {
  const start = async (options: { token?: string } = {}): Promise<string> => {
    running = await serve(fakeHost(), {
      ...SERVER, host: '127.0.0.1', port: 0, ...(options.token === undefined ? {} : { token: options.token }),
    });
    return `http://127.0.0.1:${running.port}`;
  };

  it('speaks MCP at /mcp', async () => {
    const at = await start();
    const said = await fetch(`${at}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(said.status).toBe(200);
    const body = await said.json() as { result: { tools: unknown[] } };
    expect(body.result.tools).toHaveLength(TOOLS.length);
  });

  it('answers a notification with 202 and no body', async () => {
    const at = await start();
    const said = await fetch(`${at}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    // Not 200 with an empty body: a client waiting on a reply to a
    // notification would hang over one.
    expect(said.status).toBe(202);
    expect(await said.text()).toBe('');
  });

  it('runs the same tool as plain JSON at /api', async () => {
    const at = await start();
    const said = await fetch(`${at}/api/list_agents`, { method: 'POST' });
    expect(said.status).toBe(200);
    // The answer itself, without MCP's content envelope: this half is for a
    // program rather than for a model.
    const body = await said.json();
    expect(body).toBeDefined();
    expect(JSON.stringify(body)).not.toContain('structuredContent');
  });

  it('turns a tool refusal into a status a caller can branch on', async () => {
    const at = await start();
    const said = await fetch(`${at}/api/session_history`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(said.status).toBe(400);
    expect((await said.json() as { error: string }).error).toContain('No session was given');
  });

  it('lists what it serves to somebody who has just started it', async () => {
    const at = await start();
    const said = await fetch(`${at}/api`);
    expect((await said.json() as { tools: unknown[] }).tools).toHaveLength(TOOLS.length);
  });

  it('refuses everything without the token, once one is set', async () => {
    const at = await start({ token: 'secret' });
    expect((await fetch(`${at}/api`)).status).toBe(401);
    const allowed = await fetch(`${at}/api`, { headers: { authorization: 'Bearer secret' } });
    expect(allowed.status).toBe(200);
    // And a wrong one is refused rather than let through by a prefix match.
    expect((await fetch(`${at}/api`, { headers: { authorization: 'Bearer secretly' } })).status).toBe(401);
  });

  it('says where to look rather than 404ing silently', async () => {
    const at = await start();
    const said = await fetch(`${at}/nowhere`);
    expect(said.status).toBe(404);
    expect((await said.json() as { error: string }).error).toContain('/api');
  });
});

describe('the tools a session is driven with', () => {
  it('creates a session, says something, and reads it back', async () => {
    const host = fakeHost();
    const made = await named('new_session')!.run(host, {}) as { session: string };
    expect(made.session).toBeTruthy();

    /*
     * The fake answers as it is pumped, which is the point of it.
     *
     * `send_turn` blocks until the turn ends, so the clock has to be driven
     * from outside the call - the same way the application drives it from a
     * ticker. Pumped and given a tick to settle, until it answers.
     */
    const answering = named('send_turn')!.run(host, {
      session: made.session, text: 'hello there', timeoutSeconds: 5,
    });
    let finished = false;
    void answering.then(() => { finished = true; }, () => { finished = true; });
    for (let i = 0; i < 400 && !finished; i += 1) {
      host.drain();
      await new Promise((tick) => { setTimeout(tick, 0); });
    }
    const turn = await answering as { state?: string; text?: string };
    expect(turn.state).not.toBe('timeout');
    expect(turn.text).toBeTruthy();

    const read = await named('session_history')!.run(host, { session: made.session }) as {
      turns: { text: string }[];
    };
    expect(read.turns.length).toBeGreaterThan(0);
  });

  it('lists what it created, and hides nothing that is not archived', async () => {
    const host = fakeHost();
    const made = await named('new_session')!.run(host, {}) as { session: string };
    const rows = await named('list_sessions')!.run(host, {}) as { session: string }[];
    expect(rows.some((row) => row.session === made.session)).toBe(true);
  });
});
