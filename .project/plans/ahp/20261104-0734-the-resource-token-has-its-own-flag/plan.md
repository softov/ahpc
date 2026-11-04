---
title: The resource token has its own flag, and --token always means the connection
domain: ahp
status: planned
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://7551c40 - the commit the facts were checked at, and the last commit that holds the brief `briefs/the-resource-token-has-its-own-flag.md`
  - "[code://src/cli/main.ts#L1584-L1589](../../../../src/cli/main.ts#L1584-L1589) - `ahpc auth` reads `--token` as the resource token"
  - "[code://src/cli/main.ts#L246-L258](../../../../src/cli/main.ts#L246-L258) - `where` reads `--token` as the connection token"
  - "[code://src/flags.ts#L44-L62](../../../../src/flags.ts#L44-L62) - `SWITCHES`, the flags that take no value"
  - file:///github/ahpd/packages/server/src/commands/options.ts - at ahpd `4d703f16`, `--token` is the credential that opens the connection
---

## Goal

`ahpc auth <resource> --resource-token T` pushes the token for a resource.
`--token` means the connection token in every command, as in ahpd.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `--token` in `src/` - `where` reads it as the connection token, and `ahpc auth` as the resource token.
- `SWITCHES` in `src/flags.ts` - a flag not in it takes a value, so `--resource-token` needs no entry.
- `auth .*--token` in `docs/` - `docs/start/CONNECT.md` shows the old form.

### Runtime path

```
ahpc auth <resource> --resource-token T -> host.authenticate(resource, T)
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| `ahpc auth` takes the resource token from `--resource-token`, `AHPC_TOKEN_<RESOURCE>` or a pipe | Softov, 2026-11-04: "New --resource-token" | 01 |
| `ahpc auth X --token T` with no `--resource-token` stops with a sentence that names `--resource-token` | Softov, 2026-11-04: "New --resource-token" | 01 |
| `--token` is the connection token in `ahpc auth` too | Softov, 2026-11-04: "New --resource-token" | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The --resource-token flag](task-01-resource-token-flag.md) | todo | - |

## Risks and tradeoffs

- A script that runs `ahpc auth X --token T` stops working, and the sentence says what to pass.

## Resume state

- **Done so far:** the plan.
- **Next action:** build task 01.
- **Open questions:** none.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
