---
title: A session's own pull requests are told from the ones it inherited
domain: screen
status: planned
priority: medium
created: 2026-09-19
revalidated: 2026-09-19
requires: []
changes: []
creates: []
decisions: []
refs:
  - code://.project/review/2026-09-19-upstream-pass-4.md#L30 - the finding and the reference rule this plan ports
  - code://.project/review/2026-09-19-upstream-pass-4.md#L62 - the Left open question, answered in favour of doing the work
  - code://.project/ideas/artifacts-and-references.md - the recorded-reference surface this client does not read, so the stable-id prong has nothing to stand on
  - code://src/state.ts#L609-L651 - `PullRequest`, `urlKey` and `pullRequest()`, which takes `pullRequestUrls[0]` as this session's
  - code://src/state.ts#L653-L657 - `pullRequestLabel()`, the number and its state as a row says it
  - code://src/state.ts#L589-L607 - `sessionView()`, which puts the label on the component's session
  - code://src/screens.tsx#L128-L133 - the Branch detail field, where the label is drawn
  - code://src/screens.tsx#L262 - the catalogue row, the other reader of `sessionView`
  - code://src/ahp/fake.ts#L525-L527 - the fixture's `pullRequest` option, which carries no baseline today
  - code://src/ahp/fake.ts#L638-L646 - where the fixture writes `_meta.github`
  - code://src/ahp/fake.ts#L821-L830 - the seed call for the archived session, whose pull request at :829 is the one the catalogue row draws
  - code://test/pullrequest.test.ts - the unit cases for the rule, which this plan extends
  - code://test/smoke.test.tsx#L869-L875 - the catalogue row case that must stay green
  - file:///github/externals/vscode/src/vs/sessions/services/sessions/common/session.ts#L399-L403 - `getSessionOwnedGitHubPullRequestRefs`, the reference's ownership filter
  - file:///github/externals/vscode/src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts#L391-L421 - `toGitHubPullRequestRefs` and the merge that marks a discovered URL as this session's
  - file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L1674-L1690 - `ISessionGitHubState`, where `initialPullRequestUrls` and `associatedPullRequestUrls` are declared
  - file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L1715-L1722 - `getSessionRelatedPullRequestUrls`, the filter this plan ports
---

## Goal

A person looking at a session sees a pull request drawn beside its branch only when that pull request belongs to this session, so one that came with the checkout is no longer presented as something this session opened or merged.
The rule comes from the reference client, which knows a pull request was added by the session and not inherited from the folder, and this client reads the same two host keys to tell them apart.
A host that sends neither key keeps exactly the row it draws today, so the change cannot break a host that does not know about provenance.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "pullRequest|pullRequestUrl|pullRequestLabel" src/` - the entire `_meta.github` read is in `src/state.ts`: `pullRequest()` at :634, `pullRequestLabel()` at :654, `urlKey` at :618, and `sessionView()` at :589.
- `rg -n "initialPullRequestUrls|associatedPullRequestUrls" src/ test/` - nothing; neither key is read anywhere in this repository today.
- `rg -n "artifact|recordedReference|sessionArtifacts" src/` - nothing; the client has no artifact or reference surface, which is why the stable-id prong of the rule cannot be ported here (idea `artifacts-and-references.md`).
- `rg -n "pull request|pullRequest" test/` - `test/pullrequest.test.ts` holds the unit cases, and `test/smoke.test.tsx:869` is the only case that draws the label on a row.
- `rg -n "getSessionOwnedGitHubPullRequestRefs|initialPullRequestUrls|associatedPullRequestUrls|getSessionRelatedPullRequestUrls" src/vs/` in the clone - the helper at `sessions/services/sessions/common/session.ts:400`, the two keys at `src/vs/platform/agentHost/common/state/sessionState.ts:1682,1684`, and the provider's use at `baseAgentHostSessionsProvider.ts:402,446`.

### Runtime path

```
listSessions -> SessionSummary -> _meta.github
  -> pullRequest(): urls = pullRequestUrls (or the singular pullRequestUrl)
     -> owned = urls.filter(not in initialPullRequestUrls or in associatedPullRequestUrls)
     -> url = owned[0] -> the branch check (:641) -> the state-on-its-own-URL check (:645)
  -> PullRequest -> pullRequestLabel() -> sessionView()
  -> SessionList row (screens.tsx:262) and SessionDetails Branch field (screens.tsx:131)
