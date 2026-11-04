---
title: The status row does not end with the screen's name
domain: screen
status: active
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://2832057 - the commit of this repository the facts were checked at
  - "[code://src/app.tsx#L432-L479](../../../../src/app.tsx#L432-L479) - the status row ends with the store's `SCREEN` in the muted tone"
---

## Goal

The status row shows only the hints and the host's sentences.
On 2026-11-04, Softov saw "sessi…" at the end of the status row on the sessions screen.
The header already says where a person is.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `SCREEN` in `src/app.tsx` - the status row reads it only to draw its name.
- The tests - no case reads the screen's name on the status row.

### Runtime path

```
SCREEN -> Status -> a muted text at the row end
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| The status row does not show the screen's name | Softov, 2026-11-04: "on footer we have the name of the screen. I don't think its necessary." | 01 |
| The hints take the whole row | `(defaulted: the hints already have flex 1)` | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The screen's name leaves the status row](task-01-the-screen-name-leaves-the-row.md) | implemented | - |

## Risks and tradeoffs

- None known. `SCREEN` stays in the store, because the screens read it.

## Resume state

- **Done so far:** task 01 implemented, as [implemented.md](implemented.md) says.
- **Next action:** Softov reviews the pull request, and looks at the status row by hand.
- **Open questions:** none.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [ ] By hand, the status row on the sessions screen ends with the hints.
