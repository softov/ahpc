---
title: A usage screen says what a session has spent - implemented
date: 2026-09-20
refs:
  - code://src/ahp/types.ts
  - code://src/ahp/live.ts
  - code://src/screens.tsx
  - code://src/app.tsx
  - code://src/control.ts
  - code://src/ahp/fake.ts
  - code://test/meta.test.ts
  - code://test/reconnect.test.ts
  - code://test/usage.test.tsx
---

A session's spend is now readable: a turn decoded from the wire keeps its token counts, its cost, the model it billed to and what automatic routing resolved to, a catalogue model keeps its context window, and a usage screen shows that for the open chat, reached by `u` in the conversation or by `go.usage` in the palette.
A host that reports none of the numbers draws "reported nothing" rather than a row of zeroes, and the header and history rows are untouched.

## What was built

- `code://src/ahp/types.ts` - `TurnUsage` with `inputTokens`, `outputTokens`, `cacheReadTokens`, `model`, `resolvedModel`, `cost` and `sessionCost`; `Turn.usage`; and `ModelRow.contextWindow`.
- `code://src/ahp/live.ts` - `usage()` reads a turn's report, taking a non-negative `_meta.cost` or converting `_meta.copilotUsage.totalNanoAiu` and `sessionTotalNanoAiu` to credits, and yields nothing when there are no numbers; `turn()` attaches it; `model()` reads `maxContextWindow` or the `maxPromptTokens` plus `maxOutputTokens` fallback.
- `code://src/screens.tsx` - `UsageScreen`, one row per agent turn with its billed model, its input, output and cached tokens and its cost, the session total the host reports, and the window against the most recent turn that used a listed model.
- `code://src/app.tsx` - the component and the `usage` screen registration.
- `code://src/control.ts` - `go.usage` under Screens gated on `OPEN`, and `u` bound in the chat scope.
- `code://src/ahp/fake.ts` - a `contextWindow` on each claude model and a usage report on the agent turn `reply()` builds.
- `code://test/meta.test.ts`, `code://test/reconnect.test.ts` and `code://test/usage.test.tsx` - the decoding, the catalogue and the screen cases.

## Verified

- `test/meta.test.ts`, 11 tests: the counts, the plain cost, the nano-AIU conversion, the empty report, the negative cost and the session-total-only report.
- `test/reconnect.test.ts`, 68 tests: the declared window, the input-plus-output fallback and a row with neither.
- `test/usage.test.tsx`, 6 tests: the palette command, the `u` key, a row with the model, both counts and the cost, the context line, the session total and the nothing-reported session.
- `test/fake.test.ts`, 17 tests, and the fixture's model and turn counts elsewhere, still green.
- `npm test` green at 29 files and 557 tests, and `npm run typecheck` green.

## Departures from the plan

- The screen lists the agent's own turns rather than every transcript row: a user row is the prompt a turn was given and is never billed, so drawing one would put "reported nothing" above each answer.
- When Auto resolved, the model line reads the billed id from `usage.model` and the routed id from `usage.resolvedModel`, which is the decisions table's "both drawn"; the task step's "requested id" was read as that billed id, because `Turn.model` is the request and already rides the transcript.

## Left for later

- The manual check the plan named, opening a session and pressing `u` against a real host, needs a running daemon and was not done here.
- No `deferred.md`: nothing was set aside.
