---
title: The model a queued or reopened turn runs on
domain: screen
status: active
priority: medium
created: 2026-09-19
revalidated: 2026-09-19
requires: []
changes: []
creates: []
decisions: []
refs:
  - code://src/ahp/live.ts#L1255-L1260 - `queued()`, which keeps each pending message's id and text and drops `message.model`
  - code://src/ahp/live.ts#L1048-L1059 - `selection()`, the decoder that already returns a model's id and its answers
  - code://src/ahp/live.ts#L2726-L2737 - `queue()`, which sends the model to the host, so the loss is on the read
  - code://src/ahp/live.ts#L2948-L2999 - `detail()`, which finds the last turn's selection and returns only its id
  - code://src/ahp/types.ts#L243-L246 - `QueuedMessage`, which gains the model it will run on
  - code://src/ahp/types.ts#L404-L408 - `ModelSelection`, the id and the answers together
  - code://src/ahp/types.ts#L81-L114 - `SessionDetail`, which gains the last turn's answers
  - code://src/control.ts#L641-L692 - `open()`, which sets `MODEL` from the detail and leaves `MODEL_CONFIG` alone
  - code://src/control.ts#L712-L759 - `send()`, which reads `MODEL` and `MODEL_CONFIG` into the selection it queues or says
  - code://src/control.ts#L284-L321 - `offerModel()`, the commands registered for the chosen model's own schema
  - code://src/control.ts#L1762-L1773 - the model picker, which clears `MODEL_CONFIG` when the model changes
  - code://src/state.ts#L98-L109 - `PROVIDER`, `MODEL` and `MODEL_CONFIG`, the composer's row of choices
  - code://src/blocks.ts#L69-L71 - the queued rows, which carry only text today
  - code://src/ahp/fake.ts#L1089-L1098 - `drain()`, which starts the next queued turn without its model
  - code://src/ahp/fake.ts#L1135-L1138 - `reply()`, which builds the agent turn from the session's model rather than the message's
  - code://src/ahp/fake.ts#L1716-L1725 - the fake's `say` and `queue`, which take no model and so cannot be tested for one
  - code://test/smoke.test.tsx#L633-L647 - the queue case where the model is asserted
  - code://test/live.test.tsx#L254-L277 - the `connect()` suite where the detail and queue decoders are driven
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionHandler.ts#L2247-L2254 - `toRemote` hands a pending message on with `model.id` and `model.config`
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionHandler.ts#L2507-L2513 - the active turn starts with the same two fields
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L984-L990 - the history request that carries `modelConfiguration` from `turn.message.model.config`
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts#L1347-L1350 - `requestModelByIdentifier(identifier, configuration?)`, which restores the configuration before switching
  - file:///github/textui/packages/chat/src/blocks.ts#L22 - the `queued` block, which has no model field
  - file:///github/textui/packages/chat/src/transcript.tsx#L205-L217 - the queued row the model has to be drawn on
---

## Goal

Two corrections to the model a turn runs on.
A message waiting in the host's queue keeps the model the host recorded for it, so its row can say what it will run on.
Reopening a session gives the composer back the last turn's model and the answers that went with it, instead of the id alone.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "QueuedMessage|queuedMessages" src/` - the type is `{ id, text }`, and `queue()` sends a model the reader never keeps.
- `rg -n "MODEL_CONFIG" src/` - written by `offerModel()` and the model picker, read by `send()`, and never written by `open()`.
- `rg -n "selection\(" src/ahp/live.ts` - `queued()` does not call it; `detail()` calls it and keeps only `.id`.
- `rg -n "model:" src/ahp/fake.ts` - the fake builds a turn's model from the session's own map at `:1137`, so a per-message model has nowhere to land.
- `rg -n "queue:|say:|reply\(" src/ahp/fake.ts` - `say`, `queue` and `reply` each take `(uri, text)`, so the fake drops the model the seam already passes.
- `rg -n "model\.config|modelConfiguration" src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/` in the clone - the review's `:255-256,273-274` have drifted at `832cf23c5`; the verified lines are the ones in the `refs` above.

### Runtime path

```
send() while a turn runs -> host.queue(uri, text, selection) -> the host's queuedMessages carry message.model
  -> liveHost fold -> queued() -> QUEUE -> toBlocks -> the queued row says what it will run on
reopen -> controller.open(uri) -> host.detail(uri) -> the last turn's selection
  -> MODEL and MODEL_CONFIG in the store -> offerModel() registers that model's own commands
  -> the next send() carries the same model and the same answers
```

### Gaps

