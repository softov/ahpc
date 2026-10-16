---
title: The docs say what is served by default
status: implemented
depends: [task-01-list-automations-off-groups-and-all.md]
layer: "docs"
refs:
  - "[code://docs/use/TOOL-SERVER.md#L95-L111](../../../../docs/use/TOOL-SERVER.md#L95-L111) - the group table and the count of core tools"
  - "[code://docs/subjects/AUTOMATIONS.md#L33-L35](../../../../docs/subjects/AUTOMATIONS.md#L33-L35) - says every automation tool needs the flag"
  - "[code://docs/.vitepress/theme/McpTools.vue](../../../../docs/.vitepress/theme/McpTools.vue) - the table takes `group` or `names`"
---

## Objective

The docs say that 13 tools are always served, with `list_automations` among them.
They also say that `all` turns on every group, and that the server names the groups that are off.

## Files

- `UPDATE: docs/use/TOOL-SERVER.md:95-111` - 13 core tools, `list_automations` out of the group table, `all`, and the hint in `initialize`.
- `UPDATE: docs/subjects/AUTOMATIONS.md:33-35` - `list_automations` is always served; the other three need `--mcp-tools automations`.

## Steps

1. Change the count to 13 in `docs/use/TOOL-SERVER.md`.
2. Remove `list_automations` from the `automations` row of the group table.
3. Add one sentence on `--mcp-tools all`.
4. Add one sentence on the hint that `initialize` sends.
5. In `docs/subjects/AUTOMATIONS.md`, show `list_automations` with `<McpTools names="list_automations" />` and the group table below it.
6. Run `npm run docs:build`.

## Validation

- `npm run docs:build` passes.
- `node <do-spec>/scripts/lint-prose.mjs` is not run on docs; read the two pages by hand.
- The reference page [MCP-TOOLS.md](../../../../docs/reference/MCP-TOOLS.md) shows `list_automations` under core, from the built code.

## Resume

Implemented 2026-10-16. `npm run docs:build` passes, and the reference page lists `list_automations` under core.
