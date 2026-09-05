/** Every command, and the argv reading that picks one. */

import { readFile } from 'node:fs/promises';
import { connect } from '../connect.js';
import { configPath, loadConfig } from '../config.js';
import type { Where } from '../connect.js';
import { ago, archived, branch, json, line, mark, project, table } from './render.js';
import type { HostConnection, HostEvent } from '../ahp/connection.js';
import { operate } from '../ahp/operate.js';
import type { Answer, ModelSelection, SessionUri, Turn } from '../ahp/types.js';

export const HELP = `ahpc - drive an agent host from a shell

  ahpc [--host ws://…] <command> [args]        the screen is 'ahpc' with no command

Sessions
  session list                 the catalogue, newest first   [--archived] [--json]
  session show <uri>           what the host says about one  [--full] [--json]
  session new                  start one   [--agent P] [--cwd DIR] [--set k=v]… [--json]
  session rm <uri>             dispose it
  session history <uri>        its turns               [--all] [--full] [--json]
  session config <uri>         the schema and what is in force        [--json]
  session set <uri> <k> <v>    change one config key
  session read <uri>           mark read                     [--unread]
  session archive <uri>        put it away                   [--undo]
  session customizations <uri> skills, prompts, agents, servers        [--json]
  session export <uri>         the whole session as one document
                               [--json] [--markdown]
  session toggle <uri> <id>    turn one on                   [--off]

Turns
  prompt <uri> <text>          say it and stream the answer  [--model M] [--json]
  exec <text>                  a session, one turn, and dispose it
                                       [--agent P] [--cwd DIR] [--model M] [--json]
  cancel <uri>                 stop the running turn
  queue <uri> <text>           say it after the one running  [--model M]
  unqueue <uri> <id>           take it back

Answering
  watch <uri>                  BLOCK until something wants a person, print, exit
                                       [--until turn|input|idle] [--timeout S] [--json]
  confirm <uri> <toolCallId>   approve a tool call           [--deny] [--option ID]
  answer <uri> <requestId>     answer a question      [--field k=v]… [--reject]

Chats
  chat list <uri>              the conversations in a session         [--json]
  chat new <uri> [text]        another one beside it
  chat rm <chatUri>            close one

The harness
  agents                       what it serves, and each one's models  [--json]
  models                       every model, by harness                [--json]
  commands                     what a slash offers                    [--json]
  customizations               skills, prompts, agents and MCP servers,
                               before any session exists     [--kind k] [--json]
  completions <uri> <text>     what the host would complete  [--offset N] [--json]

Changes and files
  changes <uri>                the files a session touched            [--json]
                               [--list] [--scope s] [--<variable> v]
                               [--reviewed f] [--unreviewed f]
                               [--operations]           what may be done to it
                               [--run id] [--file f] [--yes]      do one of them
                               [--list] every changeset it offers
                               [--scope <name>] one of them, e.g. turn
                               [--turnId <id>] what a chosen scope still needs
                               [--reviewed <file>] tick one off, repeatable
                               [--unreviewed <file>] and clear one
  content <uri> <file>         one of them, in full
  resource list <uri>          a directory the host serves            [--json]
  resource read <uri>          a file on the host
  resource stat <uri>          what it is, without reading it         [--json]
  resource write <uri> [file]  from a file, or from stdin      [--create-only]
  resource rm <uri>            delete it                        [--recursive]
  resource mkdir <uri>         make a directory
  resource mv <uri> <to>       move it                     [--fail-if-exists]
  resource cp <uri> <to>       copy it                     [--fail-if-exists]

Automations
  automation list              what runs on its own                   [--json]
  automation show <uri>        one of them                            [--json]
  automation triggers          what this host can trigger on          [--json]
  automation runs <uri>        its history, every page                [--json]
  automation run <uri>         start it now
  automation enable <uri>      switch it on
  automation disable <uri>     switch it off
  automation rm <uri>          forget it

Signing in
  auth                         what this host protects                [--json]
  auth <resource>              push a token   [--token T] [--expires-in S]
                               or set AHPC_TOKEN_<RESOURCE>, or pipe one in

Terminals
  terminal list                what is running                        [--json]
  terminal new                 open a shell        [--cwd DIR] [--name N]
  terminal rm <uri>            kill it
  terminal send <uri> <text>   type into it
  terminal watch <uri>         follow its output   [--timeout S]

Anything else
  dispatch <uri> <type>        send one action verbatim  [--field k=v]… [--chat]
  status                       what this client is connected to       [--json]
  help                         this

The host
  --host <url>    ws://host:port, or AHPC_HOST, or the config file
  --token <tkn>   a bearer token for it, or AHPC_TOKEN, or the config file
  --config-file   read this instead of the one below
  (none)          the scripted host, which needs nothing installed

Configuration
  config          where the file is, and what is in force  [--json]

Output is for reading. --json is the same answer for a program.
`;

/**
 * Flags, read the way agora reads them.
 *
 * A scan rather than a parser: every flag here is `--name value` or a bare
 * switch, and a dependency that handles more shapes than the CLI has would be
 * a dependency for its own sake.
 */
class Args {
  constructor(private readonly rest: string[]) {}
  /** The nth thing that is not a flag or a flag's value. */
  positional(index: number): string | undefined {
    const found: string[] = [];
    for (let i = 0; i < this.rest.length; i++) {
      const word = this.rest[i] as string;
      if (word.startsWith('--')) {
        if (!SWITCHES.has(word)) i++;
        continue;
      }
      found.push(word);
    }
    return found[index];
  }
  value(flag: string): string | undefined {
    const at = this.rest.indexOf(flag);
    return at >= 0 ? this.rest[at + 1] : undefined;
  }
  /** Every `--flag value` of one name, for the flags that repeat. */
  every(flag: string): string[] {
    const found: string[] = [];
    this.rest.forEach((word, index) => {
      if (word === flag && this.rest[index + 1] !== undefined) found.push(this.rest[index + 1] as string);
    });
    return found;
  }
  has(flag: string): boolean { return this.rest.includes(flag); }
  /** `--set k=v --set k2=v2`, as the record the host wants. */
  pairs(flag: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const pair of this.every(flag)) {
      const at = pair.indexOf('=');
      if (at <= 0) throw new Fault(`${flag} wants key=value, not ${pair}`);
      out[pair.slice(0, at)] = pair.slice(at + 1);
    }
    return out;
  }
}

