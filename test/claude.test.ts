import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostConnection, HostEvent } from '../src/ahp/connection.js';
import type { ChatInputRequest, ToolConfirmation } from '../src/ahp/types.js';
import { SessionFlag } from '../src/ahp/types.js';

/*
 * The translation, and only the translation.
 *
 * `claudeHost` turns what the Agent SDK says into what the client reads, and
 * that mapping is the whole file - so the SDK is scripted here rather than
 * run. A test that spawned the real CLI would be a test that needs an account,
 * a network and a minute, and would still not let a turn be driven frame by
 * frame, which is the only way the streaming path gets exercised at all.
 *
 * What is checked is the part that is easy to get wrong and impossible to see:
 * the order frames arrive in, which key a delta finds its part under, and the
 * shape an answer has to go back in.
 */

const sdk = vi.hoisted(() => ({
  frames: [] as Record<string, unknown>[],
  wake: undefined as (() => void) | undefined,
  closed: false,
  canUseTool: undefined as undefined | ((name: string, input: Record<string, unknown>) => Promise<unknown>),
  interrupted: 0,
  modes: [] as string[],
  sessions: [] as Record<string, unknown>[],
  transcript: [] as Record<string, unknown>[],
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: ({ options }: { options: Record<string, unknown> }) => {
    sdk.canUseTool = options.canUseTool as typeof sdk.canUseTool;
    return {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          while (sdk.frames.length > 0) yield sdk.frames.shift() as Record<string, unknown>;
          if (sdk.closed) return;
          await new Promise<void>((resolve) => { sdk.wake = resolve; });
        }
      },
      interrupt: async () => { sdk.interrupted++; },
      setPermissionMode: async (mode: string) => { sdk.modes.push(mode); },
      setModel: async () => {},
      supportedModels: async () => [{ id: 'claude-opus-5', displayName: 'Opus 5' }],
      streamInput: async () => {},
      close: () => { sdk.closed = true; sdk.wake?.(); },
    };
  },
  listSessions: async () => sdk.sessions,
  getSessionMessages: async () => sdk.transcript,
}));

const { claudeHost } = await import('../src/ahp/claude.js');

/** Let the drain loop run. It is a real async iterator, so this is a yield. */
const settle = async (times = 4): Promise<void> => {
  for (let i = 0; i < times; i++) await new Promise((resolve) => { setTimeout(resolve, 0); });
};

/** Say what the SDK said, and let the host read it. */
async function emit(...frames: Record<string, unknown>[]): Promise<void> {
  sdk.frames.push(...frames);
  sdk.wake?.();
  sdk.wake = undefined;
  await settle();
}

interface Open {
  host: HostConnection;
  uri: string;
  events: HostEvent[];
  refusals: string[];
}

async function open(): Promise<Open> {
  const refusals: string[] = [];
  const host = await claudeHost({
    path: '/github/textui',
    onRefusal: (_uri, message) => refusals.push(message),
  });
  const uri = await host.createSession({ provider: 'claude' });
  const events: HostEvent[] = [];
  host.subscribe(uri, (event) => events.push(event));
  await settle();
  return { host, uri, events, refusals };
}

const started = 'msg_1';

/** The frames a turn is made of, in the order a real one sends them. */
const streamStart = { type: 'stream_event', event: { type: 'message_start', message: { id: started } } };
const blockStart = (index: number) => ({
  type: 'stream_event',
  event: { type: 'content_block_start', index, content_block: { type: 'text' } },
});
const delta = (index: number, text: string) => ({
  type: 'stream_event',
  event: { type: 'content_block_delta', index, delta: { type: 'text_delta', text } },
});
const done = { type: 'result', subtype: 'success', is_error: false, duration_ms: 12 };

beforeEach(() => {
  sdk.frames.length = 0;
  sdk.closed = false;
  sdk.wake = undefined;
  sdk.canUseTool = undefined;
  sdk.interrupted = 0;
  sdk.modes.length = 0;
  sdk.sessions.length = 0;
  sdk.transcript.length = 0;
});

