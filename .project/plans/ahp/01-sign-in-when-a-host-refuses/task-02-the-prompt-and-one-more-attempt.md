---
title: The prompt is drawn, and the refused act runs once more
status: done
depends: [task-01-the-refusal-is-read-once.md]
layer: screen
refs:
  - code://src/control.ts#L50-L191 - the `Controller` interface, at whose call sites the retry is wrapped
  - code://src/control.ts#L227-L232 - `createController`, where the asker, its waiter list and its layer id live
  - code://src/control.ts#L442-L446 - `failed`, where a rejection lands today
  - code://src/control.ts#L541-L546 - `refresh`, whose own `catch` is why the wrapper goes around the `listSessions` call and not the method
  - code://src/control.ts#L848-L867 - `create`, whose `refresh`, `open` and `send` after the await must not run twice
  - code://src/control.ts#L1122-L1141 - the palette's modal, the shape `askSignIn` copies
  - code://src/state.ts#L165-L194 - `HOST_ERROR` and `INPUT_STATUS`, the free text the store holds
  - code://src/app.tsx#L497-L543 - the component registration list and the over-every-screen layer
  - code://src/app.tsx#L478-L492 - `registerChat`, where the controller is built in `onBoot` before `app.start()` resolves
  - code://src/ahp/auth.ts - the reader and `attempt` this task uses
  - code://src/ahp/fake.ts#L33-L90 - `protect` and `asked`, the hooks the tests read
  - code://src/screens.tsx#L1420-L1524 - the `TextInput` and `FormActions` pattern the prompt follows
  - code://test/live.test.tsx#L1-L30 - `renderApp` from `@textui/testing` over `fakeHost`, the harness the screen test follows
  - file:///github/ahpapp/src/auth-gate.tsx#L176-L215 - `waiters` and `settle`, the per-resource answer this task copies
  - file:///github/ahpapp/src/auth-gate.tsx#L356-L371 - the sheet drawn above the navigator
  - file:///github/ahpapp/src/components/ResourceAuth.tsx#L119-L167 - the field, the submit, and the refusal drawn where the credential was entered
  - npm://@textui/widgets@^0.6.1 - `TextInput.mask`, the field that replaces every character for a secret
---

## Objective

A refusal or an `auth/required` opens a masked credential field in a modal over whatever screen the person is on; submitting pushes it with `authenticate`; an accepted credential closes the modal and the refused act runs exactly once more; a refused credential leaves the modal open with the host's words; a refusal that names no resource opens nothing; and two refused acts at once are both answered by one sign-in, the one for the accepted resource retried and the other told no.

## Files

- `CREATE: src/view/auth.tsx` - `SignInPrompt`, the modal body.
- `UPDATE: src/state.ts:165-198` - `AUTH_ASK`, typed from `src/ahp/auth.ts`, and the comment beside it.
- `UPDATE: src/control.ts:50-191` - `askSignIn(one)` and `signIn(resource, token)` on `Controller`.
- `UPDATE: src/control.ts:227-232` - the waiter list, the single layer id, and `auth.ask` installed on the box `src/connect.ts` exports.
- `UPDATE: src/control.ts:442-446` - `settle` and `guard` beside `failed`.
- `UPDATE: src/control.ts:531-933` - each single `await host.<call>()` wrapped in `guard`: the `listSessions` await in `refresh` (`:543`), the `createChat` and `disposeChat` awaits (`:583`, `:590`), the `disposeSession` await (`:842`), the `createSession` await (`:856`) and not the `refresh`, `open` and `send` that follow it, and the pure forwarders at `:870-911`. `settings` (two calls) and `watchFiles` and `completions` (deliberately swallowed) are left alone.
- `UPDATE: src/control.ts:1122-1141` - the modal pattern `askSignIn` follows.
- `UPDATE: src/app.tsx:497-543` - `['SignInPrompt', SignInPrompt]` in the component list, and the import.
- `CREATE: test/auth.test.tsx` - the screen cases.

