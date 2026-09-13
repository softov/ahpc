/**
 * `ahpc wire <file>`: a capture, watched.
 *
 * A screen with no host behind it. On a terminal it is the wire screen,
 * reading the file as it grows; anywhere else it is one line per frame to
 * stdout, which is what a shell wants from it. Loaded only when asked for,
 * for the same reason the conversation screen is: it pulls in a renderer,
 * and `ahpc session list` should not pay for one.
 */

import { WRITER_KEY, createApp } from '@textui/core';
import { createNodeTerminal, createWriter } from '@textui/terminal';
import { registerWire } from './view/wire.js';
import { follow, matches, rowText } from './wire.js';

export interface WireTuiOptions {
  file: string;
  theme?: string;
  shell?: string;
  /** Keep printing as the file grows, off a terminal. */
  follow?: boolean;
  /** One JSON object per row rather than a line for reading. */
  json?: boolean;
  /** Only the rows this matches, off a terminal; on one the filter box is the same thing. */
  filter?: string;
}

/** The screen, or the lines. */
export async function wireTui(options: WireTuiOptions): Promise<void> {
  if (!process.stdout.isTTY || options.json) {
    await new Promise<void>((resolve) => {
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const done = (): void => { reader.close(); resolve(); };
      const reader = follow(options.file, (rows) => {
        for (const row of rows) {
          if (options.filter !== undefined && !matches(row, options.filter)) continue;
          process.stdout.write(options.json ? `${JSON.stringify(row)}\n` : `${rowText(row)}\n`);
        }
        if (!options.follow) { if (quiet) clearTimeout(quiet); quiet = setTimeout(done, 50); }
      });
      // Without `--follow`, what is there now and then out: the first read
      // is synchronous, so nothing arriving in the next moment means the
      // file has been read to its end.
      if (!options.follow && quiet === undefined) quiet = setTimeout(done, 50);
    });
    return;
  }

  const terminal = createNodeTerminal();
  const app = createApp({
    terminal,
    ...(options.theme ? { theme: options.theme } : {}),
    ...(options.shell ? { shell: options.shell } : {}),
    session: { managed: true, altScreen: true, mouse: true, title: 'wire' },
    onBoot: (booted) => {
      registerWire(booted, { file: options.file });
      booted.commands.register({
        id: 'app.quit',
        title: 'Quit',
        slots: ['palette'],
        run: () => void app.stop().then(() => process.exit(0)),
      });
      booted.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
      booted.keybindings.register({ keys: 'ctrl+q', commandId: 'app.quit' });
      booted.keybindings.register({ keys: 'q', commandId: 'app.quit', scopeId: 'wire.rows' });
    },
  });
  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();

  const bail = (label: string) => (error: unknown): void => {
    void app.stop().finally(() => {
      process.stderr.write(`${label}: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exit(1);
    });
  };
  process.on('unhandledRejection', bail('Unhandled rejection'));
  process.on('uncaughtException', bail('Uncaught exception'));
}
