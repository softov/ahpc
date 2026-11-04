---
title: The comments on a refused act agree with the spec, and a retry is tested
domain: ahp
status: planned
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
requires:
  - plans/ahp/20261104-0734-a-refused-command-names-the-variable/plan.md
refs:
  - git://7551c40 - the commit the facts were checked at, and the last commit that holds the brief `briefs/the-retry-comments-agree-with-the-spec.md`
  - "[code://src/cli/main.ts#L947-L955](../../../../src/cli/main.ts#L947-L955) - the shell says nothing is retried \"because the act may already have done something\""
  - "[code://src/control.ts#L717](../../../../src/control.ts#L717) - `guard`"
  - "[code://src/control.ts#L876-L884](../../../../src/control.ts#L876-L884) - `createChat` and `disposeChat` through `guard`"
  - "[code://src/control.ts#L1147-L1166](../../../../src/control.ts#L1147-L1166) - `disposeSession` and `createSession` through `guard`"
  - file:///github/agent-host-protocol/docs/specification/authentication.md - at `2c37a04f`, the *AuthRequired Error Code* section: retry the original command
---

## Goal

The screen's retry of a refused act stays, and the shell's comment gives the real reason it does not retry.
A test covers the retry of `createSession`.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `guard(` in `src/control.ts` - `createSession`, `createChat`, `disposeChat` and `disposeSession` go through it.
- `Nothing is retried` in `src/cli/main.ts` - the comment with the wrong reason.

### Runtime path

```
-32007 -> askSignIn -> authenticate -> the act once more
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| The screen keeps its retry of every awaited act | `AuthRequired Error Code` in the AHP spec: a client SHOULD "Retry the original command" | 01 |
| The shell's comment says it has nobody to ask, and that an exported variable is pushed on every connection | (defaulted: the shell's real reason) | 01 |
| The decision says that every awaited act may run once more | (defaulted: the spec's example is `createSession`) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The comments, the decision and a retry test](task-01-comments-and-a-retry-test.md) | todo | - |

## Risks and tradeoffs

- None known. The behaviour does not change.

## Resume state

- **Done so far:** the plan.
- **Next action:** build task 01.
- **Open questions:** none.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
