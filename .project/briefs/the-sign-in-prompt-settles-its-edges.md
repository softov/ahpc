---
title: The sign-in prompt answers the ask it was opened for, sends once, and settles on close
created: 2026-11-04
replaces:
  - problems/the-sign-in-prompt-leaves-edges-unsettled.md
refs:
  - git://3bcf162 - the commit of this repository the facts were checked at, and the last commit that holds the problem
  - "[code://src/control.ts#L604-L625](../../src/control.ts#L604-L625) - the waiters and `settle`"
  - "[code://src/control.ts#L679-L696](../../src/control.ts#L679-L696) - `signIn` reads `AUTH_ASK` again after the await"
  - "[code://src/control.ts#L1297](../../src/control.ts#L1297) - the controller's `dispose`, which does not settle the waiters"
  - "[code://src/view/auth.tsx#L79](../../src/view/auth.tsx#L79) - Enter in the field calls `form.submit()`"
  - file:///github/textui/roadmap/ideas/form-submit-ignores-a-second-call.md - at textui `eb7d989`, the idea to fix the cause in textui
---

# The sign-in prompt answers the ask it was opened for, sends once, and settles on close

The sign-in prompt fixes three edges in ahpc.
A refused token's error shows under the resource it was for.
One Enter sends a token once.
Closing ahpc answers every act that waits on a token.
Softov, 2026-11-04: "In ahpc now", for the second edge.

## What others do

- textui's `FormActions` blocks its button while `submitting` is set, but `submit()` does not check it. The textui idea `form-submit-ignores-a-second-call.md` proposes the fix there.

## What ahpc has today

- `signIn` writes the host's error onto whatever `AUTH_ASK` holds after the await, which can be a later ask for another resource ([`code://src/control.ts#L679-L696`](../../src/control.ts#L679-L696)).
- Enter in the token field calls `form.submit()` while a send is out, so one token can be sent twice ([`code://src/view/auth.tsx#L79`](../../src/view/auth.tsx#L79)).
- The controller's `dispose` does not call `settle(null)`, so an act that waits on a token waits forever ([`code://src/control.ts#L1297`](../../src/control.ts#L1297)).

## Who writes

- `/github/ahpc` is on `main` at `3bcf162`, and no pull request is open.
- No other brief changes `signIn`, `settle` or `src/view/auth.tsx`.

## The change

- `signIn` keeps the resource it answers, and writes an error only while that resource is still the one on screen.
- The token field ignores Enter while a send is out.
- The controller's `dispose` settles every waiter as declined.
- A test covers each edge.
- Once textui ships the idea, ahpc can drop its own Enter guard.
