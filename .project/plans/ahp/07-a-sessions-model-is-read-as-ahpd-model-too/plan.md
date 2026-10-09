---
title: A session's model is read as ahpd.model too
domain: ahp
status: built
priority: high
created: 2026-10-09
revalidated: 2026-10-09
requires: []
changes: []
creates: []
decisions: []
refs:
  - "[code://src/ahp/live.ts#L3218-L3223](../../../../src/ahp/live.ts#L3218-L3223) - the last model falls back to `_meta.model` on the session state"
  - "[code://test/reconnect.test.ts](../../../../test/reconnect.test.ts) - the tests that send `_meta.model`"
  - "file:///github/ahpd/.project/plans/host/43-the-wire-is-the-protocols-p4-ahpds-own-meta-keys-say-ahpd/plan.md - ahpd renames every key it invents to `ahpd.<name>`; its task 03 waits on this plan"
---

## Goal

ahpc finds a session's model on a host that sends `_meta['ahpd.model']` and on one that sends `_meta.model`.

## Reconnaissance

### Searches performed

- 2026-10-09: `rg -n "_meta" src` - `model` at `src/ahp/live.ts:3223` is the only ahpd key ahpc reads.
- `_meta.cost` at `src/ahp/live.ts:1217` is the reference host's number in credits. ahpd's cost becomes `ahpd.cost`, which ahpc does not read, so it does not change.

### Gaps

- None.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| - | none | - |

| What | Source | Task |
| --- | --- | --- |
| ahpc reads `ahpd.model` first, then `model` | ahpd host/43 p4: "the clients read both names, then ahpd renames, then the clients drop the old name" | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The model is read under both names](task-01-the-model-is-read-under-both-names.md) | done | - |

## Risks and tradeoffs

- None.

## Resume state

- **Done so far:** task 01, merged 2026-10-09 as a13ec65;. `src/ahp/live.ts` reads `_meta['ahpd.model']` first, then `_meta.model`, then `state.model`, and the comment above the read names all three. `test/reconnect.test.ts` holds one case per name and one with both. See [implemented.md](implemented.md).
- **Next action:** none. The plan holds one task, and it is implemented.
- **Open questions:** none.
- **Watch out for:** the run against a host that has renamed the key. ahpd `host/43` task 03 does that rename. It waits on this plan.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build` and `npm test` run clean, except for the one case this worktree fails at its baseline.
- [ ] Against a host that renamed the key, the session's model is read from `ahpd.model`. Needs that host, so it is Softov's.
- [x] `plans/index.md` updated.
