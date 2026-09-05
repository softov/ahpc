import { randomUUID } from 'node:crypto';
import type { HostConnection, HostEvent } from './connection.js';
import type {
  Agent, Answer, Automation, Changeset, ChangesetOperation, ChangesetScope, ChatInputRequest, ContentRef, Customization, FileContent, FileEdit,
  ModelRow, PendingInput, QueuedMessage, ResourceEntry, ResponsePart, SessionConfig, SessionDetail, SessionSummary,
  SessionUri, TerminalState, ToolCall, Turn,
} from './types.js';
import { SessionFlag } from './types.js';

/**
 * A host, scripted.
 *
 * An example nothing checks is an example that is already broken, and nothing
 * can check one that needs an editor running on another machine. So the seam
 * is `HostConnection` and this is the other implementation of it: the same
 * shapes, the same order, the same "the turn appears when the host reduced it".
 *
 * Time is a `pump`, not a timer. The application drives it from a ticker and a
 * test calls it in a loop, so what the test exercises is the streaming path
 * rather than a fixture that arrived all at once.
 *
 * Two things it is deliberately strict about, both because a lie here reads
 * as a bug in the client:
 *
 * - **The status is derived, never assigned.** It is computed from what this
 *   host is actually holding, so a session cannot say "waiting on you" with
 *   nothing waiting. It did, and the bug looked exactly like a client that
 *   drops a pending confirmation when you leave the screen.
 * - **The sessions differ, and so do the replies.** Every conversation opening
 *   on the same text, and every message getting the same answer, hides every
 *   layout problem that only appears on prose of another shape.
 */
export interface FakeHost extends HostConnection {
  /** Emit the next scripted step. False when there is nothing waiting. */
  pump(): boolean;
  /** Everything the script can emit without being answered. */
  drain(limit?: number): void;
  pending(): number;
  /**
   * Retitle a session, the way a host does once it has read the first message.
   *
   * Not on `HostConnection`: a client never renames a session, it is told.
   * Here so that "the host changed something about a session nobody is
   * watching" is a thing a test can make happen.
   */
  rename(uri: SessionUri, title: string): void;
  /**
   * Every action sent through `dispatch`, in order.
   *
   * Not on `HostConnection`: a real host does not hand its clients back what
   * they sent it. Here because `dispatch` carries actions this fake has no
   * behaviour for, and an escape hatch whose effect is nothing observable is
   * one nothing can check.
   */
  dispatched(): { uri: SessionUri; action: Record<string, unknown>; chat?: boolean }[];
  /**
   * Every changeset operation that actually ran.
   *
   * Not on `HostConnection` for the same reason `dispatched` is not: a real
   * host does not hand a client back its own history. Here because the
   * interesting assertion is that an operation ran *after* the grant rather
   * than despite the gate.
   */
  invoked(): { changeset: string; operationId: string; target?: unknown }[];
  /** Paths a watch is open on, so releasing one can be asserted. */
  watching(): string[];
}

type Step = () => void;

const WORDS = (text: string): string[] => text.split(/(?<=\s)/);

/** What the host says this provider's sessions can be told to do. */
/**
 * The five thinking levels, in the reference client's words.
 *
 * Held in one place because they are one host's list rather than a protocol
 * vocabulary: ahpd and VS Code agree on these five spellings and a third
 * implementation need not, which is why every reader takes labels from the
 * host positionally instead of keeping a table like this of its own.
 */
const EFFORTS: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra High' },
  { value: 'max', label: 'Max' },
];

const CONFIG: SessionConfig['properties'] = [
  {
    key: 'branch',
    title: 'Branch',
    description: 'What to base a worktree on.',
    // The host saying "ask me": a branch list is a query, not a schema. The
    // reference host marks exactly this property this way.
    values: [],
    enumDynamic: true,
    sessionMutable: false,
  },
  {
    key: 'permissionMode',
    title: 'Permissions',
    description: 'How much the agent may do before it asks.',
    sessionMutable: true,
    values: [
      { value: 'default', label: 'Ask each time', description: 'Every tool call is confirmed' },
      { value: 'acceptEdits', label: 'Accept edits', description: 'File edits run; commands still ask' },
      { value: 'plan', label: 'Plan only', description: 'Read and reason, change nothing' },
      { value: 'bypass', label: 'Bypass', description: 'Nothing is confirmed' },
    ],
  },
  {
    key: 'isolation',
    title: 'Isolation',
    description: 'Where the agent works. Fixed once the session exists.',
    sessionMutable: false,
    values: [
      { value: 'workspace', label: 'Workspace', description: 'Change the directory in place' },
      { value: 'worktree', label: 'Worktree', description: 'Change a git worktree of it' },
    ],
  },
];

let counter = 0;
const nextId = (prefix: string): string => `${prefix}${++counter}`;

const AT = '2026-08-22T10:00:00.000Z';

/** One scripted shell. */
interface Shell {
  title: string;
  cwd: string;
  /** Everything written so far. */
  output: string;
  /** Input not yet ending in a newline, which a shell has not seen either. */
  pending: string;
  exitCode?: number;
  /** What the client last said it was drawing at, per `terminal/resized`. */
  cols?: number;
  rows?: number;
  /** Who is holding it, per `terminal/claimed`. */
  claim?: string | null;
  watchers: Set<(state: TerminalState) => void>;
}

/** What the scripted shell answers. Anything else is not found, as a shell says. */
const SHELL: Record<string, string> = {
  pwd: '/brb_main/src/brb_framework\n',
  ls: 'Makefile  Makefile.linux  libbrb_core  compileLinux.sh\n',
  whoami: 'softov\n',
};

/**
 * The scripted filesystem `@` completes against.
 *
 * Keyed by the directory as it is typed, values ending in `/` being
 * directories - which is what keeps the next keystroke inside one rather than
 * starting again.
 */
const FILES: Record<string, string[]> = {
  '': ['src/', 'test/', 'README.md', 'package.json'],
  'src/': ['app.tsx', 'control.ts', 'state.ts', 'ahp/'],
  'src/ahp/': ['fake.ts', 'live.ts', 'types.ts'],
  'test/': ['smoke.test.tsx'],
};

/**
 * What each of those files says, for the half of the client that reads them.
 *
 * Every leaf in `FILES` has one. A tree that lists nine files and can open two
 * is a fixture that makes a viewer look broken, and the completion menu and the
 * file reader have to agree about what exists or one of them is testing a
 * different host.
 */
const SOURCES: Record<string, string> = {
  'README.md': '# ahpc\n\nA terminal client for the Agent Host Protocol.\n\nIt talks to any AHP host. It depends on no agent SDK.\n',
  'package.json': '{\n  "name": "ahpc",\n  "type": "module",\n  "bin": { "ahpc": "./dist/src/main.js" }\n}\n',
  'src/app.tsx': "import { fakeHost } from './ahp/fake.js';\n\n// The screens, and what drives them.\nexport function App() {\n  return null;\n}\n",
  'src/control.ts': '// Keys in, intent out. Nothing here draws anything.\nexport type Intent = { kind: string };\n',
  'src/state.ts': '// What is on screen, as one object nothing else may write to.\nexport interface State { screen: string }\n',
  'src/ahp/fake.ts': '// A scripted host, so the client runs with nothing installed.\nexport function fakeHost() { return {}; }\n',
  'src/ahp/live.ts': '// The same seam over a WebSocket.\nexport function liveHost(url: string) { return { url }; }\n',
  'src/ahp/types.ts': '// The shapes both hosts speak in.\nexport interface Turn { id: string }\n',
  'test/smoke.test.tsx': "import { it } from 'vitest';\n\nit('draws something', () => {});\n",
};

/** How many held-back turns the scripted host hands over at a time. */
const PAGE = 10;

