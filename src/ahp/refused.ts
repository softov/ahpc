/**
 * Why a socket failed to open.
 *
 * A refused handshake and a port nobody is listening on look the same from the
 * outside. One plain request to the same address, made only after the socket
 * has already failed, tells them apart by the status it answers: 401 is the
 * token, 426 is a host that is up, and no answer at all is neither.
 */

/** How long the plain request waits for an answer before it is stopped. */
const ASK_TIMEOUT_MS = 3_000;

/**
 * The sentence for a connection that failed.
 *
 * The plain request is a GET to the same address with the token in `?tkn=`,
 * which is where the socket carries it too. It runs only after the socket has
 * failed, so the wait is on a path that has already gone wrong.
 */
export async function whyNoConnection(url: string, token?: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(address(url, token), { signal: AbortSignal.timeout(ASK_TIMEOUT_MS) });
  }
  catch (error) {
    return `Could not reach ${url}: ${reason(error)}. If it is running, check the connection token.`;
  }
  // The status is all this needed. A body left unread holds the socket open
  // until the connection is collected.
  await response.body?.cancel();
  if (response.status === 401) {
    return token === undefined
      ? `The host at ${url} needs a connection token.`
      : `The host at ${url} refused the connection token.`;
  }
  if (response.status === 426) {
    return `The host at ${url} is up, but the connection failed: ${status(response)}.`;
  }
  return `Could not reach ${url}: ${status(response)}. If it is running, check the connection token.`;
}

/**
 * The address the same host answers a plain request on.
 *
 * `ws` is `http` and `wss` is `https`. The token goes in `?tkn=`, encoded the
 * way the socket's own URL encodes it, and only where there is one: a request
 * carrying an empty parameter is not the same request as one carrying none.
 */
function address(url: string, token: string | undefined): string {
  const asked = new URL(url);
  if (asked.protocol === 'ws:') asked.protocol = 'http:';
  else if (asked.protocol === 'wss:') asked.protocol = 'https:';
  if (token !== undefined) asked.searchParams.set('tkn', token);
  return asked.toString();
}

/** What an HTTP answer says it is, for a sentence that has to name it. */
const status = (response: Response): string =>
  `${String(response.status)}${response.statusText === '' ? '' : ` ${response.statusText}`}`;

/**
 * What a failed request says went wrong.
 *
 * `fetch` reports every network failure as `fetch failed` and keeps the real
 * reason in `cause`, which is the part worth putting in a sentence.
 */
function reason(error: unknown): string {
  if (error instanceof Error) {
    if (error.cause instanceof Error) return error.cause.message;
    return error.message;
  }
  return String(error);
}
