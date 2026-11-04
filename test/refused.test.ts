/*
 * Why a socket failed to open, told from the plain request behind it.
 *
 * What goes wrong with an HTTP answer is never the handler, so each case starts
 * a loopback server on port 0 and asks a `ws://` address at it. The conversion
 * to `http://` is half of what is under test.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { whyNoConnection } from '../src/ahp/refused.js';

let running: Server | undefined;

/** Close whatever this case left listening. */
const stop = async (): Promise<void> => {
  const held = running;
  running = undefined;
  if (held === undefined) return;
  await new Promise<void>((done) => held.close(() => done()));
};

afterEach(stop);

/** A loopback host answering every request with one status, and the paths it was asked for. */
const serve = async (status: number, statusMessage?: string): Promise<{ url: string; asked: string[] }> => {
  const asked: string[] = [];
  running = createServer((request, response) => {
    asked.push(request.url ?? '');
    response.writeHead(status, statusMessage);
    response.end();
  });
  await new Promise<void>((done) => running?.listen(0, '127.0.0.1', done));
  const { port } = running.address() as AddressInfo;
  return { url: `ws://127.0.0.1:${String(port)}`, asked };
};

describe('a connection that failed says which failure it was', () => {
  it('says the host refused the token on a 401, and asks with the token', async () => {
    const { url, asked } = await serve(401, 'Unauthorized');

    expect(await whyNoConnection(url, 'wrong')).toBe(`The host at ${url} refused the connection token.`);
    // One request, to the same address, carrying the token where the socket
    // would have carried it.
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('?tkn=wrong');
  });

  it('says a token is needed on a 401 when none was given, and sends no empty one', async () => {
    const { url, asked } = await serve(401, 'Unauthorized');

    // A host refusing a request with no token is a host asking for one, not a
    // host turning one down.
    expect(await whyNoConnection(url)).toBe(`The host at ${url} needs a connection token.`);
    expect(asked[0]).not.toContain('tkn');
  });

  it('says the host is up on a 426, which is a token it would have admitted', async () => {    const { url } = await serve(426, 'Upgrade Required');

    expect(await whyNoConnection(url, 'tok'))
      .toBe(`The host at ${url} is up, but the connection failed: 426 Upgrade Required.`);
  });

  it('says the host could not be reached when nothing answers, and names the token as a cause', async () => {
    const { url } = await serve(200);
    // A port that was open a moment ago: the request is refused rather than
    // left to run out its timeout.
    await stop();

    const said = await whyNoConnection(url, 'tok');
    expect(said).toContain(`Could not reach ${url}: `);
    expect(said).toContain('check the connection token');
  });

  it('says what an unexpected answer was, rather than losing it', async () => {
    const { url } = await serve(500, 'Internal Server Error');

    expect(await whyNoConnection(url, 'tok'))
      .toBe(`Could not reach ${url}: 500 Internal Server Error. If it is running, check the connection token.`);
  });
});
