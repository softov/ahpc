---
title: The sign-in prompt answers the ask it was opened for, sends once, and settles on close
domain: ahp
status: active
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
requires:
  - plans/ahp/20261104-0734-the-retry-comments-agree-with-the-spec/plan.md
refs:
  - git://7551c40 - the commit the facts were checked at, and the last commit that holds the brief `briefs/the-sign-in-prompt-settles-its-edges.md`
  - "[code://src/control.ts#L604-L625](../../../../src/control.ts#L604-L625) - the waiters and `settle`"
  - "[code://src/control.ts#L679-L696](../../../../src/control.ts#L679-L696) - `signIn`"
  - "[code://src/control.ts#L1297](../../../../src/control.ts#L1297) - the controller's `dispose`"
  - "[code://src/view/auth.tsx#L79](../../../../src/view/auth.tsx#L79) - Enter in the field calls `form.submit()`"
  - file:///github/textui/roadmap/ideas/form-submit-ignores-a-second-call.md - at textui `eb7d989`, the fix of the cause in textui
---

## Goal

The sign-in prompt fixes three edges in ahpc.
A refused token's error shows under its own resource, one Enter sends once, and closing ahpc answers every waiting act.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `AUTH_ASK` in `src/control.ts` - `signIn` reads it again after the await.
- `settle(null)` in `src/control.ts` - the layer and `dismissSignIn` call it, and `dispose` does not.
- `submit()` in textui `useForm` - it does not check `submitting`.

### Runtime path

```
SignInPrompt -> controller.signIn(resource, token) -> host.authenticate -> settle
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| `signIn` writes an error only under the resource it answers | (defaulted: the brief's fix) | 01 |
| The token field ignores Enter while a send is out | Softov, 2026-11-04: "In ahpc now" | 01 |
| The controller's `dispose` settles every waiter as declined | (defaulted: the brief's fix) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The three edges](task-01-three-edges.md) | implemented | - |

## Risks and tradeoffs

- None known. The textui idea `form-submit-ignores-a-second-call.md` lets ahpc drop its own guard later.

## Resume state

- **Done so far:** task 01 - `signIn` writes a refusal only to its own ask, the field sends once, and `dispose` settles every waiter as declined.
- **Next action:** none. The plan is waiting on review.
- **Open questions:** none.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
