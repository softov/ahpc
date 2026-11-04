---
title: prompt on a busy session refuses, queues or steers, and says when it stops waiting - implemented
date: 2026-11-04
refs:
  - git://53541d3
---

`ahpc prompt` on a session with a running turn no longer sends into it by accident.
A plain `prompt` refuses, `--queue` waits behind the running turn, and `--steer` sends into it.
The MCP `send_turn` tool takes the same choice as `busy`.

## What was built

- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `turn` reads the session before it sends, and `prompt` takes `--queue` and `--steer`.
- [`code://src/wait.ts`](../../../../src/wait.ts) - the wait for the new turn, and the stderr line when it stops waiting.
- [`code://src/ahp/connection.ts`](../../../../src/ahp/connection.ts) - `steer` on the seam, with both hosts behind it.
- [`code://src/mcp/tools.ts`](../../../../src/mcp/tools.ts) - the `busy` input of `send_turn`.

## Verified

- `test/busy.test.ts` has 9 cases: the refusal, `--queue`, `--steer`, both flags at once, an idle session, the MCP `busy` input and the timeout line.
- Softov checked it against ahpd `main` on 2026-11-03.
- A plain `prompt` was refused, `--queue` and `--steer` returned, the timeout line was written, and the MCP `busy` input worked.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass on `main` at `341a963`, 884 tests.

## Departures from the plan

- none.
