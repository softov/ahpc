/*
 * Where a resource token comes from, how long it is kept, and when it is let go.
 *
 * The environment variable wins over the cache, the cache lasts the process,
 * and only a host saying it does not know the credential drops one. Nothing
 * reaches the disk.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { forget, forgetAll, pushTokens, remember, resolveToken, tokenVariable } from '../src/ahp/tokens.js';
import type { Where } from '../src/connect.js';

const RESOURCE = 'https://api.anthropic.com';
const VARIABLE = 'AHPC_TOKEN_API_ANTHROPIC_COM';

const refused = (): Error => Object.assign(new Error('Authentication required'), {
  code: -32007,
  data: { resources: [{ resource: RESOURCE }] },
});
const invalid = (): Error => Object.assign(new Error('Unknown resource'), { code: -32602 });

let was: string | undefined;
beforeEach(() => { was = process.env[VARIABLE]; delete process.env[VARIABLE]; });
afterEach(() => {
  forgetAll();
  if (was === undefined) delete process.env[VARIABLE]; else process.env[VARIABLE] = was;
});

describe('a resource token', () => {
  it('is named after the resource', () => {
    expect(tokenVariable(RESOURCE)).toBe(VARIABLE);
  });

  it('is nothing when neither the environment nor the cache has one', () => {
    expect(resolveToken(RESOURCE)).toBeUndefined();
  });

  it('reads back once remembered, and the variable wins over it', () => {
    remember(RESOURCE, 'cached');
    expect(resolveToken(RESOURCE)).toBe('cached');
    process.env[VARIABLE] = 'exported';
    expect(resolveToken(RESOURCE)).toBe('exported');
  });

  it('is dropped when the host does not know it, and only then', () => {
    remember(RESOURCE, 'cached');
    expect(forget(RESOURCE, invalid())).toBe(false);
    expect(forget(RESOURCE, new Error('socket closed'))).toBe(false);
    expect(forget(RESOURCE, Object.assign(new Error('offline'), { code: 'ECONNRESET' }))).toBe(false);
    expect(resolveToken(RESOURCE)).toBe('cached');

    expect(forget(RESOURCE, refused())).toBe(true);
    expect(resolveToken(RESOURCE)).toBeUndefined();
  });
});

describe('pushing what this run has', () => {
  function host(answer: (resource: string, token: string) => Promise<void>) {
    const pushed: { resource: string; token: string }[] = [];
    return {
      pushed,
      protectedResources: async () => [{ resource: RESOURCE }, { resource: 'https://api.github.com' }],
      authenticate: async (resource: string, token: string) => { pushed.push({ resource, token }); await answer(resource, token); },
    };
  }

  it('pushes a token for each declared resource that has one, and skips the rest', async () => {
    remember(RESOURCE, 'cached');
    const one = host(async () => undefined);
    await pushTokens(one);
    expect(one.pushed).toEqual([{ resource: RESOURCE, token: 'cached' }]);
  });

  it('drops a cached token the host refuses, and keeps one it answers -32602 to', async () => {
    remember(RESOURCE, 'cached');
    await expect(pushTokens(host(async () => { throw invalid(); }))).resolves.toBeUndefined();
    expect(resolveToken(RESOURCE)).toBe('cached');

    await expect(pushTokens(host(async () => { throw refused(); }))).resolves.toBeUndefined();
    expect(resolveToken(RESOURCE)).toBeUndefined();
  });

  it('does nothing on a seam without the two calls, or one that fails to list', async () => {
    remember(RESOURCE, 'cached');
    await expect(pushTokens({})).resolves.toBeUndefined();
    await expect(pushTokens({ protectedResources: async () => { throw new Error('gone'); }, authenticate: async () => undefined })).resolves.toBeUndefined();
  });

  it('writes nothing to disk', async () => {
    const home = await mkdtemp(path.join(tmpdir(), 'ahpc-tokens-'));
    const saved = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = home;
    try {
      remember(RESOURCE, 'cached');
      resolveToken(RESOURCE);
      forget(RESOURCE, refused());
      expect(await readdir(home)).toEqual([]);
    }
    finally {
      if (saved === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = saved;
      await rm(home, { recursive: true, force: true });
    }
  });
});

/*
 * The flag `ahpc auth` reads a resource token from.
 *
 * `--token` opens the connection in every command, so the push has a flag of
 * its own, then the environment variable named after the resource, then a
 * pipe. A run that passed only `--token` is refused rather than read as a
 * resource token. The host is a scripted one behind a replaced `connect`,
 * because what is checked is which token reaches `authenticate` and which
 * credential opened the connection.
 */
