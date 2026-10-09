---
title: A session's model is read as ahpd.model too
domain: ahp
status: planned
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
| [01 - The model is read under both names](task-01-the-model-is-read-under-both-names.md) | todo | - |

## Risks and tradeoffs

- None.

## Resume state

- **Done so far:** nothing.
- **Next action:** [task-01-the-model-is-read-under-both-names.md](task-01-the-model-is-read-under-both-names.md).
- **Open questions:** none.
- **Watch out for:** do not touch `_meta.cost`.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npm test` pass.
- [ ] `plans/index.md` updated.
