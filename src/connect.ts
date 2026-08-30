/** Which host this run talks to, for either front end. */

import { MissingProtocolPackage, liveHost } from './ahp/live.js';
import { MissingAgentSdk, claudeHost } from './ahp/claude.js';
import { fakeHost } from './ahp/fake.js';
import type { HostConnection } from './ahp/connection.js';

/**
 * Enough of the options to choose a host, and nothing about drawing one.
 *
 * The CLI and the TUI ask the same question and must get the same answer, so
 * the choice lives here rather than in either of them. Nothing in this file
 * imports a renderer, which is what lets `ahpc session list` connect a socket
 * without loading a screen.
 */
export interface Where {
  /** A live agent host, `ws://host:port`. */
  host?: string;
  /** A bearer token for it. */
  token?: string;
  /** Claude Code in this process, through the Agent SDK. */
  claude?: boolean;
  /** Where the agent works - a path on the *host*, not on this machine. */
  path?: string;
}

/**
 * Where a refusal goes before there is an application to put it in.
 *
 * The host is built first - it has to be, the application is registered
 * against it - so its callbacks are given a box to write into and the box is
 * filled once there is a store. Until then a refusal goes to stderr, which is
 * where a connection that fails during the handshake belongs anyway, and where
 * it stays for the whole of a CLI run.
 */
export const sink: { report(message: string): void } = {
  report: (message) => process.stderr.write(`${message}\n`),
};

/**
 * The host this run talks to.
 *
 * The one place the choice is made, and the only place either implementation
 * is named. A live connection is asked for by URL; anything else is the script.
 */
export async function connect(options: Where): Promise<HostConnection & { pump?(): boolean }> {
  if (options.claude) {
    try {
      return await claudeHost({
        // The SDK spawns the CLI as a child of this process, so the host's
        // filesystem is this one and its cwd is the only truthful default.
        path: options.path ?? process.cwd(),
        onRefusal: (_uri, message) => sink.report(message),
      });
    }
    catch (error) {
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
  }
  catch (error) {
    if (error instanceof MissingProtocolPackage) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`Could not reach ${options.host}: ${String(error)}\n`);
    process.exit(1);
  }
}
