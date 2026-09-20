---
title: A usage screen says what a session has spent
domain: screen
status: built
priority: medium
created: 2026-09-19
revalidated: 2026-09-19
requires: []
changes: []
creates: []
decisions:
  - decisions/usage-gets-a-screen.md
refs:
  - code://.project/decisions/usage-gets-a-screen.md - the decision this plan executes
  - code://.project/review/2026-09-19-upstream-pass-4.md#L50 - the Read and not taken entry that left usage with nowhere to go
  - code://.project/review/2026-09-19-upstream-pass-4.md#L63 - the Left open question the decision answers in favour of a screen
  - code://src/ahp/live.ts#L633-L649 - `turn()`, which calls `selection(message.model, found.usage)` and keeps only the model
  - code://src/ahp/live.ts#L1039-L1059 - the comment and `selection()`, where the counts are dropped
  - code://src/ahp/live.ts#L1077-L1090 - `model()`, which reads the row's name and schema and drops its limits
  - code://src/ahp/types.ts#L176-L194 - `Turn`, which gains `usage`
  - code://src/ahp/types.ts#L404-L425 - `ModelSelection` and `ModelRow`, where the context window goes
  - code://src/state.ts#L25 - `TURNS`, the store key the screen reads
  - code://src/state.ts#L196 - `OPEN`, the gate the command's `when` reads
  - code://src/screens.tsx#L1788-L1820 - `SkillsScreen` and `McpScreen`, the smallest screens to sit beside
  - code://src/screens.tsx#L1873-L1919 - `HostsScreen`, which asks `controller.agents()` and lists what a harness offers
  - code://src/app.tsx#L491-L526 - the component registration list
  - code://src/app.tsx#L538-L558 - the screen registration list
  - code://src/control.ts#L1393-L1410 - `go.skills` and `go.mcp`, the Screens command pattern
  - code://src/control.ts#L2494-L2526 - the chat-scoped letter bindings, where `u` goes
  - code://src/ahp/fake.ts#L948-L975 - the fixture's claude models, which gain a context window
  - code://src/ahp/fake.ts#L1135-L1138 - the agent turn `reply()` builds, which gains a usage report
  - code://test/reconnect.test.ts#L841-L866 - the scripted catalogue case for a model row
  - code://test/meta.test.ts - where a wire shape's decoding is tested
  - npm://@microsoft/agent-host-protocol@^0.9.0 - `UsageInfo` and `SessionModelInfo`, the shapes decoded here
  - file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L190-L250 - `UsageInfoMeta`, where `cost`, `copilotUsage` and `autoModeResolved` are declared
  - file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L540-L554 - `hasReportedUsage`, the "is there a number to show" test
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L628-L706 - `formatTurnResponseDetails`, `usageInfoToAutoModeResolution`, `usageInfoToChatUsage` and `getCopilotCredits`, the reading this mirrors
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/common/languageModels.ts#L274 - `maxContextWindowTokens`, the declared window
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/common/languageModels.ts#L358-L365 - `getModelContextWindowTotal`, the fallback this mirrors
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostLanguageModelProvider.ts#L134 - `m.maxContextWindow ?? known.maxContextWindowTokens`, how the reference maps the protocol's field
---

## Goal

