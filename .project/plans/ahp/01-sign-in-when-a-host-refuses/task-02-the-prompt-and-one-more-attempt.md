---
title: The prompt is drawn, and the refused act runs once more
status: todo
depends: [task-01-the-refusal-is-read-once.md]
layer: screen
refs:
  - code://src/control.ts#L50-L191 - the `Controller` interface, whose awaited methods are wrapped
  - code://src/control.ts#L442-L446 - `failed`, where a rejection lands today
  - code://src/control.ts#L531-L546 - `refresh`, the smallest method that forwards one awaited call
  - code://src/control.ts#L1122-L1141 - the palette's modal, the shape `askSignIn` copies
  - code://src/state.ts#L165-L194 - `HOST_ERROR` and `INPUT_STATUS`, the free text the store holds
  - code://src/app.tsx#L497-L543 - the component registration list and the over-every-screen layer
  - code://src/tui.tsx#L400-L411 - where `sink.report` is filled once the app exists
  - code://src/ahp/auth.ts - the reader and `attempt` this task uses
  - code://src/ahp/fake.ts#L33-L90 - `protect` and `asked`, the hooks the tests read
  - code://src/screens.tsx#L1420-L1524 - the `TextInput` and `FormActions` pattern the prompt follows
  - code://test/scenario.ts#L1-L40 - `renderApp` over `fakeHost`, the harness the screen test uses
  - file:///github/ahpapp/src/auth-gate.tsx#L356-L371 - the sheet drawn above the navigator
  - file:///github/ahpapp/src/components/ResourceAuth.tsx#L119-L167 - the field, the submit, and the refusal drawn where the credential was entered
  - npm://@textui/widgets@^0.6.1 - `TextInput.mask`, the field that replaces every character for a secret
---

## Objective

A refusal or an `auth/required` opens a masked credential field in a modal over whatever screen the person is on; submitting pushes it with `authenticate`; an accepted credential closes the modal and the refused act runs exactly once more; a refused credential leaves the modal open with the host's words; a refusal that names no resource opens nothing.

## Files

- `CREATE: src/view/auth.tsx` - `SignInPrompt`, the modal body.
- `UPDATE: src/state.ts:165-198` - `AUTH_ASK`, typed from `src/ahp/auth.ts`, and the comment beside it.
- `UPDATE: src/control.ts:50-191` - `askSignIn(one)` and `signIn(resource, token)` on `Controller`.
- `UPDATE: src/control.ts:442-446` - `settle` and `guard` beside `failed`.
- `UPDATE: src/control.ts:531-933` - every forwarded method that returns a promise wrapped in `guard`.
- `UPDATE: src/control.ts:1122-1141` - the modal pattern `askSignIn` follows.
- `UPDATE: src/app.tsx:497-543` - `['SignInPrompt', SignInPrompt]` in the component list, and the import.
- `UPDATE: src/tui.tsx:400-411` - `auth.ask` installed beside `sink.report`.
- `CREATE: test/auth.test.tsx` - the screen cases.

## Steps

1. `AUTH_ASK` in `src/state.ts`, typed `AuthAsk | null`, holding the resource, the host's name for it, the reason and the host's words.
2. In `createController`, one waiter and one layer id: `askSignIn(one)` writes `AUTH_ASK`, opens `app.layers.open({ id: 'auth', layer: 'modal', scrim: true, trapFocus: true, dismissOnEscape: true, node: { component: 'SignInPrompt' }, onClose: () => settle(false) })` when it is not already open, and returns a promise that resolves when the layer settles.
3. `settle(accepted)` closes the layer, clears `AUTH_ASK` and resolves the waiter, so a dismissed prompt is a declined credential and never a retry.
4. `signIn(resource, token)` awaits `host.authenticate(resource, token)`; on success it settles true, and on a refusal it writes the host's words back into `AUTH_ASK` and answers false (decision 5: nothing is kept).
5. `guard(once)` is `attempt(once, (one) => askSignIn(one))` from `src/ahp/auth.ts`, and every `Controller` method that forwards one awaited call to the host is wrapped in it (decision 2).
6. `SignInPrompt` in `src/view/auth.tsx`: reads `AUTH_ASK`, draws the host's name for the resource and its identifier, the reason when there is one, the host's words over the field, a `TextInput` with `mask="*"` and `autoFocus`, and a submit and a cancel; submit is disabled while the field is empty.
7. Register `SignInPrompt` in `src/app.tsx`, and install `auth.ask` in `src/tui.tsx` after the controller exists, the way `sink.report` is installed at `:410`.
8. A notification opens the prompt with nothing to retry: `auth.ask` is called directly from `src/connect.ts` with no `attempt` around it, so closing it ends nothing but the prompt.

## Validation

- `test/auth.test.tsx`, over `fakeHost` with a protected resource: the catalogue is refused, the modal draws the resource and the host's words, typing a token and submitting serves the list and `host.asked('listSessions')` is exactly two.
- A credential the host refuses: the modal stays open, the refusal is drawn, and `asked('listSessions')` stays at one.
- A second refusal after an accepted credential: the act is not sent a third time and the host's words are reported.
- Dismissing with escape: the act is not re-run and nothing was pushed.
- A `-32007` with no resources: no layer is opened and the footer keeps the sentence.
- `npm test` and `npm run typecheck` green.

## Resume

Not started.
One thing to confirm while drawing it: whether a layer opened from the `auth.ask` callback works before `app.start()` has resolved, and whether the palette's own `onClose` prop pattern is what a layer component reads or whether `AUTH_ASK` alone is enough.
Proposed: install the asker where `sink.report` is installed, and let the component read the store.
