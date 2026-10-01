---
title: The model a queued or reopened turn runs on - implemented
date: 2026-09-30
refs:
  - "[code://src/ahp/types.ts#L275-L280](../../../../src/ahp/types.ts#L275-L280) - `QueuedMessage`, which gained the model the host recorded"
  - "[code://src/ahp/types.ts#L105-L112](../../../../src/ahp/types.ts#L105-L112) - `SessionDetail.modelConfig`, the last turn's answers"
  - "[code://src/ahp/live.ts](../../../../src/ahp/live.ts) - `queued()` reads the model through `selection()`, and `detail()` returns the answers from the same selection as the id"
  - "[code://src/ahp/fake.ts](../../../../src/ahp/fake.ts) - `say`, `queue`, `drain` and `reply` carry the model"
  - "[code://src/blocks.ts](../../../../src/blocks.ts) - the queued row's model, formatted as the header formats one"
  - "[code://src/control.ts#L846-L858](../../../../src/control.ts#L846-L858) - `open()` seeds `MODEL_CONFIG` and calls `offerModel()`"
  - "[code://test/smoke.test.tsx](../../../../test/smoke.test.tsx) - the queued row's model and the opened session's configuration"
  - "[code://test/reconnect.test.ts](../../../../test/reconnect.test.ts) - the queue decoder with and without a model"
  - "[code://test/live.test.tsx#L308-L342](../../../../test/live.test.tsx#L308-L342) - `detail()` with the last turn's answers and without"
  - "[code://test/fake.test.ts#L189-L200](../../../../test/fake.test.ts#L189-L200) - the queued turn starts on the model it was queued with"
  - "npm://@textui/chat@^0.7.0 - the release whose queued block carries the optional `model`"
---

A queued message keeps the model the host recorded for it and its row names that model beside the message, drawing nothing when the host recorded none.
Reopening a session gives the composer back the last turn's model and the answers it ran with, instead of the id alone, and registers that model's own settings commands.

## What was built

- [`code://src/ahp/types.ts`](../../../../src/ahp/types.ts) - `QueuedMessage.model?: ModelSelection`, and `SessionDetail.modelConfig?: Record<string, string>` beside `model`, said to belong to the last turn and not to the session.
- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - `queued()` reads `message.model` through the existing `selection()` decoder; `detail()` returns `ran.config` from the same selection the model id came from.
- [`code://src/ahp/fake.ts`](../../../../src/ahp/fake.ts) - `say`, `queue`, `drain` and `reply` carry the model, so the round trip is a test rather than an assumption.
- [`code://src/blocks.ts`](../../../../src/blocks.ts) - the queued block carries the model, whose id is formatted as the header formats one, and both model fields stay absent when the host sent none.
- [`code://src/control.ts`](../../../../src/control.ts) - `open()` writes `MODEL_CONFIG` from `detail.modelConfig ?? {}` and calls `offerModel(detail.model?.options ?? [])` beside the existing `MODEL` write, inside the guard that drops a detail for a session since left. The model picker still clears `MODEL_CONFIG` when the model changes.
- [`code://package.json`](../../../../package.json) - the `@textui/*` range is `^0.7.0`, the release whose queued block carries `model`.

## Verified

- 7 files and 288 tests over the seams this plan touched: [`code://test/smoke.test.tsx`](../../../../test/smoke.test.tsx), [`code://test/reconnect.test.ts`](../../../../test/reconnect.test.ts), [`code://test/live.test.tsx`](../../../../test/live.test.tsx), [`code://test/fake.test.ts`](../../../../test/fake.test.ts), with `test/i18n.test.ts`, `test/locale.test.ts` and `test/keys.test.tsx` from screen/08.
- `test/smoke.test.tsx`: the queued row carries the composer's chosen model, read from `QUEUE[0].model.id` and drawn; an opened session seeds `MODEL_CONFIG` and the registered model command's default.
- `test/reconnect.test.ts`: a snapshot whose `queuedMessages[0].message.model` is set yields that model, and one without yields none.
- `test/live.test.tsx`: a last turn with `config: { thinking: 'high' }` yields `detail.modelConfig` equal to it, and a turn with a model and no config yields none.
- `test/fake.test.ts`: the queued message starts the next turn on the model it was queued with, falling back to the session's.
- `npx vitest run`: 34 files, 652 tests green. `npm run typecheck`: clean. Both at `git://6612e1b`.

## Departures from the plan

- Task 01 was blocked from 2026-09-20 on a `@textui/chat` release with a model slot on the queued block. It was done on 2026-09-30 against textui linked from `/github/textui`, and `package.json` then moved to `@textui/* ^0.7.0` from the registry, which carries the field. The plan's `requires` is satisfied.
- The queued model is asserted in `test/smoke.test.tsx` and `test/reconnect.test.ts`, not in `test/live.test.tsx` as the checklist said; `test/live.test.tsx` drives `detail()`.
- The fake host's `detail()` resolves the model and carries no `modelConfig`, so the mounted case covers a session opening with an empty configuration while `test/live.test.tsx` covers the decoder that returns answers. No mounted case seeds answers through the fake.

## Left for later

- Nothing. The row draws no model when the host recorded none, which is the honest answer rather than the composer's current choice repeated over it.
- No `deferred.md`: nothing was set aside.
