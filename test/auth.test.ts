import { describe, expect, it } from 'vitest';
import {
  AUTH_REQUIRED, attempt, authRequiredOf, authRequiredReason, askFor, failureWords, hostWords, retryAllowed,
} from '../src/ahp/auth.js';
import { needsToken } from '../src/cli/main.js';

/*
 * The refusal, read once, and the one retry a credential buys.
 *
 * No socket and no React: the rule lives above neither, and a test that had to
 * raise a terminal to check "one attempt is one attempt" would be checking the
 * terminal. What is here is what every front end reads.
 */

/** A `-32007` in the shape the SDK throws, with whatever the host named. */
function refused(resources?: Record<string, unknown>[], message = 'Authentication required'): Error {
  return Object.assign(new Error(message), {
    code: AUTH_REQUIRED,
    ...(resources === undefined ? {} : { data: { resources } }),
  });
}

describe('reading a refusal', () => {
  it('reads the resources in the host order, with the name the host gave each', () => {
    const error = refused([
      { resource: 'https://api.anthropic.com', resource_name: 'Anthropic API' },
      { resource: 'https://api.github.com', resource_name: 'GitHub' },
    ]);

    expect(authRequiredOf(error)).toEqual({
      resources: [
        { resource: 'https://api.anthropic.com', name: 'Anthropic API' },
        { resource: 'https://api.github.com', name: 'GitHub' },
      ],
      words: 'Authentication required',
    });
  });

  it('reads the older description as the name when resource_name is absent', () => {
    const refusal = authRequiredOf(refused([{ resource: 'https://api.github.com', description: 'GitHub' }]));
    expect(refusal?.resources).toEqual([{ resource: 'https://api.github.com', name: 'GitHub' }]);
  });

  it('names a resource the host mentioned twice only once', () => {
    const refusal = authRequiredOf(refused([
      { resource: 'https://api.anthropic.com' },
      { resource: 'https://api.anthropic.com' },
    ]));
    expect(refusal?.resources).toEqual([{ resource: 'https://api.anthropic.com' }]);
  });

  it('reads a -32007 with no data as a refusal that names no door, and asks nothing', () => {
    const refusal = authRequiredOf(refused());
    expect(refusal).not.toBeNull();
    expect(refusal?.resources).toEqual([]);
    expect(askFor(refusal!)).toBeNull();
  });

  it('is not an auth refusal for another code', () => {
    expect(authRequiredOf(Object.assign(new Error('nope'), { code: -32005 }))).toBeNull();
    expect(authRequiredOf(new Error('nope'))).toBeNull();
  });

  it('takes the SDK wrapper off the host words', () => {
    expect(hostWords('RPC error -32007: Authentication required')).toBe('Authentication required');
    expect(hostWords('Authentication required')).toBe('Authentication required');
    expect(failureWords(refused(undefined, 'RPC error -32007: Authentication required')))
      .toBe('Authentication required');
    expect(failureWords(new Error('the host is busy'))).toBe('the host is busy');
  });

  it('reads a dispatch rejection whose words carry the code, and names no resource', () => {
    const refusal = authRequiredReason('RPC error -32007: Authentication required');
    expect(refusal?.resources).toEqual([]);
    expect(refusal?.words).toBe('Authentication required');
    // A code is the only door: a reason that does not carry one is not a refusal.
    expect(authRequiredReason('the host is busy')).toBeNull();
    expect(authRequiredReason('-320071 is not the code')).toBeNull();
  });

  it('asks for the first resource the host named, carrying the name and the words', () => {
    const refusal = authRequiredOf(refused([
      { resource: 'https://api.anthropic.com', resource_name: 'Anthropic API' },
      { resource: 'https://api.github.com', resource_name: 'GitHub' },
    ]));

    expect(askFor(refusal!)).toEqual({
      resource: 'https://api.anthropic.com',
      name: 'Anthropic API',
      words: 'Authentication required',
    });
    expect(askFor({ resources: [], words: 'no door' })).toBeNull();
  });

  it('allows exactly one more attempt, and not two', () => {
    expect(retryAllowed(0)).toBe(true);
    expect(retryAllowed(1)).toBe(false);
    expect(retryAllowed(2)).toBe(false);
  });
});

describe('the one retry', () => {
  it('runs an act that works exactly once, and never asks', async () => {
    let calls = 0;
    let asked = 0;
    const answer = await attempt(
      async () => { calls += 1; return 'ok'; },
      async () => { asked += 1; return true; },
    );

    expect(answer).toBe('ok');
    expect(calls).toBe(1);
    expect(asked).toBe(0);
  });

  it('runs the same act once more after an accepted credential', async () => {
    let calls = 0;
    const asked: string[] = [];
    const answer = await attempt(
      async () => {
        calls += 1;
        if (calls === 1) throw refused([{ resource: 'https://api.anthropic.com' }]);
        return 'ok';
      },
      async (one) => { asked.push(one.resource); return true; },
    );

    expect(answer).toBe('ok');
    expect(calls).toBe(2);
    expect(asked).toEqual(['https://api.anthropic.com']);
  });

  it('runs the act once when the credential is declined, and reports the refusal', async () => {
    let calls = 0;
    let asked = 0;
    await expect(attempt(
      async () => { calls += 1; throw refused([{ resource: 'https://api.anthropic.com' }]); },
      async () => { asked += 1; return false; },
    )).rejects.toThrow('Authentication required');
    expect(calls).toBe(1);
    expect(asked).toBe(1);
  });

  it('stops with the first refusal when the one more attempt is refused too', async () => {
    const first = refused([{ resource: 'https://api.anthropic.com' }], 'the first no');
    const second = refused([{ resource: 'https://api.anthropic.com' }], 'the second no');
    let calls = 0;

    const thrown = await attempt(
      async () => { calls += 1; throw calls === 1 ? first : second; },
      async () => true,
    ).catch((error: unknown) => error);

    expect(calls).toBe(2);
    // A second refusal is the host's answer rather than a second question.
    expect(thrown).toBe(first);
  });

  it('asks nothing for a refusal that names no door', async () => {
    let asked = 0;
    await expect(attempt(
      async () => { throw refused(); },
      async () => { asked += 1; return true; },
    )).rejects.toThrow('Authentication required');
    expect(asked).toBe(0);
  });
});

describe('a refusal in a shell', () => {
  it('names the resource and the variable that would satisfy it', () => {
    expect(needsToken('https://api.anthropic.com', 'Anthropic API')).toBe(
      'Anthropic API (https://api.anthropic.com) needs a token. '
      + 'Pass --token, set AHPC_TOKEN_API_ANTHROPIC_COM, or pipe one in: '
      + 'ahpc auth https://api.anthropic.com',
    );
  });

  it('names the resource alone when the host gave no name for it', () => {
    expect(needsToken('https://api.github.com')).toContain('https://api.github.com needs a token');
    expect(needsToken('https://api.github.com')).toContain('AHPC_TOKEN_API_GITHUB_COM');
  });
});
