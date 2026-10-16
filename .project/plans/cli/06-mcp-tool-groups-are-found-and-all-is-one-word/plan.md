---
title: The automation list is served by default, the other groups are named, and all turns on every group
domain: cli
status: active
priority: medium
created: 2026-10-16
revalidated: 2026-10-16
refs:
  - "[code://src/mcp/tools.ts#L15-L19](../../../../src/mcp/tools.ts#L15-L19) - the module comment that says which tools are core; it still says eleven and cites a ROADMAP.md that does not exist"
  - "[code://src/mcp/tools.ts#L41-L54](../../../../src/mcp/tools.ts#L41-L54) - `Group` and `GROUPS`: groups are opt-in to keep the tool count low, not for safety"
  - "[code://src/mcp/tools.ts#L733-L745](../../../../src/mcp/tools.ts#L733-L745) - `list_automations`, read-only, in the `automations` group today"
  - "[code://src/mcp/tools.ts#L866-L870](../../../../src/mcp/tools.ts#L866-L870) - `named` and `served`, which choose what a server lists"
  - "[code://src/mcp/serve.ts#L204-L220](../../../../src/mcp/serve.ts#L204-L220) - the `initialize` answer, which sends no `instructions` today"
  - "[code://src/mcp/serve.ts#L118-L124](../../../../src/mcp/serve.ts#L118-L124) - the refusal for a tool in a group that is off; an agent sees it only when it calls the tool by name"
  - "[code://src/cli/main.ts#L1281-L1299](../../../../src/cli/main.ts#L1281-L1299) - `wanted`, which reads `--mcp-tools` and refuses an unknown group"
  - "[code://src/cli/main.ts#L147-L149](../../../../src/cli/main.ts#L147-L149) - the help text for `--mcp-tools`"
  - "[code://test/mcp.test.ts#L95-L112](../../../../test/mcp.test.ts#L95-L112) - the tests for the core table and a group"
  - https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle - `InitializeResult.instructions`, a hint the client may give the model
---

## Goal

An agent that uses `ahpc mcp` can list the automations on a host without a flag.
An agent also learns which tool groups are off and which flag turns them on, because a hidden tool is otherwise invisible.
A person who wants every tool types `--mcp-tools all`.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg "mcp-tools" docs/` - [TOOL-SERVER.md](../../../../docs/use/TOOL-SERVER.md), [AUTOMATIONS.md](../../../../docs/subjects/AUTOMATIONS.md) and [MCP-TOOLS.md](../../../../docs/reference/MCP-TOOLS.md) describe the groups.
- `rg "instructions" src/mcp/` - nothing; the server sends no `instructions`.

### Runtime path

```
main.ts 'mcp' | 'serve' -> wanted(args) -> groups -> serve.ts answer() -> initialize | tools/list (served) | tools/call (named)
```

### Gaps

- `list_automations` is read-only and small, but an agent cannot see it without `--mcp-tools automations`.
- `tools/list` leaves out a group that is off, and `initialize` does not say the group exists.
- There is no single word for every group.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Move only `list_automations` to the core table, so the default is 13 tools | Softov, 2026-10-16: "Only list_automations" | 01 |
| `run_automation`, `set_automation_enabled` and `remove_automation` stay in the `automations` group | Softov, 2026-10-16 | 01 |
| `--mcp-tools all` turns on every group | Softov, 2026-10-16: "maybe a mcp-tools all?" | 01 |
| `initialize` sends `instructions` that name the groups that are off and the flag, only when a group is off | Softov, 2026-10-16: "Yes, name the off groups" | 01 |
| `all` mixed with a group name is accepted and means every group | (defaulted: the simplest reading of a list that holds `all`) | 01 |
| The docs subject page for automations lists `list_automations` as served by default | (defaulted: the docs follow the code) | 02 |

## Proposed architecture

- **Data flow** - `wanted` turns `all` into `GROUPS`; `served` and `named` do not change.
- **State flow** - none; the groups are fixed when the server starts.
- **Layer responsibilities** - `src/mcp/tools.ts`: the table and a function that writes the hint · `src/mcp/serve.ts`: sends the hint in `initialize` · `src/cli/main.ts`: reads `all`.
- **Source-of-truth files** - [`code://src/mcp/tools.ts`](../../../../src/mcp/tools.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The server serves list_automations, names off groups, takes all](task-01-list-automations-off-groups-and-all.md) | implemented | - |
| [02 - The docs say what is served by default](task-02-docs-say-what-is-served.md) | implemented | 01 |

## Risks and tradeoffs

- A client can ignore `instructions` - the refusal text for a hidden tool stays, so a call by name still says which flag to use.
- The `<McpTools group="automations" />` table loses `list_automations` - the docs page names it in a core table instead.

## Resume state

- **Done so far:** tasks 01 and 02 implemented on 2026-10-16, awaiting review.
- **Next action:** Softov reviews the diff.
- **Watch out for:** `--mcp-tools all` must not reach the "No tool group called" refusal in `wanted`.

## Final verification checklist

- [ ] `npm test` passes.
- [ ] `ahpc mcp` lists 13 tools, and `--mcp-tools all` lists every tool.
- [ ] `npm run docs:build` passes.
- [ ] `plans/index.md` updated.
