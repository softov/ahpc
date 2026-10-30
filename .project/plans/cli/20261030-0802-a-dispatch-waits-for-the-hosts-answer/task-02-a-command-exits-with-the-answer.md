---
title: A command exits with the host's answer
status: todo
depends: [task-01-a-dispatch-resolves-on-its-echo.md]
layer: "cli, mcp, screen"
refs:
  - "[code://src/cli/main.ts#L1620-L1679](../../../../src/cli/main.ts#L1620-L1679) - `queue` and `unqueue`"
  - "[code://src/cli/main.ts#L1728-L1747](../../../../src/cli/main.ts#L1728-L1747) - `confirm` and `answer`"
  - "[code://src/mcp/tools.ts#L346](../../../../src/mcp/tools.ts#L346) - `queue_turn`"
---

## Objective

`queue`, `unqueue`, `confirm`, `answer`, `session read`, `session archive` and `terminal send` wait for the host.
Each exits 0 when the host applied the action, and prints the reason and exits 1 when it refused.
`queue` prints the id.
The MCP tools that dispatch do the same.

## Files

- `UPDATE: src/cli/main.ts:1054-1056` - `session read` and `session archive` await the answer.
- `UPDATE: src/cli/main.ts:1320-1325` - `terminal send` awaits the answer.
- `UPDATE: src/cli/main.ts:1669-1679` - `queue` prints the id, or the id as JSON with `--json`; `unqueue` awaits the answer.
- `UPDATE: src/cli/main.ts:1728-1747` - `confirm` and `answer` await the answer.
- `UPDATE: src/mcp/tools.ts:346` - `queue_turn` returns `{ queued: true, id }`, or the refusal as a tool error.
- `UPDATE: src/mcp/tools.ts:422-451` - `confirm_tool_call` and `answer_question` return the refusal as a tool error.
- `UPDATE: src/mcp/tools.ts:669` - the terminal send tool returns the refusal as a tool error.
- `UPDATE: src/control.ts:823-1014` - the screen calls each changed method with `void`.
- `UPDATE: docs/subjects/TURNS.md` - say that `queue` prints the id and that each command exits with the host's answer.
- `UPDATE: test/cli.test.ts` - the cases in *Validation*.
- `UPDATE: test/mcp.test.ts` - the tool cases in *Validation*.

## Steps

1. Add one helper in `main.ts` that prints `refused` on stderr and returns 1, or returns 0.
2. Use the helper in the seven commands.
3. Print the id from `queue` on stdout, as one line, or as `{ "id": ... }` with `--json`.
4. Change the MCP tools to throw the refusal, as the other tools report an error.
5. Add `void` to each call in `control.ts`.
6. Update `docs/subjects/TURNS.md`.
7. Add the tests.

## Validation

- `test/cli.test.ts`: `queue` prints an id, and `unqueue` with that id exits 0.
- `test/cli.test.ts`: `unqueue` with an unknown id prints the refusal and exits 1.
- `test/cli.test.ts`: `confirm` and `answer` with an unknown id print the refusal and exit 1.
- `test/mcp.test.ts`: `queue_turn` returns an id, and `confirm_tool_call` with an unknown id is a tool error.
- `npm run typecheck` passes.
- `npm test` passes.
- By hand against ahpd: the checks in the plan's *Final verification checklist*.

## Resume
