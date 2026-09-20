---
title: A responseRoundEnded notification closes the reasoning section and draws no row
status: done
depends: []
layer: src/blocks.ts
refs:
  - code://src/ahp/live.ts#L590-L631 - `parts()`, where `_meta.kind` is read and the round-ended part is emitted
  - code://src/ahp/live.ts#L604-L605 - the `systemNotification` case that draws every notification today
  - code://src/ahp/types.ts#L158-L164 - `ResponsePart`, which gains the round-ended variant
  - code://src/blocks.ts#L40-L61 - the part switch, where the round-ended part draws nothing and closes the block above it
  - code://test/live.test.tsx#L254-L277 - the scripted-host suite where the decoder is checked
  - code://test/smoke.test.tsx#L2316-L2328 - the `blocks` suite where the row is checked
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L504-L509 - the reference, which returns an empty thinking part for the kind and builds no row
  - file:///github/externals/vscode/src/vs/platform/agentHost/common/meta/agentSystemNotificationMeta.ts#L24-L25 - `ResponseRoundEnded`, declared with the sentence that clients settle any open thinking section
---

## Objective

A `systemNotification` whose `_meta.kind` is `responseRoundEnded` leaves no row in the transcript and stops the reasoning block above it from streaming, while every other notification still draws its notice.

## Files

- `UPDATE: src/ahp/types.ts:158-164` - add `| { kind: 'roundEnded'; id: string }` to `ResponsePart`, with a line saying it is a marker between parts rather than content.
- `UPDATE: src/ahp/live.ts:604-605` - read `bag(bag(part)._meta).kind`; when it is `'responseRoundEnded'`, push `{ kind: 'roundEnded', id }` and break, and otherwise push the `systemNotification` part as today.
- `UPDATE: src/blocks.ts:40-61` - add `case 'roundEnded'` that clears `streaming` on the block just pushed when it is a `reasoning` or `prose` block, and pushes no row.
- `UPDATE: test/live.test.tsx:254-277` - the scripted `connect()` suite gains a turn whose parts are a reasoning part and then the notification.
- `UPDATE: test/smoke.test.tsx:2316-2328` - the `blocks` suite gains the row case.

## Steps

1. Add the `roundEnded` variant to `ResponsePart`; it carries an id and nothing else, because it is a marker between parts rather than something a person reads.
2. In `parts()`, read the notification's `_meta.kind` through the existing `bag()` helper and compare it to the literal `'responseRoundEnded'`; a kind that is absent or unknown keeps the current notice part.
3. Keep the round-ended part in `turn.parts`, so the part above it is no longer the last part and the existing `streaming: running && last` computation turns that part's stream off.
4. In `toBlocks`, add the `case 'roundEnded'` that also sets the previous block's `streaming` to false when that block is `reasoning` or `prose`, so the intent is in the drawing code and not only in the index arithmetic.
5. Cover a second notification kind in the same tests, so a notice with content still draws its row.

## Validation

- `test/live.test.tsx` in the `connect()` suite: a scripted chat turn whose `responseParts` are `{ kind: 'reasoning', id: 'r1', content: 'weighing it' }` and `{ kind: 'systemNotification', id: 'n1', content: '', _meta: { kind: 'responseRoundEnded' } }` gives a reader turn with the reasoning part and no `systemNotification` part; a notification with no `_meta.kind` still arrives as a `systemNotification` part carrying its content.
- `test/smoke.test.tsx` in `describe('blocks')`: a `Turn` whose parts are a reasoning part and then a `roundEnded` part maps to `['header', 'reasoning']`, and that reasoning block's `streaming` is false.
- `npm test` green.
- `npm run typecheck` green.

## Resume

Done 2026-09-20.
`ResponsePart` gained the `roundEnded` variant, and `parts()` reads `_meta.kind` through the existing `bag()` helper and emits it for `responseRoundEnded`.
`toBlocks` adds no row for it and clears `streaming` on the `reasoning` or `prose` block above it.
`test/live.test.tsx` covers the ended round and an ordinary notification in the new `a round the host ended` suite, and `test/smoke.test.tsx` covers the block case in `describe('blocks')`.
Nothing is left, and task-02 is next.
