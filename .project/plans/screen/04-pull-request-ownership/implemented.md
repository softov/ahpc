---
title: A session's own pull requests are told from the ones it inherited - implemented
date: 2026-09-20
refs:
  - code://src/state.ts
  - code://test/pullrequest.test.ts
  - code://test/smoke.test.tsx
---

A session's pull request is now drawn beside its branch only when the host says this session owns it.
`pullRequest()` reads the `initialPullRequestUrls` baseline that came with the checkout and the `associatedPullRequestUrls` a person attached, keeps a URL when it is not in the first or is in the second, and takes the first survivor before the branch and state checks.
A host that sends neither key filters nothing, so a row that draws the head today keeps drawing it, and no screen, fixture or stored key changed.

## What was built

- `code://src/state.ts` - `urlsIn(value)`, which returns the strings of an array and `[]` for anything else, and `pullRequest()`, which builds the baseline and associated sets through `urlKey` and chooses the first owned URL instead of the head, leaving the branch, number and state checks applied to the chosen URL.
- `code://test/pullrequest.test.ts` - the cases for the ownership rule.

## Verified

- `test/pullrequest.test.ts`, 13 tests: the existing six cases plus an inherited-only URL, the same URL associated, the first owned URL winning with its own state, no baseline present, a case or trailing-slash spelling, the singular `pullRequestUrl` spelling and a baseline that is not a list of URLs.
- `test/smoke.test.tsx`, 140 tests: the catalogue case that puts the pull request beside the branch still draws `cleanup/compile-script #412 merged`, because the fixture sends no baseline.
- `npm test` green at 29 files and 564 tests, and `npm run typecheck` green.

## Departures from the plan

- none.

## Left for later

- The recorded-reference prong is not ported, because this client reads no `agentHost/sessionArtifacts` and has no place a stable reference id would live; see [the artifacts idea](../../../ideas/artifacts-and-references.md) for where that would change.
- The host half is ahpd `.project/plans/host/03-pull-request-baseline/plan.md`, in another repository, so the filter is proven against hand-built sessions and the fixture rather than a live host.
- No `deferred.md`: nothing was set aside.
