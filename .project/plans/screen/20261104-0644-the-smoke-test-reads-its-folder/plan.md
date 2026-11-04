---
title: The smoke test reads the checkout's folder name
domain: screen
status: active
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://32e0f9e - the commit of this repository the facts were checked at
  - "[code://test/smoke.test.tsx#L1790-L1797](../../../../test/smoke.test.tsx#L1790-L1797) - the case expects `ahpc` on the composer's second row"
  - "[code://src/app.tsx#L553](../../../../src/app.tsx#L553) - the workspace is `process.cwd()` when no option gives one"
---

## Goal

`test/smoke.test.tsx` passes in a checkout with any folder name.
On 2026-11-04, one case failed in a clone named `othername`, because the row showed `⌂ othername`.
Softov, 2026-11-04: "This test you can do to validate. if necessary fix it."

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `process.cwd()` in `src/` - only `src/app.tsx` reads it, for the workspace.
- `'ahpc'` in `test/smoke.test.tsx` - the other two cases look for the header's name, not the folder.

### Runtime path

```
process.cwd() -> WORKSPACE -> the composer's directory chip
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| The case expects the folder name of `process.cwd()` | Softov, 2026-11-04: "if necessary fix it" | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The case expects the checkout's folder](task-01-the-case-expects-the-checkouts-folder.md) | implemented | - |

## Risks and tradeoffs

- None known. The source code does not change.

## Resume state

- **Done so far:** task 01 implemented, as [implemented.md](implemented.md) says.
- **Next action:** Softov reviews the pull request.
- **Open questions:** none.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [x] `npx vitest run test/smoke.test.tsx` passes in a clone named `othername`.