describe('ahpc auth, and the flag it reads a resource token from', () => {
  const RESOURCE = 'https://api.anthropic.com';
  const SENTENCE = '--token is the connection token. Use --resource-token for this.';

  let pushed: { resource: string; token: string }[];
  let connected: Where | undefined;
  let home: string;
  let hadHome: string | undefined;

  beforeEach(async () => {
    pushed = [];
    connected = undefined;
    home = await mkdtemp(path.join(tmpdir(), 'ahpc-auth-'));
    hadHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = home;
    vi.resetModules();
    vi.doMock('../src/connect.js', async (importOriginal) => {
      const real = await importOriginal<typeof import('../src/connect.js')>();
      const { fakeHost } = await import('../src/ahp/fake.js');
      return {
        ...real,
        connect: async (where: Where) => {
          connected = where;
          const host = fakeHost();
          const accepts = host.authenticate;
          host.authenticate = async (resource, token) => {
            pushed.push({ resource, token });
            return await accepts?.call(host, resource, token);
          };
          return host;
        },
      };
    });
  });

  afterEach(async () => {
    vi.doUnmock('../src/connect.js');
    vi.resetModules();
    connected = undefined;
    if (hadHome === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = hadHome;
    await rm(home, { recursive: true, force: true });
  });

  /** One `ahpc auth`, and whatever it threw. */
  const run = async (rest: string[]): Promise<unknown> => {
    const { cli } = await import('../src/cli/main.js');
    return await cli('auth', rest).then(() => null, (error: unknown) => error);
  };

  it('pushes the token --resource-token names, for that resource', async () => {
    expect(await run([RESOURCE, '--resource-token', 'tok-resource'])).toBeNull();
    expect(pushed).toEqual([{ resource: RESOURCE, token: 'tok-resource' }]);
  });

  it('connects with the token in --connection-token-file, and pushes the resource one', async () => {
    const file = path.join(home, 'connection-token');
    await writeFile(file, 'tok-connection\n');
    expect(await run([
      RESOURCE, '--resource-token', 'tok-resource', '--connection-token-file', file,
    ])).toBeNull();
    expect(connected?.token).toBe('tok-connection');
    expect(pushed).toEqual([{ resource: RESOURCE, token: 'tok-resource' }]);
  });

  it('pushes the variable\'s token when --token is only the connection token', async () => {
    const had = process.env.AHPC_TOKEN_API_ANTHROPIC_COM;
    process.env.AHPC_TOKEN_API_ANTHROPIC_COM = 'tok-from-the-variable';
    try {
      expect(await run([RESOURCE, '--token', 'tok-connection'])).toBeNull();
      expect(connected?.token).toBe('tok-connection');
      expect(pushed).toEqual([{ resource: RESOURCE, token: 'tok-from-the-variable' }]);
    } finally {
      if (had === undefined) delete process.env.AHPC_TOKEN_API_ANTHROPIC_COM;
      else process.env.AHPC_TOKEN_API_ANTHROPIC_COM = had;
    }
  });

  it('refuses --token on its own, naming --resource-token, and pushes nothing', async () => {
    const { Fault } = await import('../src/cli/main.js');
    // A terminal, as when a person types it: nothing is piped in.
    const tty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
    let said: unknown;
    try { said = await run([RESOURCE, '--token', 'tok-mistaken']); }
    finally {
      if (tty) Object.defineProperty(process.stdin, 'isTTY', tty);
      else delete (process.stdin as { isTTY?: boolean }).isTTY;
    }
    expect(said).toBeInstanceOf(Fault);
    expect((said as Error).message).toBe(SENTENCE);
    expect(pushed).toEqual([]);
  });
});
