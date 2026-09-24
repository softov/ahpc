---
title: A refusal is read once, and the scripted hosts can refuse
status: done
depends: []
layer: ahp
refs:
  - code://src/ahp/live.ts#L1424-L1434 - the `auth/required` notification, already read into `onAuthRequired` and the only place a `reason` arrives
  - code://src/ahp/live.ts#L1512-L1535 - `reason`, where a `-32007`'s `data.resources` is already read and its `reason` is correctly absent
  - code://src/ahp/live.ts#L1883-L1899 - `dispatch`, the fire-and-forget path whose refusal carries words and no code
  - code://src/ahp/live.ts#L1956-L1980 - `authenticate`, the call the prompt submits through
  - code://src/connect.ts#L41-L52 - `sink`, the box pattern the asker copies
  - code://src/connect.ts#L73-L86 - the sentence `onAuthRequired` prints today
  - code://src/app.tsx#L478-L492 - `registerChat`, which builds the controller in `onBoot` before `app.start()` resolves
  - code://test/scenario.ts#L60-L80 - the scripted host's refusal state
  - code://test/scenario.ts#L416-L426 - where `listSessions` and `authenticate` are answered
  - code://src/ahp/fake.ts#L1970-L1987 - the fixture's `authenticate`, which already remembers a token and never enforces one
  - code://test/reconnect.test.ts#L1436-L1512 - the existing `onAuthRequired` cases this must not break
  - file:///github/ahpapp/src/auth-required.ts#L65-L121 - `authRequiredOf` and `authRequiredReason`, the reading to port
  - file:///github/ahpapp/src/auth-required.ts#L133-L145 - `refusalStep`, where a second refusal and a no-resource refusal both stop
  - file:///github/ahpapp/src/auth-required.ts#L239-L248 - `retryAllowed`, the one-attempt rule
  - npm://@microsoft/agent-host-protocol@^0.9.0 - `AuthRequiredErrorData` and `ProtectedResourceMetadata`, whose friendly string is `resource_name`
---

## Objective

`src/ahp/auth.ts` reads a refusal by its code into the resource to ask for, the host's name for it and the words to draw, `attempt()` runs an act once and once more after an accepted credential, `src/connect.ts` hands the ask to a box a front end installs instead of only printing it, and both the scripted host and the fixture can refuse until a token is pushed.

## Files

- `CREATE: src/ahp/auth.ts` - `AUTH_REQUIRED`, `AuthResource`, `AuthRefusal`, `AuthAsk`, `hostWords`, `authRequiredOf`, `authRequiredReason`, `failureWords`, `retryAllowed`, `askFor`, `attempt`.
  No renderer, no store, no socket.
- `UPDATE: src/connect.ts:41-104` - an `auth` box beside `sink`, `onAuthRequired` filling it with an `AuthAsk`, and the printed sentence kept as the fallback for a front end that installs nothing.
- `UPDATE: src/ahp/live.ts:105-114,1424-1434,1512-1535` - `onAuthRequired`'s resource entry carries `name` rather than `description`, read from the protocol's `resource_name` in both `notified()` and `reason()`.
- `UPDATE: test/scenario.ts:60-80` - a per-method request refusal carrying a code and `data`, cleared when `authenticate` is answered for the named resource.
- `UPDATE: test/scenario.ts:416-426` - the refusal checked before the normal answer for that method.
- `UPDATE: src/ahp/fake.ts:33-90` - a `protect(resource, name?)` hook on `FakeHost` beside `pump`, `rename` and `dispatched`, and an `asked(method)` count of the requests it has served.
- `UPDATE: src/ahp/fake.ts:1970-1987` - the token already remembered per resource, now enforced: a request refused with `-32007` while a protected resource has no token.
- `CREATE: test/auth.test.ts` - the reader and the retry rule, with no React and no socket.
- `UPDATE: test/fake.test.ts` - the fixture refusing, then serving after a token.

## Steps

1. `src/ahp/auth.ts`: `AUTH_REQUIRED = -32007`, `hostWords()` stripping an SDK `RPC error -32007:` wrapper, `AuthResource { resource, name? }`, `AuthRefusal { resources: AuthResource[], words }` and `AuthAsk { resource, name?, reason?, words }`.
2. `authRequiredOf(error)` returns an `AuthRefusal` only when `error.code === AUTH_REQUIRED`, reading `data.resources[].resource` in order and deduplicating, and each entry's `resource_name` as its `name`; `null` for anything else.
3. `authRequiredReason(reason)` reads a dispatch rejection, which the host has nowhere to put a code in: it searches the text for `-32007` and answers with no resource, so the caller stops rather than guessing (decision 3).
4. `askFor(refusal)` answers the first resource the refusal named as an `AuthAsk`, with that entry's name, or `null` when it named none; `retryAllowed(retries)` is `retries < 1`.
5. `attempt(once, ask)` calls `once()`, and on an `authRequiredOf` refusal calls `ask(one)` and then `once()` once more only when the ask answered `true`; a second refusal throws the original error (decision 2). It wraps a single awaited call, never a whole controller method.
6. `src/ahp/live.ts`: `onAuthRequired`'s resource entry is `{ resource, name? }`, filled from the protocol's `resource_name` in `notified()` and in `reason()`; a `reason` is carried only by the notification, because `AuthRequiredErrorData` has none.
7. `src/connect.ts`: `export const auth: { ask(one: AuthAsk): void }` beside `sink`, whose default writes the sentence `ahpc auth <resource>` to stderr; `onAuthRequired` builds the ask from the resources and the reason and hands it over.
8. `test/scenario.ts`: `refuseRequests: Map<string, Record<string, unknown>>` and a `token` set; the `authenticate` branch records the token, and a method in the map is answered with its error while the named resource has none.
9. `src/ahp/fake.ts`: a `protect(resource, name?)` hook on `FakeHost`; while a protected resource has no token, the first awaited request throws `Object.assign(new Error(...), { code: -32007, data: { resources: [{ resource, resource_name }] } })`, and `authenticate` clears it.
10. `test/auth.test.ts`: the reader, the rule, and the ask.

## Validation

- `test/auth.test.ts` - a `-32007` with two resources reads both in order and asks for the first, carrying its `resource_name` as the ask's name; a `-32007` with no `data` reads as a refusal and asks nothing; a `-32005` is not an auth refusal; `attempt` runs once for a success, twice for a refusal then an accepted credential, and once for a refusal then a declined one, and throws on a second refusal.
- `test/fake.test.ts` - the fixture refuses `listSessions` with `-32007` until `authenticate` is given a token for the resource it names, then serves.
- `test/reconnect.test.ts` - unchanged and green, including the `-32007` and `auth/required` cases at `:1454` and `:1496`; the case that reads the resources off a `-32007` still names `https://api.anthropic.com`.
- `npm test` and `npm run typecheck` green.

## Resume

Done 2026-09-24.
`src/ahp/auth.ts` holds the reading, `askFor` and `attempt`; `src/ahp/live.ts` carries `resource_name` as the ask's name in both `notified()` and `reason()`; `src/connect.ts` has the `auth` box and `signInSentence`; the fixture enforces `protect` and counts with `asked`; the scripted host refuses a request by method with `refuseRequests` and clears it when `authenticate` names the resource.
Verified by `test/auth.test.ts` (16), `test/fake.test.ts` (19) and `test/reconnect.test.ts` (69), all green, and by `npm run typecheck`.
Left: the fixture enforces only `listSessions` and `detail`, the two requests a screen reads, rather than every method. The per-channel refusal variant the resume asked about was not needed: `refuseWith` already covers subscribe, and the request case is what `refuseRequests` adds.
