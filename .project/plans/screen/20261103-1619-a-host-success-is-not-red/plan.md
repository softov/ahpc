---
title: The host's answer to a changeset verb is not drawn as a refusal
domain: screen
status: built
priority: high
created: 2026-11-03
revalidated: 2026-11-03
refs:
  - git://9457298 - the commit of this repository the facts were checked at
  - "[code://src/control.ts#L1549-L1570](../../../../src/control.ts#L1549-L1570) - `answered` puts the host's sentence in `HOST_ERROR`"
  - "[code://src/app.tsx#L432-L472](../../../../src/app.tsx#L432-L472) - the status row draws `HOST_ERROR` in the danger tone, then `HOST_LINK`, then the update notice"
  - "[code://src/state.ts#L198-L202](../../../../src/state.ts#L198-L202) - `HOST_ERROR` and `HOST_LINK`: the pattern to reuse"
  - "[code://src/control.ts#L703-L712](../../../../src/control.ts#L703-L712) - `forgetChanges` clears `HOST_LINK`"
  - "[code://test/changes.test.tsx#L1033-L1088](../../../../test/changes.test.tsx#L1033-L1088) - the cases on the link the host sends back"
---

## Goal

The status row draws the host's answer to a changeset verb in the success tone.
On 2026-11-03, Softov committed against ahpd, and the status row said "Committed b9f9ad9: Testing on README" in red.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `HOST_ERROR` - the slot for a refusal, drawn in the danger tone, and cleared by a snapshot.
- `answered` - it writes the host's sentence to `HOST_ERROR` when the answer has no link.

### Runtime path

```
commit -> operate -> host answers { message } -> answered -> HOST_ERROR -> status row in red
```

### Gaps

- A success and a refusal share one slot, so the status row cannot tell them apart.

## Answers

| What | Source | Task |
| --- | --- | --- |
| A success is not drawn in red | Softov, 2026-11-03: "commited show in red when its success" | 01 |
| A new slot, `HOST_NOTE`, holds the host's sentence | `(defaulted: as HOST_LINK holds the link)` | 01 |
| The status row draws `HOST_NOTE` in the success tone, after a refusal and the link | `(defaulted: the order of the row)` | 01 |
| `HOST_NOTE` clears where `HOST_LINK` clears | `(defaulted: as HOST_LINK)` | 01 |
| An answer that this client cannot read stays in `HOST_ERROR`, with the host's sentence | `(defaulted: part of the answer is lost, so it is not a success)` | 01 |

## Proposed architecture

- **State flow** - `answered` writes `HOST_NOTE`, and clears `HOST_ERROR` and `HOST_LINK`.
- **Layer responsibilities** - `src/state.ts`: the slot · `src/control.ts`: the write · `src/app.tsx`: the tone.
- **Source-of-truth files** - [`code://src/control.ts`](../../../../src/control.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The host's sentence has its own slot](task-01-the-host-sentence-has-its-own-slot.md) | done | - |

## Risks and tradeoffs

- The sentence stays on the status row until the changes screen closes, as the link does.

## Resume state

- **Done so far:** task 01 done, as [implemented.md](implemented.md) says. Softov checked it against ahpd on 2026-11-04.
- **Next action:** none.
- **Open questions:** none.
- **Watch out for:** the case on an answer that this client cannot read.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [x] Against ahpd, a commit shows "Committed" in green on the status row.
