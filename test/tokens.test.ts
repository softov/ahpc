/*
 * Where a resource token comes from, how long it is kept, and when it is let go.
 *
 * The environment variable wins over the cache, the cache lasts the process,
 * and only a host saying it does not know the credential drops one. Nothing
 * reaches the disk.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { forget, forgetAll, pushTokens, remember, resolveToken, tokenVariable } from '../src/ahp/tokens.js';

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
