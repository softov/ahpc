---
title: A session's model is read as ahpd.model too - implemented
date: 2026-10-09
refs:
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts) - the read that takes `ahpd.model` first"
  - "[code://test/reconnect.test.ts](../../../../test/reconnect.test.ts) - one case per name, and one with both"
---

ahpc finds a session's model under every name a host has used for it.
It reads `_meta['ahpd.model']` first, then `_meta.model`, then the bare `state.model`.
The newest name wins when a state carries more than one.

## What was built

- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - the session's model fallback reads `_meta['ahpd.model']`, then `_meta.model`, then `state.model`. It reads `_meta` once into a local, and the comment above it names all three spellings and says why each one stays.
- [`code://test/reconnect.test.ts`](../../../../test/reconnect.test.ts) - two cases added under `the model a host actually reports, rather than the one it declares`.
- The first holds a state with `ahpd.model` alone, and the second a state with both names.

## Verified

- `npm run typecheck` clean, `npm run build` clean.
- `test/reconnect.test.ts` - 75 passed. Three of them are the model cases: the new `ahpd.model` case, the new both-names case, and the `_meta.model` case that was already there.
- `npm test` - 684 passed, 1 failed of 685. The failure is `test/smoke.test.tsx > the composer is the front door > puts where the session runs on a row of its own, and asks only what the host asks`, which expects the composer chip to contain `ahpc`. The chip draws the last segment of the working directory, by `workspaceName` in [`code://src/state.ts`](../../../../src/state.ts), and this run is in the worktree `build-agents-efbbda45`. The assertion cannot see a model, and no file this plan touched is on that path. The same case fails the same way in the reports of ahp/06 and cli/03, which ran in sibling worktrees.
- `node .agents/skills/do-spec/scripts/lint-prose.mjs .project/plans/ahp/07-a-sessions-model-is-read-as-ahpd-model-too` found nothing.

## Departures from the plan

- The plan asks `test/reconnect.test.ts` for a case for each name and one with both. The `_meta.model` case already existed as `takes the same extension from _meta, where it is moving to`, so two cases were added and the existing one was left as it stands. Its comment still reads "Both spellings", which is true of `_meta` and `_meta` alone, so it is not stale.
- The plan names no third name. `state.model` was already read after the `_meta` pair, and the rename does not remove it, so it stays last and is untouched.

## Left for later

- A run against a host that has renamed the key. ahpd `host/43 p4` task 03 does the rename, and it waits on this plan. The new name is exercised against a live host after that.
- It needs a host, so it is Softov's to do. The plan's checklist records it as the one open item.
