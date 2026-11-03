---
title: The staged mark is S, and the letter ends the row
status: done
depends: [task-01-a-row-shows-its-git-letter.md]
layer: "screen"
refs:
  - "[code://src/view/changes.tsx#L116-L134](../../../../src/view/changes.tsx#L116-L134) - the staged mark and the letter, before the path"
  - "[code://src/view/changes.tsx#L143-L144](../../../../src/view/changes.tsx#L143-L144) - the counts, at the end of the row"
  - "[code://test/changes.test.tsx#L383](../../../../test/changes.test.tsx#L383) - `staged`, which reads the dot"
---

## Objective

A row reads `S path +116 -122 M` when the file is staged, and `  path +116 -122 M` when it is not.
The staged mark is the letter `S`, not a dot, and stays before the path.
The git letter moves to the end of the row, after the counts.

## Files

- `UPDATE: src/view/changes.tsx:116-144` - draw the mark as `S`, and move the letter after the counts.
- `UPDATE: test/changes.test.tsx` - read `S` before the path and the letter at the end, at 100 and 60 columns.

## Steps

1. Draw the staged mark as `S` in place of the filled dot.
2. Draw a partly staged file as `S` with the warning tone.
3. Draw a blank in the mark column for a file that is not staged.
4. Keep the mark column before the path, after the read column.
5. Move the letter after the counts.
6. Draw no mark column when the host reports no staging.
7. Change the tests that read the dot to read `S`, and the letter at the end of the row.

## Validation

- A staged row starts with `S` before the path, and ends with its letter.
- A row that is not staged has a blank before the path.
- A partly staged row has `S` with the warning tone.
- A host that reports no staging shows no mark, and the letter at the end.
- At 60 columns every row keeps its mark, its counts and its letter.
- `npm run typecheck` and `npx vitest run` pass.

## Resume

The mark is at [`code://src/view/changes.tsx`](../../../../src/view/changes.tsx), before the `Marquee`, and the letter is the last `text` of the row.
`test/changes.test.tsx` reads the tone of the `S` from the element's `fg` prop, with `getAllByText`.
With the dot back in place of `S`, three cases fail.
