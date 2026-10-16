---
title: The server serves list_automations, names the groups that are off, and takes all
status: implemented
depends: []
layer: "mcp"
refs:
  - "[code://src/mcp/tools.ts](../../../../src/mcp/tools.ts) - the tool table and `served`"
  - "[code://src/mcp/serve.ts#L204-L220](../../../../src/mcp/serve.ts#L204-L220) - the `initialize` answer"
  - "[code://src/cli/main.ts#L1281-L1299](../../../../src/cli/main.ts#L1281-L1299) - `wanted`"
---

## Objective

`ahpc mcp` serves 13 tools, with `list_automations` among them.
`initialize` tells the client which groups are off, and `--mcp-tools all` turns on every group.

## Files

- `UPDATE: src/mcp/tools.ts:15-19` - the module comment says 13 core tools and drops the ROADMAP.md reference.
- `UPDATE: src/mcp/tools.ts:733-740` - remove `group` from `list_automations` and move it to the core part of the table.
- `UPDATE: src/mcp/tools.ts:866-870` - add `unserved(groups)`, which returns the hint sentence or `undefined` when every group is on.
- `UPDATE: src/mcp/serve.ts:204-220` - add `instructions` to the `initialize` answer when `unserved` returns a sentence.
- `UPDATE: src/cli/main.ts:1281-1299` - `wanted` reads `all` as every group in `GROUPS`.
- `UPDATE: src/cli/main.ts:147-149` - the help text names `all`.
- `UPDATE: test/mcp.test.ts` - cases for the default table, the hint and `all`.
- `UPDATE: test/cli.test.ts` - a case for `--mcp-tools all` and for `all` with a group name.

## Steps

1. Remove `group: 'automations'` from `list_automations` and move the entry next to the other core tools.
2. Correct the module comment at the top of `src/mcp/tools.ts` to the 13 core tools.
3. Add `unserved(groups)` next to `served`, with one sentence such as "Not served: resources, terminals. Start ahpc with --mcp-tools <group>, or all."
4. Send that sentence as `instructions` in the `initialize` answer, and leave the key out when it is `undefined`.
5. In `wanted`, return `[...GROUPS]` when the list holds `all`.
6. Add `all` to the "No tool group called" message and to the help text.
7. Write the tests in `test/mcp.test.ts` and `test/cli.test.ts`.

## Validation

- `test/mcp.test.ts`: the default `tools/list` holds `list_automations` and not `run_automation`.
- `test/mcp.test.ts`: `initialize` with no groups has `instructions` that name all four groups, and with every group has no `instructions`.
- `test/cli.test.ts`: `--mcp-tools all` and `--mcp-tools all,resources` both give every group.
- `npm test` and `npm run typecheck` pass.
- By hand: `ahpc mcp` prints "13 tools" on stderr, and `ahpc mcp --mcp-tools all` prints the full count.

## Resume

Implemented 2026-10-16. `list_automations` stays in its place in the table with no group, so the automation entries stay together. A new `grouped` in `src/mcp/tools.ts` reads the names, so `test/mcp.test.ts` tests `all` without a CLI run.
`test/cli.test.ts` is not changed. By hand: `ahpc mcp` reports 13 tools and `--mcp-tools all` reports 30.
