import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import { writeFile } from 'node:fs/promises';
import {
  bufferToSvg, createNodeTerminal, createWriter, renderStill,
} from '@textui/terminal';
import { registerChat } from './app.js';
import { CONTROLLER } from './control.js';
import { connect, sink } from './connect.js';
import { loadConfig } from './config.js';
import { reportHostError } from './state.js';

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
  /** The header trades its name for a creature, on an open session. */
  boodInline: boolean;
  /** The creature roams the whole application. */
  boodFloat: boolean;
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
  /** Read this config instead of the one XDG names. */
  configFile?: string;
  /**
   * Where the agent works.
   *
   * **A path on the host, not on this machine** - the same thing the
   * `compose.workspace` command says, and the reason there is one flag rather
   * than two. It defaults to nothing at all: the host is somewhere else, its
   * filesystem is not this one, and a client that sent its own cwd would be
   * naming a directory that does not exist there.
   */
  path?: string;
  /**
   * A directory on *this* machine to serve back to the host.
   *
   * The screen rather than the CLI, because a published directory is only
   * reachable while a connection is open: `ahpc session list` answers and
   * exits, so a host has nothing left to ask. Absent means nothing is served.
   */
  publish?: string;
  /** Whether the host may write into it. Read-only otherwise. */
  publishWritable?: boolean;
  help: boolean;
}

export const USAGE = `ahpc - a terminal client for the Agent Host Protocol

  ahpc [options]

The host
  --host <url>          A live agent host, ws://host:port
  --token <tkn>         A bearer token for it
  --config-file <f>     Read this instead of ~/.config/ahpc/config.json
  (none of these)       The scripted host, which needs nothing installed

Where the agent works
  --path <dir>          A path on the host, not on this machine. The host
                        has to serve it, and says so if it does not.
                        Left out, the host decides.

What this client serves back
  --publish <dir>       Serve this directory to the host under
                        virtual://<clientId>/. Nothing is served without
                        it, and every such request is refused.
  --publish-writable    Let the host write into it. Read-only otherwise.
                        Serving lasts as long as the screen does: with no
                        terminal attached this prints one frame and exits,
                        so a background shell publishes nothing.

Appearance
  --theme <name>        workbench, paper-light, ...
  --shell <name>        The shell layout
  --screen <name>       Which screen to open on
  --bood                Let the creature loose on the whole screen. It
                        keeps off the composer and off anything asking
                        a question, and alt+g turns it off again.
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

Commands
  ahpc <command> ...    Drive a host without the screen. 'ahpc help' lists
                        them: sessions, prompts, approvals, terminals.
`;

export function parse(argv: string[]): Options {
  const options: Options = {
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    tick: 40,
    settled: false,
    screen: 'sessions',
    theme: 'paper',
    shell: 'workbench',
    boodInline: false,
    boodFloat: false,
    approve: false,
    answer: false,
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
      case '--bood': options.boodFloat = true; break;
      case '--session': options.session = String(argv[++i]); break;
      case '--host': options.host = String(argv[++i]); break;
      case '--token': options.token = String(argv[++i]); break;
      case '--config-file': options.configFile = String(argv[++i]); break;
      case '--path': options.path = String(argv[++i]); break;
      case '--publish': options.publish = String(argv[++i]); break;
      case '--publish-writable': options.publishWritable = true; break;
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
 * Where a new session works, as this client can honestly answer it.
 *
 * `--path` when it was given, and it is a path on the **host**. Otherwise
 * nothing: the host's filesystem is not this one, so a path from here is one
 * it has never heard of, and the honest answer is to let the host decide.
 */
const workspaceFor = (options: Options): string => options.path ?? '';

/** One frame, to stdout. The same application, against a terminal that is a size. */
async function still(options: Options): Promise<void> {
  const host = await connect(options);

  const { text } = await renderStill({
    width: options.width,
    height: options.height,
    capabilities: overrides(options),
    theme: options.theme,
    shell: options.shell,
    onBoot: (booted) => {
      registerChat(booted, {
        host, workspace: workspaceFor(options),
        boodInline: options.boodInline, boodFloat: options.boodFloat,
      });
    },

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

/**
 * The screen.
 *
 * Exported rather than run, so `main.tsx` can decide between this and the CLI
 * without either being loaded to make the choice - this file pulls in a whole
 * renderer, and `ahpc session list` should not pay for one.
 */
export async function tui(argv: string[]): Promise<void> {
  const options = parse(argv);
  /*
   * The file, under whatever was typed.
   *
   * Same order as the CLI uses, because the two front ends answering
   * differently about which host to talk to is the one difference nobody
   * would think to look for.
   */
  const file = loadConfig('ahpc', options.configFile);
  options.host = options.host ?? process.env.AHPC_HOST ?? file.host;
  options.token = options.token ?? process.env.AHPC_TOKEN ?? file.token;
  if (file.theme && !argv.includes('--theme')) options.theme = file.theme;
  if (file.shell && !argv.includes('--shell')) options.shell = file.shell;
  if (file.boodInline !== undefined) options.boodInline = file.boodInline;
  if (file.boodFloat !== undefined && !argv.includes('--bood')) options.boodFloat = file.boodFloat;
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
    // A starting point, not a fixture. `alt+t` and the palette change both
    // while it runs, and the screens are the same graph under either.
    theme: options.theme,
    shell: options.shell,
    session: { managed: true, altScreen: true, mouse: true, title: 'assistant' },
    onBoot: (booted) => {
      registerChat(booted, {
        host, workspace: workspaceFor(options),
        boodInline: options.boodInline, boodFloat: options.boodFloat,
      });
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
  sink.report = (message) => reportHostError(app.store, message);
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
