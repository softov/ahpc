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
import { named, served } from './tools.js';
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

/**
 * One progress notification, as `notifications/progress` puts it on the wire.
 *
 * `progress` MUST increase on every one, `total` is left out because an
 * agent's reply has no length known in advance, and `message` is what a person
 * reads - which is the tool name a session stopped on, or the host's own words
 * for what it is doing.
 */
export interface Progress {
  progressToken: string | number;
  progress: number;
  message?: string;
}

/** Somewhere to put progress while a tool runs, or nothing where nobody asked. */
export type Report = ((said: string) => void) | undefined;

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
export const listing = (groups: readonly string[] = []): unknown => ({
  tools: served(groups).map((tool) => ({
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
export async function call(
  host: HostConnection,
  name: string,
  input: unknown,
  report?: Report,
  groups: readonly string[] = [],
): Promise<unknown> {
  const tool = named(name);
  if (tool === undefined) {
    return {
      isError: true,
      content: [{ type: 'text', text: `No tool called ${name}. Ask tools/list for what there is.` }],
    };
  }
  // Exists, but this server was not started with it. Said as itself rather
  // than as "no such tool", because the difference is one flag and only the
  // person who started this can supply it.
  if (tool.group !== undefined && !groups.includes(tool.group)) {
    return {
      isError: true,
      content: [{ type: 'text', text: `${name} is in the ${tool.group} group, which this server was not started with. It needs --mcp-tools ${tool.group}.` }],
    };
  }
  try {
    const answer = await tool.run(host, bag(input), report);
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
 * Somewhere for a running tool to say what it is doing, if anybody asked.
 *
 * A caller opts in by putting a `progressToken` in `_meta` on the request, and
 * `undefined` here means it did not - in which case a tool that reports
 * anything is writing to nowhere, which is exactly what should happen. The
 * counter is this closure's, because `progress` MUST increase and a tool
 * counting for itself would be a tool that has to know about the protocol.
 */
function reporter(
  message: Incoming,
  notify: ((notification: { method: string; params: unknown }) => void) | undefined,
): Report {
  const token = bag(bag(message.params)._meta).progressToken;
  if (notify === undefined) return undefined;
  if (typeof token !== 'string' && typeof token !== 'number') return undefined;
  let count = 0;
  return (said: string): void => {
    count += 1;
    const params: Progress = { progressToken: token, progress: count, message: said };
    notify({ method: 'notifications/progress', params });
  };
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
  options: {
    name: string;
    version: string;
    /** The opt-in tool groups this server was started with, if any. */
    groups?: readonly string[];
    /**
     * Somewhere to send a notification while this is being answered.
     *
     * Given by a transport that has one: stdio always does, and HTTP does only
     * once it has decided to answer with a stream. Absent means there is
     * nowhere to say anything until the result, which is the ordinary case and
     * why every progress path here is optional.
     */
    notify?(notification: { method: string; params: unknown }): void;
  },
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
  if (method === 'tools/list') return ok(listing(options.groups));
  if (method === 'tools/call') {
    const params = bag(message.params);
    const name = typeof params.name === 'string' ? params.name : '';
    if (name === '') return no(INVALID_PARAMS, 'tools/call needs a name.');
    try { return ok(await call(host, name, params.arguments, reporter(message, options.notify), options.groups)); }
    catch (error) { return no(INTERNAL, error instanceof Error ? error.message : String(error)); }
  }
  return no(METHOD_NOT_FOUND, `This server does not implement ${method}. It serves tools and nothing else.`);
}
