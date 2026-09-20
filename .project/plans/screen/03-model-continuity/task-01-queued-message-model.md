---
title: A queued message carries the model it will run on, and its row says so
status: todo
depends: []
layer: src/blocks.ts
refs:
  - code://src/ahp/live.ts#L1255-L1260 - `queued()`, where the model is dropped
  - code://src/ahp/live.ts#L1048-L1059 - `selection()`, the decoder to reuse
  - code://src/ahp/types.ts#L243-L246 - `QueuedMessage`, which gains the model
  - code://src/blocks.ts#L69-L71 - the queued rows, which carry only text
  - code://src/ahp/fake.ts#L1089-L1098 - `drain()`, which must start the next turn on the model it was queued with
  - code://src/ahp/fake.ts#L1716-L1725 - the fake's `say` and `queue`, which must carry it
  - code://test/smoke.test.tsx#L633-L647 - the queue case where the model is asserted
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionHandler.ts#L2247-L2254 - the reference projecting `model.id` and `model.config` onto a pending message
  - file:///github/textui/packages/chat/src/blocks.ts#L22 - the `queued` block, which gains the model slot
  - file:///github/textui/packages/chat/src/transcript.tsx#L205-L217 - the queued row that draws it
---

## Objective

A message waiting in the host's queue keeps the model the host recorded for it, and its row names that model beside the message, while a message the host sent no model for draws no model.

## Files

- `UPDATE: src/ahp/types.ts:243-246` - `QueuedMessage` gains `model?: ModelSelection`, with a line saying it is what the host will run the message on.
- `UPDATE: src/ahp/live.ts:1255-1260` - `queued()` reads `selection(found.message.model)` and includes the result when it is there.
- `UPDATE: src/ahp/fake.ts:1716-1725` - `say` and `queue` take the model the seam already passes, and `queue` stores it on the pending message.
- `UPDATE: src/ahp/fake.ts:1089-1098` - `drain()` starts the next turn with the queued model rather than the session's.
- `UPDATE: src/ahp/fake.ts:1135-1138` - `reply()` takes the model so the started turn records the one the message named, falling back to the session's.
- `UPDATE: src/blocks.ts:69-71` - pass the model onto the queued block, formatted the way the header formats one.
- `UPDATE: /github/textui/packages/chat/src/blocks.ts:22` - the queued variant gains `model?: string`.
- `UPDATE: /github/textui/packages/chat/src/transcript.tsx:205-217` - the queued case draws the model, muted, beside the message.
- `UPDATE: package.json:57` - the `@textui/chat` range moves to the version that carries the field.

## Steps

1. Add `model` to `QueuedMessage` and read it in `queued()` through `selection()`, which is the same decoder a turn already uses.
2. Carry the model through the fake's `say`, `queue`, `drain` and `reply`, so a test can see the message the host started and the model it started on.
3. In `toBlocks`, format the model the way the header does, the id alone, and leave both fields out when the host sent none.
4. In `@textui/chat`, add one optional field to the queued block and one conditional cell to the row; build and test the package, release it, and bump `package.json`.
5. Keep the queued row's existing text and its `queued` label, so only the model is added and nothing already drawn moves.

## Validation

- `test/smoke.test.tsx`: send a second message while the fixture turn runs, then read `QUEUE[0]?.model?.id` is the model chosen in the composer, and the rendered queued row contains that id.
- `test/live.test.tsx` in the `connect()` suite: a scripted chat whose `queuedMessages[0].message.model` is `{ id: 'm', config: { thinking: 'high' } }` yields `queued()[0].model` equal to it, and a message with no model yields none.
- `test/fake.test.ts`: the fake's queue records the model and starts the next turn on it.
- `pnpm --filter @textui/chat test` and `pnpm build` green in the components repository before the bump.
- `npm test` green and `npm run typecheck` green in this repository.

## Resume
