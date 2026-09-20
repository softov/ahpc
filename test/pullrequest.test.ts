import { describe, expect, it } from 'vitest';
import { pullRequest, pullRequestLabel } from '../src/state.js';
import type { SessionSummary } from '../src/ahp/types.js';

/*
 * The pull request beside the branch.
 *
 * The reference host finds one for a session's branch and keeps it in
 * `_meta.github`, with the last state it saw; its window draws the state on
 * the pill. The rules for when the state applies are the host's own, and a
 * row that ignores them says "merged" against a number it is not the state of.
 */

const PR = 'https://github.com/brbyte/brb_backend/pull/412';

const session = (github: Record<string, unknown>, branch = 'fix/kqueue'): SessionSummary => ({
  resource: 'ahp-session:/s1', title: 'A session', provider: 'claude', status: 1,
  workingDirectories: ['file:///brb_main/src/brb_backend'],
  _meta: { git: { branchName: branch }, github },
} as unknown as SessionSummary);

describe('the pull request the host found', () => {
  it('is the most recent one, by number, with its state', () => {
    expect(pullRequest(session({
      pullRequestUrls: [PR, 'https://github.com/brbyte/brb_backend/pull/400'],
      pullRequestState: 'merged', pullRequestStateUrl: PR,
    }))).toEqual({ number: '412', state: 'merged' });
    expect(pullRequestLabel(session({ pullRequestUrls: [PR], pullRequestState: 'open', pullRequestStateUrl: PR })))
      .toBe('#412 open');
  });

  it('is the number alone when the state was observed on another request', () => {
    expect(pullRequest(session({
      pullRequestUrls: [PR],
      pullRequestState: 'merged', pullRequestStateUrl: 'https://github.com/brbyte/brb_backend/pull/400',
    }))).toEqual({ number: '412' });
    expect(pullRequestLabel(session({ pullRequestUrls: [PR] }))).toBe('#412');
  });

  it('matches the state URL the way the host does: case and a trailing slash', () => {
    expect(pullRequest(session({
      pullRequestUrls: [PR], pullRequestState: 'closed', pullRequestStateUrl: `${PR.toUpperCase()}/`,
    }))?.state).toBe('closed');
  });

  it('is nothing for a request found on another branch', () => {
    expect(pullRequest(session({ pullRequestUrls: [PR], pullRequestBranchName: 'main' }))).toBeUndefined();
    // And still this branch's when the host has not said which branch it was
    // found on, which is what state from before it tracked that looks like.
    expect(pullRequest(session({ pullRequestUrls: [PR] }))?.number).toBe('412');
  });

  it('is nothing without a request, or with one that is not a pull URL', () => {
    expect(pullRequest(session({}))).toBeUndefined();
    expect(pullRequest(session({ pullRequestUrls: [] }))).toBeUndefined();
    expect(pullRequest(session({ pullRequestUrls: ['https://github.com/brbyte/brb_backend'] }))).toBeUndefined();
    expect(pullRequest({ resource: 'ahp-session:/s1' } as unknown as SessionSummary)).toBeUndefined();
  });

  it('reads the single-URL spelling the host accepts too', () => {
    expect(pullRequest(session({ pullRequestUrl: PR }))?.number).toBe('412');
  });
});

/*
 * The baseline a checkout came with.
 *
 * A folder-isolated session starts on a checkout that may already have a pull
 * request open; the host records it in `initialPullRequestUrls` so a row does
 * not present it as something this session opened or merged. A person who
 * attaches one by hand puts it in `associatedPullRequestUrls`, which overrides
 * the baseline, and a host that sends neither key filters nothing.
 */
describe('the pull request this session owns', () => {
  const OWNED = 'https://github.com/brbyte/brb_backend/pull/500';

  it('is nothing when the only request came with the checkout', () => {
    expect(pullRequest(session({
      pullRequestUrls: [PR], initialPullRequestUrls: [PR],
    }))).toBeUndefined();
  });

  it('is this session\'s again when a person attached it', () => {
    expect(pullRequestLabel(session({
      pullRequestUrls: [PR], initialPullRequestUrls: [PR], associatedPullRequestUrls: [PR],
    }))).toBe('#412');
  });

  it('is the first owned request when the head is inherited', () => {
    expect(pullRequest(session({
      pullRequestUrls: [PR, OWNED], initialPullRequestUrls: [PR],
    }))?.number).toBe('500');
    // And its state applies on its own URL, not the inherited head's.
    expect(pullRequest(session({
      pullRequestUrls: [PR, OWNED], initialPullRequestUrls: [PR],
      pullRequestState: 'merged', pullRequestStateUrl: OWNED,
    }))).toEqual({ number: '500', state: 'merged' });
  });

  it('leaves the head owned when the host sends no baseline', () => {
    expect(pullRequest(session({ pullRequestUrls: [PR] }))?.number).toBe('412');
    expect(pullRequestLabel(session({ pullRequestUrls: [PR] }))).toBe('#412');
  });

  it('matches a baseline spelling that differs in case or a trailing slash', () => {
    expect(pullRequest(session({
      pullRequestUrls: [PR], initialPullRequestUrls: [`${PR.toUpperCase()}/`],
    }))).toBeUndefined();
    expect(pullRequest(session({
      pullRequestUrls: [`${PR.toUpperCase()}/`], initialPullRequestUrls: [PR],
    }))).toBeUndefined();
  });

  it('filters the single-URL spelling too', () => {
    expect(pullRequest(session({
      pullRequestUrl: PR, initialPullRequestUrls: [PR],
    }))).toBeUndefined();
    expect(pullRequestLabel(session({
      pullRequestUrl: PR, initialPullRequestUrls: [PR], associatedPullRequestUrls: [PR],
    }))).toBe('#412');
  });

  it('filters nothing for a baseline that is not a list of URLs', () => {
    expect(pullRequest(session({ pullRequestUrls: [PR], initialPullRequestUrls: 'nope' }))?.number).toBe('412');
    expect(pullRequest(session({ pullRequestUrls: [PR], initialPullRequestUrls: [412] }))?.number).toBe('412');
    expect(pullRequest(session({ pullRequestUrls: [PR], associatedPullRequestUrls: { [PR]: true } }))?.number).toBe('412');
  });
});