describe('a turn, as it arrives', () => {
  it('streams into one part rather than filling in at the end', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();

    // The stream comes *before* the complete message. A turn opened only on
    // the assistant frame is a turn every delta before it lands on nothing.
    await emit(streamStart, blockStart(0), delta(0, 'Look'), delta(0, 'ing at that'));

    const turn = events.filter((e) => e.type === 'turnStarted').map((e) => e.turn).at(-1);
    expect(turn?.role).toBe('agent');
    expect(turn?.parts).toHaveLength(1);
    expect(turn?.parts[0]?.kind).toBe('markdown');
    expect((turn?.parts[0] as { content: string }).content).toBe('Looking at that');
    expect(events.filter((e) => e.type === 'delta')).toHaveLength(2);
  });

  it('does not print the answer twice when the complete message follows', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();
    await emit(streamStart, blockStart(0), delta(0, 'Looking at that'));
    // The same message again, whole. Both are sent, always.
    await emit({ type: 'assistant', message: { id: started, content: [{ type: 'text', text: 'Looking at that' }] } });

    const turn = events.filter((e) => e.type === 'turnStarted').map((e) => e.turn).at(-1);
    expect(turn?.parts).toHaveLength(1);
    expect((turn?.parts[0] as { content: string }).content).toBe('Looking at that');
  });

  it('keeps the second message of a turn apart from the first', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();
    await emit(streamStart, blockStart(0), delta(0, 'First'));
    // A tool ran, so the model speaks again - and its blocks start at 0 too.
    // Filed by index alone, this lands on top of the part above it.
    await emit(
      { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg_2' } } },
      { type: 'stream_event', event: { type: 'content_block_start', index: 0, content_block: { type: 'text' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Second' } } },
    );

    const turn = events.filter((e) => e.type === 'turnStarted').map((e) => e.turn).at(-1);
    expect(turn?.parts).toHaveLength(2);
    expect((turn?.parts[0] as { content: string }).content).toBe('First');
    expect((turn?.parts[1] as { content: string }).content).toBe('Second');
  });

  it('completes a tool call in place instead of adding a second row', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();
    await emit({
      type: 'assistant',
      message: { id: started, content: [{ type: 'tool_use', id: 'call_1', name: 'Bash', input: { command: 'ls -la' } }] },
    });

    const turn = events.filter((e) => e.type === 'turnStarted').map((e) => e.turn).at(-1);
    expect(turn?.parts).toHaveLength(1);
    const part = turn?.parts[0] as { kind: string; call: { status: string; input?: string; output?: string } };
    // The command, not the whole input object - it is the only thing
    // separating twenty identical rows.
    expect(part.call.input).toBe('ls -la');
    expect(part.call.status).toBe('running');

    await emit({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'total 0' }] },
    });
    expect(turn?.parts).toHaveLength(1);
    expect(part.call.status).toBe('completed');
    expect(part.call.output).toBe('total 0');
  });

  it('ends the turn on the result', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();
    await emit(streamStart, blockStart(0), delta(0, 'Done'), done);

    const complete = events.filter((e) => e.type === 'turnComplete').at(-1);
    expect(complete?.turn.state).toBe('complete');
    expect(complete?.turn.elapsedMs).toBe(12);
  });
});

