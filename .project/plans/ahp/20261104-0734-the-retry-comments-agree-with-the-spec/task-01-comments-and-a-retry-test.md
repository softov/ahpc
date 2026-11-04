---
title: The comments, the decision and a retry test
status: implemented
depends: []
layer: "ahp"
refs:
  - "[code://src/cli/main.ts#L947-L955](../../../../src/cli/main.ts#L947-L955) - the shell's comment"
  - "[code://src/control.ts#L717](../../../../src/control.ts#L717) - `guard`"
  - "[code://src/control.ts#L1166](../../../../src/control.ts#L1166) - `createSession` through `guard`"
---

## Objective

The shell's comment and the decision say the same as the spec, and a test runs a refused `createSession` again.

## Files

- `UPDATE: src/cli/main.ts:947-955` - the comment gives the shell's real reason
- `UPDATE: .project/decisions/one-accepted-credential-runs-the-act-again.md` - every awaited act may run once more, with the spec as the source
- `UPDATE: test/auth.test.tsx` - the case in *Validation*

## Steps

1. Rewrite the comment: the shell has nobody to ask, and pushes an exported variable on every connection.
2. Add to the decision that every awaited act may run once more, and cite the spec's section.
3. Add the case in *Validation*.

## Validation

- A host that refuses `createSession` once gets one `authenticate` and one more `createSession`, and one session exists.
- With `guard` removed from `createSession`, the case fails.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
