---
title: A still types into the composer
status: done
depends: []
layer: "screen"
refs:
  - "[code://src/tui.tsx#L222](../../../../src/tui.tsx#L222) - the still's flags"
  - "[code://src/screens.tsx#L1104-L1120](../../../../src/screens.tsx#L1104-L1120) - the composer and `DRAFT`"
  - "[code://test/still-command.test.ts](../../../../test/still-command.test.ts) - the tests of `--command`, the shape to copy"
---

## Objective

`ahpc --static --type <text>` draws the frame with `<text>` in the composer, and with what that text opens, such as the slash menu.

## Files

- `UPDATE: src/tui.tsx` - the `--type <text>` flag, its usage line, and the step in `still()` that types it.
- `CREATE: test/still-type.test.ts` - the cases of `--type`.

## Steps

1. Parse `--type <text>` into the still's options, and add its usage line.
2. In `still()`, put the text in the composer after the session opens and before the frame.
3. Check that `--type /` opens the slash menu. If a value does not open it, send the text as key presses.
4. Write the tests against the scripted host.

## Validation

- `test/still-type.test.ts`: `--type hello` shows `hello` in the composer, and sends nothing.
- `test/still-type.test.ts`: `--type /` on a session shows the slash menu.
- Run `npx vitest run test/still-type.test.ts`, and check that it passes.

## Resume
