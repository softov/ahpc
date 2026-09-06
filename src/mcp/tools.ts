/*
 * What an agent somewhere else can do to a host through this client.
 *
 * One table, three surfaces. `stdio.ts` serves it to a client that launched
 * this process, `http.ts` serves the same table over a socket as MCP and as a
 * plain JSON API, and none of them holds any knowledge of what a tool does:
 * everything below is a name, a JSON Schema, and a few lines against the
 * `HostConnection` this client already opens.
 *
 * The schemas are written out rather than generated. They go on the wire as
 * JSON Schema whatever produces them, this is the only place they exist, and
 * a validator dependency to describe five objects would be a dependency for
 * its own sake - which is the same reason `flags.ts` scans argv by hand.
 *
 * Which tools: the ones that let an agent drive a session to completion, and
 * not the whole of what `ahpc` can do. A tool table is read by a model with
 * everything else it has been given, so forty of them is a worse server than
 * eleven. Files, terminals, automations and changesets are deliberately not
 * here; see ROADMAP.md.
 */

import type { HostConnection } from '../ahp/connection.js';
import { SessionFlag } from '../ahp/types.js';
import type { Answer, SessionUri, Turn } from '../ahp/types.js';
import { spoken, turn as runTurn, until } from '../wait.js';

/** As much of JSON Schema as a tool's arguments need. */
export interface Schema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    items?: { type: string };
    additionalProperties?: boolean | { type: string };
  }>;
  required?: string[];
  additionalProperties?: boolean;
}

