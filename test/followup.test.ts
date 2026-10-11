import { describe, expect, it } from 'vitest';
import { commitMeta, createPrMeta, decodeDataUri, externalLink, pullRequestDraft } from '../src/ahp/followup.js';
import type { FollowUp } from '../src/ahp/types.js';

/**
 * What an operation sends back, read the way the reference host writes it.
 *
 * The draft is the case worth the care: its `context` goes back to the host
 * untouched, and a draft read without one would create a pull request against
 * branches nobody confirmed.
 */

const DRAFT = {
  title: 'Build on Linux',
  description: 'Adds the script.',
  branchName: 'agent/linux',
  baseBranchName: 'main',
  repository: 'softov/brb_backend',
  context: { head: 'abc', nested: [1, 2] },
};

const json = (value: unknown): FollowUp => ({
  content: { uri: `data:application/json,${encodeURIComponent(JSON.stringify(value))}`, contentType: 'application/json' },
});

describe('a follow-up, read', () => {
  it('reads a percent-encoded draft', () => {
    const draft = pullRequestDraft(json(DRAFT));
    expect(draft?.title).toBe('Build on Linux');
    expect(draft?.description).toBe('Adds the script.');
    expect(draft?.branchName).toBe('agent/linux');
    expect(draft?.context).toEqual(DRAFT.context);
  });

  it('reads a base64 draft', () => {
    const uri = `data:application/json;base64,${Buffer.from(JSON.stringify({ ...DRAFT, title: 'Construir no Linux' })).toString('base64')}`;
    expect(pullRequestDraft({ content: { uri } })?.title).toBe('Construir no Linux');
  });

  it('does not read an external link as a draft', () => {
    const link: FollowUp = { content: { uri: 'https://github.com/softov/brb_backend/pull/7', contentType: 'text/html' }, external: true };
    expect(pullRequestDraft(link)).toBeNull();
    expect(externalLink(link)).toBe('https://github.com/softov/brb_backend/pull/7');
    expect(externalLink(json(DRAFT))).toBeNull();
  });

  it('does not read a draft without a context', () => {
    const { context: _dropped, ...bare } = DRAFT;
    expect(pullRequestDraft(json(bare))).toBeNull();
  });

  it('cannot read a data URI that is not JSON', () => {
    expect(pullRequestDraft({ content: { uri: 'data:text/plain,hello', contentType: 'text/plain' } })).toBeNull();
    expect(pullRequestDraft({ content: { uri: 'data:,not%20json' } })).toBeNull();
    expect(decodeDataUri('https://example.com')).toBeNull();
  });

  it('builds the arguments the two verbs take', () => {
    expect(commitMeta('Fix the build')).toEqual({ 'ahpd.commit': { message: 'Fix the build' } });
    const draft = pullRequestDraft(json(DRAFT));
    if (!draft) throw new Error('no draft');
    expect(createPrMeta({ ...draft, title: 'Changed' }, true)).toEqual({
      'vscode.pullRequest': { title: 'Changed', description: 'Adds the script.', draft: true, expectedContext: DRAFT.context },
    });
  });
});
