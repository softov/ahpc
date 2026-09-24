---
title: Sign in when a host refuses, and run the refused act once more - implemented
date: 2026-09-24
refs:
  - code://src/ahp/auth.ts
  - code://src/view/auth.tsx
  - code://test/auth.test.ts
  - code://test/auth.test.tsx
---

A `-32007` or an `auth/required` no longer stops at a sentence.
A masked credential field opens in a modal over whatever screen the person is on, submitting pushes the token with `authenticate`, and the act that was refused runs exactly once more when the host takes it. A credential the host turns down keeps the prompt open with the host's own words; a dismissed prompt runs nothing; a refusal that names no resource opens nothing and is drawn as the host's sentence. In a shell, a refusal is one sentence naming the resource and the environment variable that satisfies it, and the command exits 1 without prompting or retrying.

## What was built

- `code://src/ahp/auth.ts` - the reading (`authRequiredOf`, `authRequiredReason`, `hostWords`, `failureWords`), the ask (`askFor`, `AuthAsk`) and the one retry (`retryAllowed`, `attempt`). No renderer, no store, no socket.
- `code://src/connect.ts` - the module-level `auth` box beside `sink`, whose default reports `signInSentence(one)`. The controller fills it once there is one, exactly as `sink.report` is filled.
- `code://src/ahp/live.ts` - `onAuthRequired`'s resource entry carries `name`, read from the protocol's `resource_name` in both `notified()` and `reason()`; `description` was the wrong field and dropped the host's own name.
- `code://src/state.ts` - `AUTH_ASK` and the `authAsk(store)` reader, typed from `src/ahp/auth.ts`.
- `code://src/control.ts` - `askSignIn`, `settle`, `signIn`, `dismissSignIn`, a waiter list keyed by resource under one layer id, and `guard` wrapping each single `await host.<call>()`: `refresh`, `reread`, `createChat`, `disposeChat`, `disposeSession`, the `createSession` await in `create`, and the pure forwarders. `settings`, `watchFiles` and `completions` are deliberately left alone.
- `code://src/view/auth.tsx` - `SignInPrompt`, a masked `TextInput` in a `Form` with `FormActions`, reading the ask from the store; registered in `code://src/app.tsx`.
- `code://src/ahp/fake.ts` - `protect(resource, name?)` and `asked(method)` on `FakeHost`; `listSessions` and `detail` refuse with a real `-32007` shape while a protected resource has no token, and `authenticate` clears it.
- `code://test/scenario.ts` - `refuseRequests`, a per-method request refusal that clears once `authenticate` names the resource the error carried.
- `code://src/cli/main.ts` - a `catch` before the `finally` that turns a refusal into a `Fault`, and `needsToken(resource, name?)`, the one sentence shared with `signIn`'s missing-token message.

## Verified

- `code://test/auth.test.ts` - 16 cases: the reader with and without resources and names, the dispatch rejection read from its words, the one-retry rule including a second refusal throwing the first, and the shell sentence.
- `code://test/auth.test.tsx` - 6 cases over `fakeHost`: refused, prompted, accepted and served exactly once more with the token pushed for the right resource; a refused credential keeps the prompt open and runs nothing; a second refusal stops and reports the first; escape runs nothing; a doorless refusal opens nothing; two refused acts are both held and only the matching one is retried.
- `code://test/fake.test.ts` - 19 cases, including the fixture refusing and then serving after a token, and answering when nothing was protected.
- `code://test/reconnect.test.ts` - 69 cases, including a request refused until a token is pushed and answered afterwards.
- `npm test` - 31 files, 591 tests, all green. `npm run typecheck` green.

## Departures from the plan

- Task 02 - `dismissSignIn()` was added to `Controller` so the prompt's Cancel settles it without a credential; the plan named only `askSignIn` and `signIn`.
- Task 02 - `settle` carries a re-entrancy guard. Closing the layer calls its own `onClose`, which calls `settle` again, and the guard is what keeps a waiter from being resolved twice.
- Task 01 - the fixture enforces `protect` on `listSessions` and `detail` only, the two requests a screen reads, rather than on every method. `asked(method)` counts those, which is all a retry assertion needs.
- Task 01 - the `-32007` path still carries no `reason`, because `AuthRequiredErrorData` has none. The prompt's "expired" line is therefore reachable only from an `auth/required` notification, which is what the protocol allows.

## Left for later

- `src/mcp/` reads the same `HostConnection` and still answers a raw refusal to a model, and a refused dispatch is still not retried.
- The reference's live-state fallback for a refusal that names no resource, and the declared-resource ordering in `resourceToAsk`, are not ported.
  See [deferred.md](deferred.md).
