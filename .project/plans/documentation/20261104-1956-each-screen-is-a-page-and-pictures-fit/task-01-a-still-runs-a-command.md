---
title: A still runs a command before its frame
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/tui.tsx#L218-L221](../../../../src/tui.tsx#L218-L221) - the flags to add one beside"
---

## Objective

`ahpc --static --command <id>` runs that command after it pushes the screen, and draws the frame with what the command opened.

## Files

- `UPDATE: src/tui.tsx` - parse `--command`, and run it in `still` after the screen is pushed.
- `UPDATE: src/tui.tsx` - the usage line for `--command`.
- `UPDATE: docs/use/SCREEN.md` - `--command` in the still flags, if the page lists them.
- `UPDATE: test/` - the cases in *Validation*, beside the still tests.

## Steps

1. Parse `--command <id>` into the still's options.
2. In `still`, run the command with `app.execute` after the push of the screen, before the wait on the host.
3. Refuse an id that no command has, with one sentence that names it.
4. Add the flag to the usage text.

## Validation

- A test: a still with `--command app.palette` draws the palette's title.
- A test: a still with `--command harness.choose` on the new session screen draws the agent list.
- A test: an unknown id stops with the sentence.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume
