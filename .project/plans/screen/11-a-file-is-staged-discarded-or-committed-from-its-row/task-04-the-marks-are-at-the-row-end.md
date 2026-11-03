---
title: The staged mark and the letter are at the end of the row
status: todo
depends: [task-01-a-row-shows-its-git-letter.md]
layer: "screen"
refs:
  - "[code://src/view/changes.tsx#L116-L134](../../../../src/view/changes.tsx#L116-L134) - the staged mark and the letter, before the path"
  - "[code://src/view/changes.tsx#L143-L144](../../../../src/view/changes.tsx#L143-L144) - the counts, at the end of the row"
  - "[code://test/changes.test.tsx#L383](../../../../test/changes.test.tsx#L383) - `staged`, which reads the dot"
---

## Objective

A row reads `path +116 -122  M` when the file is not staged, and `path +116 -122 SM` when it is.
The staged mark is the letter `S`, not a dot.

## Files

- `UPDATE: src/view/changes.tsx:116-144` - move the staged mark and the letter after the counts, and draw the mark as `S`.
- `UPDATE: test/changes.test.tsx` - read `S` and the letter at the end of the row, at 100 and 60 columns.

## Steps

1. Draw the staged mark as `S` in place of the filled dot.
2. Draw a partly staged file as `S` with the warning tone.
3. Draw a blank in the mark column for a file that is not staged.
4. Move the mark and the letter after the counts, in that order, with no gap between them.
5. Keep the read column at the start of the row.
6. Draw no mark column when the host reports no staging.
7. Change the tests that read the dot to read `S` at the end of the row.

## Validation

- A staged row ends with `SM`, and a row that is not staged ends with ` M`.
- A partly staged row has `S` with the warning tone.
- A host that reports no staging shows the letter only at the end.
- At 60 columns every row keeps its counts, its mark and its letter.
- `npm run typecheck` and `npx vitest run` pass.
