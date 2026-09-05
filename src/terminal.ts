import type { TextUIApp } from '@textui/core';
import type { HostConnection } from './ahp/connection.js';
import type { TerminalRow, TerminalState } from './ahp/types.js';
import { OPEN_TERMINAL, TERMINAL, TERMINALS } from './state.js';

/**
 * Terminals, as operations rather than as a screen.
 *
 * The split is doop's: what a terminal *is* - which ones exist, which is
 * open, what it has said, what happens when you type - lives here, and the
 * view only draws it. The two change for different reasons, and a view that
 * held the subscription would lose the terminal every time it was unmounted.
 *
 * A terminal belongs to the *host*, not to a session: it outlives the turn
 * that opened it, several clients watch one, and the protocol lists them on
 * the root channel. So this is the host's list and not any session's.
 */
export interface Terminals {
  /** Re-read the host's list. */
  refresh(): Promise<void>;
  /** Open one, and read it. */
  open(options?: { cwd?: string }): Promise<void>;
  /** Read one that already exists. */
  read(uri: string): void;
  /** Send what was typed. Nothing comes back but what the shell says. */
  write(data: string): void;
  /**
   * Say how big the terminal is being drawn.
   *
   * Sent on opening one and whenever the size changes. A host that is never
   * told wraps its output at its own default, so a wide terminal shows lines
   * broken at eighty columns and a narrow one shows them running off.
   * Repeats are dropped: a resize event per frame is a dispatch per frame.
   */
  resize(cols: number, rows: number): void;
  /** Empty the scrollback of the open one. */
  clear(): void;
  /** Rename the open one. */
  rename(title: string): void;
  /** Kill the open one and read whatever is left. */
  close(): Promise<void>;
  /** Let go of the subscription. */
  dispose(): void;
}

export function createTerminals(app: TextUIApp, host: HostConnection, report: (error: unknown) => void): Terminals {
  /** The one being read. Closed and replaced, never two at once. */
  let watching: { uri: string; close(): void } | undefined;
  /** The last size reported, so an unchanged one is not reported again. */
  let sized = '';

  const list = async (): Promise<TerminalRow[]> => {
    try {
      const found = await host.terminals();
      app.store.set(TERMINALS, found);
      return found;
    }
    catch (error) { report(error); return []; }
  };

  const terminals: Terminals = {
    refresh: async () => { await list(); },

    read: (uri) => {
      if (watching?.uri === uri) return;
      watching?.close();
      app.store.set(OPEN_TERMINAL, uri);
      // Null rather than an empty terminal: nothing has been read yet, and a
      // blank screen that says "no output" is a claim rather than a wait.
      app.store.set(TERMINAL, null);
      const held = host.watchTerminal(uri, (state: TerminalState) => {
        if (app.store.get<string>(OPEN_TERMINAL) !== uri) return;
        app.store.set(TERMINAL, state);
      });
      watching = { uri, close: held.close };
    },

    open: async (options) => {
      try {
        const uri = await host.createTerminal(options?.cwd ? { cwd: options.cwd } : {});
        await list();
        terminals.read(uri);
      }
      catch (error) { report(error); }
    },

    write: (data) => {
      const uri = app.store.get<string>(OPEN_TERMINAL);
      if (!uri) return;
      host.writeTerminal(uri, data);
    },

    resize: (cols, rows) => {
      const uri = app.store.get<string>(OPEN_TERMINAL);
      if (!uri) return;
      // The same size again is not a resize. A screen re-renders for reasons
      // that have nothing to do with its width, and every one of them would
      // otherwise be a dispatch.
      const at = `${uri} ${String(cols)}x${String(rows)}`;
      if (at === sized) return;
      sized = at;
      host.resizeTerminal(uri, cols, rows);
    },

    clear: () => {
      const uri = app.store.get<string>(OPEN_TERMINAL);
      if (!uri) return;
      host.clearTerminal(uri);
    },

    rename: (title) => {
      const uri = app.store.get<string>(OPEN_TERMINAL);
      if (!uri) return;
      host.renameTerminal(uri, title);
    },

    close: async () => {
      const uri = app.store.get<string>(OPEN_TERMINAL);
      if (!uri) return;
      watching?.close();
      watching = undefined;
      app.store.set(OPEN_TERMINAL, null);
      app.store.set(TERMINAL, null);
      try { await host.disposeTerminal(uri); }
      catch (error) { report(error); }
      const left = await list();
      const next = left[0];
      if (next) terminals.read(next.resource);
    },

    dispose: () => {
      watching?.close();
      watching = undefined;
    },
  };

  return terminals;
}
