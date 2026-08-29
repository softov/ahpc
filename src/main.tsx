#!/usr/bin/env node
import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import { writeFile } from 'node:fs/promises';
import {
  bufferToSvg, createNodeTerminal, createWriter, renderStill,
} from '@textui/terminal';
import { registerChat } from './app.js';
import { CONTROLLER } from './control.js';
import { fakeHost } from './ahp/fake.js';
import { MissingProtocolPackage, liveHost } from './ahp/live.js';
import { MissingAgentSdk, claudeHost } from './ahp/claude.js';
import type { HostConnection } from './ahp/connection.js';
import { HOST_ERROR } from './state.js';

/**
 * The entry point.
 *
 * Split from `app.tsx` so the example can be *mounted* without being *run*.
 * What is here and not there: the terminal, the quit key, and the clock - the
 * scripted host is driven by a timer here and by a test's own loop there,
 * which is what makes streaming testable at all.
 */

interface Options {
  static_: boolean;
  width: number;
  height: number;
  unicode?: UnicodeLevel;
  colors?: number;
  /** Milliseconds a scripted word takes to arrive. */
  tick: number;
  /** Run the script to the end before the first frame, for a still. */
  settled: boolean;
  /** Or exactly this many scripted words, for a still of a turn mid-flight. */
  pump?: number;
  /**
   * Write the still as an SVG here instead of ANSI on stdout.
   *
   * The form a still can be *looked at* in - a README, the docs, a pull
   * request. An `.ans` file is only a screenshot on a terminal, so the places
   * that most want to show what this looks like are the ones that cannot
   * replay one.
   */
  svg?: string;
  screen: string;
  session?: string;
  theme: string;
  shell: string;
  /** Say something on the open session before the frame is taken. */
  say?: string;
  /** Answer the confirmation the script stops at, to reach the question. */
  approve: boolean;
  /** ...and then answer the question, to reach the end of the turn. */
  answer: boolean;
  /**
   * A real host: `ws://127.0.0.1:9187`, or wherever the editor advertises one.
   *
   * Left off, the scripted host runs - which is the point of the seam. The
   * fake is for driving a shape on purpose (a blocked confirmation, a failing
   * turn, a question) and the real one is for finding out what a host actually
   * sends. Nothing above `HostConnection` knows which is which.
   */
  host?: string;
  token?: string;
  /**
   * Claude Code, in this process, through the Agent SDK.
   *
   * The third host. `--host` is somebody else's editor and this is the agent
   * itself, and the seam is what makes them the same application.
   */
  claude: boolean;
  /**
   * Where the agent works.
   *
   * **A path on the host, not on this machine** - the same thing the
   * `compose.workspace` command says, and the reason there is one flag rather
   * than two. Against `--claude` the host *is* this machine, so it defaults to
   * the current directory. Against `--host` it defaults to nothing at all: the
   * host is somewhere else, its filesystem is not this one, and a client that
   * sent its own cwd would be naming a directory that does not exist there.
   */
  path?: string;
  help: boolean;
}

const USAGE = `ahpc - a terminal client for the Agent Host Protocol

  ahpc [options]

The host
  --claude              Claude Code in this process, through the Agent SDK
  --host <url>          A live agent host, ws://host:port
  --token <tkn>         A bearer token for it
  (none of these)       The scripted host, which needs nothing installed

Where the agent works
  --path <dir>          A path on the host, not on this machine. The host
                        has to serve it, and says so if it does not.
                        With --claude the host is this machine, so it
                        defaults to the current directory. With --host it
                        defaults to nothing - the host decides.

Appearance
  --theme <name>        workbench, paper-light, ...
  --shell <name>        The shell layout
  --screen <name>       Which screen to open on
  --session <uri>       Open this session

Stills, for a README or a test
  --static, -s          One frame to stdout instead of running
  --width, -w <n>       Columns
  --height <n>          Rows
  --unicode <level>     ascii, bmp, full
  --colors <n>          0, 4, 8 or 24
  --svg <file>          Write the still as SVG here
  --tick <ms>           Milliseconds per scripted word
  --settled             Run the script out before the frame
  --pump <n>            Or exactly this many scripted words
  --say <text>          Say this on the open session first
  --approve             Answer the confirmation the script stops at
  --answer              ...and then the question

  --help, -h            This
`;

