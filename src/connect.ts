/** Which host this run talks to, for either front end. */

import { MissingProtocolPackage, liveHost } from './ahp/live.js';
import { whyNoConnection } from './ahp/refused.js';
import { fakeHost } from './ahp/fake.js';
import { publish } from './ahp/publish.js';
import { pushTokens, tokenVariable } from './ahp/tokens.js';
import { pushTrust, trustedUris } from './ahp/trust.js';
import type { HostConnection, RefusalKind } from './ahp/connection.js';
import type { AuthAsk } from './ahp/auth.js';

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
   * A directory on *this* machine to serve back, under `virtual://<clientId>/`.
   *
   * The authority is this connection's own id, because that is what a host
   * routes on: it reads the authority out of the URI and matches it against
   * the connection that published it.
   *
   * AHP is symmetrical and a host may read from a client-published URI. Absent
   * means nothing is served and every such request is refused, which is the
   * default because publishing by accident is worse than not publishing.
   */
  publish?: string;
  /** Whether the published directory may be written to. Read-only otherwise. */
  publishWritable?: boolean;
  /**
   * Folders on *this* machine the host may treat as trusted.
   *
   * Written as paths, not URIs; `trustedUris` resolves and encodes them. Sent
   * on every connection, because the host keeps trust per connection. Absent
   * or empty sends nothing, which is what a host trusts anyway.
   */
  trust?: string[];
  /** A file every frame is appended to, both directions, as JSON lines. */
  wire?: string;
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
export const sink: {
  report(message: string): void;
  /** Take a sentence off the row, where there is a row, and only if it is still this one. */
  clear(message: string): void;
  /** A refusal that no reader claimed, with the channel it was about. */
  refused(uri: string, message: string, kind: RefusalKind): void;
} = {
  report: (message) => process.stderr.write(`${message}\n`),
  // A shell has no row to clear.
  clear: () => undefined,
  refused: (_uri, message) => sink.report(message),
};

/** The sentence that names a resource and the variable that would satisfy it. */
export function signInSentence(one: AuthAsk): string {
  const what = one.name ?? one.resource;
  return one.reason === 'expired'
    ? `The token for ${what} has expired. Set ${tokenVariable(one.resource)} to a new token and run it again.`
    : `${what} needs a token. Set ${tokenVariable(one.resource)} and run it again.`;
}

/**
 * Where a refusal goes when there is a screen to put it in.
 *
 * The connection is built before the application is, so its callback is given a
 * box to write into and the box is filled once there is a controller, exactly
 * as `sink` is. Until then an ask goes to `sink`, which is where a connection
 * that fails before there is an interface belongs, and in a shell run nothing
 * ever fills it, so the sentence is the whole of what happens.
 */
export const auth: { ask(one: AuthAsk): void } = {
  ask: (one) => sink.report(signInSentence(one)),
};

/**
 * The host this run talks to.
 *
 * The one place the choice is made, and the only place either implementation
 * is named. A live connection is asked for by URL; anything else is the script.
 */
export async function connect(options: Where): Promise<HostConnection & { pump?(): boolean }> {
  if (!options.host) return fakeHost();
  /** The last reason said for a failed retry, so a retry loop does not repeat it. */
  let reported = '';
  /** Whether the connection is up now, so an answer that arrives late can be dropped. */
  let back = false;
  try {
    return await liveHost({
      url: options.host,
      ...(options.token ? { token: options.token } : {}),
      ...(options.wire ? { wire: options.wire } : {}),
      onRefusal: (uri, message, kind) => sink.refused(uri, message, kind),
      onLimit: (message) => sink.report(message),
      // Work the host is doing under a token of its own. Reported while it
      // runs and not on the frame that closes it - the finish is the thing
      // that happened, and it is what the screen shows next.
      onProgress: (_token, message) => { if (message !== null) sink.report(message); },
      /*
       * The host wants signing into something.
       *
       * Handed to the `auth` box rather than said here: a screen fills the box
       * and opens the prompt where the person is, and a shell leaves it alone,
       * so the box's own sentence is the whole of what happens. `expired` is
       * carried because the answer is different: a new credential, not the one
       * that was just refused.
       */
      onAuthRequired: (resources, why) => {
        const first = resources[0];
        if (first === undefined) return;
        auth.ask({
          resource: first.resource,
          ...(first.name !== undefined ? { name: first.name } : {}),
          ...(why !== undefined ? { reason: why } : {}),
          words: '',
        });
      },
      // What this client serves back. Nothing unless a directory was named:
      // the protocol is symmetrical, and a client that published by default
      // would be one that hands its disk to any host it connects to.
      ...(options.publish !== undefined
        ? { publish: publish({ root: options.publish, ...(options.publishWritable ? { writable: true } : {}) }) }
        : {}),
      /*
       * A reconnect that failed says why, in the sentence the first connection
       * would have said. The retry loop runs until the host is back, and the
       * same reason twice is the same line on the status row.
       */
      onRetryFailed: () => {
        void whyNoConnection(options.host as string, options.token).then((sentence) => {
          // The plain request takes a round trip, and the connection may have
          // come back while it was out. A reason for a state that ended is
          // wrong on screen, so it is dropped rather than said late.
          if (back) return;
          if (sentence === reported) return;
          reported = sentence;
          sink.report(sentence);
        });
      },
      onState: (state) => {
        back = state === 'connected';
        if (state === 'offline') sink.report('The host stopped answering');
        // A reason for a state that has ended is wrong on screen, so the line
        // goes when the connection comes back - unless something newer has
        // taken it, which `clear` is what decides.
        if (state === 'connected' && reported !== '') {
          sink.clear(reported);
          reported = '';
        }
      },
      /*
       * What the host is told on every connection, in the order it is told.
       *
       * Credentials first, because a host that wants one is a host that will
       * refuse the next thing asked of it; the trusted folders after, because
       * they decide what a session started here may load. Both are per
       * connection - the host drops what it holds when a socket closes - so
       * both are sent again after every reconnect.
       */
      onConnected: async (host) => {
        await pushTokens(host);
        await pushTrust(host, trustedUris(options.trust ?? []));
      },
    });
  }
  catch (error) {
    if (error instanceof MissingProtocolPackage) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`${await whyNoConnection(options.host, options.token)}\n`);
    process.exit(1);
  }
}
