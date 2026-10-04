---
title: ahpc speaks protocol 1.0.0
domain: ahp
status: planned
priority: high
created: 2026-10-04
revalidated: 2026-10-04
requires: []
changes: []
creates: []
decisions: []
refs:
  - "[code://package.json#L56](../../../../package.json#L56) - `@microsoft/agent-host-protocol` at `^0.9.0`"
  - "[code://src/ahp/live.ts#L207](../../../../src/ahp/live.ts#L207) - `VERSIONS`, the versions offered in `initialize`, `0.9.0` first"
  - "[code://tools/schema.mjs](../../../../tools/schema.mjs) - the strict schema, generated from the installed package"
  - "file:///github/ahpd/UPSTREAM.md - \"The wire, beside the features\": what 1.0.0 adds"
  - npm://@microsoft/agent-host-protocol@1.0.0 - published 2026-10-03; ahpd is on it
---

## Goal

ahpc installs protocol 1.0.0 and offers it first, so against ahpd it runs at 1.0.0 and not 0.9.0.

## Reconnaissance

### Searches performed

- 2026-10-04, in a scratch worktree: `npm i @microsoft/agent-host-protocol@1.0.0`, then `npx tsc --noEmit` gives 0 errors and `npx vitest run` passes 34 files, 655 tests.
- `rg -n "IsArchived|IsRead" src` - the session flags are read from `status` already; 1.0.0 adds the same bits per chat.

### Gaps

- 1.0.0 adds state ahpc does not draw: a chat's own read and archived bits, `chat/isArchivedChanged`, `chat/isReadChanged`, `moveChat` with `session/chatsReordered` and `chat/movableChanged`, `ChatState.backgroundWork`, `session/mcpServerBackgroundRequested`, `ChangesetStatus.recomputing`. Listed in [the 1.0.0 idea](../../../ideas/what-protocol-1-0-0-adds.md).

## Decisions locked in

| Decision | Task |
| --- | --- |
| - none | - |

| What | Source | Task |
| --- | --- | --- |
| Take `@microsoft/agent-host-protocol@^1.0.0` | Softov, 2026-10-04: "up ahpc to 1.0 also right?" | 01 |
| `VERSIONS` is `['1.0.0', '0.9.0', '0.8.0', '0.7.0']` | (defaulted: 1.0.0 first, the versions offered today kept for older hosts) | 01 |
| Drawing what 1.0.0 adds is a later plan, from the idea file | (defaulted: this plan moves the wire; each new surface is its own screen work) | - |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - Take 1.0.0 and offer it first](task-01-take-1-0-0.md) | implemented | - |

## Risks and tradeoffs

- A host on 0.9.0 still negotiates 0.9.0; nothing ahpc sends is 1.0.0-only.

## Resume state

- **Next:** task 01.

## Final verification checklist

- [ ] Against ahpd, `initialize` answers `protocolVersion: "1.0.0"` (seen with `--wire`).
- [ ] `npm test`, `npx tsc --noEmit` pass; `tools/ahp.strict.schema.json` regenerated.
- [ ] `plans/index.md` updated.