/** Flags that take no value, so a positional after one is still a positional. */
const SWITCHES = new Set([
  '--json', '--full', '--all', '--archived', '--unread', '--undo', '--off', '--deny',
  '--reject', '--claude', '--chat',
  // The write half's own flags, which take no value: without them here a
  // positional after one is read as that flag's argument and disappears.
  '--create-only', '--recursive', '--fail-if-exists', '--publish-writable',
]);

/** A message for the person, not a stack trace. */
export class Fault extends Error {}

/**
 * Where the host is: a flag, then the environment, then the config file.
 *
 * In that order because each is more deliberate than the next. A flag is this
 * invocation, an environment variable is this shell, and a file is every
 * invocation until somebody edits it - so the narrower answer wins.
 */
const where = (args: Args): Where => {
  const file = loadConfig('ahpc', args.value('--config-file'));
  const host = args.value('--host') ?? process.env.AHPC_HOST ?? file.host;
  const token = args.value('--token') ?? process.env.AHPC_TOKEN ?? file.token;
  return {
    ...(host ? { host } : {}),
    ...(token ? { token } : {}),
    ...(args.value('--cwd') ? { path: args.value('--cwd') as string } : {}),
    // What this client serves back to the host, and whether the host may
    // write into it. Both off unless asked for.
    ...(args.value('--publish') ? { publish: args.value('--publish') as string } : {}),
    ...(args.has('--publish-writable') ? { publishWritable: true } : {}),
  };
};

/** A URI the command needs, said plainly when it is missing. */
/**
 * The model a command was told to run on, and what it was told to run it at.
 *
 * `--model sonnet --model-config thinkingLevel=high`, repeatable. The second
 * is `ModelSelection.config`, which is where the protocol says the answers to
 * a model's own `configSchema` go - so a level chosen on the command line
 * reaches the host the same way one chosen in the screen does.
 */
