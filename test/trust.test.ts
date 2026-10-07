/*
 * What this client tells a host it trusts.
 *
 * A host trusts nothing until a connection says so, which is why the list
 * goes over on every connection and why an empty list sends no frame at all.
 * A path is resolved and encoded on the way out, because the host matches
 * folders rather than the text it was handed.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { InMemoryTransport, type AhpTransport } from '@microsoft/agent-host-protocol/client';
import { liveHost } from '../src/ahp/live.js';
import { pushTrust, trustedUris } from '../src/ahp/trust.js';
import { cli, where } from '../src/cli/main.js';
import { Scripted, settle } from './scenario.js';

const FOLDER = '/github/x';

/** Every action a scripted host was dispatched, with the channel it went to. */
const dispatched = (scripted: Scripted | undefined): { channel?: unknown; action?: unknown }[] =>
  (scripted?.asked ?? [])
    .filter((frame) => frame.method === 'dispatchAction')
    .map((frame) => frame.params ?? {});

/**
 * A live client over a scripted host, pushing trust the way `connect` wires it.
 *
 * Not the scripted *seam*: `fakeHost` never calls `onConnected`, so a list
 * sent on every connection is the one thing it cannot show.
 */
async function connecting(uris: readonly string[]): Promise<{
  host: Awaited<ReturnType<typeof liveHost>>;
  all: Scripted[];
}> {
  const all: Scripted[] = [];
  const open = async (): Promise<AhpTransport> => {
    const [mine, theirs] = InMemoryTransport.pair();
    all.push(new Scripted(theirs));
    return mine;
  };
  const host = await liveHost({
    url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
    onConnected: (made) => pushTrust(made, uris),
  });
  return { host, all };
}

/** Run `body` with this client's configuration pointed at a throwaway home. */
async function inConfig(file: string | undefined, body: () => void | Promise<void>): Promise<void> {
  const home = mkdtempSync(join(tmpdir(), 'ahpc-trust-'));
  const had = {
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    AHPC_HOST: process.env.AHPC_HOST,
    AHPC_TOKEN: process.env.AHPC_TOKEN,
  };
  process.env.XDG_CONFIG_HOME = home;
  delete process.env.AHPC_HOST;
  delete process.env.AHPC_TOKEN;
  mkdirSync(join(home, 'ahpc'), { recursive: true });
  if (file !== undefined) writeFileSync(join(home, 'ahpc', 'config.json'), file);
  try { await body(); }
  finally {
    for (const [key, value] of Object.entries(had)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(home, { recursive: true, force: true });
  }
}

describe('the folders, as the host is told them', () => {
  it('writes a path as a file URI, with ~ as the home folder and a space encoded', () => {
    // A space must arrive encoded: the host decodes what it is sent and then
    // compares folders, and a raw space is not a URI it can read.
    expect(trustedUris(['/github/a b'])).toEqual(['file:///github/a%20b']);
    expect(trustedUris(['~'])).toEqual([pathToFileURL(homedir()).href]);
    expect(trustedUris(['~/github/x'])).toEqual([pathToFileURL(join(homedir(), 'github/x')).href]);
    // A folder named twice is one folder.
    expect(trustedUris([FOLDER, FOLDER])).toEqual([`file://${FOLDER}`]);
    expect(trustedUris([])).toEqual([]);
  });
});

describe('the trust, on every connection', () => {
  it('sends root/configChanged with workspaceTrust on ahp-root:// when connected', async () => {
    const { host, all } = await connecting(trustedUris([FOLDER]));
    await settle(2);

    expect(dispatched(all[0])).toEqual([{
      channel: 'ahp-root://',
      clientSeq: expect.any(Number),
      action: {
        type: 'root/configChanged',
        config: { workspaceTrust: { enabled: true, trustedUris: [`file://${FOLDER}`] } },
      },
    }]);

    await host.close();
  });

  it('sends the trust again after a reconnect', async () => {
    const { host, all } = await connecting(trustedUris([FOLDER]));
    await settle(2);

    await all[0]?.drop();
    await settle(40);
    expect(all).toHaveLength(2);
    expect(host.state()).toBe('connected');
    await settle(2);

    // The host keeps trust per connection, so a resumed one is told again.
    expect(dispatched(all[1])).toHaveLength(1);
    expect(dispatched(all[1])[0]?.action).toMatchObject({
      type: 'root/configChanged',
    });

    await host.close();
  });

  it('sends nothing when the list is empty', async () => {
    const { host, all } = await connecting(trustedUris([]));
    await settle(2);

    expect(dispatched(all[0])).toEqual([]);

    await host.close();
  });

  it('does not fail the connection when the dispatch throws', async () => {
    // Nothing asked for the list, and a connection must not fail over it.
    await expect(pushTrust({ dispatch: () => { throw new Error('gone'); } }, [`file://${FOLDER}`]))
      .resolves.toBeUndefined();
    await expect(pushTrust({ dispatch: async () => { throw new Error('gone'); } }, [`file://${FOLDER}`]))
      .resolves.toBeUndefined();
    await expect(pushTrust({}, [`file://${FOLDER}`])).resolves.toBeUndefined();

    // And the connection it hangs off stays up, because the throw is swallowed
    // before it can reach the socket's own error path.
    const all: Scripted[] = [];
    const open = async (): Promise<AhpTransport> => {
      const [mine, theirs] = InMemoryTransport.pair();
      all.push(new Scripted(theirs));
      return mine;
    };
    const host = await liveHost({
      url: 'ws://scripted', clientId: 'ahpc-test', connect: open, backoff: [0], keepaliveMs: 0,
      onConnected: () => pushTrust({ dispatch: () => { throw new Error('gone'); } }, trustedUris([FOLDER])),
    });
    await settle(2);
    expect(host.state()).toBe('connected');
    expect(dispatched(all[0])).toEqual([]);

    await host.close();
  });
});

describe('which folders a run trusts', () => {
  it('trusts the --cwd of a command run with --trust, and not without it', async () => {
    await inConfig(JSON.stringify({ trust: ['/from/config'] }), () => {
      // The config list is always in; the directory is in only when the same
      // command asked for it, because `--cwd` alone is where the agent works
      // rather than a folder anybody said was safe to load.
      expect(where(['--cwd', FOLDER, '--trust']).trust).toEqual(['/from/config', FOLDER]);
      expect(where(['--cwd', FOLDER]).trust).toEqual(['/from/config']);
      // The list is what it is whether or not this run named a directory.
      expect(where(['--trust', '--cwd', FOLDER, '--json']).trust).toEqual(['/from/config', FOLDER]);
    });
  });

  it('is the --trust directory alone for a run with no config list', async () => {
    await inConfig(undefined, () => {
      expect(where(['--cwd', FOLDER, '--trust']).trust).toEqual([FOLDER]);
      expect(where([]).trust).toEqual([]);
    });
  });

  it('refuses --trust without --cwd', async () => {
    await inConfig(undefined, async () => {
      let err = '';
      const write = process.stderr.write.bind(process.stderr);
      process.stderr.write = ((chunk: string | Uint8Array) => { err += String(chunk); return true; }) as typeof process.stderr.write;
      let code: number;
      try {
        // `exec` is one of the commands that takes both flags, so this is the
        // invocation a person would actually type.
        code = await cli('exec', ['hello', '--trust']);
      }
      finally { process.stderr.write = write; }

      expect(code).toBe(2);
      expect(err.trim()).toBe('--trust needs --cwd, the folder to trust.');
    });
  });
});