describe('subscribing', () => {
  it('answers with a snapshot now, not a tick later', async () => {
    const host = await claudeHost({ path: '/github/textui' });
    const uri = await host.createSession({ provider: 'claude' });
    const events: HostEvent[] = [];
    // No await between these two lines on purpose: a snapshot that needs one
    // is a session that reads as empty on every open, and in a still - which
    // cannot await - reads as empty for ever.
    host.subscribe(uri, (event) => events.push(event));
    expect(events[0]?.type).toBe('snapshot');
  });

  it('reads the transcript of a session it has not run', async () => {
    sdk.transcript.push(
      { type: 'user', uuid: 'u1', message: { role: 'user', content: 'what changed?' } },
      { type: 'assistant', uuid: 'a1', message: { content: [{ type: 'text', text: 'Two files.' }] } },
    );
    const host = await claudeHost({ path: '/github/textui' });
    const events: HostEvent[] = [];
    host.subscribe('ahp-session:/older', (event) => events.push(event));
    await settle();

    const last = events.filter((e) => e.type === 'snapshot').at(-1);
    expect(last?.turns.map((t) => t.role)).toEqual(['user', 'agent']);
    expect(last?.turns[0]?.message).toBe('what changed?');
  });

  it('does not put the agent\'s tool output in the person\'s voice', async () => {
    sdk.transcript.push(
      { type: 'user', uuid: 'u1', message: { role: 'user', content: 'go' } },
      { type: 'assistant', uuid: 'a1', message: { content: [{ type: 'tool_use', id: 'c1', name: 'Bash', input: { command: 'ls' } }] } },
      // A user frame carrying only a tool result is the SDK reporting a call
      // finishing, not somebody saying something.
      { type: 'user', uuid: 'u2', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'a b' }] } },
    );
    const host = await claudeHost({ path: '/github/textui' });
    const events: HostEvent[] = [];
    host.subscribe('ahp-session:/older', (event) => events.push(event));
    await settle();

    const last = events.filter((e) => e.type === 'snapshot').at(-1);
    expect(last?.turns.filter((t) => t.role === 'user')).toHaveLength(1);
    const call = last?.turns[1]?.parts[0] as { call: { status: string; output?: string } };
    expect(call.call.status).toBe('completed');
    expect(call.call.output).toBe('a b');
  });
});

describe('what the agent is waiting for', () => {
  it('asks to run a tool, and running it is what an approval means', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();

    const decision = sdk.canUseTool?.('Bash', { command: 'rm -rf build' });
    await settle();

    const asked = events.filter((e) => e.type === 'inputNeeded').at(-1);
    const input = asked?.input as ToolConfirmation;
    expect(input.kind).toBe('toolConfirmation');
    expect(input.call.input).toBe('rm -rf build');
    // Blocked, and it has to read as blocked - `InputNeeded` carries
    // `InProgress`, so a status that lost it reads as merely running.
    const status = events.filter((e) => e.type === 'status').at(-1);
    expect((status?.status ?? 0) & SessionFlag.InputNeeded).toBe(SessionFlag.InputNeeded);

    host.confirmToolCall(uri, input.call.id, true);
    expect(await decision).toEqual({ behavior: 'allow', updatedInput: { command: 'rm -rf build' } });
  });

  it('tells the agent why, when the answer is no', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();
    const decision = sdk.canUseTool?.('Bash', { command: 'rm -rf build' });
    await settle();

    const input = (events.filter((e) => e.type === 'inputNeeded').at(-1))?.input as ToolConfirmation;
    host.confirmToolCall(uri, input.call.id, false);
    expect(await decision).toEqual({ behavior: 'deny', message: 'The person declined this action' });
  });

  it('renders a question as a question, not as a confirmation', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();

    const questions = [
      {
        question: 'How should I format the output?',
        header: 'Format',
        multiSelect: false,
        options: [
          { label: 'Summary', description: 'Brief overview' },
          { label: 'Detailed', description: 'Full explanation' },
        ],
      },
    ];
    const decision = sdk.canUseTool?.('AskUserQuestion', { questions });
    await settle();

    const asked = (events.filter((e) => e.type === 'inputNeeded').at(-1))?.input as ChatInputRequest;
    // The whole request is the questions. Rendering this as a confirmation
    // loses the choices and leaves a heading and an Approve button.
    expect(asked.kind).toBe('chatInput');
    expect(asked.questions).toHaveLength(1);
    expect(asked.questions[0]?.message).toBe('How should I format the output?');
    expect(asked.questions[0]?.options?.map((o) => o.id)).toEqual(['Summary', 'Detailed']);

    host.completeInput(uri, asked.id, true, { q1: { kind: 'selected', value: 'Summary' } });
    // Keyed by the question's own text and valued by the option's own label,
    // with the questions echoed back - anything else is a call the tool
    // cannot process and a turn that stalls rather than errors.
    expect(await decision).toEqual({
      behavior: 'allow',
      updatedInput: { questions, answers: { 'How should I format the output?': 'Summary' } },
    });
  });

  it('sends what the person typed, not the word they typed it under', async () => {
    const { host, uri, events } = await open();
    host.say(uri, 'hello');
    await settle();
    const questions = [{ question: 'Which database?', options: [{ label: 'Postgres' }] }];
    const decision = sdk.canUseTool?.('AskUserQuestion', { questions });
    await settle();

    const asked = (events.filter((e) => e.type === 'inputNeeded').at(-1))?.input as ChatInputRequest;
    host.completeInput(uri, asked.id, true, { q1: { kind: 'text', value: 'sqlite, actually' } });
    expect(await decision).toEqual({
      behavior: 'allow',
      updatedInput: { questions, answers: { 'Which database?': 'sqlite, actually' } },
    });
  });

  it('settles the promise when the turn is stopped, rather than leaving it hanging', async () => {
    const { host, uri } = await open();
    host.say(uri, 'hello');
    await settle();
    const decision = sdk.canUseTool?.('Bash', { command: 'sleep 100' });
    await settle();

    // A stop that only interrupts leaves the subprocess waiting on a promise
    // nobody will ever settle.
    host.stopTurn(uri);
    expect(await decision).toEqual({ behavior: 'deny', message: 'The turn was stopped' });
    expect(sdk.interrupted).toBe(1);
  });
});

