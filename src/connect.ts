/** Which host this run talks to, for either front end. */

import { MissingProtocolPackage, liveHost } from './ahp/live.js';
import { fakeHost } from './ahp/fake.js';
import { publish } from './ahp/publish.js';
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
  /** Where the agent works - a path on the *host*, not on this machine. */
  path?: string;
  /**
   * A directory on *this* machine to serve back, under `virtual://ahpc/`.
   *
   * AHP is symmetrical and a host may read from a client-published URI. Absent
   * means nothing is served and every such request is refused, which is the
   * default because publishing by accident is worse than not publishing.
   */
  publish?: string;
  /** Whether the published directory may be written to. Read-only otherwise. */
  publishWritable?: boolean;
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
  if (!options.host) return fakeHost();
  try {
    return await liveHost({
      url: options.host,
      ...(options.token ? { token: options.token } : {}),
      onRefusal: (_uri, message) => sink.report(message),
      onLimit: (message) => sink.report(message),
      // Work the host is doing under a token of its own. Reported while it
      // runs and not on the frame that closes it - the finish is the thing
      // that happened, and it is what the screen shows next.
      onProgress: (_token, message) => { if (message !== null) sink.report(message); },
      // What this client serves back. Nothing unless a directory was named:
      // the protocol is symmetrical, and a client that published by default
      // would be one that hands its disk to any host it connects to.
      ...(options.publish !== undefined
        ? { publish: publish({ root: options.publish, ...(options.publishWritable ? { writable: true } : {}) }) }
        : {}),
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
