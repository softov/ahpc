---
title: An operation carries its arguments and brings back its answer
status: todo
depends: []
layer: "ahp"
refs:
  - "[code://src/ahp/connection.ts#L365](../../../../src/ahp/connection.ts#L365) - `invoke`, the contract that changes"
  - "[code://src/ahp/live.ts#L1250-L1256](../../../../src/ahp/live.ts#L1250-L1256) - `decodeInvoked`, which drops `followUp`"
  - "[code://src/ahp/live.ts#L3035-L3041](../../../../src/ahp/live.ts#L3035-L3041) - the request, which sends no `_meta`"
  - "[code://src/ahp/operate.ts](../../../../src/ahp/operate.ts) - `operate()`, which passes the arguments through its retry"
  - "[code://src/ahp/fake.ts#L2027-L2063](../../../../src/ahp/fake.ts#L2027-L2063) - the fake host's `invoke` and what it records"
  - file:///github/ahpapp/src/changeset-followup.ts - `decodeDataUri`, `pullRequestDraft` and `externalFollowUp`, the reading this mirrors
  - file:///github/ahpd/packages/sdk/src/changes.ts - what the reference host answers for `prepare-pull-request` and `create-pr`
---

## Objective

`invoke` sends a `_meta` bag when given one and answers the host's `followUp` beside its `message`.
One module reads a follow-up into a pull request draft, an external link, or "something this client cannot read".

## Files

- `UPDATE: src/ahp/connection.ts:365` - `invoke(changeset, operationId, target?, meta?)` answers `{ message?: string; followUp?: FollowUp }`.
- `UPDATE: src/ahp/types.ts` - `FollowUp { content: ContentRef; external?: boolean }`.
- `UPDATE: src/ahp/live.ts:1250-1256, 3035-3041` - send `_meta` when present; `decodeInvoked` keeps `followUp`.
- `UPDATE: src/ahp/operate.ts` - an optional `meta` option, sent on the first try and on the retry after a grant.
- `CREATE: src/ahp/followup.ts` - `decodeDataUri`, `pullRequestDraft`, `externalLink`, `commitMeta`, `createPrMeta`; no textui.
- `UPDATE: src/ahp/fake.ts:2027-2063` - record `meta`; answer `prepare-pull-request` with a draft and `create-pr` with an external link, on the working-tree changeset.

## Steps

1. Widen the contract and its two implementations, keeping every caller compiling with the new argument optional.
2. Write `followup.ts` against the reference host's shapes: percent-encoded and `;base64` data URIs, a draft only when it has a title and a `context`.
3. Give the fake host the two pull request verbs if it lacks them, with a confirmation on neither.

## Validation

- `test/followup.test.ts` - a percent-encoded and a base64 draft decode; an external link is not a draft; a draft without `context` is not a draft; a non-JSON data URI is unreadable.
- `test/changes.test.tsx` - the fake host records the `_meta` an invocation carried.
- `npm run typecheck` and `npx vitest run` pass.

## Resume

