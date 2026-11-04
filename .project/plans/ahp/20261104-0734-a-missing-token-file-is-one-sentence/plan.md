---
title: A missing connection token file is one sentence on the screen
domain: ahp
status: active
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
requires:
  - plans/ahp/20261104-0734-a-token-file-read-says-why/plan.md
refs:
  - git://7551c40 - the commit the facts were checked at, and the last commit that holds the brief `briefs/a-missing-token-file-is-one-sentence.md`
  - "[code://src/tui.tsx#L362-L379](../../../../src/tui.tsx#L362-L379) - `tui` calls `connectionToken` with no `try`"
  - "[code://src/main.tsx#L46-L75](../../../../src/main.tsx#L46-L75) - the `Fault` catch wraps `cli()` only"
  - "[code://src/cli/main.ts#L246-L258](../../../../src/cli/main.ts#L246-L258) - `where`, the shell's pattern to copy"
---

## Goal

A connection token file that is named and cannot be read stops `ahpc` at start with one sentence, on the screen as in the shell.
Today the screen prints a stack trace for it.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `connectionToken(` in `src/` - `tui` and `where` call it, and only `where` turns its throw into a `Fault`.
- `catch` in `src/main.tsx` - it wraps `cli()` and not `tui()`.

### Runtime path

```
main.tsx -> tui() -> connectionToken -> throw
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| A named token file that cannot be read always stops the start, with or without a host | Softov, 2026-11-04: "Always fail" | 01 |
| The sentence is the one `connectionToken` throws, on stderr, with exit code 1 | (defaulted: the shell already prints it that way) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The screen says one sentence](task-01-the-screen-says-one-sentence.md) | implemented | - |

## Risks and tradeoffs

- None known. The scripted host with a missing token file now stops, as Softov chose.

## Resume state

- **Done so far:** task 01 - the screen says one sentence.
- **Next action:** nothing to build; the task is implemented and awaits review.
- **Open questions:** none.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
