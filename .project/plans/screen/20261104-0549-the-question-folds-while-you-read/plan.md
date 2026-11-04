---
title: The waiting question folds to one line while you read
domain: screen
status: planned
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://1bd0c15 - the last commit that holds the brief `briefs/the-question-folds-while-you-read.md`
  - "[code://src/screens.tsx#L1001-L1030](../../../../src/screens.tsx#L1001-L1030) - the chat screen draws `ChatHitl` while an input waits, and its `onEscape` moves focus to `chat.transcript`"
  - "[code://src/screens.tsx#L769-L778](../../../../src/screens.tsx#L769-L778) - `hitlInput`, the input that `ChatHitl` draws"
  - "[code://src/app.tsx#L222](../../../../src/app.tsx#L222) - the hint row reads the focused id from `FOCUS`"
  - "[code://src/app.tsx#L238-L264](../../../../src/app.tsx#L238-L264) - the hints while a confirmation or a question waits"
  - "[code://src/control.ts#L1087-L1111](../../../../src/control.ts#L1087-L1111) - `approve` and `deny`, which the line calls as `ChatHitl` does"
  - "[code://src/control.ts#L3260](../../../../src/control.ts#L3260) - escape runs `screen.back` when no handler takes it first"
  - npm://@textui/chat@^0.9.0 - `ChatHitl`, and `ConfirmRequest`, whose global `useInput` is the pattern the line copies for `a` and `d`
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatToolConfirmationCarouselPart.ts - VS Code at `171e90619c7` caps the confirmation's height and expands it on a button
---

## Goal

While a question waits and focus is in the history, the chat screen draws one yellow line in place of the full question.
Softov, 2026-11-04: "Just a text line yellow.. to click again and open the question... or when going out of the history focus".
The history that the question is about gets the room.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `FOCUS` in `src/` - the hint row and two screens read it; textui writes it on every focus change.
- `deactivateScope` in textui `focus.ts` - a closing scope moves focus only when it holds it, so folding with focus on the transcript leaves focus there.
- `autoFocus` on the Approve button in `ConfirmRequest` - it takes focus when the panel mounts, because focus is in another scope.
- `keys: 'a'` and `keys: 'd'` in `src/control.ts` - bound only on the sessions and automations scopes.

### Runtime path

```
FOCUS == 'chat.transcript' && INPUT -> FoldedQuestion (a, d, click)
FOCUS elsewhere && INPUT            -> ChatHitl (autoFocus)
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| The question folds to one yellow line while focus is on `chat.transcript` | Softov, 2026-11-04: "Just a text line yellow.. to click again and open the question... or when going out of the history focus" | 01 |
| `a` and `d` still answer a confirmation from the line | Softov, 2026-11-04: "a and d still answer (Recommended)" | 01 |
| A click on the line, or focus leaving the history, opens the question | Softov, 2026-11-04: "Click, or leaving history (Recommended)" | 01 |
| The change is in ahpc only, with no textui release | Softov, 2026-11-04: "ok implement", on the brief | 01 |
| `1-9` and the question keys work only once the question is open | `(defaulted: the line shows no options to number)` | 01 |
| Escape on the line runs `screen.back` | `(defaulted: the same as escape from the transcript today)` | 01 |
| The line keeps the panel's place, and reports it as the creature's floor | `(defaulted: the creature must not stand on the line)` | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The question folds to one line on the history](task-01-the-question-folds-to-a-line.md) | todo | - |

## Risks and tradeoffs

- A question that arrives while focus is on the history shows folded at once, because the fold follows focus. The yellow line and the hint row still name it.

## Resume state

- **Done so far:** the plan.
- **Next action:** build task 01 on a branch.
- **Open questions:** none.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [ ] By hand, escape from a waiting confirmation folds it to one line, `a` approves from there, and a click opens it.
