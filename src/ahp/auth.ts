/**
 * A refusal, read once, and the one retry a credential buys.
 *
 * A `-32007` is read here, off a request that rejects with the JSON-RPC code in
 * its `code`, so nothing above this file has to know what a protocol code is. A
 * dispatch carries its refusal as a `rejectionReason` string instead, with no
 * code to read; that shape is not retried and so is not read here. See
 * `deferred.md` beside the plan.
 *
 * The discipline is the reference client's, stated as three rules. One attempt
 * is one attempt, so a refusal is read rather than retried in place. One
 * accepted credential buys exactly one more attempt, so the same act runs once
 * after the host takes the token. And a second refusal is the host's answer
 * rather than a second question, so `attempt` stops with it.
 *
 * Nothing here renders, stores or opens a socket: it is the reading and the
 * rule, and the front end decides what a person sees.
 */

/** AHP's `AuthRequired`, the JSON-RPC code for "authenticate for this first". */
export const AUTH_REQUIRED = -32007;

/** The SDK puts `RPC error -32007: ` in front of the host's own message. */
const WRAPPER = /^RPC error -?\d+:\s*/;

/** One protected resource a host named, and its own word for it when it gave one. */
export interface AuthResource {
  /** The identifier `authenticate` takes, which MUST match one the host advertised. */
  resource: string;
  /** The host's human-readable name, from `ProtectedResourceMetadata.resource_name`. */
  name?: string;
}

/** A refusal, read: everything the host named, and its own words with the wrapper off. */
export interface AuthRefusal {
  /** Every resource the host named, in its order, deduplicated. Empty for a dispatch. */
  resources: AuthResource[];
  /** The host's own words, wrapper removed. */
  words: string;
}

/**
 * What a prompt is asked to collect.
 *
 * One resource rather than all of them: the host named each, and a credential
 * is for one. `name` is the host's word for it when it gave one. `reason` comes
 * only from an `auth/required` notification, because the error's `data` carries
 * none. `words` is the host's refusal, empty when a notification is the source.
 */
export interface AuthAsk {
  resource: string;
  name?: string;
  reason?: string;
  words: string;
}

function bag(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** The host's own words, without the client's wrapper. */
export function hostWords(message: string): string {
  return message.replace(WRAPPER, '');
}

/**
 * A thrown request failure, read as an auth refusal, or `null` when it was
 * something else.
 *
 * The code decides rather than the message: a host is free to word a refusal
 * however it likes, and one that happened to say "auth" about a different error
 * would otherwise open the wrong door. The resource's name is read from
 * `resource_name`, which is what `ProtectedResourceMetadata` calls it; a host
 * that sent the older `description` is still read.
 */
export function authRequiredOf(error: unknown): AuthRefusal | null {
  const held = bag(error);
  if (held.code !== AUTH_REQUIRED) return null;

  const resources: AuthResource[] = [];
  for (const raw of list(bag(held.data).resources)) {
    const one = bag(raw);
    const resource = str(one.resource);
    if (resource === null) continue;
    // The first mention wins: a host that named the same door twice is one
    // refusal, and re-asking does not help.
    if (resources.some((seen) => seen.resource === resource)) continue;
    const name = str(one.resource_name) ?? str(one.description);
    resources.push({ resource, ...(name !== null ? { name } : {}) });
  }

  const said = typeof held.message === 'string'
    ? held.message
    : error instanceof Error
      ? error.message
      : String(error);
  return { resources, words: hostWords(said) };
}

/** The sentence to draw for a failed act: a refusal's own words, or the error's. */
export function failureWords(error: unknown): string {
  const refusal = authRequiredOf(error);
  if (refusal !== null) return refusal.words;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Which resource to ask for, or `null` when the refusal named no door.
 *
 * Only the first the host named is asked for. A second one belongs to a
 * different act's refusal, and a refusal that named none is drawn rather than
 * guessed at: `authenticate` MUST name a resource the host advertised, so a
 * guess is a request the host is obliged to refuse.
 */
export function askFor(refusal: AuthRefusal, reason?: string): AuthAsk | null {
  const first = refusal.resources[0];
  if (first === undefined) return null;
  return {
    resource: first.resource,
    ...(first.name !== undefined ? { name: first.name } : {}),
    ...(reason !== undefined ? { reason } : {}),
    words: refusal.words,
  };
}

/**
 * Run an act, and run it once more after a credential.
 *
 * `once` is the whole of one call, so a catalogue read and a session create
 * differ only in what they hand this. A refusal with a door opens the asker and
 * waits; a credential the host turns down, a dismissed prompt or a refusal that
 * named nothing throws the original refusal. A second refusal after a credential
 * is the host's answer, and the first one is what the caller reports.
 */
export async function attempt<T>(once: () => Promise<T>, ask: (one: AuthAsk) => Promise<boolean>): Promise<T> {
  let refused: unknown;
  try {
    return await once();
  }
  catch (error) {
    const refusal = authRequiredOf(error);
    if (refusal === null) throw error;
    const one = askFor(refusal);
    if (one === null) throw error;
    refused = error;
    // A closed prompt and a credential the host turned down are the same news:
    // the act does not run again, and what the caller sees is the host's no.
    if (!(await ask(one))) throw error;
  }
  try {
    return await once();
  }
  catch (error) {
    // The one more attempt was refused too. That is the answer, not a second
    // question, so what surfaces is the refusal that started this.
    if (authRequiredOf(error) !== null && refused !== undefined) throw refused;
    throw error;
  }
}
