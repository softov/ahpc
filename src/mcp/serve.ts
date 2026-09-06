/*
 * MCP, spoken directly.
 *
 * The protocol a tools-only server has to answer is small: `initialize`, an
 * `initialized` notification with no reply, `tools/list`, `tools/call`, and
 * `ping`. All of it is JSON-RPC 2.0, which this client already reads and
 * writes for AHP. An SDK for those five would be a dependency the published
 * CLI carries into every install to save a hundred lines - the same trade
 * `flags.ts` refuses for argv.
 *
 * What is deliberately not here: prompts, resources, sampling, roots and
 * subscriptions. A server that advertises no capability for them is not
 * obliged to answer them, and a caller that asks is told the method is not
 * there, which is the truth.
 */

import type { HostConnection } from '../ahp/connection.js';
import { TOOLS, named } from './tools.js';
import { version } from '../version.js';

/** The newest version of MCP this speaks, and what it answers an unknown one with. */
export const PROTOCOL = '2025-06-18';

/**
 * Every version this will serve, newest first.
 *
 * Both of these describe the same tools, and this server uses nothing either
 * of them added or removed - no sessions, no resources, no sampling - so
 * refusing the older one would be refusing a client for a difference that
 * cannot reach it. `2024-11-05` is *not* here: its HTTP transport is a
 * different shape, with an `endpoint` event and a second URL.
 */
export const SPOKEN: readonly string[] = ['2025-06-18', '2025-03-26'];

/**
 * What this server calls itself.
 *
 * MCP requires a version where AHP's `clientInfo` does not. Read from the
 * manifest rather than written here: the literal that used to be here said
 * 0.1 while the package said 0.2, within a day of being written.
 */
export const SERVER = { name: 'ahpc', version: version() };

/** A JSON-RPC request or notification, as far as this needs to read one. */
export interface Incoming {
  jsonrpc?: unknown;
  id?: number | string | null;
  method?: unknown;
  params?: unknown;
}

/** What goes back, or nothing at all where the message was a notification. */
export type Outgoing = { jsonrpc: '2.0'; id: number | string | null } & (
  | { result: unknown; error?: never }
  | { error: { code: number; message: string }; result?: never }
);

const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL = -32603;

const bag = (value: unknown): Record<string, unknown> =>
  (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {});

/** The tools, in the shape `tools/list` puts them on the wire. */
export const listing = (): unknown => ({
  tools: TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.input,
    annotations: { readOnlyHint: tool.readOnly },
  })),
});

/**
 * Run one tool and shape the answer the way `tools/call` wants it.
 *
 * A tool that throws is *not* a protocol error. MCP has `isError` on the
 * result for exactly this: the call reached the tool and the tool said no,
 * which a model can read and act on, where a JSON-RPC error is a transport
 * fault it can only give up over. So a refusal from the host - a session that
 * is gone, a directory it does not serve - comes back as content.
 */
export async function call(host: HostConnection, name: string, input: unknown): Promise<unknown> {
  const tool = named(name);
  if (tool === undefined) {
    return {
      isError: true,
      content: [{ type: 'text', text: `No tool called ${name}. Ask tools/list for what there is.` }],
    };
  }
  try {
    const answer = await tool.run(host, bag(input));
    return {
      // Both, because clients differ: the text is what a model reads and
      // `structuredContent` is what a program does, and sending only the
      // second leaves older clients with an empty result.
      content: [{ type: 'text', text: JSON.stringify(answer, null, 2) }],
      structuredContent: bag(answer).constructor === Object && !Array.isArray(answer) && answer !== null
        ? answer
        : { result: answer },
    };
  }
  catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    };
  }
}

/**
 * Answer one message.
 *
 * `undefined` where there is nothing to send back, which is a notification -
 * and answering one anyway is a protocol error on this end, not a courtesy.
 */
export async function answer(
  host: HostConnection,
  message: Incoming,
  options: { name: string; version: string },
): Promise<Outgoing | undefined> {
  const method = typeof message.method === 'string' ? message.method : '';
  const id = message.id ?? null;
  const notification = message.id === undefined;

  if (method === 'notifications/initialized' || method.startsWith('notifications/')) return undefined;
  if (notification) return undefined;

  const ok = (result: unknown): Outgoing => ({ jsonrpc: '2.0', id, result });
  const no = (code: number, said: string): Outgoing => ({ jsonrpc: '2.0', id, error: { code, message: said } });

  if (method === 'initialize') {
    /*
     * The client's version where this can speak it, and the newest otherwise.
     *
     * `lifecycle` says a server answering a version it was not asked for is
     * telling the client to take that one or disconnect, so answering our
     * own regardless would refuse every client a release behind for no
     * reason. A version this cannot speak gets the newest it can, which is
     * the offer the client then accepts or drops.
     */
    const asked = bag(message.params).protocolVersion;
    return ok({
      protocolVersion: typeof asked === 'string' && SPOKEN.includes(asked) ? asked : PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: options.name, version: options.version },
    });
  }
  if (method === 'ping') return ok({});
  if (method === 'tools/list') return ok(listing());
  if (method === 'tools/call') {
    const params = bag(message.params);
    const name = typeof params.name === 'string' ? params.name : '';
    if (name === '') return no(INVALID_PARAMS, 'tools/call needs a name.');
    try { return ok(await call(host, name, params.arguments)); }
    catch (error) { return no(INTERNAL, error instanceof Error ? error.message : String(error)); }
  }
  return no(METHOD_NOT_FOUND, `This server does not implement ${method}. It serves tools and nothing else.`);
}