A person opens a usage screen on the chat they are reading and sees what the session has spent: a row for each turn with its prompt, completion and cached tokens and what it cost, the model that turn billed to including what automatic routing resolved to, the session total the host reports, and the model's context window against what the current turn has used.
All of it is already on the wire, and today the client reads the usage report only for the model id, so the change is reading what arrives and giving it a place to be read.
The header and the history rows keep the width they have, and a host that reports no numbers gets a screen that says so rather than a screen full of zeroes.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "usage" src/` - `src/ahp/live.ts` at :645, :1034, :1039, :1048, :1050 and :2975 and nowhere else; there is no `Usage` type, no store key and no screen.
- `rg -n "maxContextWindow|maxPromptTokens|maxOutputTokens" node_modules/@microsoft/agent-host-protocol/dist/types/` - `SessionModelInfo` declares all three, so the host already advertises the window and `model()` at `src/ahp/live.ts:1077` reads none of them.
- `rg -n "screens.register|app.screens.push|component: '" src/` - a screen is one component entry at `src/app.tsx:504`, one screen entry at `src/app.tsx:538`, and a command that pushes it, as `go.changes` does at `src/control.ts:1369`.
- `rg -n "usageInfoToChatUsage|getCopilotCredits|getSessionCopilotCredits|autoModeResolved" src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts` in the clone - the reference reads the counts at :664, the credits at :692, the session total at :685 and the routing at :645.
- `rg -n "getModelContextWindowTotal|maxContextWindowTokens" src/vs/workbench/contrib/chat/` in the clone - the declared window and the input-plus-output fallback at `languageModels.ts:274,358`.

### Runtime path

```
ahp-chat snapshot -> live.ts turn() -> usage() reads inputTokens, outputTokens, cacheReadTokens and _meta.cost, _meta.copilotUsage, _meta.autoModeResolved
  -> Turn.usage -> state.ts applyEvent -> writeTurns -> TURNS
  -> u (chat scope) or go.usage in the palette -> app.screens.push('usage')
  -> UsageScreen reads TURNS and controller.agents(): one row per turn, the session total, and the window against the latest turn
```

### Gaps

- No `TurnUsage` type and no `Turn.usage`; `selection()` at `src/ahp/live.ts:1048-1059` keeps `usage.model` and drops every count, so the numbers are read off the wire and thrown away.
- No `ModelRow.contextWindow`; `model()` at `src/ahp/live.ts:1077-1090` drops `maxContextWindow`, `maxPromptTokens` and `maxOutputTokens`, so the window the host advertises is unread.
- No screen, no `go.usage` command and no key binding; the `u` letter is free in the chat scope, where `c`, `f`, `l`, `s`, `t`, `k`, `p` and `m` are taken.
- The fixture advertises no context window and reports no usage on a turn, so a screen test would have nothing to draw.
- `Not found: any reader of turn token counts, cost, or the context window - searched "usage|inputTokens|outputTokens|cost|credits|maxContextWindow" in src/ and test/.`

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [Usage gets a screen of its own](../../../decisions/usage-gets-a-screen.md) | Softov, 2026-09-19, "Add a dedicated `/usage` screen" |

What this plan settled without one:

| What | Source | Task |
| --- | --- | --- |
| The screen is reached by `u` in the chat scope and by `go.usage` in the palette, the way `c` opens changes, not by a slash command, because slash commands here come from the host | `code://src/control.ts#L2496`, `code://src/ahp/types.ts` | 02 |
| Cost is `_meta.cost` when it is a number, otherwise `_meta.copilotUsage.totalNanoAiu / 1_000_000_000`, and the session total is `_meta.copilotUsage.sessionTotalNanoAiu / 1_000_000_000`, never a sum of the rows | `getCopilotCredits`, `file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L685-L706` | 01, 02 |
| The billed model is `usage.model` and the routed one is `_meta.autoModeResolved.chosenModel`, both drawn when Auto resolved, while the requested model stays `Turn.model` | `usageInfoToAutoModeResolution`, `file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L644-L660` | 01, 02 |
| A turn with no numbers is drawn as "nothing reported", not as zeroes | `hasReportedUsage`, `file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L540-L554` | 01, 02 |
| The context window is `maxContextWindow` when the row carries it, otherwise `maxPromptTokens + maxOutputTokens` when either is a number | `getModelContextWindowTotal`, `file:///github/externals/vscode/src/vs/workbench/contrib/chat/common/languageModels.ts#L358-L365` | 01 |
| The context line is the most recent turn with a usage report against that turn's billed model row, and a turn whose model is not in the catalogue has no window to draw | `code://src/ahp/live.ts#L1077-L1090` | 02 |
| No new store key: the numbers ride on the turns already in `TURNS`, and the catalogue row is asked for as `HostsScreen` asks for it | `code://src/state.ts#L25`, `code://src/screens.tsx#L1879-L1881` | 01, 02 |
| Turns are listed oldest first, as the transcript has them, with the current turn's context line above the rows | this plan, 2026-09-19 | 02 |

## Proposed architecture

- **Data flow** - the chat channel's `turn.usage` goes through `usage()` in `src/ahp/live.ts`, which reads the three token counts, `_meta.cost` or `_meta.copilotUsage`, and `_meta.autoModeResolved`, into `Turn.usage`; the root channel's `SessionModelInfo` goes through `model()`, which reads `maxContextWindow` or the two token limits into `ModelRow.contextWindow`; `UsageScreen` reads the turns back out of `TURNS` and asks `controller.agents()` for the row that carries the window.
- **Event flow** - a running turn's usage arrives on `turnStarted` and again on `turnComplete`, `applyEvent` in `src/state.ts:326` writes the turn list, and a screen bound to `TURNS` redraws without any new event.
- **State flow** - no key is added; the only new state is the optional `Turn.usage` and `ModelRow.contextWindow`, both immutable once decoded.
- **Layer responsibilities** - `src/ahp/types.ts`: `TurnUsage` and `contextWindow` · `src/ahp/live.ts`: the decoding · `src/screens.tsx`: `UsageScreen` · `src/app.tsx`: the component and screen registration · `src/control.ts`: `go.usage` and the `u` binding · `src/ahp/fake.ts`: the fixture that lets the screen be tested.
- **Source-of-truth files** - `code://src/ahp/live.ts`, `code://src/ahp/types.ts`, `code://src/screens.tsx`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The usage data](task-01-usage-data.md) | done | - |
| [02 - The usage screen](task-02-usage-screen.md) | done | 01 |

## Risks and tradeoffs

- The `_meta` keys are a host convention inside an open map, so every field is read defensively and a host that sends none of them draws "nothing reported" rather than a screen of zeroes.
- Cost is credits from nano-AIU in one spelling and a plain number in `_meta.cost` in another, and the client cannot tell which it holds; the screen names the unit credits the way the reference does, and a turn with tokens but no cost draws no cost.
- The context window is per model and the usage is per turn, so the screen says which is which, and a turn billed to a model the catalogue does not list has no window rather than a guessed one.
- The fixture change is what makes the screen testable, and it has to keep `test/fake.test.ts` and every case that counts the fixture's models and turns green.
- `u` is a letter, so the binding must be scoped to the chat or it takes the key from every other screen, and the command needs `when: OPEN` so it is not offered with no session.

## Resume state

- **Done so far:** tasks 01 and 02 done 2026-09-20; `Turn.usage` and `ModelRow.contextWindow` are decoded, the usage screen draws them, and the tests cover both.
- **Next action:** none; [implemented.md](implemented.md) is written.
- **Open questions:** none; turns are listed oldest first with the context line pinned above, as the decisions table settled.
- **Watch out for:** `selection()` must keep reading `usage.model` for the turn's model id while the new `usage()` reads the counts, or a host that records its model only in usage loses the model row it has today.

## Final verification checklist

- [x] `test/meta.test.ts` asserts the decoded counts, cost, session total, billed model and resolved model from a turn's `usage`, and that an empty report yields none.
- [x] `test/reconnect.test.ts` asserts `ModelRow.contextWindow` from `maxContextWindow` and the input-plus-output fallback.
- [x] `test/usage.test.tsx` drives `go.usage` and the `u` key over `fakeHost`, with a row per turn, the session total and the context line.
- [x] `npm test` green.
- [x] `npm run typecheck` green.
- [x] `plans/index.md` updated.
