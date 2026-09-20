---
title: A turn's usage, its billed model and the model's context window are decoded and kept
status: todo
depends: []
layer: ahp
refs:
  - code://src/ahp/live.ts#L1039-L1059 - `selection()`, which reads `usage.model` and drops every count
  - code://src/ahp/live.ts#L633-L649 - `turn()`, which builds a `Turn` and calls `selection()`
  - code://src/ahp/live.ts#L1077-L1090 - `model()`, which drops the row's limits
  - code://src/ahp/live.ts#L526-L530 - `bag`, `list` and `str`, the readers every decoder uses
  - code://src/ahp/types.ts#L176-L194 - `Turn`, which gains `usage`
  - code://src/ahp/types.ts#L404-L425 - `ModelSelection` and `ModelRow`, where `contextWindow` goes
  - npm://@microsoft/agent-host-protocol@^0.9.0 - `UsageInfo` and `SessionModelInfo`, the shapes decoded here
  - file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L190-L250 - `UsageInfoMeta`, where cost, copilotUsage and autoModeResolved are declared
  - file:///github/externals/vscode/src/vs/platform/agentHost/common/state/sessionState.ts#L540-L554 - `hasReportedUsage`, the "is there a number to show" test
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L664-L706 - `usageInfoToChatUsage`, `getSessionCopilotCredits` and `getCopilotCredits`, the reading this mirrors
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/common/languageModels.ts#L358-L365 - `getModelContextWindowTotal`, the fallback this mirrors
---

## Objective

A turn decoded from the wire carries a `TurnUsage` with its token counts, its cost, the model it billed to and what automatic routing resolved to, and a `ModelRow` carries the model's context window, so a screen has real numbers to read and a host that reports none of them yields no `usage` rather than zeroes.

## Files

- `UPDATE: src/ahp/types.ts:404-425` - a `TurnUsage` interface beside `ModelSelection`, and `contextWindow?: number` on `ModelRow`.
- `UPDATE: src/ahp/types.ts:176-194` - `Turn` gains `usage?: TurnUsage`.
- `UPDATE: src/ahp/live.ts:1039-1059` - `usage(value)` reads the report beside `selection()`, which keeps reading `.model` only.
- `UPDATE: src/ahp/live.ts:633-649` - `turn()` sets `usage: usage(found.usage)`.
- `UPDATE: src/ahp/live.ts:1077-1090` - `model()` reads `maxContextWindow`, `maxPromptTokens` and `maxOutputTokens` into `contextWindow`.
- `UPDATE: test/meta.test.ts` - the turn cases.
- `UPDATE: test/reconnect.test.ts:841-866` - the model row case.

## Steps

1. Add `TurnUsage` to `src/ahp/types.ts` beside `ModelSelection`: `inputTokens?`, `outputTokens?`, `cacheReadTokens?`, `model?`, `resolvedModel?`, `cost?`, `sessionCost?`, all optional numbers or strings.
2. Add `usage?: TurnUsage` to `Turn`, documented as the report that rode the turn and not the requested model, which stays `Turn.model`.
3. Add `contextWindow?: number` to `ModelRow`, documented as the protocol's `maxContextWindow` with the input-plus-output fallback made here.
4. Add `function usage(value: unknown): TurnUsage | undefined` in `src/ahp/live.ts` beside `selection()`, built from `bag`, `list` and `str`:
   - the counts from a number `inputTokens`, `outputTokens` and `cacheReadTokens`;
   - `model` from `str(found.model)`;
   - `resolvedModel` from `str(bag(bag(found._meta).autoModeResolved).chosenModel)`;
   - `cost` from a non-negative `bag(found._meta).cost`, otherwise a non-negative `bag(bag(found._meta).copilotUsage).totalNanoAiu` divided by `1_000_000_000`;
   - `sessionCost` from a non-negative `bag(bag(found._meta).copilotUsage).sessionTotalNanoAiu` divided by `1_000_000_000`.
5. Return `undefined` when there is no input token, no output token, no cost and no session cost, which is the reference's `hasReportedUsage`, so an empty report is absent rather than a row of zeroes.
6. In `turn()`, call the decoder once into a local `report` and add `...(report ? { usage: report } : {})` beside the model line at `:645`, leaving `selection(message.model, found.usage)` as the only reader of `usage.model` for the id.
7. In `model()`, set `contextWindow` from a number `found.maxContextWindow`, else from `(maxPromptTokens ?? 0) + (maxOutputTokens ?? 0)` when either is a number, else nothing.
8. Add the cases under Validation.

## Validation

- `test/meta.test.ts` gains a case for a turn whose `usage` carries `inputTokens`, `outputTokens` and `cacheReadTokens`, a `_meta.cost`, a `_meta.copilotUsage.totalNanoAiu`, a `_meta.copilotUsage.sessionTotalNanoAiu` and a `_meta.autoModeResolved.chosenModel`, asserting every decoded field; a turn with an empty `usage` yields no `usage`; a negative cost is absent; a usage that carries only a session total still yields a `usage`.
- `test/reconnect.test.ts` gains: the scripted catalogue's first model row carries `maxContextWindow` and decodes to `contextWindow`; a row with only `maxPromptTokens` and `maxOutputTokens` decodes to their sum; a row with none has no `contextWindow`.
- `npm test` green.
- `npm run typecheck` green.

## Resume
