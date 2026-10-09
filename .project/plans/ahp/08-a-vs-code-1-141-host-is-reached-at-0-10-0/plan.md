---
title: A VS Code 1.141 host is reached at 0.10.0
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
  - "[code://src/ahp/live.ts#L188-L210](../../../../src/ahp/live.ts#L188-L210) - `VERSIONS`, the versions offered at `initialize`: `1.0.0`, `0.9.0`, `0.8.0`, `0.7.0`"
  - "file:///github/externals/vscode/src/vs/platform/agentHost/common/agentHostProtocolCompatibility.ts - VS Code main keeps `0.10.0` as an exact alias: \"VS Code's 0.10.0 release shares the wire contract of the upstream baselines\""
  - "git://51ec2ee42fd - VS Code, 2026-10-08: `PROTOCOL_VERSION` goes from `0.10.0` to `1.1.0`, and the host accepts `1.0.0` again"
  - npm://@microsoft/agent-host-protocol@1.0.0 - no `0.10.0` was ever published
---

## Goal

`ahpc --host` connects to the agent host of VS Code 1.141 stable.
That host speaks `0.10.0` and accepts only `^0.10.0`, so today it refuses every version ahpc offers.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- 2026-10-09: `code agent --host 0.0.0.0` (VS Code Agent Host v1.141.0) refused `ahpc --host`: "Client offered protocol versions [1.0.0, 0.9.0, 0.8.0, 0.7.0], none of which are compatible with this server's version 0.10.0 (server accepts ^0.10.0)".
- `git show 51ec2ee42fd^:src/vs/platform/agentHost/common/state/protocol/version/registry.ts` in the VS Code clone - the 1.141 host has `PROTOCOL_VERSION = '0.10.0'`. Its canvas actions are `0.10.0` and are the only actions new to that version.

### Gaps

- ahpc does not offer `0.10.0`.
- Whether ahpc skips `chat/canvasesChanged` and `canvas/stateChanged` without an error is untested.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| - | none | - |

| What | Source | Task |
| --- | --- | --- |
| ahpc offers `0.10.0` after `1.0.0`, and reads a `0.10.0` answer as `1.0.0` | Softov, 2026-10-09, asked "Add 0.10.0 to what both clients offer?" and answered "Both, plan then build" | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - ahpc offers 0.10.0](task-01-ahpc-offers-0-10-0.md) | doing | - |

## Risks and tradeoffs

- `0.10.0` is VS Code's own number and not a published release. VS Code says it has the wire contract of `1.0.0`, and the canvas actions are the only addition.

## Resume state

- **Done so far:** nothing.
- **Next action:** [task-01-ahpc-offers-0-10-0.md](task-01-ahpc-offers-0-10-0.md).
- **Open questions:** none.
- **Watch out for:** `VERSIONS` is in preference order. `0.10.0` goes after `1.0.0`, so a host that speaks both answers `1.0.0`.

## Final verification checklist

- [ ] An `initialize` offers `1.0.0, 0.10.0, 0.9.0, 0.8.0, 0.7.0`.
- [ ] A host that answers `0.10.0` connects, and a canvas action does not break the session.
- [ ] `plans/index.md` updated.
