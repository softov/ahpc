---
title: wire channel follows one session or chat
status: todo
depends: [task-01-one-reader.md]
layer: "cli"
refs:
  - "[code://src/wire.ts#L125](../../../../src/wire.ts#L125) - `matches`, the viewer's filter"
---

## Objective

`ahpc wire channel <file> <uri> [--json]` prints, in order, every frame about one channel: its snapshot or subscribe answer first, then each action, request and response that names it.

## Files

- `CREATE: src/wirechannel.ts`.
- `UPDATE: src/cli/main.ts`.
- `CREATE: test/wirechannel.test.ts`.

## Steps

1. A frame is about a channel when its params, action, snapshot `resource` or response to a request naming it carry that URI.
2. Each row: time, direction, method or action type, and one line on what it changes (title, status, turn id, part kind).
3. A chat URI also shows the session actions that add or remove it.

## Validation

- From ahpd's fixture, one session's channel lists its snapshot and then its actions, and nothing from another session.

## Resume