function parse(argv: string[]): Options {
  const options: Options = {
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    tick: 40,
    settled: false,
    screen: 'sessions',
    theme: 'workbench',
    shell: 'workbench',
    approve: false,
    answer: false,
    claude: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--static': case '-s': options.static_ = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
      case '--unicode': options.unicode = argv[++i] as UnicodeLevel; break;
      case '--colors': options.colors = Number(argv[++i]); break;
      case '--tick': options.tick = Number(argv[++i]); break;
      case '--settled': options.settled = true; break;
      case '--pump': options.pump = Number(argv[++i]); break;
      case '--svg': options.svg = String(argv[++i]); break;
      case '--say': options.say = String(argv[++i]); break;
      case '--approve': options.approve = true; break;
      case '--answer': options.answer = true; break;
      case '--screen': options.screen = String(argv[++i]); break;
      case '--theme': options.theme = String(argv[++i]); break;
      case '--shell': options.shell = String(argv[++i]); break;
      case '--session': options.session = String(argv[++i]); break;
      case '--host': options.host = String(argv[++i]); break;
      case '--token': options.token = String(argv[++i]); break;
      case '--claude': options.claude = true; break;
      case '--path': options.path = String(argv[++i]); break;
      case '--help': case '-h': options.help = true; break;
      // A flag nobody reads is a flag nobody can rely on: an unknown one is
      // said so rather than silently doing what the defaults would have done.
      default:
        if (argv[i]?.startsWith('-')) {
          process.stderr.write(`Unknown option ${argv[i]}. Try --help.\n`);
          process.exit(2);
        }
        break;
    }
  }
  return options;
}

function overrides(options: Options): CapabilityOverrides {
  return {
    ...(options.unicode ? { unicode: options.unicode, wideChars: options.unicode !== 'ascii' } : {}),
    ...(options.colors !== undefined ? { colorDepth: options.colors as 0 | 4 | 8 | 24 } : {}),
  };
}

/**
 * The host this run talks to.
 *
 * The one place the choice is made, and the only place either implementation
 * is named. A live connection is asked for by URL; anything else is the script.
 */
/**
 * Where a refusal goes before there is an application to put it in.
 *
 * The host is built first - it has to be, the application is registered
 * against it - so its callbacks are given a box to write into and the box is
 * filled once there is a store. Until then a refusal goes to stderr, which is
 * where a connection that fails during the handshake belongs anyway.
 */
const sink: { report(message: string): void } = {
  report: (message) => process.stderr.write(`${message}\n`),
};

async function connect(options: Options): Promise<HostConnection & { pump?(): boolean }> {
  if (options.claude) {
    try {
      return await claudeHost({
        // The SDK spawns the CLI as a child of this process, so the host's
        // filesystem is this one and its cwd is the only truthful default.
        path: options.path ?? process.cwd(),
        onRefusal: (_uri, message) => sink.report(message),
      });
    } catch (error) {
      if (error instanceof MissingAgentSdk) {
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
      }
      process.stderr.write(`Could not start Claude in ${options.path ?? process.cwd()}: ${String(error)}\n`);
      process.exit(1);
    }
  }
  if (!options.host) return fakeHost();
  try {
    return await liveHost({
      url: options.host,
      ...(options.token ? { token: options.token } : {}),
      onRefusal: (_uri, message) => sink.report(message),
      onState: (state) => { if (state === 'offline') sink.report('The host stopped answering'); },
    });
  } catch (error) {
    if (error instanceof MissingProtocolPackage) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`Could not reach ${options.host}: ${String(error)}\n`);
    process.exit(1);
  }
}

/**
 * Where a new session works, as this client can honestly answer it.
 *
 * `--path` when it was given, and it is a path on the **host**. Otherwise the
 * directory this was started in - but only for the hosts that *are* this
 * machine. Against `--host` the filesystem is somewhere else entirely, so a
 * path from here is one the host has never heard of, and the honest answer is
 * none at all: the host decides, which is what `--help` has always said.
 */
const workspaceFor = (options: Options): string =>
  options.path ?? (options.host ? '' : process.cwd());

