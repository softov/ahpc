---
title: A completed turn's header says how many lines it added and removed
status: todo
depends: []
layer: src/blocks.ts
refs:
  - code://src/ahp/live.ts#L546-L587 - `toolCall()`, which reads a result's `content` for text and file uris and drops each `fileEdit`'s `diff`
  - code://src/ahp/types.ts#L126-L156 - `ToolCall`, which gains the counted edits
  - code://src/ahp/types.ts#L256-L279 - `FileEdit.diff`, the `{ added, removed }` a `fileEdit` result carries
  - code://src/blocks.ts#L30-L38 - the turn header, whose `meta` line carries the count
  - code://test/live.test.tsx#L254-L277 - the scripted-host suite where the decoder is checked
  - code://test/smoke.test.tsx#L2316-L2328 - the `blocks` suite where the row is checked
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts#L3375-L3398 - the completed response that aggregates its parts' edit diffs
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatEditStatsButton.ts#L17-L48 - `aggregateChatEditDiffs` and `setDiff`, the `+A` and `-R` the response shows
---

## Objective

A completed turn whose tool results edited files draws `+A -R` on its header row, summed over that turn's own results, and a turn with no edits or no diffs draws no count.

## Files

- `UPDATE: src/ahp/types.ts:126-156` - `ToolCall` gains `edits?: { added: number; removed: number }`, with a line saying it is what this call's results changed.
- `UPDATE: src/ahp/live.ts:546-587` - in `toolCall()`, sum `diff.added` and `diff.removed` over the `content` entries whose `type` is `'fileEdit'`, and set `edits` when either total is non-zero.
- `UPDATE: src/blocks.ts:30-38` - sum `turn.parts`' `toolCall` edits before the header is pushed, and append `+A -R` to the header's `meta` after the elapsed time.
- `UPDATE: test/live.test.tsx:254-277` - the `connect()` suite gains a scripted tool result with a `fileEdit` body.
- `UPDATE: test/smoke.test.tsx:2316-2328` - the `blocks` suite gains the count cases.

## Steps

1. `toolCall()` already maps `content`; add the `fileEdit` arm that reads `bag(entry).diff` beside the arms that read `text`, `preview` and the file uris.
2. Default a missing or non-numeric `added` and `removed` to nothing rather than zero, so a host that sends no diff draws no count instead of a false zero.
3. Sum on the flattened call, so the number belongs to the result that earned it and the turn total is the sum of its calls.
4. In `toBlocks`, total the turn's `toolCall` parts before the header is built and append `+A -R` to `meta`; leave `meta` untouched when both totals are zero.
5. Use the `+A -R` spelling the reference's button uses, so the two clients say the same thing.

## Validation

- `test/smoke.test.tsx` in `describe('blocks')`: a `Turn` whose tool call carries `edits: { added: 12, removed: 3 }` has a header whose `meta` contains `+12 -3`; a turn whose calls carry no `edits` has a header with no count.
- `test/live.test.tsx` in the `connect()` suite: a scripted tool call result with `content: [{ type: 'fileEdit', diff: { added: 4, removed: 1 } }]` yields a call with `edits` `{ added: 4, removed: 1 }`, and a text-only result yields no `edits`.
- `npm test` green.
- `npm run typecheck` green.

## Resume