const selected = (args: Args): ModelSelection | undefined => {
  const id = args.value('--model');
  if (id === undefined) return undefined;
  const config: Record<string, string> = {};
  for (const pair of args.every('--model-config')) {
    const at = pair.indexOf('=');
    if (at > 0) config[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return { id, ...(Object.keys(config).length > 0 ? { config } : {}) };
};

const needs = (args: Args, index: number, what: string): string => {
  const found = args.positional(index);
  if (!found) throw new Fault(`This wants ${what}.`);
  return found;
};

/**
 * Watch one session until it does something, then stop watching.
 *
 * Every streaming command is this with a different stopping condition, so it
 * is written once. The subscription is always closed - a CLI that left one
 * open would be a process that never exits, which is the one thing a shell
 * cannot work around.
 */
function until(
  host: HostConnection,
  uri: SessionUri,
  done: (event: HostEvent) => boolean,
  options: { onEvent?(event: HostEvent): void; timeoutSeconds?: number } = {},
): Promise<HostEvent | undefined> {
  return new Promise((answer) => {
    let closed = false;
    /*
     * The handle may not exist yet when this runs.
     *
     * A host is entitled to deliver the opening snapshot *synchronously*
     * inside `subscribe` - the scripted one does, and it is the honest thing
     * for a host holding the state already - so a condition satisfied by that
     * first event fires before `subscribe` has returned anything to close.
     * Reading the handle there threw, which made every waiting command fail
     * against the scripted host and work against a socket, purely because one
     * of them answers a tick later.
     */
    let handle: { close(): void } | undefined;
    const finish = (event: HostEvent | undefined): void => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      handle?.close();
      answer(event);
    };
    const timer = setTimeout(
      () => finish(undefined),
      Math.max(1, (options.timeoutSeconds ?? 900)) * 1000,
    );
    timer.unref?.();
    handle = host.subscribe(uri, (event) => {
      options.onEvent?.(event);
      if (done(event)) finish(event);
    });
    // Already over, before there was a handle to close. Closing it now is what
    // `finish` could not do.
    if (closed) handle.close();
  });
}

/**
 * Ask again once the catalogue moves, for an answer that starts out empty.
 *
 * A harness enumerates its models once its host has asked one, and a host that
 * has just been started has not finished asking. An empty list is a real
 * answer - a harness nobody has signed into has none - so this waits for the
 * host to say something changed rather than for a fixed time, and gives up
 * quickly enough that the real empty answer is still prompt.
 */
async function settled<T>(
  host: HostConnection,
  ask: () => Promise<T[]>,
  seconds = 8,
): Promise<T[]> {
  const first = await ask();
  if (first.length > 0) return first;
  return await new Promise<T[]>((answer) => {
    const stop = (found: T[]): void => {
      clearTimeout(timer);
      watching.close();
      answer(found);
    };
    const timer = setTimeout(() => stop([]), seconds * 1000);
    timer.unref?.();
    const watching = host.onSessions(() => {
      void ask().then((found) => { if (found.length > 0) stop(found); }).catch(() => {});
    });
  });
}

/**
 * How many pages of history `--all` will walk.
 *
 * A bound rather than a promise: a conversation somebody has been having for
 * a year is one this would otherwise read to the end of before printing a
 * line, and stopping is better than appearing to hang.
 */
const PAGES = 100;

/** One session's snapshot, and nothing after it. */
const snapshot = async (host: HostConnection, uri: SessionUri): Promise<Extract<HostEvent, { type: 'snapshot' }> | undefined> => {
  const event = await until(host, uri, (e) => e.type === 'snapshot', { timeoutSeconds: 30 });
  return event?.type === 'snapshot' ? event : undefined;
};

/** A turn, as a line of prose rather than a tree of parts. */
const spoken = (turn: Turn): string => turn.parts
  .map((part) => (part.kind === 'markdown' ? part.content : ''))
  .join('')
  .trim();

/**
 * One command, and then the process is done.
 *
 * A switch rather than a registry: every branch is a few lines against
 * `HostConnection`, and the shape of the whole surface being readable in one
 * file is worth more than the indirection a registry would buy.
 */
export async function cli(command: string, rest: string[]): Promise<number> {
  const args = new Args(rest);
  const wants = args.has('--json');
  if (command === 'help' || args.has('--help')) { process.stdout.write(HELP); return 0; }

  /*
   * Answered before any connection, because it is not a question about one.
   *
   * `ahpc config` is what you run when the host cannot be reached and you want
   * to know which host it was trying - so needing a host to answer it would
   * make it useless exactly when it is wanted.
   */
  if (command === 'config') {
    const file = loadConfig('ahpc', args.value('--config-file'));
    const at = args.value('--config-file') ?? configPath('ahpc');
    if (wants) { json({ path: at, values: file }); return 0; }
    line(at);
    const rows = Object.entries(file).map(([key, value]) => [key, String(value)]);
    if (rows.length === 0) line('  (nothing set)');
    else table(rows);
    return 0;
  }

  const host = await connect(where(args));
  try {
    switch (command) {
      case 'status': {
        const rows = await host.listSessions().catch(() => []);
        if (wants) { json({ id: host.id, url: host.url, state: host.state(), sessions: rows.length }); break; }
        line(`${host.state()}  ${host.url || '(scripted host)'}`);
        line(`${rows.length} session(s)`);
        break;
      }

      case 'session': return await sessions(host, args, wants);
      case 'chat': return await chats(host, args, wants);
      case 'terminal': return await shells(host, args, wants);
      case 'resource': return await files(host, args, wants);

      case 'auth': return await signIn(host, args, wants);

      case 'automation': return await automation(host, args, wants);

      case 'agents': {
        const found = await settled(host, () => host.agents());
        if (wants) { json(found); break; }
        table(found.map((a) => [a.provider, a.displayName ?? '', `${a.models.length} model(s)`]));
        break;
      }
      case 'models': {
        // Settled on the models rather than the harnesses: a host advertises a
        // harness at once and its models when it has asked one.
        const found = await settled(host, async () => (await host.agents()).filter((a) => a.models.length > 0));
        if (wants) { json(found.flatMap((a) => a.models)); break; }
        // The levels a model takes, where it says. A model that takes one is
        // as worth saying as a model that takes five, and a column that is
        // empty for most rows is what a person scanning for the exception
        // reads.
        table(found.flatMap((a) => a.models.map((m) => [
          m.provider || a.provider,
          m.id,
          m.displayName,
          (m.options ?? []).flatMap((option) => option.values.map((one) => one.value)).join(' '),
        ])));
        break;
      }
      case 'commands': {
        const found = await host.harnessCommands();
        if (wants) { json(found); break; }
        table(found.map((c) => [`/${c.name}`, c.kind, c.description ?? '']));
        break;
      }
      /*
       * What every harness on this host offers, with no session anywhere.
       *
       * `session customizations` is the same list resolved against one
       * session's directory. This is the unresolved one, off the root channel,
       * and it is the only one answerable before somebody has decided which
       * agent to start - which is when a person picking a skill to open with
       * is asking.
       *
       * Settled on, because a harness is advertised at once and what it offers
       * arrives when its probe answers.
       */
      case 'customizations': {
        const kind = args.value('--kind');
        const found = await settled(host, async () => (await host.agents())
          .filter((agent) => (agent.customizations ?? []).length > 0));
        const rows = found.flatMap((agent) => (agent.customizations ?? [])
          .filter((one) => kind === undefined || one.kind === kind)
          .map((one) => ({ provider: agent.provider, ...one })));
        if (wants) { json(rows); break; }
        if (rows.length === 0) {
          line('This host advertises no customizations. A harness nobody has signed into offers none.');
          break;
        }
        table(rows.map((one) => [
          one.provider,
          one.kind,
          one.name,
          // The state is the half a list is read for: a server that needs
          // signing into looks exactly like a working one without it.
          one.state ?? (one.enabled ? 'on' : 'off'),
          // The first sentence, clipped. A skill's description is written for
          // a model deciding whether to load it and runs to a paragraph, which
          // in a table is one row pushing the next sixty off the screen.
          // `--json` is where the whole thing is.
          brief(one.description),
        ]));
        break;
      }
      case 'completions': {
        const uri = needs(args, 0, 'a session URI');
        const text = needs(args, 1, 'the text being typed');
        const offset = args.value('--offset');
        const found = await host.completions({
          channel: uri, text, ...(offset ? { offset: Number(offset) } : {}),
        });
        if (wants) { json(found); break; }
        table(found.map((c) => [c.insertText ?? '', c.label ?? '']));
        break;
      }

      case 'changes': {
        const uri = needs(args, 0, 'a session URI');
        const scopes = (await host.changesets?.(uri)) ?? [];

        /** What a scope is called, once the parts still to be filled in are gone. */
        const named = (template: string): string => template
          .replace(uri, '')
          .replace(/^\/changeset\//, '')
          .replace(/\/?\{\w+\}/g, '');

        if (args.has('--list')) {
          if (wants) { json(scopes); break; }
          if (scopes.length === 0) { line('This host advertises no changesets.'); break; }
          // The name to pass to --scope first, since that is what this
          // listing is read for.
          table(scopes.map((s) => [
            named(s.uriTemplate),
            s.variables.map((v) => `--${v}`).join(' '),
            s.reviewable ? 'reviewable' : '',
            s.label,
            s.description ?? '',
          ]));
          break;
        }

        /*
         * Which one, and what fills it in.
         *
         * A scope is chosen by label or by the tail of its template, because
         * those are what `--list` prints; the variables come from flags named
         * after them, which is the only mapping that survives the protocol
         * adding a template shape this client has never heard of.
         */
        const wantedName = args.value('--scope');
        const chosen = wantedName === undefined
          ? undefined
          : scopes.find((s) => s.label === wantedName
            || s.uriTemplate === wantedName
            || named(s.uriTemplate) === wantedName);
        if (wantedName !== undefined && !chosen) {
          throw new Fault(`No changeset called ${wantedName}. 'changes <uri> --list' says what there is.`);
        }

        let target: string | undefined;
        if (chosen) {
          target = chosen.uriTemplate;
          for (const variable of chosen.variables) {
            // `{turnId}` is filled from `--turnId`, and so is anything else
            // the protocol adds later without this needing to know it.
            const given = args.value(`--${variable}`);
            if (given === undefined) {
              throw new Fault(`${chosen.label} needs --${variable}. Its template is ${chosen.uriTemplate}.`);
            }
            target = target.replace(`{${variable}}`, given);
          }
        }

        /*
         * Ticking files off, which needs the changeset's own URI.
         *
         * So it is here rather than a command of its own: choosing which
         * changeset is the same question either way, and a second command
         * would have to ask it again.
         */
        const ticking = args.every('--reviewed').concat(args.every('--unreviewed'));
        if (ticking.length > 0) {
          if (!target) throw new Fault('Which changeset? --scope says, and --list says what there is.');
          if (!host.review) throw new Fault('This host connection cannot mark files reviewed.');
          const on = args.every('--reviewed');
          const off = args.every('--unreviewed');
          // Whole `file://` URIs are what a row's id is, and what this prints,
          // so a path typed as it was printed is accepted too.
          const idOf = (one: string): string => (one.startsWith('file://') ? one : `file://${one}`);
          if (on.length > 0) host.review(target, on.map(idOf), true);
          if (off.length > 0) host.review(target, off.map(idOf), false);
          await host.flush?.();
        }

        /*
         * Running one of the verbs the changeset advertises.
         *
         * Here rather than a command of its own for the same reason ticking is:
         * choosing which changeset is the same question, and a second command
         * would ask it again. `--run` names an id from `--operations`, and
         * `--file` points it at a row where the operation is not
         * changeset-wide.
         */
        const running = args.value('--run');
        if (running !== undefined) {
          if (!target) throw new Fault('Which changeset? --scope says, and --list says what there is.');
          if (!host.invoke) throw new Fault('This host connection cannot run changeset operations.');
          const set = await host.changes(uri, target);
          const one = (set.operations ?? []).find((op) => op.id === running);
          if (!one) {
            throw new Fault(`No operation called ${running} on that changeset.`
              + ` It offers ${(set.operations ?? []).map((op) => op.id).join(', ') || 'none'}.`);
          }
          if (one.status === 'disabled') throw new Fault(`${one.label} is disabled right now, probably because a turn is running.`);
          const file = args.value('--file');
          const needsFile = !one.scopes.includes('changeset');
          if (needsFile && file === undefined) throw new Fault(`${one.label} acts on one file. Pass --file.`);
          // The protocol says a client MUST show the confirmation before
          // invoking. In a shell that means saying it and requiring the person
          // to have meant it.
          if (one.confirmation !== undefined && !args.has('--yes')) {
            throw new Fault(`${one.confirmation}\nPass --yes to go ahead.`);
          }
          const done = await operate(host, target, running, {
            ...(needsFile || file !== undefined
              ? {
                target: {
                  kind: 'resource' as const,
                  resource: file?.startsWith('file://') === true ? file : `file://${file ?? ''}`,
                },
              }
              : {}),
            /*
             * A shell says what it is about to do and does it.
             *
             * `--yes` has already been required for anything the host called
             * destructive, so the person has said so once; making them say it
             * twice for the *permission* would be asking about the plumbing
             * rather than about the act. What is not silent is the fact that
             * access was taken, which is printed.
             */
            ask: (request) => {
              line(`Asking ${request.uri} for write access.`);
              return true;
            },
          });
          await host.flush?.();
          if (wants) { json(done); break; }
          line(done.message ?? `${one.label} done.`);
          break;
        }

        const found = await host.changes(uri, target);
        if (wants) { json(found); break; }

        if (args.has('--operations')) {
          const offered = found.operations ?? [];
          if (offered.length === 0) { line('This changeset offers nothing to do to it.'); break; }
          // The status is the half worth having: a verb that cannot be pressed
          // right now looks exactly like one that can without it.
          table(offered.map((op) => [
            op.id,
            op.status,
            op.scopes.join('/'),
            op.confirmation !== undefined ? 'asks first' : '',
            op.label,
            brief(op.error?.message ?? op.description),
          ]));
          break;
        }

        if (found.files.length === 0) { line('No changes.'); break; }
        // Creation and deletion are the absences, which is how the protocol
        // says them: no `before` is new, no `after` is gone.
        table(found.files.map((f) => [
          f.reviewed ? '\u2713' : ' ',
          f.before === undefined ? 'new' : f.after === undefined ? 'gone' : 'edit',
          `+${f.diff.added} -${f.diff.removed}`,
          f.uri.replace(/^file:\/\//, ''),
        ]));
        break;
      }
      case 'content': {
        const uri = needs(args, 0, 'a session URI');
        const wanted = needs(args, 1, 'a file in it');
        const set = await host.changes(uri);
        // Matched on the path a person would type, not the whole `file://`
        // URI: the changes listing prints the short form, and what it prints
        // is what can be pasted back in.
        const edit = set.files.find((f) => f.uri === wanted || f.uri.endsWith(`/${wanted}`));
        if (!edit) throw new Fault(`No file called ${wanted} in that changeset.`);
        const ref = edit.content?.after ?? edit.content?.before;
        if (!ref) throw new Fault('The host kept no content for that file.');
        const found = await host.content(ref);
        if (wants) { json(found); break; }
        line(found.text);
        break;
      }

      case 'prompt': case 'exec': case 'cancel': case 'queue': case 'unqueue':
      case 'watch': case 'confirm': case 'answer': case 'dispatch':
        return await turns(host, command, args, wants);

      default:
        process.stderr.write(`No command called ${command}. Try 'ahpc help'.\n`);
        return 2;
    }
    return 0;
  }
  finally {
    // Sent, then hung up. A command that dispatches one action and exits is
    // the only caller that can close a connection faster than its own
    // dispatch leaves it.
    await host.flush?.();
    await host.close?.();
  }
}

/** Everything under `session`. */
async function sessions(host: HostConnection, args: Args, wants: boolean): Promise<number> {
  const verb = args.positional(0) ?? 'list';
  const uri = args.positional(1) as SessionUri | undefined;

  if (verb === 'list') {
    const rows = (await host.listSessions())
      .filter((s) => args.has('--archived') || !archived(s.status))
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    if (wants) { json(rows); return 0; }
    // Empty is a sentence. An empty table is indistinguishable from a table
    // that failed to draw.
    if (rows.length === 0) { line('No sessions.'); return 0; }
    table(rows.map((s) => [
      mark(s.status),
      s.title.slice(0, 44),
      [project(s), branch(s)].filter(Boolean).join(' '),
      ago(s.modifiedAt),
      s.resource,
    ]));
    return 0;
  }

  if (verb === 'new') {
    const provider = args.value('--agent') ?? (await host.agents())[0]?.provider;
    if (!provider) throw new Fault('This host advertises no harness to start one on.');
    const made = await host.createSession({
      provider,
      ...(args.value('--cwd') ? { workingDirectory: args.value('--cwd') as string } : {}),
      ...(Object.keys(args.pairs('--set')).length ? { config: args.pairs('--set') } : {}),
    });
    if (wants) json({ resource: made }); else line(made);
    return 0;
  }

  if (!uri) throw new Fault(`'session ${verb}' wants a session URI.`);

  switch (verb) {
    case 'show': {
      const detail = await host.detail(uri);
      if (args.has('--full') || wants) { json(detail); return 0; }
      const row = (await host.listSessions()).find((s) => s.resource === uri);
      table([
        ['Session', uri],
        ['Title', row?.title ?? ''],
        ['Status', row ? mark(row.status) : ''],
        ['Project', row ? [project(row), branch(row)].filter(Boolean).join('  ') : ''],
        ['Workspace', (row?.workingDirectories ?? []).map((d) => d.replace(/^file:\/\//, '')).join(', ')],
        ['Chat', detail.chat ?? ''],
        ['Model', detail.model ? [detail.model.displayName, detail.model.id].filter(Boolean).join('  ') : ''],
        ['Updated', row ? ago(row.modifiedAt) : ''],
      ].filter(([, value]) => value !== ''));
      return 0;
    }
    case 'rm': await host.disposeSession(uri); line(`Disposed ${uri}.`); return 0;
    case 'read': host.setRead(uri, !args.has('--unread')); return 0;
    case 'archive': host.setArchived(uri, !args.has('--undo')); return 0;
    case 'config': {
      const config = await host.config(uri);
      if (wants) { json(config); return 0; }
      table(Object.entries(config.values).map(([key, value]) => [key, String(value)]));
      return 0;
    }
    case 'set': {
      const key = needs(args, 2, 'a config key');
      const value = needs(args, 3, 'a value for it');
      host.setConfig(uri, key, value);
      return 0;
    }
    case 'history': {
      /*
       * Everything the host will give, when asked for it.
       *
       * A snapshot is a tail window on one host and nothing at all on
       * another, so without this the command prints whatever happened to
       * arrive - which against a host that sends no turns is an empty list
       * and no sign that a conversation is there. Bounded, because `--all` is
       * a person asking for a long read and not for an unbounded one.
       */
      if (args.has('--all')) {
        for (let page = 0; page < PAGES; page += 1) {
          if (!await host.loadOlderTurns(uri)) break;
        }
      }
      const shot = await snapshot(host, uri);
      if (!shot) throw new Fault('The host sent no snapshot for that session.');
      const all = [...shot.turns, ...(shot.active ? [shot.active] : [])];
      if (wants || args.has('--full')) { json(all); return 0; }
      for (const turn of all) {
        line(`${turn.role === 'user' ? '›' : '‹'} ${turn.role}  ${ago(turn.at)}  ${turn.state}`);
        const text = turn.role === 'user' ? (turn.message ?? '') : spoken(turn);
        if (text) line(`  ${text.replace(/\n/g, '\n  ')}`);
        line();
      }
      return 0;
    }
    case 'customizations': {
      const found = await host.customizations(uri);
      if (wants) { json(found); return 0; }
      table(found.map((c) => [c.enabled ? 'on' : 'off', c.kind, c.name, c.description ?? '']));
      return 0;
    }
    /*
     * The whole session, as one document.
     *
     * Everything here could already be read one command at a time and never
     * together, so there was no way to hand somebody a session, keep one after
     * a host is gone, or diff two. This is assembly rather than anything new -
     * `show`, `history`, `customizations` and `changes`, fetched in parallel
     * and written out once.
     *
     * There is no import, and that is not an omission. Nothing in the protocol
     * carries a turn *into* a host: `createSession` starts an empty one and
     * every turn after it is the agent's own work. So a session read out of a
     * host cannot be put back into another, and a command that pretended
     * otherwise would be the worst thing here.
     */
    case 'export': {
      const [detail, shot, custom, rows] = await Promise.all([
        host.detail(uri),
        snapshot(host, uri),
        host.customizations(uri).catch(() => []),
        host.listSessions().catch(() => []),
      ]);
      const row = rows.find((one) => one.resource === uri);
      const turns = [...(shot?.turns ?? []), ...(shot?.active ? [shot.active] : [])];

      /*
       * Every changeset the host will answer for, not only the default one.
       *
       * A scope still carrying `{turnId}` is skipped rather than guessed at:
       * an export that filled a template with the first turn id it saw would
       * be putting a diff in the document that nobody asked about.
       */
      const scopes = (await host.changesets?.(uri).catch(() => [])) ?? [];
      const sets = await Promise.all(scopes
        .filter((scope) => scope.variables.length === 0)
        .map(async (scope) => ({
          label: scope.label,
          uri: scope.uriTemplate,
          changes: await host.changes(uri, scope.uriTemplate).catch(() => undefined),
        })));

      const document = {
        exportedAt: new Date().toISOString(),
        host: { url: host.url },
        session: { resource: uri, ...(row ?? {}), detail },
        turns,
        customizations: custom,
        changesets: sets.filter((one) => one.changes !== undefined),
      };
      if (!args.has('--markdown')) { json(document); return 0; }

      // The readable form, which is what somebody actually pastes into a
      // ticket. One heading per turn, and the diffs as counts rather than
      // bodies - a changeset of forty files would otherwise bury the
      // conversation the document is about.
      line(`# ${row?.title ?? uri}`);
      line();
      line(`- Session: \`${uri}\``);
      if (row?.provider) line(`- Harness: ${row.provider}`);
      if (detail.model) line(`- Model: ${detail.model.displayName} (\`${detail.model.id}\`)`);
      if (row?.workingDirectories?.length) {
        line(`- Workspace: ${row.workingDirectories.map((d) => d.replace(/^file:\/\//, '')).join(', ')}`);
      }
      line(`- Exported: ${document.exportedAt}`);
      line();
      for (const turn of turns) {
        const text = turn.role === 'user' ? (turn.message ?? '') : spoken(turn);
        // The model and what it was asked for. An export that named the model
        // and not the thinking level recorded half of what produced the answer
        // underneath it.
        const asked = turn.model
          ? [turn.model.id, ...Object.values(turn.model.config ?? {})].join(', ')
          : '';
        line(`## ${turn.role === 'user' ? 'Said' : 'Answered'}${asked ? ` (${asked})` : ''}`);
        line();
        if (text) { line(text); line(); }
      }
      for (const set of sets) {
        if (!set.changes || set.changes.files.length === 0) continue;
        line(`## ${set.label}`);
        line();
        for (const file of set.changes.files) {
          const kind = file.before === undefined ? 'new' : file.after === undefined ? 'gone' : 'edit';
          line(`- \`${file.uri.replace(/^file:\/\//, '')}\` — ${kind}, +${file.diff.added} -${file.diff.removed}`);
        }
        line();
      }
      return 0;
    }
    case 'toggle': {
      const id = needs(args, 2, 'a customization id');
      host.setCustomizationEnabled(uri, id, !args.has('--off'));
      return 0;
    }
    default: throw new Fault(`No 'session ${verb}'. Try 'ahpc help'.`);
  }
}

/**
 * One line of a description, short enough to sit in a column.
 *
 * Skill descriptions are written for a model choosing whether to load one, so
 * they run to a paragraph and carry newlines. `--json` is the whole answer;
 * this is the one a person reads down.
 */
const brief = (text: string | undefined, width = 72): string => {
  if (!text) return '';
  const line_ = text.split('\n')[0]?.trim() ?? '';
  return line_.length > width ? `${line_.slice(0, width - 1)}…` : line_;
};

/** Everything under `chat`. */
async function chats(host: HostConnection, args: Args, wants: boolean): Promise<number> {
  const verb = args.positional(0) ?? 'list';
  const uri = args.positional(1);
  if (!uri) throw new Fault(`'chat ${verb}' wants a URI.`);

  if (verb === 'list') {
    const event = await until(host, uri as SessionUri, (e) => e.type === 'chats', { timeoutSeconds: 30 });
    const items = event?.type === 'chats' ? event.items : [];
    if (wants) { json(items); return 0; }
    if (items.length === 0) { line('One chat, and the host says nothing more about it.'); return 0; }
    table(items.map((c) => [c.resource, c.title]));
    return 0;
  }
  if (verb === 'new') {
    const made = await host.createChat(uri as SessionUri, args.positional(2));
    if (wants) json({ resource: made }); else line(made);
    return 0;
  }
  if (verb === 'rm') { await host.disposeChat(uri); line(`Closed ${uri}.`); return 0; }
  throw new Fault(`No 'chat ${verb}'. Try 'ahpc help'.`);
}

/** Everything under `terminal`. */
async function shells(host: HostConnection, args: Args, wants: boolean): Promise<number> {
  const verb = args.positional(0) ?? 'list';

  if (verb === 'list') {
    const rows = await host.terminals();
    if (wants) { json(rows); return 0; }
    if (rows.length === 0) { line('No terminals.'); return 0; }
    table(rows.map((r) => [r.resource, r.title ?? '']));
    return 0;
  }
  if (verb === 'new') {
    const made = await host.createTerminal({
      ...(args.value('--cwd') ? { cwd: args.value('--cwd') as string } : {}),
      ...(args.value('--name') ? { name: args.value('--name') as string } : {}),
    });
    if (wants) json({ resource: made }); else line(made);
    return 0;
  }

  const uri = args.positional(1);
  if (!uri) throw new Fault(`'terminal ${verb}' wants a terminal URI.`);
  if (verb === 'rm') { await host.disposeTerminal(uri); line(`Closed ${uri}.`); return 0; }
  if (verb === 'send') {
    // A newline, because a shell over pipes runs a line rather than a string,
    // and `terminal send ls` that never runs reads as a terminal that is broken.
    host.writeTerminal(uri, `${needs(args, 2, 'something to type')}\n`);
    return 0;
  }
  if (verb === 'watch') {
    let last = '';
    await new Promise<void>((done) => {
      const timer = setTimeout(() => { handle.close(); done(); },
        Math.max(1, Number(args.value('--timeout') ?? 30)) * 1000);
      timer.unref?.();
      const handle = host.watchTerminal(uri, (state) => {
        // Only what is new. The state carries the whole buffer each time, and
        // re-printing it per event is the same output over and over.
        const text = state.output ?? '';
        if (text.startsWith(last)) process.stdout.write(text.slice(last.length));
        else process.stdout.write(text);
        last = text;
        if (state.exitCode !== undefined) { clearTimeout(timer); handle.close(); done(); }
      });
    });
    return 0;
  }
  throw new Fault(`No 'terminal ${verb}'. Try 'ahpc help'.`);
}

/** Everything under `resource`. */
async function files(host: HostConnection, args: Args, wants: boolean): Promise<number> {
  const verb = args.positional(0) ?? 'list';
  const uri = needs(args, 1, 'a file:// URI on the host');
  if (!host.resourceList || !host.resourceRead) {
    throw new Fault('This host serves no filesystem. A host is given one, and this one was not.');
  }
  if (verb === 'list') {
    const found = await host.resourceList(uri);
    if (wants) { json(found); return 0; }
    if (found.length === 0) { line('Nothing there.'); return 0; }
    // Directories first, then by name: a listing is navigated downwards before
    // it is read across.
    const sorted = [...found].sort((a, b) => (a.kind === b.kind
      ? a.name.localeCompare(b.name)
      : a.kind === 'directory' ? -1 : 1));
    table(sorted.map((e) => [e.kind === 'directory' ? 'dir' : '', e.name, e.size === undefined ? '' : String(e.size)]));
    return 0;
  }
  if (verb === 'read') {
    const found = await host.resourceRead(uri);
    if (wants) { json(found); return 0; }
    // Bytes as bytes, so `ahpc resource read … > out.png` is a file rather
    // than a screenful of base64.
    if (found.encoding === 'base64') process.stdout.write(Buffer.from(found.data, 'base64'));
    else line(found.data);
    return 0;
  }
  if (verb === 'stat') {
    if (!host.resourceResolve) throw new Fault('This host does not resolve paths.');
    const found = await host.resourceResolve(uri);
    if (wants) { json(found); return 0; }
    table([
      ['Uri', found.uri],
      ['Type', found.type],
      ...(found.size === undefined ? [] : [['Size', String(found.size)]]),
      ...(found.mtime === undefined ? [] : [['Modified', found.mtime]]),
    ]);
    return 0;
  }
  if (verb === 'write') {
    if (!host.resourceWrite) throw new Fault('This host serves no writable filesystem.');
    // From a file, or from stdin: `ahpc resource write <uri> < thing` is how
    // this gets used, and a second positional is the convenience.
    const from = args.positional(2);
    const data = from === undefined ? await readAll(process.stdin) : await readFile(from, 'utf8');
    await host.resourceWrite(uri, data, {
      ...(args.has('--create-only') ? { createOnly: true } : {}),
    });
    return 0;
  }
  if (verb === 'rm') {
    if (!host.resourceDelete) throw new Fault('This host serves no writable filesystem.');
    await host.resourceDelete(uri, { ...(args.has('--recursive') ? { recursive: true } : {}) });
    return 0;
  }
  if (verb === 'mkdir') {
    if (!host.resourceMkdir) throw new Fault('This host serves no writable filesystem.');
    await host.resourceMkdir(uri);
    return 0;
  }
  if (verb === 'mv' || verb === 'cp') {
    const move = host.resourceMove;
    const copy = host.resourceCopy;
    if (!move || !copy) throw new Fault('This host serves no writable filesystem.');
    const to = needs(args, 2, 'somewhere to put it');
    const options = { ...(args.has('--fail-if-exists') ? { failIfExists: true } : {}) };
    await (verb === 'mv' ? move(uri, to, options) : copy(uri, to, options));
    return 0;
  }
  throw new Fault(`No 'resource ${verb}'. Try 'ahpc help'.`);
}

/**
 * Automations, from a script.
 *
 * The point of an automation is doing something without a person present, so a
 * feature only a screen can reach is the wrong shape for it. Every verb here
 * is one the seam already had; `triggers` and `runs` are the two the screen
 * never asked for either.
 */
async function automation(host: HostConnection, args: Args, wants: boolean): Promise<number> {
  const verb = args.positional(0) ?? 'list';
  if (!host.automations) throw new Fault('This host serves no automations.');

  if (verb === 'list') {
    const found = await host.automations();
    if (wants) { json(found); return 0; }
    table(found.map((one) => [
      one.enabled ? 'on' : 'off',
      one.title,
      one.schedule?.expression ?? '',
      one.nextRunAt ?? '',
      one.resource,
    ]));
    return 0;
  }
  if (verb === 'triggers') {
    if (!host.automationTriggers) throw new Fault('This host does not say which triggers it has.');
    const found = await host.automationTriggers();
    if (wants) { json(found); return 0; }
    table(found.map((one) => [one.kind, one.title ?? '', one.description ?? '']));
    return 0;
  }

  const uri = needs(args, 1, 'an automation URI');
  if (verb === 'show') {
    const found = (await host.automations()).find((one) => one.resource === uri);
    if (!found) throw new Fault(`No automation at ${uri}.`);
    if (wants) { json(found); return 0; }
    table([
      ['Title', found.title],
      ['Enabled', found.enabled ? 'yes' : 'no'],
      ['Schedule', found.schedule?.expression ?? ''],
      ['Zone', found.schedule?.timeZone ?? ''],
      ['Next run', found.nextRunAt ?? ''],
      ['Operations', found.operations.join(', ')],
    ].filter(([, value]) => value !== ''));
    return 0;
  }
  if (verb === 'runs') {
    if (!host.automationRuns) throw new Fault('This host does not page run history.');
    // Every page, because a cursor is the host's and a caller should not have
    // to hold one to read a history.
    const rows: { resource: string; status: string; startedAt?: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await host.automationRuns(uri, cursor);
      rows.push(...page.runs);
      cursor = page.nextCursor;
    } while (cursor !== undefined && rows.length < 500);
    if (wants) { json(rows); return 0; }
    table(rows.map((one) => [one.status, one.startedAt ?? '', one.resource]));
    return 0;
  }
  if (verb === 'run') {
    if (!host.runAutomation) throw new Fault('This host will not start an automation.');
    await host.runAutomation(uri);
    return 0;
  }
  if (verb === 'enable' || verb === 'disable') {
    if (!host.setAutomationEnabled) throw new Fault('This host will not switch an automation.');
    await host.setAutomationEnabled(uri, verb === 'enable');
    return 0;
  }
  if (verb === 'rm') {
    if (!host.removeAutomation) throw new Fault('This host will not remove an automation.');
    // The host revalidates, and asking first is what the specification says a
    // client SHOULD do: an automation that does not advertise `remove` is one
    // this refuses rather than one the host refuses.
    const found = (await host.automations()).find((one) => one.resource === uri);
    if (found && !found.operations.includes('remove')) {
      throw new Fault(`${uri} does not offer removal.`);
    }
    await host.removeAutomation(uri);
    return 0;
  }
  throw new Fault(`No 'automation ${verb}'. Try list, show, triggers, runs, run, enable, disable, rm.`);
}

/**
 * A token for one of the host's protected resources.
 *
 * `ahpc auth` lists what the host protects; `ahpc auth <resource>` pushes a
 * token for one. The token comes from `--token`, then an environment variable
 * named after the resource, then standard input - a flag is this invocation, a
 * variable is this shell, and neither puts a credential in shell history the
 * way a positional argument would.
 */
async function signIn(host: HostConnection, args: Args, wants: boolean): Promise<number> {
  if (!host.protectedResources || !host.authenticate) {
    throw new Fault('This host serves no protected resources.');
  }
  const known = await host.protectedResources();
  const resource = args.positional(0);
  if (resource === undefined) {
    if (wants) { json(known); return 0; }
    if (known.length === 0) { line('This host protects nothing.'); return 0; }
    table(known.map((one) => [one.resource, one.description ?? '']));
    return 0;
  }
  const token = args.value('--token')
    ?? process.env[tokenVariable(resource)]
    ?? (process.stdin.isTTY ? undefined : (await readAll(process.stdin)).trim());
  if (token === undefined) {
    throw new Fault(`No token. Pass --token, set ${tokenVariable(resource)}, or pipe one in.`);
  }
  // An expiry is only sent when it is known and is a positive integer, which
  // is what the specification requires of it.
  const expires = Number(args.value('--expires-in') ?? '');
  await host.authenticate(resource, token, {
    ...(Number.isInteger(expires) && expires > 0 ? { expiresIn: expires } : {}),
  });
  return 0;
}

/**
 * The environment variable a resource's token is read from.
 *
 * Derived from the resource rather than fixed, because a host may protect
 * several and one variable for all of them is one credential for all of them:
 * `https://api.anthropic.com` becomes `AHPC_TOKEN_API_ANTHROPIC_COM`.
 */
function tokenVariable(resource: string): string {
  const name = resource.replace(/^[a-z]+:\/\//, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `AHPC_TOKEN_${name.toUpperCase()}`;
}

/** Everything on a stream, for the write that takes its content from a pipe. */
async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
}

/** Prompts, approvals, and the escape hatch. */
async function turns(host: HostConnection, command: string, args: Args, wants: boolean): Promise<number> {
  /**
   * Stream a turn to stdout and answer with the finished one.
   *
   * Written against **snapshots**, because that is what a live host sends. Its
   * `subscribe` re-emits the whole state on every action rather than turning
   * each one into a delta - the reducers are the authority on what the state
   * is now, and a second hand-written path from action to screen would be a
   * second answer to the same question. So "what is new" is the part of the
   * running turn not yet printed, which is a length rather than an event.
   */
  const run = async (uri: SessionUri, text: string): Promise<Turn | undefined> => {
    let printed = 0;
    let sawActive = false;
    let before = new Set<string>();
    let first = true;
    let noted: string | undefined;
    let answer: Turn | undefined;

    // Subscribed before saying anything: the first snapshot is the baseline
    // that says which turns were already there, and one taken afterwards
    // would count the new turn among them.
    const finished = until(host, uri, (event) => {
      if (event.type !== 'snapshot') return false;
      if (first) { first = false; before = new Set(event.turns.map((turn) => turn.id)); }

      if (event.active) {
        sawActive = true;
        if (!wants) {
          const now = spoken(event.active);
          if (now.length > printed) { process.stdout.write(now.slice(printed)); printed = now.length; }
          // On stderr, so a pipe still gets only the answer while a person
          // watching sees why it stopped.
          const call = event.active.parts.find((part) => part.kind === 'toolCall'
            && part.call.status === 'pending-confirmation');
          if (call?.kind === 'toolCall' && noted !== call.call.id) {
            noted = call.call.id;
            process.stderr.write(`  · waiting on ${call.call.name}  ${call.call.id}\n`);
          }
        }
        return false;
      }
      // Something wants a person. Not finished, and not this command's to answer.
      if (event.input) return false;

      // Nothing running. Done once a turn of *ours* has finished - one that
      // was not in the baseline, rather than merely the last in the list.
      const fresh = event.turns.filter((turn) => turn.role === 'agent' && !before.has(turn.id));
      if (!sawActive && fresh.length === 0) return false;
      answer = fresh[fresh.length - 1];
      return true;
    }, { timeoutSeconds: Number(args.value('--timeout') ?? 900) });

    host.say(uri, text, selected(args));
    await finished;
    if (!wants && printed > 0) line();
    return answer;
  };

  switch (command) {
    case 'prompt': {
      const uri = needs(args, 0, 'a session URI') as SessionUri;
      const turn = await run(uri, needs(args, 1, 'something to say'));
      if (wants) json(turn ?? { state: 'timeout' });
      return turn?.state === 'complete' ? 0 : 1;
    }
    case 'exec': {
      const text = needs(args, 0, 'something to say');
      const provider = args.value('--agent') ?? (await host.agents())[0]?.provider;
      if (!provider) throw new Fault('This host advertises no harness to start one on.');
      const uri = await host.createSession({
        provider,
        ...(args.value('--cwd') ? { workingDirectory: args.value('--cwd') as string } : {}),
      });
      try {
        const turn = await run(uri, text);
        if (wants) json(turn ?? { state: 'timeout' });
        return turn?.state === 'complete' ? 0 : 1;
      }
      finally {
        // One turn, and then it is gone - which is what makes this the
        // one-shot rather than `session new` followed by `prompt`.
        await host.disposeSession(uri).catch(() => {});
      }
    }
    case 'cancel': host.stopTurn(needs(args, 0, 'a session URI') as SessionUri); return 0;
    case 'queue': {
      const uri = needs(args, 0, 'a session URI') as SessionUri;
      host.queue(uri, needs(args, 1, 'something to say'), selected(args));
      return 0;
    }
    case 'unqueue': {
      const uri = needs(args, 0, 'a session URI') as SessionUri;
      host.unqueue(uri, needs(args, 1, 'a queued message id'));
      return 0;
    }

    case 'watch': {
      const uri = needs(args, 0, 'a session URI') as SessionUri;
      const stop = args.value('--until') ?? 'input';
      let first = true;
      // What "done" means, so a script can wait for the thing it will act on:
      // an approval to give, an answer to read, or simply quiet. Read off the
      // snapshot, because that is the only event a live host sends.
      const reached = (event: HostEvent): boolean => {
        if (event.type !== 'snapshot') return false;
        /*
         * Whether the state it arrived in counts.
         *
         * Two of these are *conditions* and one is an event. A session that is
         * already quiet satisfies "block until it is quiet", and one that is
         * already waiting on a person satisfies "block until something wants
         * a person" - a pending input is not the past, it is still pending,
         * and skipping it means a script hangs on exactly the approval it was
         * started to give.
         *
         * `turn` is the event: a finished turn in the opening snapshot is
         * history, and returning it would answer about the turn before this
         * one.
         */
        const opening = first;
        first = false;
        if (stop === 'idle') return event.active === undefined && event.input === undefined;
        if (stop === 'input') return event.input !== undefined;
        if (opening) return false;
        return event.active === undefined && event.turns.length > 0;
      };
      const event = await until(host, uri, reached, {
        timeoutSeconds: Number(args.value('--timeout') ?? 900),
      });
      if (!event || event.type !== 'snapshot') {
        process.stderr.write('Nothing happened before the timeout.\n');
        return 1;
      }
      if (wants) { json(event); return 0; }
      const input = event.input;
      if (input?.kind === 'toolConfirmation') line(`tool  ${input.call.id}  ${input.call.name}`);
      else if (input?.kind === 'chatInput') line(`question  ${input.id}  ${input.message}`);
      else {
        const last = event.turns[event.turns.length - 1];
        line(last ? spoken(last) : 'idle');
      }
      return 0;
    }

    case 'confirm': {
      const uri = needs(args, 0, 'a session URI') as SessionUri;
      const call = needs(args, 1, 'a tool call id');
      host.confirmToolCall(uri, call, !args.has('--deny'), args.value('--option'));
      return 0;
    }
    case 'answer': {
      const uri = needs(args, 0, 'a session URI') as SessionUri;
      const request = needs(args, 1, 'an input request id');
      // Everything arrives as text, because argv is text. A host that wanted a
      // number said so in its schema, and guessing here would send `1` for the
      // answer "1" to a question that asked for a name.
      const answers: Record<string, Answer> = {};
      for (const [key, value] of Object.entries(args.pairs('--field'))) {
        answers[key] = { kind: 'text', value } as Answer;
      }
      host.completeInput(uri, request, !args.has('--reject'), answers);
      return 0;
    }

    case 'dispatch': {
      const uri = needs(args, 0, 'a session URI') as SessionUri;
      const type = needs(args, 1, 'an action type, e.g. session/isReadChanged');
      if (!host.dispatch) {
        throw new Fault('This host connection sends no raw actions. Only a live host does.');
      }
      const action: Record<string, unknown> = { type };
      for (const [key, value] of Object.entries(args.pairs('--field'))) {
        // `true`, `false` and numbers as themselves; everything else as text.
        // An action field is typed by the protocol, and sending "true" where a
        // boolean belongs is a dispatch the host quietly ignores.
        action[key] = value === 'true' ? true : value === 'false' ? false
          : /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
      }
      host.dispatch(uri, action, args.has('--chat'));
      if (wants) json(action);
      return 0;
    }

    default: throw new Fault(`No command called ${command}.`);
  }
}
