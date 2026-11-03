---
title: The commit prompt keeps its keys while the changeset changes
domain: screen
status: active
priority: high
created: 2026-11-03
revalidated: 2026-11-03
requires:
  - plans/screen/20261103-1443-the-changes-list-follows-the-host/plan.md
refs:
  - git://f162c65 - the commit of this repository the facts were checked at
  - "[code://src/screens.tsx#L1360-L1398](../../../../src/screens.tsx#L1360-L1398) - the changes screen draws the tabs, the actions row and the list, and the actions row comes and goes with the operations"
  - "[code://src/view/changes.tsx#L100-L108](../../../../src/view/changes.tsx#L100-L108) - `ChangesList` draws the computing line before the list, and the line comes and goes with the status"
  - "[code://src/screens.tsx#L1377](../../../../src/screens.tsx#L1377) - `key` on the action buttons: the pattern to reuse"
  - "[code://src/ahp/fake.ts#L2221-L2232](../../../../src/ahp/fake.ts#L2221-L2232) - the fake's `review` builds the changeset without its operations"
  - "[code://src/control.ts#L2114-L2119](../../../../src/control.ts#L2114-L2119) - the commit prompt"
  - npm://@textui/core@^0.9.0 - `useFocusable` takes the focus for an `autoFocus` control when the focus is in another scope, a trapped modal included
---

## Goal

The commit prompt takes every key while the changes screen behind it updates.
On 2026-11-03, Softov opened the commit prompt against ahpd, and the keys ran the screen's actions: `s` staged.
A click on the text box did not give it the focus, and backspace did nothing.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- A test that types after an update with the prompt open - the focus moved to the `List` behind the prompt.
- The same test with the fake's operations kept - the focus stayed in the prompt.
- The same test with `key="files"` on `ChangesList` and on its `List` - the focus stayed in the prompt.

### Runtime path

```
commit prompt open -> changeset update -> actions row or computing line comes or goes -> List remounts -> autoFocus takes the focus from the prompt -> keys reach CHANGES_SCOPE
```

### Gaps

- The list remounts when a row above it comes or goes, so it loses its selected row and takes the focus.
- The fake's `review` drops the operations, which a host's `filesReviewChanged` keeps.
- textui lets an `autoFocus` control take the focus from a trapped modal. The textui brief `autofocus-respects-a-trapped-modal` records it.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Fix the remount in ahpc now, and write a textui brief for the focus steal | Softov, 2026-11-03: "ahpc now, textui later" | 01 |
| A fixed `key` keeps `ChangesList` and its `List` mounted | `(defaulted: as the action buttons keep theirs)` | 01 |
| The fake's `review` keeps the changeset's operations | `(defaulted: the protocol's reducer keeps them)` | 01 |

## Proposed architecture

- **State flow** - unchanged. Only the mount of the list changes.
- **Layer responsibilities** - `src/screens.tsx` and `src/view/changes.tsx`: the keys · `src/ahp/fake.ts`: the operations on a tick.
- **Source-of-truth files** - [`code://src/view/changes.tsx`](../../../../src/view/changes.tsx)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The list stays mounted when a row above it changes](task-01-the-list-stays-mounted.md) | todo | - |

## Risks and tradeoffs

- Another `autoFocus` control that remounts behind a modal still takes the focus, until textui stops it.

## Resume state

- **Done so far:** nothing.
- **Next action:** [task-01-the-list-stays-mounted.md](task-01-the-list-stays-mounted.md).
- **Open questions:** none.
- **Watch out for:** a test that does not drop the operations or the computing line passes without the keys.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [ ] Against ahpd, the commit prompt takes typed text and backspace, and `git log -1` shows the message.