describe('what this host will not do', () => {
  it('refuses the queue rather than keeping one only it could send', async () => {
    const { host, uri, refusals, events } = await open();
    host.queue(uri, 'after this one');
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatch(/no queue/i);
    // Said on the session too, so it is on screen and not only in a callback.
    expect(events.some((e) => e.type === 'error')).toBe(true);
  });

  it('refuses a changeset rather than answering that nothing changed', async () => {
    const { host, uri, refusals } = await open();
    const changes = await host.changes(uri);
    expect(changes.files).toEqual([]);
    expect(refusals[0]).toMatch(/changeset/i);
  });

  it('keeps the read and archived flags, because those are the client\'s own', async () => {
    const { host, uri, events } = await open();
    host.setRead(uri, true);
    host.setArchived(uri, true);
    const status = events.filter((e) => e.type === 'status').at(-1)?.status ?? 0;
    expect(status & SessionFlag.IsRead).toBe(SessionFlag.IsRead);
    expect(status & SessionFlag.IsArchived).toBe(SessionFlag.IsArchived);
  });
});

describe('the catalogue', () => {
  it('lists what is on disk and what is only running here', async () => {
    sdk.sessions.push({
      sessionId: 'aaaa-bbbb', summary: 'An older session', lastModified: 1_700_000_000_000, cwd: '/github/textui',
    });
    const { host, uri } = await open();
    const found = await host.listSessions();

    expect(found.map((s) => s.title)).toContain('An older session');
    // The session this process just started is real and is not written yet.
    // A catalogue that dropped it would lose the one being looked at.
    expect(found.map((s) => s.resource)).toContain(uri);
  });

  it('answers with no models until there is a session to ask through', async () => {
    const bare = await claudeHost({ path: '/github/textui' });
    const [before] = await bare.agents();
    expect(before?.provider).toBe('claude');
    // A real answer, not a loading state - the same shape a host gives for a
    // harness nobody has signed into. A client that reads it as "still
    // loading" shows a blank panel for ever.
    expect(before?.models).toEqual([]);

    // A session is a running CLI, and a running CLI is what can be asked.
    await bare.createSession({ provider: 'claude' });
    const [after] = await bare.agents();
    expect(after?.models).toEqual([{ id: 'claude-opus-5', displayName: 'Opus 5' }]);
  });

  it('changes the permission mode on the running session rather than restarting it', async () => {
    const { host, uri } = await open();
    host.say(uri, 'hello');
    await settle();
    host.setConfig(uri, 'permissionMode', 'acceptEdits');
    await settle();
    expect(sdk.modes).toEqual(['acceptEdits']);
    expect((await host.config(uri)).values.permissionMode).toBe('acceptEdits');
  });
});
