---
title: One reader for every capture shape
status: todo
depends: []
layer: "cli"
refs:
  - "[code://src/wire.ts#L47-L54](../../../../src/wire.ts#L47-L54) - `parseWireLine`"
  - "file:///github/ahpd/packages/server/src/wire.ts - the `_ahpLog` shape"
---

## Objective

`parseWireLine` returns a `WireLine` for each of the four shapes, so the viewer and every new command read any capture.

## Files

- `UPDATE: src/wire.ts` - `parseWireLine` and a `readCapture(path)` that numbers lines.
- `UPDATE: test/wire.test.tsx` - one line of each shape.
- `CREATE: test/fixtures/` - a few lines of each shape, the `_ahpLog` ones copied from an ahpd capture with no token in them.

## Steps

1. ahpc's shape as today.
2. `{ at, from, frame }` with a string `frame`: parse the string; keep it raw when it does not parse.
3. A line with `_ahpLog`: `at = ts`, `from = dir === 'c2s' ? 'client' : 'host'`, `peer = connectionId`, `frame` = the line without `_ahpLog` (or `_raw`).
4. A bare JSON-RPC object (`jsonrpc`, `method`, `id` or `result`): no time, and a direction guessed from its shape (a `result`/`error` or an `action` notification is the host's), marked as guessed.

## Validation

- Each shape gives the same `WireLine` for the same message.
- ahpd's `packages/sdk/test/fixtures/wire.jsonl` reads as 122 lines in `ahpc wire --json`.

## Resume

