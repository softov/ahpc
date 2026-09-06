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
import type { Answer, SessionUri, TerminalState, Turn } from '../ahp/types.js';
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

/**
 * A set of tools a caller has to ask for by name.
 *
 * The core table - sessions, turns, attention - is what a server is for and is
 * always served. These are not: a tool table is read by a model alongside
 * everything else it was given, and thirty tools is a worse server than twelve
 * for the thing almost everybody wants. So they are opt-*in*, one group at a
 * time, and a caller that needs files says so.
 */
export type Group = 'resources' | 'terminals' | 'automations' | 'changes';

/** Every group there is, for `--mcp-tools` to name in its help. */
export const GROUPS: readonly Group[] = ['resources', 'terminals', 'automations', 'changes'];

/** One tool, as MCP describes it and as this client runs it. */
export interface Tool {
  /** The name a caller uses. MCP has no dots, so these are underscored. */
  name: string;
  /**
   * The group that has to be turned on for this to be served.
   *
   * Absent is core: always there, never asked for.
   */
  group?: Group;
  /** A short label, for a client that shows one. */
  title: string;
  /** What it does and when to reach for it, written for a model. */
  description: string;
  input: Schema;
  /** Whether it changes anything, which some clients ask a person about. */
  readOnly: boolean;
  /**
   * Do it.
   *
   * `report` is where to say what is happening while a long one runs, and is
   * absent unless the caller asked for progress and the transport can carry
   * it. A tool that reports nothing is a tool that finishes quickly enough
   * not to need to.
   */
  run(host: HostConnection, input: Record<string, unknown>, report?: (said: string) => void): Promise<unknown>;
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

/** The URI a resource tool was given, which is a `file://` on the host rather than a local path. */
const pathOf = (input: Record<string, unknown>, key = 'path'): string => {
  const found = text(input[key]);
  if (found === '') throw new Error(`No ${key} was given. Resource tools take a file:// URI on the host, not a path on this machine.`);
  return found;
};

/** A host half this connection may not have, or the reason it does not. */
function has<T>(part: T | undefined, what: string): T {
  if (part === undefined) throw new Error(`This host serves no ${what}. A host is given one, and this one was not.`);
  return part;
}

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
    run: async (host, input, report) => {
      const model = text(input.model);
      const answer = await runTurn(host, uriOf(input), text(input.text), {
        ...(model === '' ? {} : { model: { id: model } as never }),
        ...(typeof input.timeoutSeconds === 'number' ? { timeoutSeconds: input.timeoutSeconds } : {}),
        /*
         * What a caller watching this is told while it waits.
         *
         * The tool a session stopped on, not the reply as it is typed: MCP's
         * progress carries a human-readable line and has no shape for partial
         * result content, so the text still arrives whole at the end. What
         * this fixes is an agent that looked frozen for a minute.
         */
        ...(report === undefined ? {} : {
          onStep: (call) => report(call.name),
          onWaiting: (call) => report(`waiting on ${call.name}`),
        }),
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
  /*
   * The files the host serves, which is the `resources` group.
   *
   * Every one of these takes a `file://` URI on the *host*, not a path here -
   * the host may be on another machine, and a tool that quietly resolved a
   * relative path against this process's directory would be wrong in a way
   * nobody notices until it writes somewhere.
   */
  {
    name: 'list_directory',
    group: 'resources',
    title: 'List a directory',
    description: 'What is in a directory the host serves. Takes a file:// URI on the host.',
    readOnly: true,
    input: {
      type: 'object',
      properties: { path: { type: 'string', description: 'A file:// URI of a directory on the host.' } },
      required: ['path'],
      additionalProperties: false,
    },
    run: async (host, input) => has(host.resourceList, 'filesystem')(pathOf(input)),
  },
  {
    name: 'read_file',
    group: 'resources',
    title: 'Read a file',
    description: 'The contents of a file the host serves. Text comes back as text; anything the host sends as bytes comes back base64 with the encoding said.',
    readOnly: true,
    input: {
      type: 'object',
      properties: { path: { type: 'string', description: 'A file:// URI on the host.' } },
      required: ['path'],
      additionalProperties: false,
    },
    run: async (host, input) => has(host.resourceRead, 'filesystem')(pathOf(input)),
  },
  {
    name: 'write_file',
    group: 'resources',
    title: 'Write a file',
    description: 'Write a file on the host, refusing if it changed since it was read. Pass force to write over whatever is there now. A host that has not granted write access to that directory refuses this, and only a person at the host can grant it.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'A file:// URI on the host.' },
        content: { type: 'string', description: 'The whole new contents. This replaces the file.' },
        createOnly: { type: 'boolean', description: 'Refuse if the file already exists.' },
        force: { type: 'boolean', description: 'Write even if the file changed since it was last read.' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      const write = has(host.resourceWrite, 'writable filesystem');
      const uri = pathOf(input);
      /*
       * The etag the file has now, unless told not to.
       *
       * The same guard `ahpc resource write` has, and it matters more here: a
       * model reads a file, thinks about it, and writes it back, and the whole
       * of that is a read-modify-write with a person editing in between. A
       * write with no `ifMatch` lands on whatever is there and loses their edit.
       */
      let ifMatch: string | undefined;
      if (input.force !== true && host.resourceResolve) {
        try { ifMatch = (await host.resourceResolve(uri)).etag; }
        catch { /* not there yet, so there is nothing to have changed */ }
      }
      await write(uri, text(input.content), {
        ...(input.createOnly === true ? { createOnly: true } : {}),
        ...(ifMatch === undefined ? {} : { ifMatch }),
      });
      return { written: uri };
    },
  },
  {
    name: 'make_directory',
    group: 'resources',
    title: 'Make a directory',
    description: 'Create a directory on the host.',
    readOnly: false,
    input: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      await has(host.resourceMkdir, 'writable filesystem')(pathOf(input));
      return { made: pathOf(input) };
    },
  },
  {
    name: 'delete_path',
    group: 'resources',
    title: 'Delete a file or directory',
    description: 'Remove something on the host. A directory needs recursive.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        recursive: { type: 'boolean', description: 'Needed to remove a directory that is not empty.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      await has(host.resourceDelete, 'writable filesystem')(pathOf(input), {
        ...(input.recursive === true ? { recursive: true } : {}),
      });
      return { deleted: pathOf(input) };
    },
  },
  {
    name: 'move_path',
    group: 'resources',
    title: 'Move or rename',
    description: 'Move something on the host, which is also how it is renamed.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        failIfExists: { type: 'boolean', description: 'Refuse rather than write over something already at the destination.' },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      await has(host.resourceMove, 'writable filesystem')(pathOf(input, 'from'), pathOf(input, 'to'), {
        ...(input.failIfExists === true ? { failIfExists: true } : {}),
      });
      return { moved: pathOf(input, 'to') };
    },
  },
  {
    name: 'copy_path',
    group: 'resources',
    title: 'Copy',
    description: 'Copy something on the host.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        failIfExists: { type: 'boolean', description: 'Refuse rather than write over something already at the destination.' },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      await has(host.resourceCopy, 'writable filesystem')(pathOf(input, 'from'), pathOf(input, 'to'), {
        ...(input.failIfExists === true ? { failIfExists: true } : {}),
      });
      return { copied: pathOf(input, 'to') };
    },
  },

  /* The host's terminals, which is the `terminals` group. */
  {
    name: 'list_terminals',
    group: 'terminals',
    title: 'List terminals',
    description: 'The terminals the host is running, with the URI each other terminal tool takes.',
    readOnly: true,
    input: { type: 'object', properties: {}, additionalProperties: false },
    run: async (host) => (await host.terminals()).map((row) => ({
      terminal: row.resource,
      title: row.title,
      ...(row.exitCode === undefined ? {} : { exitCode: row.exitCode }),
    })),
  },
  {
    name: 'new_terminal',
    group: 'terminals',
    title: 'Open a terminal',
    description: 'Start a terminal on the host and return its URI.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        workingDirectory: { type: 'string', description: 'An absolute path on the host.' },
        name: { type: 'string' },
      },
      additionalProperties: false,
    },
    run: async (host, input) => ({
      terminal: await host.createTerminal({
        ...(text(input.workingDirectory) === '' ? {} : { cwd: text(input.workingDirectory) }),
        ...(text(input.name) === '' ? {} : { name: text(input.name) }),
      }),
    }),
  },
  {
    name: 'send_to_terminal',
    group: 'terminals',
    title: 'Type into a terminal',
    description: 'Send a line to a terminal. A newline is added unless newline is false, because a shell runs lines rather than strings.',
    readOnly: false,
    input: {
      type: 'object',
      properties: {
        terminal: { type: 'string', description: 'A terminal URI from list_terminals or new_terminal.' },
        text: { type: 'string' },
        newline: { type: 'boolean', description: 'Whether to end it with a newline. True unless said otherwise.' },
      },
      required: ['terminal', 'text'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      host.writeTerminal(pathOf(input, 'terminal'), `${text(input.text)}${input.newline === false ? '' : '\n'}`);
      return { sent: true };
    },
  },
  {
    name: 'read_terminal',
    group: 'terminals',
    title: 'Read a terminal',
    description: 'What a terminal has written so far. With waitSeconds it keeps reading until the process exits or that long passes, which is how a command that was just sent is waited on.',
    readOnly: true,
    input: {
      type: 'object',
      properties: {
        terminal: { type: 'string' },
        waitSeconds: { type: 'number', description: 'Wait this long for the process to exit before answering. Zero, the default, answers with what is there now.' },
      },
      required: ['terminal'],
      additionalProperties: false,
    },
    run: async (host, input, report) => {
      const uri = pathOf(input, 'terminal');
      const seconds = typeof input.waitSeconds === 'number' && input.waitSeconds > 0 ? input.waitSeconds : 0;
      return new Promise((done) => {
        let last: TerminalState | undefined;
        const stop = (): void => {
          clearTimeout(timer);
          handle.close();
          done({
            terminal: uri,
            title: last?.title ?? '',
            output: last?.output ?? '',
            ...(last?.exitCode === undefined ? { running: true } : { exitCode: last.exitCode }),
          });
        };
        const timer = setTimeout(stop, Math.max(0, seconds) * 1000);
        timer.unref?.();
        const handle = host.watchTerminal(uri, (state) => {
          last = state;
          report?.(state.exitCode === undefined ? `${state.output.length} bytes` : `exited ${state.exitCode}`);
          // The first state carries the whole buffer, so a caller that is not
          // waiting has its answer as soon as one arrives.
          if (seconds === 0 || state.exitCode !== undefined) stop();
        });
      });
    },
  },
  {
    name: 'dispose_terminal',
    group: 'terminals',
    title: 'Close a terminal',
    description: 'Close a terminal on the host.',
    readOnly: false,
    input: {
      type: 'object',
      properties: { terminal: { type: 'string' } },
      required: ['terminal'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      await host.disposeTerminal(pathOf(input, 'terminal'));
      return { disposed: true };
    },
  },

  /* Scheduled work, which is the `automations` group. */
  {
    name: 'list_automations',
    group: 'automations',
    title: 'List automations',
    description: 'What the host runs on a schedule, whether each is on, and when it next fires.',
    readOnly: true,
    input: { type: 'object', properties: {}, additionalProperties: false },
    run: async (host) => (await has(host.automations, 'automations')()).map((one) => ({
      automation: one.resource,
      title: one.title,
      enabled: one.enabled,
      ...(one.schedule === undefined ? {} : { schedule: one.schedule.expression, timeZone: one.schedule.timeZone }),
      ...(one.nextRunAt === undefined ? {} : { nextRunAt: one.nextRunAt }),
      operations: one.operations,
      lastRuns: one.runs.slice(0, 5),
    })),
  },
  {
    name: 'run_automation',
    group: 'automations',
    title: 'Run an automation',
    description: 'Fire an automation now, without waiting for its schedule. Answers once the host has taken it, not once it has finished.',
    readOnly: false,
    input: {
      type: 'object',
      properties: { automation: { type: 'string', description: 'An automation URI from list_automations.' } },
      required: ['automation'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      await has(host.runAutomation, 'automations')(pathOf(input, 'automation'));
      return { started: true };
    },
  },
  {
    name: 'set_automation_enabled',
    group: 'automations',
    title: 'Turn an automation on or off',
    description: 'Stop an automation firing, or start it again. The definition stays either way.',
    readOnly: false,
    input: {
      type: 'object',
      properties: { automation: { type: 'string' }, enabled: { type: 'boolean' } },
      required: ['automation', 'enabled'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      await has(host.setAutomationEnabled, 'automations')(pathOf(input, 'automation'), input.enabled === true);
      return { enabled: input.enabled === true };
    },
  },
  {
    name: 'remove_automation',
    group: 'automations',
    title: 'Remove an automation',
    description: 'Delete an automation from the host. Use set_automation_enabled to stop one without losing it.',
    readOnly: false,
    input: {
      type: 'object',
      properties: { automation: { type: 'string' } },
      required: ['automation'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      await has(host.removeAutomation, 'automations')(pathOf(input, 'automation'));
      return { removed: true };
    },
  },

  /* What a session changed, which is the `changes` group. */
  {
    name: 'list_changesets',
    group: 'changes',
    title: 'List changesets',
    description: 'The changesets a session offers - what the conversation changed, what one turn changed, what the working tree has. Each is a URI show_changes takes.',
    readOnly: true,
    input: {
      type: 'object',
      properties: { session: { type: 'string' } },
      required: ['session'],
      additionalProperties: false,
    },
    run: async (host, input) => (await has(host.changesets, 'changesets')(uriOf(input))).map((scope) => ({
      changeset: scope.uriTemplate,
      label: scope.label,
      ...(scope.description === undefined ? {} : { description: scope.description }),
      // What is still to be filled in. A template with these left in it is not
      // a URI yet, and saying so is better than the host refusing it later.
      variables: scope.variables,
    })),
  },
  {
    name: 'show_changes',
    group: 'changes',
    title: 'Show a changeset',
    description: 'The files in a changeset and how much each changed. The contents are not here: a changeset of two hundred files is a list worth having and megabytes that are not. Read one with read_file.',
    readOnly: true,
    input: {
      type: 'object',
      properties: {
        session: { type: 'string' },
        changeset: { type: 'string', description: 'A changeset URI from list_changesets. The session\'s own, if omitted.' },
      },
      required: ['session'],
      additionalProperties: false,
    },
    run: async (host, input) => {
      const target = text(input.changeset);
      const found = await host.changes(uriOf(input), target === '' ? undefined : target);
      return {
        status: found.status,
        files: found.files.map((file) => ({
          uri: file.uri,
          added: file.diff.added,
          removed: file.diff.removed,
          ...(file.before === undefined ? { created: true } : {}),
          ...(file.after === undefined ? { deleted: true } : {}),
        })),
        operations: (found.operations ?? []).map((op) => op.id),
      };
    },
  },
];

/**
 * One tool by the name a caller used, or nothing.
 *
 * Over the whole table, including groups nobody turned on - whether a tool
 * exists and whether this server serves it are different questions, and
 * `served` answers the second. Telling somebody the tool is in a group they
 * did not ask for is a better answer than telling them it does not exist.
 */
export const named = (name: string): Tool | undefined => TOOLS.find((one) => one.name === name);

/** The tools a server started with these groups serves. */
export const served = (groups: readonly string[] = []): Tool[] =>
  TOOLS.filter((one) => one.group === undefined || groups.includes(one.group));