## Steps

1. `AUTH_ASK` in `src/state.ts`, typed `AuthAsk | null`, holding the resource, the host's name for it, the reason and the host's words.
2. In `createController`, a `waiters` list and one layer id: `askSignIn(one)` pushes `{ resource: one.resource, settle }` onto the list, writes `AUTH_ASK`, and opens `app.layers.open({ id: 'auth', layer: 'modal', scrim: true, trapFocus: true, dismissOnEscape: true, node: { component: 'SignInPrompt' }, onClose: () => settle(null) })` only when the layer is not already open; when it is, the newest ask is what `AUTH_ASK` shows. It returns a promise that resolves when `settle` answers that waiter.
3. `settle(accepted)` empties the waiter list first, then closes the layer if it is open, clears `AUTH_ASK` and resolves each waiter `accepted !== null && waiter.resource === accepted`. Emptying first is what makes it safe against its own `onClose`, and a dismissed prompt is `settle(null)`, a declined credential and never a retry.
4. `signIn(resource, token)` awaits `host.authenticate(resource, token)`; on success it calls `settle(resource)` and returns true, and on a refusal it writes the host's words back into `AUTH_ASK`, leaves the layer open and returns false, so a refused credential never reaches the retry (decisions 2 and 5).
5. `guard(once)` is `attempt(once, (one) => askSignIn(one))` from `src/ahp/auth.ts`, wrapped around each single `await host.<call>()` named in Files, never around a `Controller` method (decision 2).
6. `SignInPrompt` in `src/view/auth.tsx`: reads `AUTH_ASK`, draws the host's name for the resource and its identifier, the reason when there is one, the host's words over the field, a `TextInput` with `mask="*"` and `autoFocus`, and a submit and a cancel; submit is disabled while the field is empty, and the node carries no props.
7. Register `SignInPrompt` in `src/app.tsx`, and install `auth.ask` on the `src/connect.ts` box from `createController`, disposed with the controller's bag, so `src/tui.tsx` is not touched.
8. A notification or a refused channel opens the prompt with nothing to retry: `auth.ask` calls `askSignIn` with no `attempt` around it, so closing it ends nothing but the prompt.

## Validation

- `test/auth.test.tsx`, over `fakeHost` with `protect()`: the catalogue is refused, the modal draws the resource and the host's words, typing a token and submitting serves the list and `host.asked('listSessions')` is exactly two.
- A credential the host refuses: the modal stays open, the refusal is drawn, and `asked('listSessions')` stays at one.
- A second refusal after an accepted credential: the act is not sent a third time and the host's words are reported.
- Dismissing with escape: the act is not re-run and nothing was pushed.
- A `-32007` with no resources: no layer is opened and the footer keeps the sentence.
- Two refused acts at once, a catalogue read and a session open: one prompt is drawn for the newest resource, one credential answers both, the act for the accepted resource is retried and the other reports the host's refusal rather than hanging.
- `npm test` and `npm run typecheck` green.

## Resume

Done 2026-09-24.
`AUTH_ASK` and the `authAsk()` reader are in `src/state.ts`; the waiter list, `settle`, `askSignIn`, `signIn`, `dismissSignIn`, the `guard` call-site wrapper and the installed `auth.ask` are in `src/control.ts`; `src/view/auth.tsx` draws `SignInPrompt` and `src/app.tsx` registers it.
Verified by `test/auth.test.tsx` (6) over the fake host: refused, prompted, accepted and served once more; a refused credential leaves the prompt open; a second refusal stops and reports the first; escape runs nothing; a doorless refusal opens nothing; two refused acts are both held and only the matching one retried. `npm test` and `npm run typecheck` green.
Departure: `dismissSignIn()` was added to `Controller` so Cancel can settle the prompt without a credential, which the plan did not name. `settle` also carries a re-entrancy guard, because closing the layer calls its own `onClose`.
