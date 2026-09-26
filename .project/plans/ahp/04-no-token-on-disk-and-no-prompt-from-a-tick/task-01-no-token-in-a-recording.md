---
title: No resource token in a recording
status: done
depends: []
layer: "src/ahp/live.ts"
refs:
  - "[code://src/ahp/live.ts#L331-L363](../../../../src/ahp/live.ts#L331-L363) - `redacted` and `tee`"
---

## Objective

A frame written by `--wire` or `AHPC_RECORD` never holds the `token` of an `authenticate` request.

## Files

- `UPDATE: src/ahp/live.ts` - `redacted`, called in `tee` after the parse.
- `UPDATE: test/conformance.test.ts` - a distinctive token, and a check on the capture.

## Steps

1. Write `redacted(frame)`: an `authenticate` request with a string `params.token` comes back with the token replaced by `[redacted]`; anything else comes back as it was.
2. Call it in `tee`'s `write` between the parse and the append.
3. Send `tok-never-on-disk` in the conformance run, and check the capture holds `[redacted]` in the `authenticate` frame and nowhere holds the token.

## Validation

- `test/conformance.test.ts`: the new case passes, fails with the call removed, and the schema checks still pass on the redacted frame.

## Resume

Done on 2026-09-26.
