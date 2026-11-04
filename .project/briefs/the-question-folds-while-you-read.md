---
title: The waiting question folds to one line while you read
created: 2026-11-04
refs:
  - git://382f94b - the commit of this repository the facts were checked at
  - "[code://src/screens.tsx#L1001-L1030](../../src/screens.tsx#L1001-L1030) - the chat screen draws `ChatHitl` between the transcript and the composer while an input waits, and its `onEscape` moves focus to `chat.transcript`"
  - "[code://src/app.tsx#L222](../../src/app.tsx#L222) - the hint row reads the focused id from `FOCUS`"
  - "[code://src/app.tsx#L238-L264](../../src/app.tsx#L238-L264) - the hints while a confirmation waits, and while a question waits"
  - "[code://src/state.ts#L357](../../src/state.ts#L357) - `FOCUS`, the store key that holds the focused id"
  - "[code://src/control.ts#L2880-L2901](../../src/control.ts#L2880-L2901) - `tool.approve` and `tool.deny`, the commands that answer a confirmation"
  - "[code://src/control.ts#L3260](../../src/control.ts#L3260) - escape runs `screen.back` when no handler takes it first"
  - npm://@textui/chat@^0.9.0 - the package that holds `ChatHitl`, `ConfirmRequest` and `QuestionForm`
  - file:///github/textui/packages/chat/src/hitl.tsx - at textui `9d42d1c`, the same code as the published 0.9.0
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatToolConfirmationCarouselPart.ts - VS Code's tool confirmation above the input, with a capped height and an expand button
---

# The waiting question folds to one line while you read

While a tool question waits and focus is in the history, ahpc draws one yellow line in place of the full question.
The line names the tool, as `⚠ Run Bash?`, and says how to open it.
A click on the line opens the full question again, and so does any move out of the history.
Softov, 2026-11-04: "Just a text line yellow.. to click again and open the question... or when going out of the history focus".
The aim is room to read the history that the question is about.

## What others do

- VS Code, at `171e90619c7`, draws pending tool confirmations in a carousel above the chat input.
- The carousel shows the tool title, and caps its own height while it is not expanded (`getCollapsedMaxHeight`).
- A button expands the carousel to its full height and restores it again (`toggleContentExpanded`).
- VS Code does not fold the carousel when the reader moves to the history.

## What ahpc has today

- While an input waits, the chat screen draws `ChatHitl` from `@textui/chat` between the transcript and the composer ([`code://src/screens.tsx#L1001-L1030`](../../src/screens.tsx#L1001-L1030)).
- `ChatHitl` is a warning panel with the confirmation title and the meta `⚠ waiting on you`.
- `ChatHitl` takes focus when it mounts, through `useFocusScope({ id: 'chat.hitl', autoFocus: true, restore: true })`.
- `ChatHitl` has no prop that folds it.
- For a confirmation, `ConfirmRequest` inside `ChatHitl` binds `a`, `d`, `1-9` and escape as global keys. The keys exist only while the panel is mounted.
- For a question, `QuestionForm` inside `ChatHitl` binds its keys globally too.
- Escape on the panel calls ahpc's `onEscape`. From the panel it moves focus to `chat.transcript`, and from the transcript it leaves the screen.
- Escape with no global handler runs `screen.back` ([`code://src/control.ts#L3260`](../../src/control.ts#L3260)).
- `tool.approve` and `tool.deny` answer a confirmation, and exist only while an input waits ([`code://src/control.ts#L2880-L2901`](../../src/control.ts#L2880-L2901)).
- The focused id is in the store as `FOCUS`, and the hint row already reads it ([`code://src/app.tsx#L222`](../../src/app.tsx#L222)).
- While a confirmation waits, the hint row shows `a approve`, `d deny`, `1-9 option` and `esc read` ([`code://src/app.tsx#L238-L264`](../../src/app.tsx#L238-L264)).
- textui boxes take a click through `onClick`, which `Button` uses for `onPress`.

## Who writes

- `/github/ahpc` is on `main`, clean, at `382f94b`, and has no other worktree.
- No pull request is open on ahpc.
- Two local branches with work not yet checked by hand touch the chat screen and the hint row:
  - `screen/20261103-1600-the-name-is-ahpc-with-its-logo`, already merged into `main`.
  - `screen/20261104-0437-the-status-row-drops-the-screen-name`, merged into `main` as PR #10.
- So no open branch changes `src/screens.tsx` or `src/app.tsx` against this change.
- The change is in ahpc only, so textui needs no release.

## The change

- While an input waits and `FOCUS` is `chat.transcript`, the chat screen draws one warning-toned line in place of `ChatHitl`.
- For a confirmation, the line is the confirmation title with `a approve · d deny · click to open`.
- For a question, the line is the panel title with `click to open`.
- While the line shows a confirmation, ahpc binds `a` to `tool.approve` and `d` to `tool.deny`. Softov, 2026-11-04: "a and d still answer".
- `1-9` and the question keys work only once the question is open.
- A click on the line opens the full question, and focus goes to it.
- Any move of focus out of `chat.transcript` opens the full question, and focus goes to it, as when it first appears. Softov, 2026-11-04: "Click, or leaving history".
- Escape while the line shows runs `screen.back`, as escape from the transcript does today.
- While the line shows, the hint row drops `1-9 option`, and escape reads as leaving the screen.
- The line keeps the position of the panel, so the creature's floor (`boodFloorFor('ask')`) is the line.
