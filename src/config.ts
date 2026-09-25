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
  /**
   * A file holding that token, read instead of writing the secret down here.
   *
   * The same file `ahpd --connection-token-file` keeps, and the same key name
   * that host's own configuration uses. A path is not a credential, so this
   * key is safe in a file people share and back up, which `token` is not.
   */
  connectionTokenFile?: string;
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
  /**
   * Ask npm whether a newer version exists, six hours apart.
   *
   * `false` never asks. The same as `--no-update-check`, for a person who
   * would rather not type it every time.
   */
  updateCheck?: boolean;
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
 * A file the tool writes, beside the one a person edits.
 *
 * `config.json` is hand-written and stays that way; anything a program
 * rewrites on its own schedule gets a file of its own next to it, so a
 * rewrite never loses the comments and the ordering somebody put there.
 */
export const statePath = (tool: string, file: string): string =>
  join(configHome(), tool, file);

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

/**
 * The secret this client presents to open a connection, or nothing.
 *
 * Both front ends resolve it through here, because the screen and the shell
 * disagreeing about which credential to send is the one difference nobody
 * would think to look for.
 *
 * Most deliberate source first: this invocation, then this shell, then the
 * file that answers for every invocation. Within a pair, the path beats the
 * written-down secret, because somebody who set both has said where they are
 * moving to.
 *
 * `--token` and `--connection-token-file` are refused together rather than
 * ranked, which is what the host does with the same two flags.
 */
export function connectionToken(
  said: { token?: string; tokenFile?: string },
  file: Config,
): string | undefined {
  if (said.token !== undefined && said.tokenFile !== undefined) {
    throw new Error('Pass --token or --connection-token-file, not both.');
  }
  if (said.token !== undefined) return said.token;
  if (said.tokenFile !== undefined) return readTokenFile(said.tokenFile);
  if (process.env.AHPC_TOKEN) return process.env.AHPC_TOKEN;
  if (file.connectionTokenFile !== undefined) return readTokenFile(file.connectionTokenFile);
  return file.token;
}

/**
 * The token inside a file the host keeps.
 *
 * Trimmed, because the host writes a trailing newline and reads its own file
 * back the same way. A missing file is refused rather than written: the host
 * owns this secret and a client that invented one would be presenting a
 * credential nobody agreed to. Nothing here checks the token's shape, so
 * whatever the host accepts is whatever this sends.
 */
function readTokenFile(path: string): string {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  }
  catch {
    throw new Error(`No connection token at ${path}. The host writes one there when it is given --connection-token-file.`);
  }
  const held = text.trim();
  if (held === '') throw new Error(`${path} is empty.`);
  return held;
}
