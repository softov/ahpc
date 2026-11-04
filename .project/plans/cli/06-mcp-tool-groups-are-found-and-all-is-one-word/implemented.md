---
title: The automation list is served by default, the other groups are named, and all turns on every group - implemented
date: 2026-11-04
refs:
  - git://5d59f0e
---

`ahpc mcp` serves `list_automations` with no flag, names the tool groups that are off when a client connects, and takes `--mcp-tools all` for every group.

## What was built

- [`code://src/mcp/tools.ts`](../../../../src/mcp/tools.ts) - `list_automations` outside the groups, and the sentence that names the groups that are off.
- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `all` as a value of `--mcp-tools`, and the refusal of a name that is no group.
- [`code://docs/use/TOOL-SERVER.md`](../../../../docs/use/TOOL-SERVER.md) - what is served by default, and `all`.

## Verified

- `test/mcp.test.ts` has 3 new cases: the default list, the named groups, and `all` with a refused name.
- Softov checked it on 2026-11-03: `ahpc mcp` listed 13 tools, `--mcp-tools all` listed all 30, and `npm run docs:build` passed.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass on `main` at `341a963`, 884 tests.

## Departures from the plan

- none.
