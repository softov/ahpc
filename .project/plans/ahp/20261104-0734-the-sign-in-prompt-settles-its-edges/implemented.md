---
title: The sign-in prompt answers the ask it was opened for, sends once, and settles on close - implemented
date: 2026-11-04
refs:
  - git://e696747
  - "[code://src/control.ts](../../../../src/control.ts)"
  - "[code://src/view/auth.tsx](../../../../src/view/auth.tsx)"
  - "[code://test/auth.test.tsx](../../../../test/auth.test.tsx)"
---

The sign-in prompt now keeps its edges. A credential the host turns down writes its words only under the resource it was sent for. A second refusal drawing the prompt is left alone. The token field ignores Enter while a send is out, so one answer is one `authenticate`. Closing the client settles every act waiting on the prompt as declined, rather than leaving it hanging.

## What was built

- [`code://src/control.ts#L679-L698`](../../../../src/control.ts#L679-L698) - `signIn` writes a refusal, or the missing-token sentence, only while `AUTH_ASK` still names the resource it answers.
- [`code://src/control.ts#L1298-L1300`](../../../../src/control.ts#L1298-L1300) - the controller's `dispose` calls `settle(null)` before the bag is disposed.
- [`code://src/view/auth.tsx#L79`](../../../../src/view/auth.tsx#L79) - the field's `onSubmit` returns while `form.submitting` is set.
- [`code://test/auth.test.tsx`](../../../../test/auth.test.tsx) - the three cases in *Validation*.

## Verified

- `npm run -s typecheck` passed.
- `npm run -s build` passed.
- `npx vitest run` passed 862 of 863 tests. The one failure is `test/smoke.test.tsx` "puts where the session runs on a row of its own". That is the known worktree failure, because the folder is not named `ahpc`.
- With the resource check removed from the `signIn` catch, the new refusal case fails with the first resource's words under the second ask.
- With the submit guard removed, the new two-Enter case sends two `authenticate` calls.
- With `settle(null)` removed from `dispose`, the new dispose case times out because the waiting act is never answered.

## Departures from the plan

- none.

## Left for later

- `form.submitting` is render state, so two Enter presses inside one frame, as from a paste, can both submit. The textui idea `form-submit-ignores-a-second-call.md` fixes the cause with a ref.
