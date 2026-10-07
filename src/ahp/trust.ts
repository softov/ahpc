/**
 * The folders this client tells a host it trusts.
 *
 * A host that has been told nothing trusts nothing: a session started in one
 * of those folders does not load the project's own files, and an ACP agent is
 * refused there. The list is sent as `root/configChanged` on the root channel,
 * the shape VS Code sends, and it is sent on **every** connection because the
 * host keeps trust per connection and drops it when a socket closes.
 *
 * Nothing here reads the config file or the command line: the list arrives as
 * paths, and a path becomes a `file://` URI here. Nothing here renders, stores
 * or opens a socket.
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The root channel, which is where a connection's own configuration goes. */
const ROOT = 'ahp-root://';

/**
 * The folders as `file://` URIs, in the order they were given.
 *
 * A leading `~` is the home folder of the machine this client runs on, and a
 * path is resolved before it is written - a relative path is relative to where
 * this process was started, which is the only reading available here. The URI
 * is encoded, because the host decodes what arrives and then compares folders:
 * a path with a space in it must survive the trip. A folder named twice is
 * one folder.
 */
export function trustedUris(paths: readonly string[]): string[] {
  const uris: string[] = [];
  for (const one of paths) {
    const at = one === '~' || one.startsWith('~/') ? `${homedir()}${one.slice(1)}` : one;
    const uri = pathToFileURL(resolve(at)).href;
    if (!uris.includes(uri)) uris.push(uri);
  }
  return uris;
}

/**
 * Tell the host which folders are trusted.
 *
 * Silent, and sent on every connection. An empty list sends no frame, because
 * a host trusts nothing by default and a frame saying so is a frame for
 * nothing. Every failure is swallowed, as `pushTokens` swallows one: a
 * connection must not fail over a list nobody asked for.
 */
export async function pushTrust(
  host: { dispatch?(uri: string, action: unknown): unknown },
  uris: readonly string[],
): Promise<void> {
  if (uris.length === 0 || !host.dispatch) return;
  try {
    await host.dispatch(ROOT, {
      type: 'root/configChanged',
      config: { workspaceTrust: { enabled: true, trustedUris: [...uris] } },
    });
  }
  catch {
    // Say nothing: the host's refusal is about a folder, and the connection
    // this is riding on is not the thing that went wrong.
  }
}