/** One frame, to stdout. The same application, against a terminal that is a size. */
async function still(options: Options): Promise<void> {
  const host = await connect(options);

  const { text } = await renderStill({
    width: options.width,
    height: options.height,
    capabilities: overrides(options),
    theme: options.theme,
    shell: options.shell,
    onBoot: (booted) => { registerChat(booted, { host, workspace: workspaceFor(options) }); },

    // A still of a turn mid-flight is what `--pump` is for: run a fixed number
    // of scripted words rather than all of them, and the caret is wherever the
    // agent had got to. `--settled` runs until the script has nothing left it
    // can do without being answered, which is how the confirmation is reached.
    before: (app) => {
      const controller = app.services.require(CONTROLLER);
      if (options.session) {
        controller.open(options.session);
        if (options.screen !== 'sessions') app.screens.push(options.screen);
      }
      if (options.say) controller.send(options.say);

      const steps = options.pump ?? (options.settled ? 100_000 : 0);
      for (let i = 0; i < steps; i++) if (host.pump?.() !== true) break;
      if (options.approve) {
        controller.approve();
        for (let i = 0; i < 100_000; i++) if (host.pump?.() !== true) break;
      }
      if (options.answer) {
        controller.answer({ q1: { kind: 'selected', value: 'transcript-scope' } }, true);
        for (let i = 0; i < 100_000; i++) if (host.pump?.() !== true) break;
      }
    },

    after: async (app) => {
      if (options.svg === undefined) return;
      // The theme's own two colours, not the exporter's defaults: a cell left
      // at the terminal default means "whatever the emulator is set to", and
      // the honest answer for a picture of *this* application is the
      // background it was drawn against.
      await writeFile(options.svg, `${bufferToSvg(app.buffer(), {
        background: app.theme.colors.canvas,
        foreground: app.theme.colors.text,
        title: `chat - ${options.screen}`,
      })}\n`, 'utf8');
    },
  });

  // The frame is drawn, so let the host go. A live one is a socket and a
  // local one is a subprocess, and either keeps the event loop alive after
  // `main` has returned - a still that renders correctly and then hangs for
  // ever, which is what every `--host` still did.
  await host.close?.();

  if (options.svg !== undefined) {
    process.stderr.write(`${options.svg}\n`);
    return;
  }
  process.stdout.write(`${text}\n`);
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (options.static_ || !process.stdout.isTTY) {
    await still(options);
    return;
  }

  const terminal = createNodeTerminal();
  const host = await connect(options);
  const app = createApp({
    terminal,
    // A starting point, not a fixture. `ctrl+t` and the palette change both
    // while it runs, and the screens are the same graph under either.
    theme: options.theme,
    shell: options.shell,
    session: { managed: true, altScreen: true, mouse: true, title: 'assistant' },
    onBoot: (booted) => {
      registerChat(booted, { host, workspace: workspaceFor(options) });
      booted.commands.register({
        id: 'app.quit',
        title: 'Quit',
        slots: ['palette'],
        run: () => void app.stop().then(() => process.exit(0)),
      });
      // `q` is *not* bound. The focused composer would take it first anyway,
      // but a quit key that exists only where it happens to be unread is a
      // quit key nobody can rely on - so it is ctrl+c and the palette.
      //
      // `ctrl+c` is registered for the turn *and* for this, in that order:
      // while something is running it stops it, and when nothing is, the
      // first binding does not apply and this one does. Cancel what is
      // happening, or leave if nothing is - which is what the key means
      // everywhere else.
      booted.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
      booted.keybindings.register({ keys: 'ctrl+q', commandId: 'app.quit' });
    },
  });

  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  sink.report = (message) => app.store.set(HOST_ERROR, message);
  await app.start();

  /**
   * The last resort, and the reason it exists at all.
   *
   * A promise nobody caught ends the Node process, and this process is holding
   * a terminal in its alternate screen with the cursor hidden and raw mode on.
   * Exiting from there leaves a shell nobody can type into. So whatever it is,
   * the application is stopped first - which puts the terminal back - and then
   * the error is printed where it can be read.
   */
  const bail = (label: string) => (error: unknown): void => {
    void app.stop().finally(() => {
      process.stderr.write(`${label}: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exit(1);
    });
  };
  process.on('unhandledRejection', bail('Unhandled rejection'));
  process.on('uncaughtException', bail('Uncaught exception'));

  // The clock, for the scripted host only. A real connection has a socket
  // pushing actions, and everything above it cannot tell the difference -
  // which is why this is the only line that has to know.
  if (host.pump) {
    const timer = setInterval(() => { host.pump?.(); }, Math.max(1, options.tick));
    timer.unref?.();
  }
}

await main();