/** One tool, as MCP describes it and as this client runs it. */
export interface Tool {
  /** The name a caller uses. MCP has no dots, so these are underscored. */
  name: string;
  /** A short label, for a client that shows one. */
  title: string;
  /** What it does and when to reach for it, written for a model. */
  description: string;
  input: Schema;
  /** Whether it changes anything, which some clients ask a person about. */
  readOnly: boolean;
  run(host: HostConnection, input: Record<string, unknown>): Promise<unknown>;
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const uriOf = (input: Record<string, unknown>): SessionUri => {
  const found = text(input.session);
  if (found === '') throw new Error('No session was given. Every session tool takes one from list_sessions or new_session.');
  return found as SessionUri;
};

/** A turn as an answer rather than a tree of parts, which is what a model reads. */
const said = (one: Turn): Record<string, unknown> => ({
  id: one.id,
  role: one.role,
  state: one.state,
  at: one.at,
  ...(one.message === undefined ? {} : { message: one.message }),
  text: spoken(one),
  tools: one.parts
    .filter((part) => part.kind === 'toolCall')
    .map((part) => (part.kind === 'toolCall'
      ? { id: part.call.id, name: part.call.name, status: part.call.status }
      : null))
    .filter((one_) => one_ !== null),
});

export const TOOLS: Tool[] = [
  {
    name: 'list_sessions',
    title: 'List sessions',
    description: 'Every session on the connected host, newest first. Start here: every other session tool takes a session URI from this list.',
    readOnly: true,
    input: {
      type: 'object',
      properties: {
        archived: { type: 'boolean', description: 'Include archived sessions. Off by default.' },
      },
      additionalProperties: false,
    },
    run: async (host, input) => {
      const rows = await host.listSessions();
      const wanted = input.archived === true
        ? rows
        : rows.filter((row) => (row.status & SessionFlag.IsArchived) === 0);
      return wanted.map((row) => ({
        session: row.resource,
        title: row.title,
        provider: row.provider,
        status: row.status,
        modifiedAt: row.modifiedAt,
        workingDirectories: row.workingDirectories,
        ...(row.activity === undefined ? {} : { activity: row.activity }),
      }));
    },
  },
  {
    name: 'show_session',
    title: 'Show one session',
    description: 'What the host says about one session: its title, what it is doing, and the directories it works in.',
    readOnly: true,
    input: {
      type: 'object',
      properties: { session: { type: 'string', description: 'A session URI from list_sessions.' } },
      required: ['session'],
      additionalProperties: false,
    },
    run: async (host, input) => host.detail(uriOf(input)),
  },
  {
    name: 'list_agents',
    title: 'List harnesses',
    description: 'The harnesses this host serves and the models each offers. The provider name from here is what new_session takes.',
    readOnly: true,
    input: { type: 'object', properties: {}, additionalProperties: false },
    run: async (host) => (await host.agents()).map((agent) => ({
      provider: agent.provider,
      name: agent.displayName,
      ...(agent.description === undefined ? {} : { description: agent.description }),
      models: agent.models.map((model) => model.id),
    })),
  },
  {
    name: 'new_session',
    title: 'Start a session',
    description: 'Create a session on the host and return its URI. The agent is not asked anything until send_turn.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: 'A provider from list_agents. The first one the host serves, if omitted.' },
        workingDirectory: { type: 'string', description: 'An absolute path on the host for the agent to work in.' },
        config: { type: 'object', description: 'Configuration values, as a flat object of strings.', additionalProperties: { type: 'string' } },
      },
      additionalProperties: false,
    },
    run: async (host, input) => {
      const provider = text(input.provider) || (await host.agents())[0]?.provider;
      if (provider === undefined) throw new Error('This host advertises no harness to start a session on.');
      const config = typeof input.config === 'object' && input.config !== null
        ? input.config as Record<string, string>
        : undefined;
      const where = text(input.workingDirectory);
      return {
        session: await host.createSession({
          provider,
          ...(where === '' ? {} : { workingDirectory: where }),
          ...(config === undefined ? {} : { config }),
        }),
      };
    },
  },
  {
    name: 'dispose_session',
    title: 'End a session',
    description: 'Dispose of a session. The transcript is the host\'s to keep or drop; the agent behind it stops.',
    readOnly: false,
    input: {
      type: 'object',
      properties: { session: { type: 'string' } },
      required: ['session'],
      additionalProperties: false,
    },
    run: async (host, input) => { await host.disposeSession(uriOf(input)); return { disposed: true }; },
  },
  {
    name: 'session_history',
    title: 'Read a transcript',
    description: 'The turns in a session, oldest first, as text rather than as a tree of parts.',
    readOnly: true,
    input: {
      type: 'object',
      properties: {
        session: { type: 'string' },
        all: { type: 'boolean', description: 'Load the whole conversation rather than the window the host opened with.' },
      },
      required: ['session'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      const uri = uriOf(input);
      if (input.all === true) {
        // Bounded, because a conversation somebody has been having for a year
        // is one this would otherwise read to the end of before answering.
        for (let page = 0; page < 100; page += 1) {
          if (!await host.loadOlderTurns(uri)) break;
        }
      }
      const event = await until(host, uri, (one) => one.type === 'snapshot', { timeoutSeconds: 30 });
      if (event?.type !== 'snapshot') throw new Error(`${uri} said nothing within thirty seconds.`);
      return {
        turns: event.turns.map(said),
        ...(event.active === undefined ? {} : { running: said(event.active) }),
        ...(event.input === undefined ? {} : { waitingOn: event.input }),
      };
    },
  },
  {
    name: 'send_turn',
    title: 'Say something and wait',
    description: 'Say something to a session and block until the agent has finished answering, then return what it said. A turn that stops to ask a person something is not finished: this keeps waiting, and wait_for_attention is how to find out what it wants.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        session: { type: 'string' },
        text: { type: 'string', description: 'What to say.' },
        model: { type: 'string', description: 'A model id from list_agents. The session\'s own, if omitted.' },
        timeoutSeconds: { type: 'number', description: 'How long to wait. 900 by default.' },
      },
      required: ['session', 'text'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      const model = text(input.model);
      const answer = await runTurn(host, uriOf(input), text(input.text), {
        ...(model === '' ? {} : { model: { id: model } as never }),
        ...(typeof input.timeoutSeconds === 'number' ? { timeoutSeconds: input.timeoutSeconds } : {}),
      });
      // Not an error: the turn is still running and the session is still
      // there, which is a different thing to tell a caller than a failure.
      return answer === undefined ? { state: 'timeout' } : said(answer);
    },
  },
  {
    name: 'queue_turn',
    title: 'Say something after this one',
    description: 'Queue a message to be said once the running turn finishes. Returns at once, unlike send_turn.',
    readOnly: false,
    input: {
      type: 'object',
      properties: { session: { type: 'string' }, text: { type: 'string' } },
      required: ['session', 'text'],
      additionalProperties: false,
    },
    run: async (host, input) => { host.queue(uriOf(input), text(input.text)); return { queued: true }; },
  },
  {
    name: 'cancel_turn',
    title: 'Stop the running turn',
    description: 'Interrupt whatever the agent is doing. What it had already said stays in the transcript.',
    readOnly: false,
    input: {
      type: 'object',
      properties: { session: { type: 'string' } },
      required: ['session'],
      additionalProperties: false,
    },
    run: async (host, input) => { host.stopTurn(uriOf(input)); return { cancelled: true }; },
  },
  {
    name: 'wait_for_attention',
    title: 'Wait until something wants a person',
    description: 'Block until the session needs an answer - a tool call to approve, a question to fill in - or until it goes quiet, and say which. This is what makes a session drivable from here: without it a caller has no way to see what send_turn is waiting on.',
    readOnly: true,
    input: {
      type: 'object',
      properties: {
        session: { type: 'string' },
        until: { type: 'string', description: 'input, the default, waits for something that wants a person; idle waits for the session to go quiet.' },
        timeoutSeconds: { type: 'number', description: '300 by default.' },
      },
      required: ['session'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      const stop = text(input.until) || 'input';
      /*
       * Either vocabulary, as `wait.ts` does.
       *
       * A host may rebuild the whole view and send a snapshot, or say what
       * changed - `inputNeeded` and `turnComplete`. Reading only snapshots
       * waits for ever on the second kind.
       */
      const event = await until(host, uriOf(input), (one) => {
        if (stop === 'idle') {
          if (one.type === 'turnComplete') return true;
          return one.type === 'snapshot' && one.active === undefined && one.input === undefined;
        }
        if (one.type === 'inputNeeded') return true;
        return one.type === 'snapshot' && one.input !== undefined;
      }, { timeoutSeconds: typeof input.timeoutSeconds === 'number' ? input.timeoutSeconds : 300 });
      if (event === undefined) return { state: 'timeout' };
      if (event.type === 'inputNeeded') return { state: 'waiting', waitingOn: event.input };
      if (event.type === 'turnComplete') return { state: 'idle', finished: said(event.turn) };
      if (event.type !== 'snapshot') return { state: 'timeout' };
      return {
        state: event.input === undefined ? 'idle' : 'waiting',
        ...(event.input === undefined ? {} : { waitingOn: event.input }),
        ...(event.active === undefined ? {} : { running: said(event.active) }),
      };
    },
  },
  {
    name: 'confirm_tool_call',
    title: 'Approve or deny a tool call',
    description: 'Answer a tool call the agent is blocked on. The id comes from wait_for_attention.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        session: { type: 'string' },
        toolCallId: { type: 'string' },
        approved: { type: 'boolean', description: 'True to allow it, false to refuse.' },
        optionId: { type: 'string', description: 'One of the options the request offered, where it offered any.' },
      },
      required: ['session', 'toolCallId', 'approved'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      const option = text(input.optionId);
      host.confirmToolCall(
        uriOf(input),
        text(input.toolCallId),
        input.approved === true,
        option === '' ? undefined : option,
      );
      return { answered: true };
    },
  },
  {
    name: 'answer_question',
    title: 'Answer what the agent asked',
    description: 'Fill in a question the agent put to a person. The request id and the fields come from wait_for_attention.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        session: { type: 'string' },
        requestId: { type: 'string' },
        answers: { type: 'object', description: 'The answers, keyed by question id.', additionalProperties: true },
        reject: { type: 'boolean', description: 'Decline to answer instead.' },
      },
      required: ['session', 'requestId'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      const answers = typeof input.answers === 'object' && input.answers !== null
        ? input.answers as Record<string, Answer>
        : {};
      host.completeInput(uriOf(input), text(input.requestId), input.reject !== true, answers);
      return { answered: true };
    },
  },
];

/** One tool by the name a caller used, or nothing. */
export const named = (name: string): Tool | undefined => TOOLS.find((one) => one.name === name);
