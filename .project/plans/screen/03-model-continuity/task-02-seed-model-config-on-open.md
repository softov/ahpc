---
title: Opening a session seeds the composer's model configuration from the last turn
status: done
depends: []
layer: src/control.ts
refs:
  - code://src/ahp/live.ts#L2948-L2999 - `detail()`, which computes the last turn's selection and returns only the id
  - code://src/ahp/types.ts#L81-L114 - `SessionDetail`, which gains the answers
  - code://src/control.ts#L641-L692 - `open()`, which sets `MODEL` and never `MODEL_CONFIG`
  - code://src/control.ts#L284-L321 - `offerModel()`, which registers the chosen model's own commands
  - code://src/control.ts#L1762-L1773 - the model picker, which clears the answers when the model changes
  - code://src/state.ts#L98-L109 - `MODEL` and `MODEL_CONFIG`
  - code://test/live.test.tsx#L254-L277 - the scripted-host suite where the detail decoder is checked
  - code://test/smoke.test.tsx#L1027-L1030 - an opened session in a mounted app, where the store is read
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L984-L990 - the history request carrying `modelConfiguration` from `turn.message.model.config`
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts#L1347-L1350 - `requestModelByIdentifier(identifier, configuration?)`, which restores the configuration before switching
---

## Objective

Opening a session sets `MODEL_CONFIG` from the last turn's recorded answers and registers that model's own commands, so the composer can send the next message on the same model with the same settings, while a session whose last turn answered nothing opens with an empty configuration.

## Files

- `UPDATE: src/ahp/types.ts:94-103` - `SessionDetail` gains `modelConfig?: Record<string, string>` beside `model`, with a line saying it belongs to the last turn and not to the session.
- `UPDATE: src/ahp/live.ts:2972-2998` - keep `ran.config` and return it as `modelConfig` when the id and the answers come from the same selection.
- `UPDATE: src/control.ts:682-691` - under the existing open-session guard, set `MODEL_CONFIG` from `detail.modelConfig ?? {}` and call `offerModel(detail.model?.options ?? [])` beside the existing `MODEL` write.
- `UPDATE: test/live.test.tsx:254-277` - the `connect()` suite gains a detail whose last turn recorded a config.
- `UPDATE: test/smoke.test.tsx:1027-1030` - the opened-session case reads `MODEL_CONFIG` after the detail settles.

## Steps

1. Add the field to `SessionDetail`, and say in its comment that it is the last turn's answers rather than a session setting.
2. In `detail()`, `ran` already carries the config; return it from the same selection the id came from, so the two cannot be answers to different turns.
3. In `open()`, write `MODEL_CONFIG` beside `MODEL` and register the model's commands, inside the guard that already drops a detail for a session that has since been left.
4. Leave the model picker clearing `MODEL_CONFIG` when the model changes: the answers belong to the model they were given to.
5. Cover a detail whose last turn recorded no config, so the composer opens empty rather than on a previous session's answers.

## Validation

- `test/live.test.tsx` in the `connect()` suite: a scripted chat whose last turn's `message.model` is `{ id: 'claude-opus-5', config: { thinking: 'high' } }` yields `detail().modelConfig` equal to `{ thinking: 'high' }`, and a turn with a model and no config yields no `modelConfig`.
- `test/smoke.test.tsx`: open the fixture session, settle, and read `MODEL_CONFIG` and the default of the model command registered for that setting.
- `npm test` green.
- `npm run typecheck` green.

## Resume

Done 2026-09-20.
`SessionDetail` gained `modelConfig`, `detail()` returns it from the same selection as the model id, and `open()` seeds `MODEL_CONFIG` and registers the model's commands through `offerModel()`.
`test/live.test.tsx` decodes a last turn's answers and their absence, and `test/smoke.test.tsx` opens the fixture session and reads `MODEL_CONFIG` and the registered command's default.
Found that the fake host's `detail()` resolves the model and carries no `modelConfig`, so the mounted case covers the empty branch while the decoder case covers the answers.
