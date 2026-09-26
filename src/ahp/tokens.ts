/**
 * Resource tokens: where one comes from, and how long one is kept.
 *
 * A **resource** token is the credential `authenticate` pushes for something a
 * host protects. It is not the **connection** token, which goes into the
 * endpoint URL and is none of this module's business.
 *
 * One is found in `AHPC_TOKEN_<RESOURCE>` first and in a cache second. The
 * cache lives as long as the process, in a private map rather than the
 * reactive store, and nothing here writes to disk or sets a variable: a
 * session spawns child processes that inherit this one's environment.
 *
 * Nothing here renders, stores or opens a socket.
 */

import { authRequiredOf } from './auth.js';

/** Tokens a host accepted during this run, by resource. */
const accepted = new Map<string, string>();

/**
 * The environment variable a resource's token is read from.
 *
 * Derived from the resource rather than fixed, because a host may protect
 * several and one variable for all of them is one credential for all of them:
 * `https://api.anthropic.com` becomes `AHPC_TOKEN_API_ANTHROPIC_COM`.
 */
export function tokenVariable(resource: string): string {
  const name = resource.replace(/^[a-z]+:\/\//, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `AHPC_TOKEN_${name.toUpperCase()}`;
}

/** A token for `resource`, from the environment and then the cache, or `undefined`. */
export function resolveToken(resource: string): string | undefined {
  const said = process.env[tokenVariable(resource)];
  if (said !== undefined && said !== '') return said;
  return accepted.get(resource);
}

/** Keep a token the host accepted, for the rest of the run. */
export function remember(resource: string, token: string): void {
  accepted.set(resource, token);
}

/**
 * Drop a cached token when `error` says the host does not know it.
 *
 * Only an authentication refusal counts. A wrong resource (`-32602`), a dropped
 * link or a host fault says nothing about the credential, so the entry stays.
 * Answers whether it was dropped.
 */
export function forget(resource: string, error: unknown): boolean {
  if (authRequiredOf(error) === null) return false;
  return accepted.delete(resource);
}

/**
 * Push a token for everything the host protects that this run has one for.
 *
 * Silent: a resource with no token is skipped, and every failure is swallowed,
 * because a connection must not fail over a credential nobody asked for.
 */
export async function pushTokens(host: {
  protectedResources?(): Promise<{ resource: string }[]>;
  authenticate?(resource: string, token: string): Promise<unknown>;
}): Promise<void> {
  if (!host.protectedResources || !host.authenticate) return;
  let declared: { resource: string }[];
  try { declared = await host.protectedResources(); }
  catch { return; }
  for (const { resource } of declared) {
    const token = resolveToken(resource);
    if (token === undefined) continue;
    try { await host.authenticate(resource, token); }
    catch (error) { forget(resource, error); }
  }
}

/** Empty the cache. For tests, which share one process. */
export function forgetAll(): void {
  accepted.clear();
}
