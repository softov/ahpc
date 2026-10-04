---
title: wire stats says what is in a capture
status: todo
depends: [task-01-one-reader.md]
layer: "cli"
refs:
  - "[code://src/wire.ts#L64](../../../../src/wire.ts#L64) - `describer`, which pairs responses with requests"
---

## Objective

`ahpc wire stats <file> [--json]` prints counts per method, action type and channel, frame sizes, request-to-response latency by method, and errors by code.

## Files

- `CREATE: src/wirestats.ts`.
- `UPDATE: src/cli/main.ts`.
- `CREATE: test/wirestats.test.ts`.

## Steps

1. One pass over `readCapture`: count requests, notifications and responses by method and direction; actions by `type` and by channel.
2. Sizes from `_ahpLog.byteLength` where present, else the line's length; total, largest frame and its method.
3. Latency: request time to response time per `(connection, id)`, reported as count, median and max per method; lines with no time are left out and counted.
4. Errors by `code` with the method they answered.

## Validation

- A small capture with known counts, one error and one slow response gives exact numbers.

## Resume

