---
title: Take 1.0.0 and offer it first
status: implemented
depends: []
layer: "ahp"
refs:
  - "[code://package.json#L56](../../../../package.json#L56) - the dependency"
  - "[code://src/ahp/live.ts#L207](../../../../src/ahp/live.ts#L207) - `VERSIONS`"
---

## Objective

`package.json` and the lockfiles take 1.0.0, `VERSIONS` offers it first, and the strict schema is regenerated from it.

## Files

- `UPDATE: package.json`, `package-lock.json`, `deno.lock` if it pins the package.
- `UPDATE: src/ahp/live.ts:207`.
- `UPDATE: tools/ahp.strict.schema.json` - `npm run schema`.
- `UPDATE: UPSTREAM.md` - the version ahpc is on.
- `UPDATE: test/` - any test that asserts the offered versions.

## Steps

1. `npm i @microsoft/agent-host-protocol@^1.0.0`.
2. `VERSIONS = ['1.0.0', '0.9.0', '0.8.0', '0.7.0']`.
3. `npm run schema`.
4. `npx tsc --noEmit`, `npx vitest run`.

## Validation

- Both pass; an ahpc `--wire` capture against ahpd shows `protocolVersion: "1.0.0"` in the `initialize` result.

## Resume

Implemented 2026-10-04.

- `npm i @microsoft/agent-host-protocol@^1.0.0` took `package.json` to `^1.0.0` and `package-lock.json` to the `1.0.0` tarball; 1.0.0 is installed.
- `VERSIONS` is `['1.0.0', '0.9.0', '0.8.0', '0.7.0']`. The comment above it said the opposite of the truth in two places - that `0.9.0` was the newest published, and that offering `1.0.0` was the wrong kind of forward-compatibility because a VS Code-local `1.0.0` had never reached the protocol repository - so it was rewritten around the reason `1.0.0` came out and the reason it is back.
- `src/ahp/live.ts:39`, the module comment saying which version the file is written against, now says `1.0.0`.
- `npm run schema` regenerated `tools/ahp.strict.schema.json`: 507 definitions from 506 exported types, 632 closed objects.
- `test/conformance.test.ts` lost its one known exception. It named `AuthenticateParams / undeclared key 'expiresIn'` as a version skew - the 0.9.0 package not declaring a field `authentication.md` has four MUSTs about - and said it was named rather than suppressed by pattern "so the day it publishes this line fails and somebody deletes it". 1.0.0 declares it (`tools/ahp.strict.schema.json`, `AuthenticateParams.expiresIn`, `type: number`), so that day was this one and the exception is gone; the test now asserts no undeclared field with none excused. This is the only failure the upgrade caused.

**Validation.** `npm run typecheck` passes on the 1.0.0 types with no error, which is the reconnaissance's own result. `npm test` is 654 passed / 1 failed, the one failure being `test/smoke.test.tsx`'s "puts where the session runs on a row of its own", which asserts the status bar contains `ahpc` and reads the current directory's basename; the worktree is `build-agents-38f59a5f`, so it fails identically before and after this task and is not this plan's to fix.

The offered list was checked on the wire rather than read off the constant, with a throwaway test driven over `InMemoryTransport` and then deleted: the `initialize` frame carried `protocolVersions: ["1.0.0","0.9.0","0.8.0","0.7.0"]`, and a host that speaks every published version - as ahpd does - settled the client at `1.0.0` with `agents()` and a root snapshot resolving normally. A host answering `0.9.0` is the path the rest of the suite already runs on: `test/conformance.test.ts`'s scripted host answers `protocolVersion: '0.9.0'` unconditionally and passes unchanged, which is the plan's stated risk, checked.

**Not done, and why.**

- `deno.lock` still pins `@microsoft/agent-host-protocol@0.9` with the 0.9.0 integrity hash, though the task asks for it "if it pins the package" and it does. Two reasons it was left: regenerating it needs `deno`, which is not on this machine's permitted commands here, and hand-writing an integrity hash into a lockfile is guessing. And the repository's own pattern says not to: `deno.lock` is already stale for every other dependency - it pins `@textui/*` at `0.6.1` while `package.json` says `^0.8.0` - because commit `8bf6113` ("Take @textui 0.8.0") did not touch it. It was resolved once, wholesale, by `816d445`, and CI never reads it (`ci.yml` runs `npm ci` and says so in a comment). **This should be resolved in one pass with `deno`, as `816d445` did, before it is relied on for a `deno run` of `dist/`.**
- `README.md:7`'s badge and `docs/CONFORMANCE.md:8-10,90` still say the protocol is 0.9.0 and still explain that `1.0.0` came out of the list. Both are now false. Neither file is named by this task, and the brief says to touch only what a task names, so they were left for the reviewer.
- Nothing in the suite pins `VERSIONS`. The task's `UPDATE: test/` line reads "any test that asserts the offered versions"; there is none - `test/wire.test.tsx:37` has `protocolVersions: ['0.9.0']` inside a fixed sample capture used to test the reader, not a claim about this client. So the offer is unpinned and a later edit could drop `1.0.0` with the suite green. A test asserting the list was not added, because the task said update and there was nothing to update; it is the obvious place to put one.
- Against ahpd by hand, the plan's own validation, was not run: there is no ahpd here and no host to capture. The `InMemoryTransport` check above is the substitute and is weaker - it proves the offer and the negotiation, not that ahpd takes it.