```

### Gaps

- No ownership filter exists: `pullRequest()` takes `urls[0]` at `src/state.ts:639` and the two keys behind the reference rule are never read.
- The recorded-reference prong is unreachable here, because the client reads none of `agentHost/sessionArtifacts` and has no place a stable reference id would live.
- No test builds a session whose only pull request is inherited, so the defect the review found is invisible to the suite.
- `Not found: a client-side read of initialPullRequestUrls or associatedPullRequestUrls - searched "initialPullRequestUrls|associatedPullRequestUrls" in src/ and test/.`
- The host half is in another repository, at ahpd `.project/plans/host/03-pull-request-baseline/plan.md`, and this repository's own host sends neither key today (the review's Left open).

## Decisions locked in

No decision file, because the rule is the reference's own and a gap against the reference is fixed in a task rather than recorded as a fork.
What this plan settled without one:

| What | Source | Task |
| --- | --- | --- |
| A pull request is owned when it is in `pullRequestUrls` and not in `initialPullRequestUrls`, or it is in `associatedPullRequestUrls` | `getSessionRelatedPullRequestUrls`, `file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L1715-L1722` | 01 |
| The chosen pull request is the first owned URL, in the host's most-recent-first order | `pullRequests.find(createdByThisSession)`, `file:///github/externals/vscode/src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts#L446` | 01 |
| Neither key present means no filtering, so a host that sends neither keeps drawing the head as this session's | `initialPullRequestUrls ?? []`, `file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L1717-L1718` | 01 |
| The recorded-reference prong is not ported, so a reference with a stable id cannot mark ownership here | idea `artifacts-and-references.md`; the review's Left open | 01 |
| The branch check and the state-on-its-own-URL check stay as they are, applied to the chosen URL | `code://src/state.ts#L641-L650` | 01 |
| The host half is ahpd `.project/plans/host/03-pull-request-baseline/plan.md`, a different repository, so it is prose and not a frontmatter `requires` | this plan's brief, 2026-09-19 | 01 |

## Proposed architecture

- **Data flow** - `pullRequest()` reads `_meta.github`, builds the URL list from `pullRequestUrls` or the singular `pullRequestUrl`, keys `initialPullRequestUrls` and `associatedPullRequestUrls` through `urlKey`, filters with the reference's `!initial.has(urlKey(url)) || associated.has(urlKey(url))`, takes the first survivor, and then applies the branch and state checks exactly as it does now.
- **Event flow** - none; both readers take the `SessionSummary` the catalogue already holds, and nothing is fetched.
- **State flow** - none; no key is added and nothing is stored.
- **Layer responsibilities** - `src/state.ts`: the rule, `urlsIn()` and the filter · `src/screens.tsx`: the catalogue row and the detail field, untouched · `src/ahp/fake.ts`: the fixture, untouched because its seeded pull request has no baseline and stays owned · `test/pullrequest.test.ts`: the cases.
- **Source-of-truth files** - `code://src/state.ts`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The ownership filter](task-01-ownership-filter.md) | todo | - |

## Risks and tradeoffs

- A host that sends `initialPullRequestUrls` but not `associatedPullRequestUrls` will start hiding a pull request it used to draw, which is the whole point but is a visible change; the fixture's seeded pull request carries no baseline and the case at `test/smoke.test.tsx:869` must stay green.
- The recorded-reference prong has no client representation, so a pull request a person recorded as a reference with a stable id and the host did not also put in `associatedPullRequestUrls` still reads as inherited; the artifacts idea is where that would change.
- The two keys are a host convention inside the open `_meta` map rather than declared wire, so a second host may spell or omit them differently; every read is defensive (a non-array is no list, a non-string is not a URL) and an absent list filters nothing.
- The host half is in another repository, so until ahpd host/03 lands the filter is proven only against hand-built sessions and the fixture.

## Resume state

- **Done so far:** nothing; the plan was written 2026-09-19 from the upstream pass 4 review.
- **Next action:** [task-01-ownership-filter.md](task-01-ownership-filter.md).
- **Open questions:**
  1. Does ahpd host/03 send `initialPullRequestUrls` as a captured empty array or omit the key? Proposed: either is read the same way, because an absent list and an empty list both leave every `pullRequestUrls` entry owned, which is what the reference's `?? []` does.
- **Watch out for:** the singular `pullRequestUrl` spelling must go through the same filter, or a host that sends one URL bypasses ownership; and the host half, ahpd `.project/plans/host/03-pull-request-baseline/plan.md`, is prose here and in the index row and never a frontmatter `requires`, because a path into another repository cannot resolve.

## Final verification checklist

- [ ] `test/pullrequest.test.ts` covers both keys absent, an inherited URL, an associated URL that is also in the baseline, the first owned URL winning, and the case and trailing-slash spellings.
- [ ] The case at `test/smoke.test.tsx:869` still draws `cleanup/compile-script #412 merged`.
- [ ] `npm test` green.
- [ ] `npm run typecheck` green.
- [ ] `plans/index.md` updated.
