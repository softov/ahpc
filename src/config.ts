/** What this client was told before anybody typed a flag. */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** What a config file may say. Every key is what a flag would have said. */
export interface Config {
  /** A live agent host, `ws://host:port`. */
  host?: string;
  /** A bearer token for it. */
  token?: string;
  /** The theme to open on. */
  theme?: string;
  /** The shell layout. */
  shell?: string;
  /**
   * Keys, over the ones this client ships with.
   *
   * A chord to a command id - `"ctrl+g": "editor.open"` - or to `null`, which
   * takes the chord away and binds nothing. Naming a chord replaces every
   * default on it, including one registered against a single screen, so a
   * chord is either yours or ours and never half of each.
   *
   * `ahpc config` lists the command ids. A chord bound to a name no command
   * answers to is reported at startup rather than dropped, because a binding
   * that silently does nothing is indistinguishable from one that never
   * loaded.
   */
  keys?: Record<string, string | null>;
  /**
   * Trade the header's own name for a seven-cell creature, on an open session.
   *
   * Off unless it is asked for. The header's leftmost cell is the one part of
   * the row that is the same on every screen, and a client that gives it away
   * by default has decided something about itself on somebody else's behalf.
   */
  boodInline?: boolean;
  /**
   * Let the creature loose on the whole application.
   *
   * Off unless it is asked for, and the reason is the one thing a terminal
   * cannot do: there is no per-cell transparency, so a figure that goes
   * everywhere writes over whatever it is standing on. It keeps clear of the
   * composer, which says how tall it is, and of anything opened on a layer -
   * but a screen whose content runs to the bottom will have a cat on it.
   */
  boodFloat?: boolean;
}

/**
 * Where a tool's configuration lives.
 *
 * XDG, and the environment variable first: `$XDG_CONFIG_HOME` is what a person
 * sets when their configuration is not in `~/.config`, and a tool that reads
 * the fallback anyway is a tool that ignores them.
 */
export const configHome = (): string =>
  process.env.XDG_CONFIG_HOME || join(homedir(), '.config');

/** This tool's own file. */
export const configPath = (tool: string): string =>
  join(configHome(), tool, 'config.json');

/**
 * Read it, or answer that there was nothing to read.
 *
 * A file that is not there is not an error - most people have none. A file
 * that is there and is broken *is* one, and says so rather than starting with
 * defaults somebody did not choose: silently ignoring a config somebody wrote
 * is worse than refusing to start.
 */
export function loadConfig(tool: string, named?: string): Config {
  const path = named ?? configPath(tool);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  }
  catch {
    // Only a file that was *asked for* by name is worth complaining about.
    if (named === undefined) return {};
    throw new Error(`No configuration at ${named}`);
  }
  try {
    const found: unknown = JSON.parse(text);
    if (typeof found !== 'object' || found === null || Array.isArray(found)) {
      throw new Error('it is not an object');
    }
    return found as Config;
  }
  catch (error) {
    throw new Error(`${path} could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
}