export function fakeHost(): FakeHost {
  const summaries = new Map<SessionUri, SessionSummary>();
  const turns = new Map<SessionUri, Turn[]>();
  /**
   * Turns this host has but has not handed over, oldest last.
   *
   * A real host sends a tail window and a cursor for the rest, so a client
   * that never asks sees a conversation that starts partway through. Holding
   * some back here is what lets that be tested against the scripted host
   * rather than only against a daemon.
   */
  const older = new Map<SessionUri, Turn[]>();
  const active = new Map<SessionUri, Turn>();
  const inputs = new Map<SessionUri, PendingInput>();
  const changesets = new Map<SessionUri, Changeset>();
  /**
   * What is waiting for the running turn to end.
   *
   * The host's, because on a real one it is: `queuedMessages` is on the chat
   * and the server starts the next turn from the head. The fake has to drain
   * it for the same reason, or a queue is a list that only ever grows.
   */
  const queues = new Map<SessionUri, QueuedMessage[]>();
  /** What each chat is holding as a draft, which is host state and not a screen's. */
  const drafts = new Map<SessionUri, string>();
  /** Paths something is watching, so a test can see one released. */
  const watched = new Set<string>();
  /** Tokens pushed, by resource. An empty token revokes, as the protocol says. */
  const tokens = new Map<string, string>();
  const configs = new Map<SessionUri, Record<string, string>>();
  const observers = new Map<SessionUri, Set<(event: HostEvent) => void>>();
  const chats = new Map<SessionUri, string>();
  /**
   * Chats opened after the session was, by chat URI.
   *
   * The session's own maps above are the *default* chat's - that is what
   * every script sets up, and a session that has only ever had one is a
   * session where the two are the same thing. A second chat is its own
   * conversation with nothing in it, which is what a second chat is.
   */
  const extra = new Map<string, { session: SessionUri; title: string; turns: Turn[]; watchers: Set<(event: HostEvent) => void> }>();
  /** The scripted shells, by terminal URI. */
  const shells = new Map<string, Shell>();
  const shellState = (uri: string, held: Shell): TerminalState => ({
    title: held.title,
    output: held.output,
    cwd: held.cwd,
    ...(held.exitCode !== undefined ? { exitCode: held.exitCode } : {}),
    // Pipes, like the daemon's. Said rather than left to be discovered by
    // rendering something that draws itself with cursor movement.
    isPty: false,
  });
  const models = new Map<SessionUri, string>();
  /** `IsRead` and `IsArchived` only. Nothing about what the session is doing. */
  const flags = new Map<SessionUri, number>();
  const failed = new Set<SessionUri>();
  /** What a `ContentRef` points at. Keyed by the ref's own uri. */
  const contents = new Map<string, string>();
  const script: Step[] = [];

  const emit = (uri: SessionUri, event: HostEvent): void => {
    for (const observer of observers.get(uri) ?? []) observer(event);
  };

  /** A session's chats: its own, and any opened since. */
  const chatsOf = (uri: SessionUri): { resource: string; title: string }[] => {
    const own = chats.get(uri);
    return [
      ...(own ? [{ resource: own, title: summaries.get(uri)?.title ?? 'Chat' }] : []),
      ...[...extra].filter(([, held]) => held.session === uri).map(([resource, held]) => ({ resource, title: held.title })),
    ];
  };

  /**
   * A file, and where its two versions are.
   *
   * The rows carry pointers and the text goes in `contents`, which is the
   * protocol's own arrangement rather than a convenience here: a changeset is
   * a list a client wants up front and a pile of bytes it wants only for the
   * row somebody opened. Building the fake the same way is what makes the
   * fetch path something a test exercises rather than something only a real
   * host ever takes.
   */
  const edited = (uri: string, before: string | null, after: string | null): FileEdit => {
    const key = (side: string): string => `ahp-content:/${uri.split('/').pop() ?? 'f'}-${side}`;
    if (before !== null) contents.set(key('before'), before);
    if (after !== null) contents.set(key('after'), after);
    const lines = (text: string | null): number => (text === null ? 0 : text.split('\n').length);
    return {
      uri,
      ...(before !== null ? { before: uri } : {}),
      ...(after !== null ? { after: uri } : {}),
      diff: { added: lines(after), removed: lines(before) },
      content: {
        ...(before !== null ? { before: { uri: key('before'), contentType: 'text/plain' } } : {}),
        ...(after !== null ? { after: { uri: key('after'), contentType: 'text/plain' } } : {}),
      },
    };
  };

  /**
   * The changesets one session offers, keyed by the scope segment.
   *
   * Scoped rather than one per session, because on a real host a session
   * advertises several and they differ - what this conversation changed is not
   * what the working tree has, and a fake that answered the same list for every
   * scope would let a picker be built that looked right and proved nothing.
   */
  const scoped = new Map<SessionUri, Map<string, Changeset>>();

  const EDITS: Changeset = {
    status: 'complete',
    files: [
      edited(
        'file:///brb_main/src/brb_backend/compileLinux.sh',
        '#!/bin/sh\nset -e\nfor lib in libbrb_core libbrb_ev_kq; do\n  make -C "$lib" -f Makefile\ndone\n',
        '#!/bin/sh\nset -e\nfor lib in libbrb_core libbrb_ev_kq libbrb_data; do\n  make -C "$lib" -f Makefile.linux\ndone\n',
      ),
      // A creation: no `before` at all, which is the case a viewer that
      // assumes two sides renders as a diff against the empty string and
      // labels wrongly.
      edited(
        'file:///brb_main/src/brb_backend/README.linux.md',
        null,
        '# Building on Linux\n\nNeeds libkqueue built from source with\n`-DCMAKE_INSTALL_PREFIX=/usr`.\n',
      ),
      // And a deletion, for the same reason in the other direction.
      edited('file:///brb_main/src/brb_backend/build.old.sh', 'make all\n', null),
    ],
  };

  /**
   * The status, from what is actually here.
   *
   * Activity is a fact about this host's own maps - a pending input, a running
   * turn, a failure - and the two client flags are carried alongside it. There
   * is no way to write a status by hand, which is the point: a seeded session
   * once claimed `InputNeeded` while holding no pending input, and opening it
   * showed a conversation with nothing to answer. That is indistinguishable
   * from a client that loses the request, and it cost an afternoon.
   */
  const statusOf = (uri: SessionUri): number => {
    const activity = inputs.has(uri) ? SessionFlag.InputNeeded
      : active.has(uri) ? SessionFlag.InProgress
        : failed.has(uri) ? SessionFlag.Error
          : SessionFlag.Idle;
    return activity | (flags.get(uri) ?? 0);
  };

  /**
   * Watchers of the catalogue itself, as opposed to of one session.
   *
   * A real host says this on its root channel; here it is said by whatever
   * changed a summary, which is the same thing from the outside.
   */
  /**
   * Every action a client has sent through `dispatch`, in order.
   *
   * Kept because the escape hatch is the one method whose whole job is to
   * carry things this fake does not understand: there is nothing to observe
   * for most of them, so without a record there is nothing to assert either.
   */
  const sent: { uri: SessionUri; action: Record<string, unknown>; chat?: boolean }[] = [];

  /** Resources this client has been granted write on, as a real host keeps them. */
  const granted = new Set<string>();
  /** Every operation actually run, so a test can assert the gate was passed rather than skipped. */
  const invoked: { changeset: string; operationId: string; target?: unknown }[] = [];

  /**
   * A changeset URI split back into the session and the scope.
   *
   * `<sessionUri>/changeset/<scope>`, which is the protocol's own nesting -
   * and the reason a scope may itself contain slashes, so only the first
   * separator is the one that matters.
   */
  const scopeIn = (uri: string): { owner: SessionUri; scope: string } | undefined => {
    const cut = uri.indexOf('/changeset/');
    if (cut <= 0) return undefined;
    return { owner: uri.slice(0, cut), scope: uri.slice(cut + '/changeset/'.length) };
  };

  /**
   * The directories this host serves, as paths, longest first.
   *
   * Longest first so the deepest one wins: two served directories where one
   * contains the other would otherwise resolve every file under the inner one
   * against the outer, and list the wrong tree.
   */
  const roots = (): string[] => [...new Set([...summaries.values()]
    .flatMap((one) => one.workingDirectories)
    .map((one) => one.replace(/^file:\/\//, '')))]
    .sort((a, b) => b.length - a.length);

  /**
   * A `file://` URI, as a root and a path relative to it.
   *
   * `inside` is spelled the way `FILES` and `SOURCES` key themselves - a
   * directory ends in a slash and the root itself is the empty string - so a
   * URI can be looked up in either without a second convention.
   */
  const inTree = (uri: string): { root: string; inside: string } | undefined => {
    if (!uri.startsWith('file://')) return undefined;
    const path = uri.slice('file://'.length);
    const root = roots().find((one) => path === one || path.startsWith(`${one}/`));
    if (root === undefined) return undefined;
    const rest = path.slice(root.length).replace(/^\//, '');
    if (rest === '') return { root, inside: '' };
    return { root, inside: FILES[`${rest}/`] === undefined ? rest : `${rest}/` };
  };

  const catalogue = new Set<() => void>();
  const moved = (): void => { for (const listener of catalogue) listener(); };

  /** Recompute, and tell anyone watching if it moved. */
  const touch = (uri: SessionUri): void => {
    const summary = summaries.get(uri);
    if (!summary) return;
    const status = statusOf(uri);
    summaries.set(uri, { ...summary, status, modifiedAt: AT });
    emit(uri, { type: 'status', status });
    moved();
  };

  const setFlag = (uri: SessionUri, flag: number, on: boolean): void => {
    const current = flags.get(uri) ?? 0;
    flags.set(uri, on ? current | flag : current & ~flag);
    touch(uri);
  };

  // ----------------------------------------------------------- the automations

  /**
   * Automations this host holds, and who is watching them.
   *
   * Two, because the interesting screen is the one with both kinds on it: one
   * on a clock with a history behind it, and one that is only ever run by
   * hand. A fixture with a single scheduled automation would let a screen be
   * built that assumes every automation has a next run.
   */
  const automations = new Map<string, Automation>([
    ['ahp-automation:/9c4a', {
      resource: 'ahp-automation:/9c4a',
      title: 'Nightly framework build',
      enabled: true,
      schedule: { expression: '0 9 * * 1-5', timeZone: 'America/Sao_Paulo' },
      // Relative to now, so the fixture is still a *next* run tomorrow and
      // next year. A hardcoded date becomes a schedule in the past, which is
      // the one thing a next run cannot be.
      nextRunAt: new Date(Date.now() + 4 * 3_600_000 + 12 * 60_000).toISOString(),
      runs: [
        { resource: 'ahp-automation-run:/r3', status: 'completed', session: 'ahp-session:/1f0a', triggered: true },
        { resource: 'ahp-automation-run:/r2', status: 'completed', session: 'ahp-session:/6b21', triggered: true },
        { resource: 'ahp-automation-run:/r1', status: 'failed', triggered: true },
      ],
      operations: ['update', 'remove', 'run'],
    }],
    ['ahp-automation:/2e71', {
      resource: 'ahp-automation:/2e71',
      title: 'Triage new Desk cases',
      // Switched off, which is why it has no next run despite the host having
      // a clock. The absent `nextRunAt` means the same thing for both.
      enabled: false,
      schedule: { expression: '*/30 * * * *', timeZone: 'UTC' },
      runs: [],
      // No `run` while it is off: offering the button anyway would be a
      // control that argues with the switch beside it.
      operations: ['update', 'remove'],
    }],
  ]);
  const automationWatchers = new Set<() => void>();
  const automationsMoved = (): void => { for (const listener of automationWatchers) listener(); };

  // ------------------------------------------------------------ the catalogue

  const seed = (options: {
    id: string;
    provider: string;
    title: string;
    dir: string;
    model?: string;
    read?: boolean;
    archived?: boolean;
    failed?: boolean;
    permissions?: string;
    isolation?: string;
    activity?: string;
    /** What started it, when it was not a person. */
    origin?: { kind: 'automation'; automation: string; run: string };
    turns?: Turn[];
    /** Turns behind the window, oldest last, fetched a page at a time. */
    older?: Turn[];
    active?: Turn;
    input?: PendingInput;
    changes?: Changeset;
    /** The branch its directory is on, as `_meta.git.branchName`. */
    branch?: string;
    /** Ahead, behind and uncommitted, in that order. */
    drift?: [number, number, number];
  }): void => {
    const { id } = options;
    flags.set(id, (options.read === false ? 0 : SessionFlag.IsRead)
      | (options.archived ? SessionFlag.IsArchived : 0));
    if (options.failed) failed.add(id);
    turns.set(id, options.turns ?? []);
    older.set(id, options.older ?? []);
    if (options.active) active.set(id, options.active);
    if (options.input) inputs.set(id, options.input);
    if (options.changes) {
      changesets.set(id, options.changes);
      /*
       * The same files, cut four ways.
       *
       * A real host answers a different list per scope, and the differences
       * are the point of having scopes at all: the working tree holds work
       * nobody's agent did, one turn holds one file, and a comparison holds
       * the span between two. A fake that returned the session's list for
       * every one of them would let a picker be built that switched between
       * four identical screens.
       */
      const spoken = (options.turns ?? []).filter((turn) => turn.role === 'agent').map((turn) => turn.id);
      const files = options.changes.files;
      /*
       * The verbs, on the scope each actually belongs to.
       *
       * A real host advertises different ones per scope - the working tree can
       * be committed and a turn cannot, and what a turn changed can be put
       * back because both sides of it were captured. A fixture that offered
       * the same three everywhere would let a screen be built that is wrong
       * against every real host.
       */
      const COMMIT: ChangesetOperation = {
        id: 'commit', label: 'Commit', scopes: ['changeset'], icon: 'git-commit', group: 'commit', status: 'idle',
      };
      const DISCARD: ChangesetOperation = {
        id: 'discard',
        label: 'Discard Changes',
        scopes: ['resource'],
        confirmation: 'Discard the changes to this file? This cannot be undone.',
        icon: 'discard',
        status: 'idle',
      };
      const REVERT: ChangesetOperation = {
        id: 'revert',
        label: 'Revert This File',
        scopes: ['resource'],
        confirmation: 'Put this file back the way the agent found it?',
        icon: 'discard',
        status: 'idle',
      };
      const per = new Map<string, Changeset>([
        ['session', { ...options.changes, operations: [REVERT] }],
        ['uncommitted', {
          status: 'complete',
          operations: [COMMIT, DISCARD],
          files: [
            ...files,
            // Somebody else's edit, sitting in the tree beside the agent's.
            // What makes `uncommitted` worth a separate scope rather than a
            // second name for `session`.
            edited(`${options.dir}/notes.todo`, null, 'check the kqueue patch against 10.1\n'),
          ],
        }],
      ]);
      for (const id_ of spoken) {
        const one = files[spoken.indexOf(id_) % files.length];
        if (one) per.set(`turn/${id_}`, { status: 'complete', files: [one], operations: [REVERT] });
      }
      const [first, second] = spoken;
      if (first !== undefined && second !== undefined) {
        per.set(`compare/${first}/${second}`, { status: 'complete', files: files.slice(0, 2) });
      }
      scoped.set(id, per);
    }
    // `ahp-chat:/<uuid>`, which is the protocol's own shape - a chat is its
    // own channel, not a path under the session.
    chats.set(id, `ahp-chat:/${id.split('/').pop() ?? id}`);
    if (options.model) models.set(id, options.model);
    configs.set(id, {
      permissionMode: options.permissions ?? 'default',
      isolation: options.isolation ?? 'workspace',
    });
    summaries.set(id, {
      resource: id,
      provider: options.provider,
      title: options.title,
      status: statusOf(id),
      createdAt: AT,
      modifiedAt: AT,
      workingDirectories: [options.dir],
      /*
       * What a host says about git, in the vocabulary the reference host uses.
       *
       * `_meta` is an open map and `git` is convention rather than
       * specification, so the names here are copied from a capture rather than
       * from a declaration - `branchName`, not `branch`. A fixture spelling it
       * the other way is a fixture that agrees with a client reading it wrong,
       * which is exactly what happened: the branch row said "the host does not
       * say" against hosts that were saying it.
       */
      _meta: {
        git: {
          branchName: options.branch ?? 'main',
          upstreamBranchName: `origin/${options.branch ?? 'main'}`,
          hasGitHubRemote: true,
          incomingChanges: options.drift?.[1] ?? 0,
          outgoingChanges: options.drift?.[0] ?? 0,
          uncommittedChanges: options.drift?.[2] ?? 0,
        },
      },
      ...(options.activity ? { activity: options.activity } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.changes
        ? {
          changes: {
            files: options.changes.files.length,
            additions: options.changes.files.reduce((n, f) => n + f.diff.added, 0),
            deletions: options.changes.files.reduce((n, f) => n + f.diff.removed, 0),
          },
        }
        : {}),
    });
  };

  /**
   * One session blocked on a confirmation, and the confirmation to go with it.
   *
   * The whole point of the seed: a reader arriving at the catalogue can answer
   * something without saying anything first, and the row that says a person is
   * wanted is a row where one actually is.
   */
  const blockedCall: ToolCall = {
    id: 'seed-c2', name: 'Bash', toolName: 'Bash', status: 'pending-confirmation',
    input: 'make -f Makefile.linux clean all',
    intention: 'Rebuild libbrb_core against the patched libkqueue',
    confirmationTitle: 'Run a command in /brb_main/src/brb_framework?',
    options: [
      { id: 'once', label: 'Allow once' },
      { id: 'session', label: 'Allow for this session' },
    ],
  };

  seed({
    id: 'ahp-session:/1f0a',
    provider: 'claude',
    title: 'Kqueue events on Linux',
    dir: 'file:///brb_main/src/brb_framework',
    model: 'claude-opus-5',
    activity: 'waiting for permission to run a command',
    turns: [
      {
        id: 't1', role: 'user', message: 'EVFILT_FS never fires on Linux. Is that us or libkqueue?',
        parts: [], state: 'complete', at: AT,
      },
      {
        id: 't2',
        role: 'agent',
        state: 'complete',
        model: { id: 'claude-opus-5' },
        at: AT,
        elapsedMs: 21_400,
        parts: [
          { kind: 'reasoning', id: 'r1', content: 'The filter is registered, so the question is whether libkqueue implements it at all.' },
          { kind: 'markdown', id: 'm1', content: 'Short answer: **libkqueue**, not us.\n\nBoth `EVFILT_AIO` and `EVFILT_FS` are compiled out:' },
          {
            kind: 'toolCall',
            id: 'c1',
            call: {
              id: 'c1', name: 'Search', toolName: 'Grep', status: 'completed',
              input: 'rg -n "EVFILT_FS" /usr/include/kqueue',
              intention: 'Look for the filter in the installed headers',
              outcome: 'Found 2 matches',
              output: 'sys/event.h:74:#if 0\nsys/event.h:75:#define EVFILT_FS  (-9)',
            },
          },
          { kind: 'markdown', id: 'm2', content: 'They sit behind `#if 0`. Re-defining them compiles and then silently never delivers an event, which is the worst of the three outcomes.\n\n- keep the FreeBSD path on `EVFILT_FS`\n- on Linux, poll or use `inotify` directly' },
        ],
      },
    ],
    active: {
      id: 't3',
      role: 'agent',
      state: 'running',
      model: { id: 'claude-opus-5', config: { thinkingLevel: 'medium' } },
      at: AT,
      parts: [
        { kind: 'markdown', id: 'm3', content: 'Let me check that the patched header actually builds before you take it any further.' },
        { kind: 'toolCall', id: blockedCall.id, call: blockedCall },
      ],
    },
    input: { kind: 'toolConfirmation', id: 'seed-i1', call: blockedCall },
  });

  seed({
    id: 'ahp-session:/6b21',
    provider: 'claude',
    title: 'Split the transcript viewport',
    dir: 'file:///github/textui',
    model: 'claude-sonnet-5',
    activity: 'reading packages/core/src/ui/data.ts',
    permissions: 'acceptEdits',
    turns: [
      {
        id: 's2-t1', role: 'user', message: 'The Feed draws nothing inside a content-sized panel. Why?',
        parts: [], state: 'complete', at: AT,
      },
    ],
    // Mid-flight, and nothing is blocked. A reader arriving here sees a turn
    // being written, which is the state a transcript is hardest to get right in.
    active: {
      id: 's2-t2',
      role: 'agent',
      state: 'running',
      model: { id: 'claude-sonnet-5' },
      at: AT,
      parts: [
        { kind: 'reasoning', id: 's2-r1', content: 'Sizing rule first: a component that fills has a measured height, one that does not draws everything.' },
        { kind: 'markdown', id: 's2-m1', content: 'Because it takes its viewport from `useMeasure`, and in a content-sized panel there is nothing to measure - the height is zero, the window is zero rows, and it' },
      ],
    },
  });

  seed({
    id: 'ahp-session:/9c74',
    provider: 'copilotcli',
    title: 'Why does the composer eat q',
    dir: 'file:///github/textui',
    model: 'gpt-5',
    turns: [
      {
        id: 's3-t1', role: 'user', message: 'q does nothing while I am typing. Bug?',
        parts: [], state: 'complete', at: AT,
      },
      {
        id: 's3-t2',
        role: 'agent',
        state: 'complete',
        model: { id: 'gpt-5' },
        at: AT,
        elapsedMs: 3_100,
        parts: [
          { kind: 'markdown', id: 's3-m1', content: 'No - that is the focus model working. The focused node is offered a key before any keybinding, so while the composer has it, `q` is a letter.\n\nBind single letters to a focus scope and they exist only where they mean something.' },
        ],
      },
    ],
  });

  seed({
    id: 'ahp-session:/2d55',
    provider: 'claude',
    title: 'Advisor case 412 triage',
    dir: 'file:///brb_main/src/service_advisor',
    model: 'claude-opus-5',
    read: false,
    failed: true,
    permissions: 'plan',
    turns: [
      {
        id: 's4-t1', role: 'user', message: 'Pull the Desk ticket behind case 412 and summarise it.',
        parts: [], state: 'complete', at: AT,
      },
      {
        id: 's4-t2',
        role: 'agent',
        state: 'failed',
        model: { id: 'claude-opus-5' },
        at: AT,
        elapsedMs: 900,
        parts: [
          { kind: 'systemNotification', id: 's4-n1', content: 'The session ended: the host refused the request.' },
          { kind: 'markdown', id: 's4-m1', content: 'The host answered `-32007 Authentication is required to use Claude`. That is a sign-in on the host, not a network problem here.' },
          // How a 0.9.0 host ends a turn it could not finish. A `failed` turn
          // carrying no such part is the shape every earlier version had, so
          // the one scripted failure here has one.
          { kind: 'error', id: 's4-e1', message: 'Sign in on the host, then run this turn again.', resumable: true },
        ],
      },
    ],
  });

  seed({
    id: 'ahp-session:/4e18',
    provider: 'claude',
    title: 'Old build script cleanup',
    dir: 'file:///brb_main/src/brb_backend',
    model: 'claude-sonnet-5',
    archived: true,
    turns: [
      {
        id: 's5-t1', role: 'user', message: 'Delete compileFramework.sh from the Linux path.',
        parts: [], state: 'complete', at: AT,
      },
      {
        id: 's5-t2',
        role: 'agent',
        state: 'complete',
        model: { id: 'claude-sonnet-5' },
        at: AT,
        elapsedMs: 12_000,
        parts: [
          { kind: 'markdown', id: 's5-m1', content: 'Left it in place. It is FreeBSD-only - `/usr/local/bin/bash` and `md5 -q` - so nothing on Linux calls it and removing it costs the FreeBSD build.' },
        ],
      },
    ],
    changes: EDITS,
  });

  // ----------------------------------------------------- what the host handed it

  /**
   * The skills, the servers and where they came from.
   *
   * Not per-session here, though the protocol's is: the same list answers for
   * every session, because what this is for is having something on screen with
   * nothing installed. What it does reproduce is the *shape* - two containers
   * with children, one MCP server contributed at the top level by the host
   * itself, one plugin that failed to load, one skill the agent may use and a
   * person may not, and a server waiting to be signed into.
   */
  const CUSTOMIZATIONS: Customization[] = [
    {
      id: 'c-plug-review', kind: 'plugin', name: 'code-review',
      uri: 'https://plugins.example/code-review', enabled: true,
      description: 'A review pass, and the checklist it runs',
    },
    {
      id: 'c-skill-review', kind: 'skill', name: 'review', from: 'code-review',
      uri: 'file:///home/softov/.claude/plugins/code-review/skills/review/SKILL.md',
      enabled: true, userInvocable: true,
      description: 'Read the diff and report what is wrong with it',
    },
    {
      id: 'c-skill-verify', kind: 'skill', name: 'verify', from: 'code-review',
      uri: 'file:///home/softov/.claude/plugins/code-review/skills/verify/SKILL.md',
      // The agent's, not a person's: offering it in a slash menu offers
      // something the host would refuse.
      enabled: true, userInvocable: false,
      description: 'Try to refute a finding before it is reported',
    },
    {
      id: 'c-mcp-desk', kind: 'mcpServer', name: 'desk', from: 'code-review',
      uri: 'https://plugins.example/code-review#mcpServers.desk',
      enabled: true, state: 'ready',
    },
    {
      id: 'c-dir-commands', kind: 'directory', name: '.claude/commands',
      uri: 'file:///brb_main/src/brb_framework/.claude/commands', enabled: true,
      description: 'Slash commands for this workspace',
    },
    {
      id: 'c-skill-linux', kind: 'skill', name: 'linux-build', from: '.claude/commands',
      uri: 'file:///brb_main/src/brb_framework/.claude/commands/linux-build.md',
      enabled: true, userInvocable: true,
      description: 'Build the framework with the GNU makefiles',
    },
    {
      id: 'c-prompt-release', kind: 'prompt', name: 'release-notes', from: '.claude/commands',
      uri: 'file:///brb_main/src/brb_framework/.claude/commands/release-notes.md',
      enabled: true, description: 'Write the notes for what is on this branch',
    },
    {
      id: 'c-skill-off', kind: 'skill', name: 'deploy', from: '.claude/commands',
      uri: 'file:///brb_main/src/brb_framework/.claude/commands/deploy.md',
      // Off on its own, inside a directory that is on. The pair is what makes
      // "enabled is derived from both" something a screen can be checked on.
      enabled: false, userInvocable: true,
      description: 'Push to buildbox and restart the service',
    },
    {
      id: 'c-mcp-tasker', kind: 'mcpServer', name: 'tasker',
      uri: 'file:///home/softov/.mcp.json#tasker', enabled: true, state: 'ready',
    },
    {
      id: 'c-mcp-drive', kind: 'mcpServer', name: 'google-drive',
      uri: 'file:///home/softov/.mcp.json#google-drive', enabled: true,
      state: 'authRequired', problem: 'required',
    },
    {
      id: 'c-plug-broken', kind: 'plugin', name: 'notes-sync',
      uri: 'https://plugins.example/notes-sync', enabled: true,
      problem: 'manifest is not valid JSON: unexpected } at line 14',
    },
  ];

  /** The harnesses this fixture advertises, and what each offers to run on. */
  const AGENTS: Agent[] = [
        {
          provider: 'claude',
          displayName: 'Claude Code',
          description: 'Anthropic, in the editor',
          // The scripted harness holds several chats, so the commands that need
          // it are offered. A host that does not advertise this is one where
          // `createChat` MUST NOT be called at all - and the second agent below
          // deliberately does not, so the gate itself is scripted too.
          multipleChats: true,
        // Both, as the reference host advertises them.
        chatSources: { fork: true, sideChat: true },
        // What a real host advertises for a harness that needs signing in.
        // `authenticate` may only name one of these.
        protectedResources: [{ resource: 'https://api.anthropic.com', description: 'Anthropic API' }],
          // Three shapes, because a real host sends three. A model that takes
          // every thinking level, one that takes a single level that is not the
          // one anything defaults to - so it carries no default at all, which is
          // the case a form filling the gap in from the top of the list gets
          // wrong - and one that takes none and carries no schema.
          models: [
            {
              id: 'claude-opus-5',
              displayName: 'Opus 5',
              provider: 'claude',
              options: [{
                key: 'thinkingLevel',
                title: 'Thinking Level',
                description: 'Controls how much reasoning effort Claude uses.',
                values: EFFORTS,
                sessionMutable: true,
                default: 'high',
              }],
            },
            {
              id: 'claude-sonnet-5',
              displayName: 'Sonnet 5',
              provider: 'claude',
              options: [{
                key: 'thinkingLevel',
                title: 'Thinking Level',
                description: 'Controls how much reasoning effort Claude uses.',
                values: [EFFORTS[1] as { value: string; label: string }],
                sessionMutable: true,
              }],
            },
            { id: 'claude-haiku-5', displayName: 'Haiku 5', provider: 'claude' },
          ],
          // What this harness offers, before any session exists. The same list a
          // session reports, which is what the protocol says it is: entries here
          // are propagated into a session's own when one is created with this
          // agent, so two different lists would be a fixture lying about the
          // relationship it exists to demonstrate.
          customizations: CUSTOMIZATIONS.map((entry) => ({ ...entry })),
        },
        // No models, on purpose. This is what a real host answers for a harness
        // nobody has given it a token for: the harness is there, and it will
        // enumerate nothing to run on until somebody signs in. A fixture where
        // every harness has models is a client that has never been asked to say
        // "none", and it says it by showing an empty panel forever.
        // And no customizations either, for the same reason: a harness nobody
        // has signed into enumerates neither.
        { provider: 'copilotcli', displayName: 'Copilot CLI', models: [] },
  ];

  /** A model id, resolved the way a live host resolves one: against the catalogue. */
  function modelRow(id: string): ModelRow {
    for (const agent of AGENTS) {
      const found = agent.models.find((one) => one.id === id);
      if (found) return found;
    }
    return { id, displayName: id, provider: '' };
  }

  // ------------------------------------------------------------------ scripts

  /** Stream one prose part into the running turn, a word per pump. */
  function prose(uri: SessionUri, kind: 'markdown' | 'reasoning', text: string): void {
    const id = nextId(kind === 'markdown' ? 'm' : 'r');
    script.push(() => {
      const turn = active.get(uri);
      if (turn) turn.parts.push({ kind, id, content: '' } as ResponsePart);
    });
    for (const word of WORDS(text)) {
      script.push(() => {
        const turn = active.get(uri);
        const found = turn?.parts.find((p) => p.id === id);
        if (found && (found.kind === 'markdown' || found.kind === 'reasoning')) found.content += word;
        emit(uri, { type: 'delta', partId: id, kind, text: word });
      });
    }
  }

  /** Add a tool call, then complete it a pump later. */
  function tool(uri: SessionUri, call: Omit<ToolCall, 'id' | 'status'>, done: Partial<ToolCall>): void {
    const made: ToolCall = { ...call, id: nextId('c'), status: 'running' };
    script.push(() => {
      active.get(uri)?.parts.push({ kind: 'toolCall', id: made.id, call: made });
      emit(uri, { type: 'toolCall', call: made });
    });
    script.push(() => {
      made.status = done.status ?? 'completed';
      Object.assign(made, done);
      emit(uri, { type: 'toolCall', call: made });
    });
  }

  /** Block on a confirmation. Nothing after this runs until it is answered. */
  function asks(uri: SessionUri, call: Omit<ToolCall, 'id' | 'status'>): void {
    const made: ToolCall = { ...call, id: nextId('c'), status: 'pending-confirmation' };
    script.push(() => {
      active.get(uri)?.parts.push({ kind: 'toolCall', id: made.id, call: made });
      emit(uri, { type: 'toolCall', call: made });
      const input: PendingInput = { kind: 'toolConfirmation', id: nextId('i'), call: made };
      inputs.set(uri, input);
      emit(uri, { type: 'inputNeeded', input });
      touch(uri);
    });
  }

  /** Block on a question, which is a different thing entirely. */
  function elicits(uri: SessionUri, input: Omit<ChatInputRequest, 'id' | 'kind'>): void {
    script.push(() => {
      const made: PendingInput = { kind: 'chatInput', id: nextId('i'), ...input };
      inputs.set(uri, made);
      emit(uri, { type: 'inputNeeded', input: made });
      touch(uri);
    });
  }

  /**
   * Start the next queued turn, if one is waiting and nothing is running.
   *
   * One, not the lot. The queue is a list of turns to take in order, and a
   * host that started them together would be interleaving turns in one chat -
   * which is the thing queueing exists to prevent. Sending them as one joined
   * message would be the other way to get it wrong: they were written as
   * separate messages, and the agent reading them is entitled to see that.
   */
  /**
   * Cut the turn short.
   *
   * A function rather than only a method, because two callers want it: the
   * control that stops a turn, and `chat/turnCancelled` arriving through
   * `dispatch` - which is the same thing said the other way, and must not be
   * a second, slightly different implementation of it.
   */
  function stop(uri: SessionUri): void {
    script.length = 0;
    const turn = active.get(uri);
    if (turn) {
      turn.state = 'cancelled';
      turns.get(uri)?.push(turn);
      active.delete(uri);
      emit(uri, { type: 'turnComplete', turn });
    }
    inputs.delete(uri);
    emit(uri, { type: 'inputResolved' });
    touch(uri);
  }

  function drain(uri: SessionUri): void {
    if (active.has(uri)) return;
    const waiting = queues.get(uri) ?? [];
    const next = waiting[0];
    if (!next) return;
    const rest = waiting.slice(1);
    queues.set(uri, rest);
    emit(uri, { type: 'queued', messages: rest });
    reply(uri, next.text);
  }

  function finish(uri: SessionUri, closing: string, options: { failed?: boolean; changes?: Changeset } = {}): void {
    if (closing) prose(uri, 'markdown', closing);
    script.push(() => {
      const turn = active.get(uri);
      if (!turn) return;
      turn.state = options.failed ? 'failed' : 'complete';
      turn.elapsedMs = 18_200;
      turns.get(uri)?.push(turn);
      active.delete(uri);
      if (options.failed) failed.add(uri); else failed.delete(uri);
      emit(uri, { type: 'turnComplete', turn });
      touch(uri);

      if (options.changes) {
        changesets.set(uri, options.changes);
        emit(uri, { type: 'changes', changes: options.changes });
      }

      // The turn is over, so whatever was waiting on it goes now. Appending to
      // `script` from inside a step is safe: `pump` shifts one and runs it.
      drain(uri);
    });
  }

  /**
   * What the agent does when it is spoken to.
   *
   * Four shapes, and which one runs depends on what was said - a question gets
   * an answer, "run the tests" gets a command that asks first, a choice gets an
   * elicitation, and something that cannot work fails. One canned reply to
   * everything is a fixture that only ever proves the client can render *it*:
   * the short one never scrolls, the long one always does, the failing one is
   * the only thing that renders a system notification, and none of that is
   * exercised by a script that always says the same paragraph.
   */
  function reply(uri: SessionUri, said: string): void {
    const userTurn: Turn = { id: nextId('u'), role: 'user', message: said, parts: [], state: 'complete', at: AT };
    const model = { id: models.get(uri) ?? 'claude-opus-5' };
    const agentTurn: Turn = { id: nextId('a'), role: 'agent', parts: [], state: 'running', model, at: AT };

    script.push(() => {
      turns.get(uri)?.push(userTurn);
      emit(uri, { type: 'turnStarted', turn: userTurn });
      active.set(uri, agentTurn);
      emit(uri, { type: 'turnStarted', turn: agentTurn });
      touch(uri);
    });

    switch (pick(said)) {
      case 'run':
        prose(uri, 'reasoning', 'The composer swallows single-letter keys, so a global `q` cannot exist while it has focus. ');
        prose(uri, 'markdown', 'Two things are true at once here.\n\nThe **composer owns the keyboard** while it is focused, so every single-letter binding has to live in a focus scope rather than globally. What is left global is the modified set:\n\n- `ctrl+p` for the palette\n- `ctrl+c` to stop the turn\n\nLet me look at what the transcript does with the rest.');
        tool(uri, {
          name: 'Read', toolName: 'Read',
          input: 'packages/core/src/app/input.ts',
          intention: 'Read the input router, to see who gets a key first',
        }, {
          outcome: 'Read 214 lines',
          output: 'const order = [layers, screen, surfaces, global];\n// A layer that traps focus gets the key before anything under it.',
        });
        asks(uri, {
          name: 'Bash', toolName: 'Bash',
          input: 'pnpm --filter @textui/core test -- input.test.ts',
          intention: 'Run the input router tests',
          confirmationTitle: 'Run a command in /github/textui?',
          options: [
            { id: 'once', label: 'Allow once' },
            { id: 'session', label: 'Allow for this session' },
          ],
        });
        return;

      case 'ask':
        prose(uri, 'markdown', 'Both work, and they fail differently, so this is yours to pick rather than mine.');
        elicits(uri, {
          message: 'Two ways to keep the composer from eating the keys.',
          questions: [
            {
              id: 'q1',
              kind: 'single-select',
              message: 'Where should the single-letter keys be registered?',
              required: true,
              options: [
                { id: 'transcript-scope', label: 'On the transcript scope, so the composer never sees them' },
                { id: 'composer-escape', label: 'Globally, and escape blurs the composer first' },
                { id: 'both', label: 'Both, with the transcript winning' },
              ],
              allowFreeformInput: true,
            },
            { id: 'q2', kind: 'boolean', message: 'Add a test that types into the composer and asserts q is not quit?' },
          ],
        });
        return;

      case 'name':
        /*
         * A question with nothing to choose from.
         *
         * The other elicitation is a choice, and a choice is answerable with
         * the arrow keys - so a fixture that only ever asks one hides the kind
         * that needs the keyboard. This is what a real host sends when it
         * wants a file, a symbol or a sentence back, and it is the shape that
         * was unanswerable: the field was drawn and what was typed at it went
         * into the composer behind.
         */
        elicits(uri, {
          message: 'I can look, but not at all of it at once.',
          questions: [
            {
              id: 'q1',
              kind: 'text',
              message: 'Which specific bug, failing test, or file should I investigate?',
              required: true,
            },
          ],
        });
        return;

      case 'fail':
        prose(uri, 'reasoning', 'Check the host answered at all before blaming the harness. ');
        tool(uri, {
          name: 'Bash', toolName: 'Bash',
          input: 'ssh buildbox -p 22 make -f Makefile.linux',
          intention: 'Build on the FreeBSD box',
        }, { status: 'failed', outcome: 'Exited 255', exitCode: 255, output: 'ssh: connect to host build.example.com port 22: Connection timed out' });
        finish(uri, 'The box did not answer on 22. That is the tunnel, not the build - nothing was compiled, so nothing is broken.', { failed: true });
        return;

      default:
        // Short, and with no tool calls at all. The shape a transcript is
        // least often tested against, because a fixture is always the long one.
        prose(uri, 'markdown', `Yes - **${said.trim().slice(0, 40)}** is the part that matters.\n\nThe focused node is offered the key first, so a binding only exists where its scope is mounted.`);
        finish(uri, '');
    }
  }

  /**
   * Which script.
   *
   * Read off what was said, so a person driving the example can choose what to
   * exercise; the counter only decides when the words say nothing, which keeps
   * "hello" from being the same conversation every time.
   */
  let rotation = 0;
  function pick(said: string): 'run' | 'ask' | 'name' | 'fail' | 'short' {
    const text = said.toLowerCase();
    // Failure first: "the build fails" names both, and the interesting half of
    // it is the failure.
    if (/\b(fail|fails|error|broken|ssh|buildbox|timeout)\b/.test(text)) return 'fail';
    if (/\b(run|test|tests|build|compile|pnpm|make)\b/.test(text)) return 'run';
    if (/\b(which|choose|option|options|prefer)\b/.test(text)) return 'ask';
    // Before the rotation, and after the rest: a question with nothing to
    // choose from is the elicitation that has to be typed at.
    if (/\b(look|find|investigate|somewhere|anything)\b/.test(text)) return 'name';
    return (['short', 'run', 'ask', 'fail'] as const)[rotation++ % 4] ?? 'short';
  }

  /** What it does once the command has been allowed. */
  function afterApproval(uri: SessionUri, call: ToolCall, approved: boolean): void {
    script.push(() => {
      call.status = approved ? 'completed' : 'cancelled';
      call.outcome = approved ? 'Ran in 4.2s, 38 passed' : 'Denied';
      if (approved) call.output = 'Test Files  1 passed (1)\n     Tests  38 passed (38)';
      call.exitCode = approved ? 0 : undefined;
      emit(uri, { type: 'toolCall', call });
    });

    if (!approved) {
      finish(uri, 'Left it alone. Tell me what you want to run instead.');
      return;
    }

    // A question, which is not a confirmation: no tool call, its own prose,
    // and choices that are lost entirely if it is rendered as a yes/no.
    elicits(uri, {
      message: 'The tests pass, so the fix is a choice about where the keys live.',
      questions: [
        {
          id: 'q1',
          kind: 'single-select',
          message: 'Where should the single-letter keys be registered?',
          required: true,
          options: [
            { id: 'transcript-scope', label: 'On the transcript scope, so the composer never sees them' },
            { id: 'composer-escape', label: 'Globally, and escape blurs the composer first' },
            { id: 'both', label: 'Both, with the transcript winning' },
          ],
          allowFreeformInput: true,
        },
        { id: 'q2', kind: 'boolean', message: 'Add a test that types into the composer and asserts q is not quit?' },
      ],
    });
  }

  /** What the script says next, once the question has been answered. */
  function answered(uri: SessionUri, accepted: boolean, answers: Record<string, Answer>): void {
    const chosen = answers.q1;
    const where = !accepted ? 'nothing'
      : chosen?.kind === 'selected' ? chosen.value
        : chosen?.kind === 'text' ? chosen.value : 'nothing';
    finish(uri, `Right - **${where}**. I will move the bindings and leave the modified keys where they are.`, {
      changes: {
        status: 'complete',
        files: [
          { uri: 'file:///github/textui/examples/chat/src/control.ts', before: 'x', after: 'y', diff: { added: 34, removed: 6 } },
          { uri: 'file:///github/textui/examples/chat/test/keys.test.tsx', after: 'y', diff: { added: 51, removed: 0 } },
        ],
      },
    });
  }

  /** One scripted step. The application's ticker and a test's loop share it. */
  function pump(): boolean {
    const step = script.shift();
    if (!step) return false;
    step();
    return true;
  }

  // --------------------------------------------------------------- connection

  return {
    id: 'fake',
    url: 'fake://scripted',
    state: () => 'connected',

    listSessions: async () => [...summaries.values()],

    agents: async (): Promise<Agent[]> => AGENTS,

    // Iterative, as a real host's is: what has been answered comes back
    // answered. A fixture that returns its defaults every time quietly undoes
    // every choice the moment anything asks the question again.
    resolveConfig: async ({ values }): Promise<SessionConfig> => ({
      properties: CONFIG,
      values: { permissionMode: 'default', isolation: 'workspace', ...values },
    }),

    automations: async () => [...automations.values()],

    onAutomations: (observer) => {
      automationWatchers.add(observer);
      return { close: () => { automationWatchers.delete(observer); } };
    },

    createAutomation: async (definition) => {
      const uri = `ahp-automation:/${(0x8000 + automations.size).toString(16)}`;
      const triggers = Array.isArray(definition.triggers) ? definition.triggers : [];
      const schedule = triggers
        .map((one) => (typeof one === 'object' && one !== null ? one as Record<string, unknown> : {}))
        .find((one) => one.kind === 'schedule');
      const timing = (typeof schedule?.schedule === 'object' && schedule.schedule !== null
        ? schedule.schedule
        : {}) as { expression?: string; timeZone?: string };
      automations.set(uri, {
        resource: uri,
        title: typeof definition.title === 'string' ? definition.title : 'Untitled automation',
        enabled: definition.enabled !== false,
        ...(timing.expression
          ? { schedule: { expression: timing.expression, timeZone: timing.timeZone ?? 'UTC' } }
          : {}),
        // A host with a clock answers with when it will fire, and that answer
        // is the confirmation the form is waiting for. An hour from now, so
        // the fixture is a *next* run whenever this is read.
        ...(timing.expression
          ? { nextRunAt: new Date(Date.now() + 3_600_000).toISOString() }
          : {}),
        runs: [],
        operations: ['update', 'remove', 'run'],
      });
      automationsMoved();
      return uri;
    },

    /**
     * Run one now, which is what the host does with nobody watching.
     *
     * The session it starts carries the origin, because that is the whole
     * point of the field: a catalogue that showed this next to one somebody
     * typed, with nothing to tell them apart, is what 0.9.0 added it for.
     */
    runAutomation: async (uri) => {
      const found = automations.get(uri);
      if (!found || !found.operations.includes('run')) return;
      const run = `ahp-automation-run:/${(0x100 + found.runs.length).toString(16)}`;
      const session = `ahp-session:/${(0x1000 + summaries.size).toString(16)}`;
      seed({
        id: session,
        provider: 'claude',
        title: found.title,
        dir: 'file:///brb_main/src/brb_framework',
        read: false,
        origin: { kind: 'automation', automation: uri, run },
      });
      automations.set(uri, {
        ...found,
        runs: [{ resource: run, status: 'running', session, triggered: false }, ...found.runs],
      });
      moved();
      automationsMoved();
    },

    setAutomationEnabled: async (uri, enabled) => {
      const found = automations.get(uri);
      if (!found) return;
      automations.set(uri, {
        ...found,
        enabled,
        // What the host would answer with, rather than what was asked for: an
        // automation switched off stops offering Run, and switching it back on
        // offers it again.
        operations: enabled ? ['update', 'remove', 'run'] : ['update', 'remove'],
        ...(enabled ? {} : { nextRunAt: undefined }),
      });
      automationsMoved();
    },

    removeAutomation: async (uri) => {
      if (!automations.delete(uri)) return;
      automationsMoved();
    },

    createSession: async ({ provider, workingDirectory }) => {
      const uri = `ahp-session:/${(0x1000 + summaries.size).toString(16)}`;
      seed({
        id: uri,
        provider,
        title: 'New session',
        dir: workingDirectory ? `file://${workingDirectory}` : '',
      });
      moved();
      return uri;
    },

    disposeSession: async (uri) => {
      summaries.delete(uri);
      moved();
      turns.delete(uri);
      active.delete(uri);
      inputs.delete(uri);
      chats.delete(uri);
      flags.delete(uri);
      failed.delete(uri);
    },

    setArchived: (uri, archived) => setFlag(uri, SessionFlag.IsArchived, archived),
    setRead: (uri, read) => setFlag(uri, SessionFlag.IsRead, read),

    rename: (uri, title) => {
      const summary = summaries.get(uri);
      if (!summary) return;
      summaries.set(uri, { ...summary, title });
      moved();
    },

    onSessions: (observer) => {
      catalogue.add(observer);
      return { close: () => { catalogue.delete(observer); } };
    },

    /**
     * A scripted filesystem, for the one thing a menu of paths has to get
     * right: replacing the fragment rather than appending to it.
     *
     * Not a real directory. The point of the script is arriving at a
     * particular state on purpose, and a fixture that read this machine's
     * files would answer differently on every machine it ran on.
     */
    /*
     * A scripted shell.
     *
     * It answers three commands and says so for anything else, which is
     * enough to check the one thing a terminal view has to get right:
     * keystrokes go out, output comes back, and what is on screen is the
     * accumulated stream rather than the last thing said.
     */
    terminals: async () => [...shells].map(([resource, held]) => ({
      resource,
      title: held.title,
      ...(held.exitCode !== undefined ? { exitCode: held.exitCode } : {}),
    })),

    createTerminal: async (options) => {
      const uri = `ahp-terminal:/${randomUUID()}`;
      shells.set(uri, {
        title: options?.name ?? 'sh',
        cwd: options?.cwd ?? '/brb_main/src/brb_framework',
        output: '',
        pending: '',
        watchers: new Set(),
      });
      return uri;
    },

    disposeTerminal: async (uri) => {
      const held = shells.get(uri);
      if (!held) return;
      held.exitCode = 0;
      for (const watcher of held.watchers) watcher(shellState(uri, held));
      shells.delete(uri);
    },

    watchTerminal: (uri, observer) => {
      const held = shells.get(uri);
      if (!held) return { close: () => {} };
      held.watchers.add(observer);
      observer(shellState(uri, held));
      return { close: () => { held.watchers.delete(observer); } };
    },

    resizeTerminal: (uri, cols, rows) => {
      const held = shells.get(uri);
      if (!held) return;
      held.cols = cols;
      held.rows = rows;
      for (const watcher of held.watchers) watcher(shellState(uri, held));
    },

    clearTerminal: (uri) => {
      const held = shells.get(uri);
      if (!held) return;
      held.output = '';
      for (const watcher of held.watchers) watcher(shellState(uri, held));
    },

    renameTerminal: (uri, title) => {
      const held = shells.get(uri);
      if (!held) return;
      held.title = title;
      for (const watcher of held.watchers) watcher(shellState(uri, held));
    },

    claimTerminal: (uri, claim) => {
      const held = shells.get(uri);
      if (!held) return;
      held.claim = claim;
      for (const watcher of held.watchers) watcher(shellState(uri, held));
    },

    writeTerminal: (uri, data) => {
      const held = shells.get(uri);
      if (!held) return;
      held.pending += data;
      // A line at a time, which is what a shell reading from a pipe does.
      for (;;) {
        const at = held.pending.indexOf('\n');
        if (at === -1) break;
        const line = held.pending.slice(0, at).trim();
        held.pending = held.pending.slice(at + 1);
        held.output += `$ ${line}\n${SHELL[line] ?? `sh: ${line}: not found\n`}`;
      }
      for (const watcher of held.watchers) watcher(shellState(uri, held));
    },

    completions: async ({ text, offset }) => {
      const at = offset ?? text.length;
      const found = /(?:^|\s)@(\S*)$/.exec(text.slice(0, at));
      if (!found) return [];
      const typed = found[1] ?? '';
      const start = at - typed.length - 1;
      const cut = typed.lastIndexOf('/');
      const inside = cut === -1 ? '' : typed.slice(0, cut + 1);
      const prefix = cut === -1 ? typed : typed.slice(cut + 1);
      const here = FILES[inside] ?? [];
      return here
        .filter((name) => name.toLowerCase().startsWith(prefix.toLowerCase()))
        .map((name) => ({
          insertText: `@${inside}${name}`,
          rangeStart: start,
          rangeEnd: at,
          label: `${inside}${name}`,
        }));
    },

    createChat: async (uri, first, source) => {
      const chat = `ahp-chat:/${randomUUID()}`;
      // A fork copies the source's visible history through the named turn; a
      // side chat carries the context without copying it into what a person
      // reads. A fixture that treated them alike would let a screen ship that
      // could not tell them apart either.
      const from = source === undefined ? [] : (turns.get(source.chat as SessionUri) ?? extra.get(source.chat)?.turns ?? []);
      const carried = source?.kind === 'fork'
        ? [...from.slice(0, Math.max(1, from.findIndex((one) => one.id === source.turnId) + 1))]
        : [];
      extra.set(chat, {
        session: uri,
        title: source?.kind === 'sideChat' ? 'Side chat' : 'Chat',
        turns: carried.map((one) => ({ ...one })),
        watchers: new Set(),
      });
      emit(uri, { type: 'chats', items: chatsOf(uri), defaultChat: chats.get(uri) ?? '' });
      if (first) {
        const held = extra.get(chat);
        held?.turns.push({ id: `${chat}:said`, role: 'user', message: first, parts: [], state: 'complete', at: AT });
      }
      return chat;
    },

    disposeChat: async (chat) => {
      const held = extra.get(chat);
      if (!held) {
        // The session's own chat is the session. Saying so beats a silent
        // no-op, which reads as a close that did not take.
        throw new Error('That is the only chat in this session; dispose the session instead');
      }
      extra.delete(chat);
      emit(held.session, { type: 'chats', items: chatsOf(held.session), defaultChat: chats.get(held.session) ?? '' });
    },

    subscribe: (uri, observer, wanted) => {
      const held = wanted === undefined ? undefined : extra.get(wanted);
      if (held) {
        held.watchers.add(observer);
        observer({ type: 'snapshot', turns: held.turns, status: SessionFlag.Idle, queued: [], draft: '' });
        observer({ type: 'chats', items: chatsOf(uri), defaultChat: chats.get(uri) ?? '' });
        return { close: () => { held.watchers.delete(observer); } };
      }
      let set = observers.get(uri);
      if (!set) { set = new Set(); observers.set(uri, set); }
      set.add(observer);
      observer({
        type: 'snapshot',
        turns: turns.get(uri) ?? [],
        ...(active.get(uri) ? { active: active.get(uri) as Turn } : {}),
        ...(inputs.get(uri) ? { input: inputs.get(uri) as PendingInput } : {}),
        status: statusOf(uri),
        queued: queues.get(uri) ?? [],
        draft: drafts.get(uri) ?? '',
      });
      observer({ type: 'chats', items: chatsOf(uri), defaultChat: chats.get(uri) ?? '' });
      const changes = changesets.get(uri);
      if (changes) observer({ type: 'changes', changes });
      // Closing drops this consumer. It does not unsubscribe the channel -
      // doing that to shed a duplicate is what kills the stream everything
      // else is reading.
      return { close: () => { set?.delete(observer); } };
    },

    loadOlderTurns: async (uri) => {
      const behind = older.get(uri) ?? [];
      if (behind.length === 0) return false;
      // A page, oldest last: the ones nearest the loaded window come first,
      // which is the order a host hands them back in.
      const page = behind.splice(-PAGE);
      turns.set(uri, [...page, ...(turns.get(uri) ?? [])]);
      emit(uri, {
        type: 'snapshot',
        turns: turns.get(uri) ?? [],
        ...(active.get(uri) ? { active: active.get(uri) as Turn } : {}),
        ...(inputs.get(uri) ? { input: inputs.get(uri) as PendingInput } : {}),
        status: statusOf(uri),
        queued: queues.get(uri) ?? [],
        draft: drafts.get(uri) ?? '',
      });
      return behind.length > 0;
    },

    setDraft: (uri, text) => {
      if (text === '') drafts.delete(uri); else drafts.set(uri, text);
      emit(uri, {
        type: 'snapshot',
        turns: turns.get(uri) ?? [],
        ...(active.get(uri) ? { active: active.get(uri) as Turn } : {}),
        ...(inputs.get(uri) ? { input: inputs.get(uri) as PendingInput } : {}),
        status: statusOf(uri),
        queued: queues.get(uri) ?? [],
        draft: drafts.get(uri) ?? '',
      });
    },

    // Sending clears the draft, which is what the host does.
    say: (uri, text) => { drafts.delete(uri); reply(uri, text); },

    queue: (uri, text) => {
      const waiting = [...(queues.get(uri) ?? []), { id: nextId('q'), text }];
      queues.set(uri, waiting);
      emit(uri, { type: 'queued', messages: waiting });
      // Idle already: the protocol says a host consumes a queued message
      // immediately rather than holding it for a turn that is not running.
      drain(uri);
    },

    unqueue: (uri, id) => {
      const waiting = (queues.get(uri) ?? []).filter((message) => message.id !== id);
      queues.set(uri, waiting);
      emit(uri, { type: 'queued', messages: waiting });
    },

    stopTurn: stop,

    /*
     * Both answers land on the next step, not inside the call.
     *
     * A host answers over a socket, and a fake that has resolved the question
     * before its own caller has returned is one where the interval between
     * pressing a button and being told anything does not exist. That interval
     * is the whole of what a client has to draw - it is where "I pressed
     * Approve and nothing happened" lives - so the script has it too.
     */
    confirmToolCall: (uri, toolCallId, approved) => {
      const input = inputs.get(uri);
      if (!input || input.kind !== 'toolConfirmation' || input.call.id !== toolCallId) return;
      // At the front: whatever the script already holds comes after the
      // question is let go of, never before it.
      script.unshift(() => {
        inputs.delete(uri);
        emit(uri, { type: 'inputResolved' });
        touch(uri);
        afterApproval(uri, input.call, approved);
      });
    },

    completeInput: (uri, requestId, accepted, answers) => {
      const input = inputs.get(uri);
      if (!input || input.id !== requestId) return;
      script.unshift(() => {
        inputs.delete(uri);
        emit(uri, { type: 'inputResolved' });
        touch(uri);
        answered(uri, accepted, answers);
      });
    },

    /**
     * Which changesets a session offers.
     *
     * Four, the way the protocol has them: two that are already URIs and two
     * that are templates a client has to fill in from turns it can see. A
     * session with nothing changed offers none, which is what makes "the host
     * advertises no scopes" a case a screen can be built against.
     */
    changesets: async (uri): Promise<ChangesetScope[]> => {
      const per = scoped.get(uri);
      if (!per) return [];
      return [
        {
          label: 'This Session',
          description: 'Everything this conversation changed',
          uriTemplate: `${uri}/changeset/session`,
          changeKind: 'session',
          reviewable: true,
          variables: [],
        },
        {
          label: 'Uncommitted Changes',
          description: 'The working tree, against HEAD',
          uriTemplate: `${uri}/changeset/uncommitted`,
          changeKind: 'uncommitted',
          variables: [],
        },
        {
          label: 'This Turn',
          description: 'What one turn changed',
          uriTemplate: `${uri}/changeset/turn/{turnId}`,
          changeKind: 'turn',
          reviewable: true,
          variables: ['turnId'],
        },
        {
          label: 'Between Two Turns',
          uriTemplate: `${uri}/changeset/compare/{originalTurnId}/{modifiedTurnId}`,
          changeKind: 'compare-turns',
          reviewable: true,
          variables: ['originalTurnId', 'modifiedTurnId'],
        },
      ];
    },

    /**
     * One of them, by the URI its template became.
     *
     * The second argument is honoured rather than ignored: it is the whole
     * difference between a screen that can show four changesets and one that
     * shows the first and hides the rest. Left out, the session's own - which
     * is what a screen drawing a single changeset wants.
     */
    changes: async (uri, wanted) => {
      if (wanted === undefined) return changesets.get(uri) ?? { status: 'complete', files: [] };
      const at = scopeIn(wanted);
      // A scope this session does not offer is not an empty changeset - it is
      // a question about something that did not happen, and a host says so.
      if (!at) throw new Error(`${wanted} is not a changeset of ${uri}`);
      const found = scoped.get(at.owner)?.get(at.scope);
      if (!found) throw new Error(`${wanted} is not a changeset of ${at.owner}`);
      return found;
    },

    /**
     * Ticked off, or cleared.
     *
     * The host keeps the flag and tells everyone watching, which is why this
     * returns nothing: a client that toggled its own copy would be the only
     * one that ever saw it, and would disagree with the next snapshot.
     */
    review: (changeset, files, reviewed) => {
      const at = scopeIn(changeset);
      if (!at) return;
      const held = scoped.get(at.owner)?.get(at.scope);
      if (!held) return;
      const wanted = new Set(files);
      const after: Changeset = {
        status: held.status,
        files: held.files.map((file) => {
          if (!wanted.has(file.uri)) return file;
          // The key goes rather than turning `false`, because absent is what
          // the protocol says not-yet-reviewed is - and a row carrying
          // `reviewed: false` invites a client to read it as a third state.
          const { reviewed: _was, ...rest } = file;
          return reviewed ? { ...rest, reviewed: true } : rest;
        }),
      };
      scoped.get(at.owner)?.set(at.scope, after);
      if (at.scope === 'session') changesets.set(at.owner, after);
      emit(at.owner, { type: 'changes', changes: after });
    },

    /**
     * Which resources this client has talked its way into writing.
     *
     * A set on the host and not on the caller, because that is where it lives
     * on a real one: the grant is per connection, and a client that kept its
     * own copy would be the only thing that believed in it.
     */
    requestResource: async (uri, access) => {
      if (!uri.startsWith('file://')) throw Object.assign(new Error(`This host does not mediate ${uri}`), { code: -32009 });
      if (access.write === true) granted.add(uri);
    },

    /**
     * Run one, with the gate a real host puts in front of it.
     *
     * Refused until the write has been asked for, and the refusal carries the
     * request that would unlock it - which is the whole reason a client can
     * negotiate rather than just fail. Scripting the refusal is the point: a
     * fixture that always said yes would let a client be built that never
     * learned to ask.
     */
    invoke: async (changeset, operationId, target) => {
      const at = scopeIn(changeset);
      const held = at && scoped.get(at.owner)?.get(at.scope);
      if (!at || !held) throw new Error(`${changeset} is not a changeset here`);
      const offered = (held.operations ?? []).find((one) => one.id === operationId);
      // The advertised list *is* the access model on a real host, so a fake
      // that ran an unadvertised id would be a laxer host than any real one.
      if (!offered) throw Object.assign(new Error(`No operation called ${operationId} on ${changeset}`), { code: -32602 });
      const kind = target?.kind ?? 'changeset';
      if (!offered.scopes.includes(kind)) {
        throw Object.assign(new Error(`${operationId} cannot be invoked on a ${kind}`), { code: -32602 });
      }
      const wanted = target?.resource ?? (summaries.get(at.owner)?.workingDirectories[0] ?? '');
      if (!granted.has(wanted)) {
        throw Object.assign(new Error(`Write access to ${wanted} has not been granted`), {
          code: -32009,
          data: { request: { channel: 'ahp-root://', uri: wanted, write: true } },
        });
      }
      invoked.push({ changeset, operationId, ...(target ? { target } : {}) });
      // What it did reaches every client through the changeset's own channel,
      // never through this answer.
      if (operationId === 'commit') {
        const after: Changeset = { status: 'complete', files: [], ...(held.operations ? { operations: [] } : {}) };
        scoped.get(at.owner)?.set(at.scope, after);
        emit(at.owner, { type: 'changes', changes: after });
        return { message: 'Committed 1a2b3c4: what the session changed' };
      }
      const after: Changeset = {
        ...held,
        files: held.files.filter((file) => file.uri !== target?.resource),
      };
      scoped.get(at.owner)?.set(at.scope, after);
      if (at.scope === 'session') changesets.set(at.owner, after);
      emit(at.owner, { type: 'changes', changes: after });
      return { message: `${offered.label} on ${(target?.resource ?? '').split('/').pop() ?? ''}` };
    },

    /**
     * One directory of the host's filesystem.
     *
     * Rooted at whichever served directory the URI is under, so what this
     * lists is the same tree the `@` completion offers - two views of one
     * fixture rather than two fixtures that will drift.
     */
    resourceList: async (uri): Promise<ResourceEntry[]> => {
      const at = inTree(uri);
      if (at === undefined) throw new Error(`${uri} is not a directory this host serves`);
      const here = FILES[at.inside];
      if (here === undefined) throw new Error(`${uri} is not a directory`);
      return here.map((name) => ({
        uri: `file://${at.root}/${at.inside}${name}`.replace(/\/$/, ''),
        name: name.replace(/\/$/, ''),
        kind: name.endsWith('/') ? 'directory' : 'file',
        ...(name.endsWith('/') ? {} : { size: (SOURCES[`${at.inside}${name}`] ?? '').length }),
      }));
    },

    /**
     * One file's bytes, off the same tree.
     *
     * `encoding` is reported rather than assumed, as a real host reports it -
     * a caller that took every answer for text is a caller that prints a PNG
     * to a terminal, and a fake that only ever answers text never catches one.
     */
    resourceRead: async (uri) => {
      const at = inTree(uri);
      const body = at === undefined ? undefined : SOURCES[at.inside];
      if (body === undefined) throw new Error(`${uri} is not a file this host serves`);
      return { data: body, encoding: 'utf-8', contentType: 'text/plain' };
    },

    /*
     * A token this fixture takes and remembers.
     *
     * The resource is checked against what the agents advertise, because that
     * is the rule a real host enforces - `authentication.md` says the value
     * MUST match one the server advertised, and a fixture that accepted any
     * string would let a client ship a name no host will take.
     */
    authenticate: async (resource, token) => {
      const known = AGENTS.flatMap((agent) => agent.protectedResources ?? []);
      if (known.length > 0 && !known.some((one) => one.resource === resource)) {
        throw new Error(`This host protects ${known.map((one) => one.resource).join(', ')}, not ${resource}.`);
      }
      if (token === '') tokens.delete(resource); else tokens.set(resource, token);
      return undefined;
    },

    protectedResources: async () => AGENTS.flatMap((agent) => agent.protectedResources ?? []),

    /*
     * Values a schema would not carry.
     *
     * Filtered by the query, because that is what the host does with it - a
     * fixture that returned the whole list whatever was typed would let a
     * screen ship that never sent one.
     */
    configCompletions: async ({ property, query }) => {
      const all = property === 'branch'
        ? [
          { value: 'main', label: 'main' },
          { value: 'softov/spec-batches', label: 'softov/spec-batches' },
          { value: 'softov/reconnect', label: 'softov/reconnect' },
        ]
        : [];
      const at = (query ?? '').toLowerCase();
      return at === '' ? all : all.filter((one) => one.value.toLowerCase().includes(at));
    },

    resourceResolve: async (uri) => {
      const at = inTree(uri);
      if (at === undefined) throw new Error(`${uri} is not something this host serves`);
      const directory = FILES[at.inside] !== undefined;
      const body = SOURCES[at.inside];
      if (!directory && body === undefined) throw new Error(`${uri} is not a file this host serves`);
      return {
        uri,
        type: directory ? 'directory' : 'file',
        ...(directory ? {} : { size: (body ?? '').length }),
      };
    },

    /*
     * The write half, over the same tree.
     *
     * Written into `SOURCES` rather than pretended: a fake that accepted a
     * write and forgot it is one where a screen that saves and re-reads looks
     * correct while doing nothing. `createOnly` is the protocol's guard and
     * refuses rather than replacing.
     */
    resourceWrite: async (uri, data, opts) => {
      const at = inTree(uri);
      if (at === undefined) throw new Error(`${uri} is not somewhere this host serves`);
      if (opts?.createOnly && SOURCES[at.inside] !== undefined) {
        throw new Error(`${uri} already exists`);
      }
      SOURCES[at.inside] = data;
      return undefined;
    },

    resourceDelete: async (uri) => {
      const at = inTree(uri);
      if (at === undefined || SOURCES[at.inside] === undefined) {
        throw new Error(`${uri} is not a file this host serves`);
      }
      delete SOURCES[at.inside];
      return undefined;
    },

    resourceMkdir: async (uri) => {
      const at = inTree(uri);
      if (at === undefined) throw new Error(`${uri} is not somewhere this host serves`);
      FILES[at.inside] ??= [];
      return undefined;
    },

    resourceMove: async (from, to, opts) => {
      const source = inTree(from);
      const target = inTree(to);
      if (source === undefined || target === undefined) throw new Error('not somewhere this host serves');
      const body = SOURCES[source.inside];
      if (body === undefined) throw new Error(`${from} is not a file this host serves`);
      if (opts?.failIfExists && SOURCES[target.inside] !== undefined) {
        throw new Error(`${to} already exists`);
      }
      SOURCES[target.inside] = body;
      delete SOURCES[source.inside];
      return undefined;
    },

    resourceCopy: async (from, to, opts) => {
      const source = inTree(from);
      const target = inTree(to);
      if (source === undefined || target === undefined) throw new Error('not somewhere this host serves');
      const body = SOURCES[source.inside];
      if (body === undefined) throw new Error(`${from} is not a file this host serves`);
      if (opts?.failIfExists && SOURCES[target.inside] !== undefined) {
        throw new Error(`${to} already exists`);
      }
      SOURCES[target.inside] = body;
      return undefined;
    },

    /*
     * A watch this fixture opens and never fires.
     *
     * Which is honest: nothing changes under a scripted filesystem. What it
     * demonstrates is the shape a caller has to get right - a handle whose
     * release is the only way to close one, because the protocol has no
     * dispose command and the receiver releases the watcher when the last
     * subscriber goes.
     */
    watchResource: async (uri, _observer) => {
      const at = inTree(uri);
      if (at === undefined) throw new Error(`${uri} is not somewhere this host serves`);
      watched.add(uri);
      return { close: () => { watched.delete(uri); } };
    },

    /**
     * One action, verbatim, without this fake knowing what most of them mean.
     *
     * Every one is recorded, and the handful this host can honour are carried
     * out. That split is the honest one: a real host handles what it handles
     * and ignores the rest, and a fake that silently dropped everything would
     * make `dispatch` untestable in exactly the place it exists to be tested.
     */
    dispatch: (uri, action, chat) => {
      sent.push({ uri, action, ...(chat === true ? { chat: true } : {}) });
      const type = String(action.type ?? '');
      if (type === 'chat/turnStarted') {
        const message = action.message as { text?: string } | undefined;
        const text = message?.text ?? String(action.content ?? '');
        if (text !== '') reply(uri, text);
        return;
      }
      if (type === 'chat/turnCancelled') { stop(uri); return; }
      if (type === 'session/isReadChanged') { setFlag(uri, SessionFlag.IsRead, action.isRead === true); return; }
      if (type === 'session/isArchivedChanged') setFlag(uri, SessionFlag.IsArchived, action.isArchived === true);
    },

    /**
     * Wait for what was dispatched to have taken effect.
     *
     * On a socket this is bytes leaving; here it is the script running out,
     * which is the same promise from the caller's side - after it, everything
     * asked for has happened. A caller that dispatches one thing and exits is
     * the reason either exists.
     */
    flush: async () => {
      for (let i = 0; i < 5000; i++) if (!pump()) break;
    },


    content: async (ref: ContentRef): Promise<FileContent> => {
      const found = contents.get(ref.uri);
      // A ref nobody registered is the shape a host answers with when the
      // content has expired, and a viewer has to have something to say about
      // it other than a blank pane.
      if (found === undefined) throw new Error(`No content for ${ref.uri}`);
      return { text: found };
    },

    customizations: async () => CUSTOMIZATIONS.map((entry) => ({ ...entry })),

    // The scripted harness contributes the same things whether or not a
    // session exists, which is what makes it a script.
    harnessCommands: async () => CUSTOMIZATIONS
      .filter((entry) => entry.kind === 'skill' || entry.kind === 'prompt')
      .map((entry) => ({ ...entry })),

    setCustomizationEnabled: (uri, id, enabled) => {
      const found = CUSTOMIZATIONS.find((entry) => entry.id === id);
      if (!found) return;
      found.enabled = enabled;
      // A container carries its children with it, the way the host's own
      // resolution does - turning a plugin off turns off everything it
      // brought, whatever each child's own flag says.
      if (found.kind === 'plugin' || found.kind === 'directory') {
        for (const child of CUSTOMIZATIONS) {
          if (child.from === found.name) child.enabled = enabled;
        }
      }
      emit(uri, { type: 'status', status: statusOf(uri) });
    },

    detail: async (uri): Promise<SessionDetail> => {
      const chat = chats.get(uri) ?? null;
      const history = turns.get(uri) ?? [];
      const last = [...history, ...(active.get(uri) ? [active.get(uri) as Turn] : [])]
        .filter((turn) => turn.model).pop();
      return {
        resource: uri,
        chat,
        chats: chatsOf(uri),
        lifecycle: summaries.has(uri) ? 'ready' : 'creating',
        config: {
          properties: CONFIG,
          values: { permissionMode: 'default', isolation: 'workspace', ...(configs.get(uri) ?? {}) },
        },
        // The id a turn named, resolved against the catalogue - which is what
        // the live host does, and a fixture that answered a bare id would be
        // one where the screens were never asked to resolve anything.
        ...(last?.model ? { model: modelRow(last.model.id) } : {}),
        ...(summaries.get(uri)?.activity ? { activity: summaries.get(uri)?.activity as string } : {}),
      };
    },

    config: async (uri): Promise<SessionConfig> => ({
      properties: CONFIG,
      values: { permissionMode: 'default', isolation: 'workspace', ...(configs.get(uri) ?? {}) },
    }),

    setConfig: (uri, key, value) => {
      // One key, merged. Writing the whole object back is how a value another
      // client changed a moment ago is quietly reverted.
      configs.set(uri, { ...(configs.get(uri) ?? {}), [key]: value });
    },

    pump,

    drain: (limit = 5000) => {
      for (let i = 0; i < limit; i++) if (!pump()) break;
    },

    pending: () => script.length,

    dispatched: () => [...sent],

    invoked: () => [...invoked],

    /** What is being watched, so a screen closing can be seen to release it. */
    watching: () => [...watched],
  };
}