- `QueuedMessage` has nowhere for the model and `queued()` discards it, so the queue cannot say what each pending turn will run on even though `queue()` sent it.
- `detail()` computes the last turn's `ModelSelection` with its config and then returns only the id, so the answers are lost before the screen ever sees them.
- `open()` sets `MODEL` and never `MODEL_CONFIG`, and it never calls `offerModel()` for the resolved model, so a reopened session cannot offer the last model's own settings at all.
- The fake host takes no model on `say`, `queue` or `reply`, and builds a turn's model from the session map, so the round trip cannot be tested until the fake carries it.
- The queued row is drawn by `@textui/chat`, whose `queued` block has no model field, so the row needs a slot there to say it.
- `Not found: a model on the chat's queuedMessages in this client - searched "queuedMessages|QueuedMessage|message.model" in src/ahp and src/state.ts; the protocol's Message carries model and this client reads it only on a turn.`

## Decisions locked in

No decision file is created by this plan; every choice it settles is recorded in the second table.

| # | Decision | Rationale / source |
| --- | --- | --- |

| What | Source | Task |
| --- | --- | --- |
| A queued message keeps the model the host recorded, read through the existing `selection()` decoder | `(defaulted: queue() already sends the same shape)` | 01 |
| The queued row names the model beside the message and says nothing when the host sent none | `(defaulted: @textui/chat's queued block gains one optional model slot, which is the smallest change that keeps the message text whole)` | 01 |
| The fake host carries the model through `say`, `queue`, `drain` and `reply`, so the round trip is a test and not an assumption | `(defaulted: the fake already resolves a session's model against the catalogue)` | 01 |
| The session detail carries the last turn's answers beside the resolved model row rather than in place of it | `(defaulted: the resolved row is what the picker matches, and the answers belong to one turn)` | 02 |
| Opening a session seeds `MODEL_CONFIG` and registers the last model's own commands through `offerModel()` | `(defaulted: open() already offers the session's schema the same way)` | 02 |
| Choosing another model still clears `MODEL_CONFIG`, because an answer belongs to the model it was given to | `code://src/control.ts#L1768-L1772` | 02 |

## Proposed architecture

- **Data flow** - `queued()` decodes `message.model` with `selection()`, and `detail()` keeps the last turn's config; the client grows only `QueuedMessage.model` and `SessionDetail.modelConfig`.
- **Event flow** - the host's `queuedMessages` already arrives through the snapshot reducer, so a queued model needs no new event; opening reads the detail once, as it does today.
- **State flow** - `QUEUE` gains the model per message, and `MODEL_CONFIG` is seeded on open and then owned by the picker and `offerModel()`, so the next `send()` carries the answers the last turn was given.
- **Layer responsibilities** - `src/ahp/live.ts`: decode the model on the queue and keep the detail's config · `src/ahp/types.ts`: the two fields · `src/ahp/fake.ts`: carry the model so it is testable · `src/control.ts`: seed `MODEL_CONFIG` and register the model's commands on open · `@textui/chat`: the queued row's model slot.
- **Source-of-truth files** - `code://src/ahp/live.ts`, `code://src/control.ts`, `code://src/ahp/types.ts`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A queued message keeps its model](task-01-queued-message-model.md) | blocked | - |
| [02 - Opening a session restores the model's answers](task-02-seed-model-config-on-open.md) | done | - |

## Risks and tradeoffs

- The queued row is drawn by `@textui/chat`, so task 01 needs a release of that package and a dependency bump, which is more than every other change here.
- A host that sends no model on a pending message draws no model, which is the honest answer rather than the composer's current choice repeated over it.
- Seeding `MODEL_CONFIG` on open must not overwrite a choice made before the detail lands; the write sits under the existing open-session guard and runs once.
- `detail()` prefers the last turn that recorded a model and falls back to the session's own private field, so the answers are taken from the same selection as the id and never from the fallback.
- A model the catalogue no longer advertises keeps its id and gets no options, which is the existing behaviour and stays.

## Resume state

- **Done so far:** task-02 is done as of 2026-09-20 and no other task is started.
- **Next action:** [task-01-queued-message-model.md](task-01-queued-message-model.md), which is blocked until a `@textui/chat` release carries a model slot on the queued block.
- **Open questions:** none.
- **Watch out for:** `MODEL_CONFIG` is the composer's answers for the next message and not a record of the last one, which is why seeding it on open is right and why clearing it on a model change must stay.

## Final verification checklist

- [ ] `test/smoke.test.tsx` asserts a queued message's model and a reopened session's `MODEL_CONFIG`.
- [ ] `test/live.test.tsx` drives `queued()` and `detail()` from a scripted host.
- [ ] `test/fake.test.ts` covers the fake's queue carrying the model into the next turn.
- [ ] `npm test` green.
- [ ] `npm run typecheck` green.
- [ ] `plans/index.md` updated.
