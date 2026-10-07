---
title: A failed turn says why - implemented
date: 2026-10-07
refs:
  - "[code://src/wait.ts](../../../../src/wait.ts) - `failure`, the error parts' messages"
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts) - the line on stderr after a failed turn, and the `Error` row of `session show`"
  - "[code://src/mcp/tools.ts](../../../../src/mcp/tools.ts) - `error` in what `said` returns"
  - "[code://src/ahp/fake.ts](../../../../src/ahp/fake.ts) - the `error` option of `finish`"
  - "[code://test/failure.test.ts](../../../../test/failure.test.ts) - the five cases"
---

A turn that stopped now says why, wherever a caller reads it.
`prompt` and `exec` write the host's sentence on stderr and keep exit code 1.
An MCP caller gets it as `error` beside the turn's `text`.
`session show` prints it in an `Error` row under the status.

## What was built

- [`code://src/wait.ts`](../../../../src/wait.ts) - `failure(turn)` returns the message of each `error` part, and drops a part that says nothing. `spoken` is unchanged.
- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `run` writes each message of `failure` on stderr after a turn that is not complete, and every string is the host's own sentence. `lastFailure` reads the latest turn's message through `snapshot`, because `detail` carries no turns. `session show` adds the `Error` row and subscribes only where the status says `error`.
- [`code://src/mcp/tools.ts`](../../../../src/mcp/tools.ts) - `said` adds `error`, the last message, when `failure` returns one.
- [`code://src/ahp/fake.ts`](../../../../src/ahp/fake.ts) - `finish` takes an `error`, which it appends as an `error` part, and the scripted `fail` turn ends with one.
- [`code://test/failure.test.ts`](../../../../test/failure.test.ts) - five cases.

## Verified

- `npm run typecheck` clean, `npm run build` clean.
- `npm test` - 681 passed, 1 failed of 682. The failure is `test/smoke.test.tsx > the composer is the front door > puts where the session runs on a row of its own, and asks only what the host asks`, which expects the composer chip to contain `ahpc`. The chip draws the last segment of the working directory, and this run is in the worktree `build-agents-1320384f`. The case fails at the unmodified baseline in this worktree, and its subject is untouched by this plan.
- `test/failure.test.ts` - 5 passed.
  It covers the stderr line and exit 1 after a failed `prompt`, and the answer that stays on stdout.
  It covers `error` on the turn a model reads, and no `error` on a turn that did not fail.
  It covers the `Error` row, and its absence for a session that is fine.
- `node .agents/skills/do-spec/scripts/lint-prose.mjs .project/plans/cli/03-a-failed-turn-says-why` found nothing.

## Departures from the plan

- The plan's test step asks for a `prompt` against the fake host, and the fake host's time is a `pump` that only the screen drives. A shell run drives none, so `cli('prompt', ...)` waited for a turn that never took a step. `test/failure.test.ts` replaces `../src/connect.js` with a `connect` that hands back a `fakeHost()` the test pumps itself. Every other module on that path is the real one, and no production file changed for it. The plan does not decide this fork. The question could not be put, so the smaller option was taken. The task's Resume records it.
- The plan names the scripted turn's error message and no mechanism, so `finish` gained an `error` option rather than a new helper. A turn is `failed` and carries the sentence only when `finish` writes both, which keeps the fixture honest about a turn that stopped.
- `session show` reads the turns through `snapshot` rather than `detail`, because `detail` carries none, and it subscribes only when the status is `error`. A command run on a session that is fine therefore costs no subscription.

## Elsewhere in this worktree

- A refusal named its code twice, and cli/01's review found it. An `RpcError` from the SDK arrives with `RPC error -32001: ` in front of the host's words. The general refusal path of [`code://src/cli/main.ts`](../../../../src/cli/main.ts) printed the message as it stood. The code was added at the end, so the line read `RPC error -32001: No agent for session ahp-session:/not-a-session (-32001)`. The message now goes through `hostWords` of [`code://src/ahp/auth.ts`](../../../../src/ahp/auth.ts), the strip the `-32007` path already used. [`code://test/cli.test.ts`](../../../../test/cli.test.ts) holds a case that throws the SDK's own `RpcError` and asserts the line `No agent for session ahp-session:/not-a-session (-32001)`. The task that asked for the refusal records it.

## Left for later

- A run against a live host, where a model that is absent answers a prompt with `chat/error`. The reconnaissance found the problem that way, on dev86 with ahpd 0.10.0, and it needs a host, so it is Softov's to do. The plan's checklist does not name it.
