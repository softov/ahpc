/**
 * What a changeset operation sends back, and the arguments two of them take.
 *
 * `followUp` is a `ContentRef` and a flag, and the protocol says nothing about
 * what the content is. The reference host answers two shapes through it:
 *
 * - **`external: true`** is a link for the person's own handler, such as the
 *   pull request `create-pr` opened. This client never fetches it.
 * - **`data:application/json`** is the pull request `prepare-pull-request`
 *   wrote: a title, a description, the branches and an opaque `context` that
 *   goes back to `create-pr` exactly as it arrived.
 *
 * Read by the screen and by the shell, so there is no textui here. ahpapp
 * reads the same shapes in its own `src/changeset-followup.ts`, and ahpd writes
 * them in `packages/sdk/src/changes.ts`; ahpc shares no package with either.
 */

import type { ChangesetOperation, FollowUp } from './types.js';

function bag(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** A `data:` URI, decoded. `contentType` is what its header named, when it named one. */
export interface DataBody {
  contentType: string | null;
  text: string;
}

/**
 * A `data:` URI read in place, or `null` for anything else.
 *
 * Both forms the protocol allows: percent-encoded, which the reference host
 * sends, and `;base64`.
 */
export function decodeDataUri(uri: string): DataBody | null {
  if (!uri.startsWith('data:')) return null;
  const comma = uri.indexOf(',');
  if (comma < 0) return null;
  const parts = uri.slice('data:'.length, comma).split(';');
  const body = uri.slice(comma + 1);
  try {
    const text = parts.includes('base64')
      ? Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
      : decodeURIComponent(body);
    return { contentType: parts[0] === '' ? null : parts[0] ?? null, text };
  }
  catch {
    return null;
  }
}

/** A pull request, as the form shows it and as `create-pr` takes it back. */
export interface PullRequestDraft {
  title: string;
  description: string;
  branchName: string | null;
  baseBranchName: string | null;
  repository: string | null;
  /** The host's opaque `context`, kept whole for `create-pr` to check. */
  context: unknown;
}

/** The form with nothing in it, for a host that offers no `prepare-pull-request`. */
export const EMPTY_DRAFT: PullRequestDraft = {
  title: '', description: '', branchName: null, baseBranchName: null, repository: null, context: undefined,
};

/**
 * The pull request a follow-up carries, or `null` when it carries none.
 *
 * A draft needs a title and a `context`: without the `context`, `create-pr`
 * has nothing to check the tree against. `body` is read where `description`
 * is missing, because the reference client's documents use that name.
 */
export function pullRequestDraft(followUp: FollowUp | undefined): PullRequestDraft | null {
  if (!followUp || followUp.external === true) return null;
  const read = decodeDataUri(followUp.content.uri);
  if (!read) return null;
  // A hint, not a gate: `application/json; charset=utf-8`, or no type at all,
  // still means JSON.
  const named = followUp.content.contentType;
  if (named !== undefined && !named.includes('json') && read.contentType?.includes('json') !== true) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.text);
  }
  catch {
    return null;
  }
  const held = bag(parsed);
  const title = str(held.title);
  if (title === null || !('context' in held)) return null;
  return {
    title,
    description: str(held.description) ?? str(held.body) ?? '',
    branchName: str(held.branchName),
    baseBranchName: str(held.baseBranchName),
    repository: str(held.repository),
    context: held.context,
  };
}

/** The link a follow-up hands to the person, or `null` when it is not one. */
export function externalLink(followUp: FollowUp | undefined): string | null {
  if (!followUp || followUp.external !== true) return null;
  return str(followUp.content.uri);
}

/**
 * The `_meta` key a commit's message goes under.
 *
 * The host's own key, because the protocol has none. The reference host reads
 * only this name.
 */
export const COMMIT_META = 'ahpd.commit';

/** The `_meta` key the reference client puts a pull request's form under. */
export const PULL_REQUEST_META = 'vscode.pullRequest';

/** The verb that writes the pull request draft. */
export const PREPARE_PULL_REQUEST = 'prepare-pull-request';

/** The verb that opens the pull request. */
export const CREATE_PULL_REQUEST = 'create-pr';

/**
 * The operations a person chooses from.
 *
 * `prepare-pull-request` is the first step of `create-pr` when both are
 * offered, so it is not listed on its own then.
 */
export function chosenOperations(operations: readonly ChangesetOperation[]): ChangesetOperation[] {
  const creates = operations.some((one) => one.id === CREATE_PULL_REQUEST);
  return operations.filter((one) => !(creates && one.id === PREPARE_PULL_REQUEST));
}

/** The `_meta` a commit carries: its message. */
export function commitMeta(message: string): Record<string, unknown> {
  return { [COMMIT_META]: { message } };
}

/**
 * The `_meta` a `create-pr` carries.
 *
 * `expectedContext` is the draft's `context` exactly as it arrived; the host
 * refuses a tree that moved since it was prepared.
 */
export function createPrMeta(draft: PullRequestDraft, isDraft: boolean): Record<string, unknown> {
  return {
    [PULL_REQUEST_META]: {
      title: draft.title,
      description: draft.description,
      draft: isDraft,
      ...(draft.context === undefined ? {} : { expectedContext: draft.context }),
    },
  };
}
