---
title: A command a host refuses names the variable that would let it through
domain: ahp
status: built
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
requires:
  - plans/ahp/20261104-0734-the-resource-token-has-its-own-flag/plan.md
refs:
  - git://7551c40 - the commit the facts were checked at, and the last commit that holds the brief `briefs/a-refused-command-names-the-variable.md`
  - "[code://src/cli/main.ts#L981](../../../../src/cli/main.ts#L981) - a `-32007` from any command prints `needsToken`"
  - "[code://src/cli/main.ts#L999-L1002](../../../../src/cli/main.ts#L999-L1002) - `needsToken`"
  - "[code://src/connect.ts#L71-L89](../../../../src/connect.ts#L71-L89) - `signInSentence`"
---

## Goal

A command that a host refuses with `-32007` says `Set AHPC_TOKEN_<RESOURCE> and run it again.`
`ahpc auth` keeps its own sentence, with its three ways in.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `needsToken` in `src/` - the refusal catch and `ahpc auth` share it.
- `signInSentence` in `src/` - a refusal with no screen prints it through `sink`.

### Runtime path

```
-32007 -> needsToken | signInSentence -> stderr
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| A refused command names only the variable | Softov, 2026-11-04: "Only the variable" | 01 |
| `ahpc auth` with no token names `--resource-token`, the variable and a pipe | Softov, 2026-11-04: "New --resource-token" | 01 |
| An expired token says "has expired" in the same sentence | (defaulted: `signInSentence` already tells the two apart) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - Two sentences, one for each place](task-01-two-sentences.md) | done | - |

## Risks and tradeoffs

- None known.

## Resume state

- **Done so far:** task 01 done, as [implemented.md](implemented.md) says. Softov merged it on 2026-11-04, and the gates passed on `main`.
- **Next action:** none.
- **Open questions:** none.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
