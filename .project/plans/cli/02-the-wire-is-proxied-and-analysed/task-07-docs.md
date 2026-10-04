---
title: Help, REFERENCE.md and tools/README.md name the wire commands
status: todo
depends: [task-02-wire-proxy.md, task-03-wire-check.md, task-04-wire-stats.md, task-05-wire-channel.md, task-06-wire-diff.md]
layer: "docs"
refs:
  - "[code://tools/README.md](../../../../tools/README.md) - \"Checking what a host actually sent\""
  - "[code://REFERENCE.md](../../../../REFERENCE.md) - the command reference"
---

## Objective

`ahpc help`, `REFERENCE.md` and `tools/README.md` list `wire proxy`, `check`, `stats`, `channel` and `diff`, and the four shapes `ahpc wire` reads.

## Files

- `UPDATE: src/cli/main.ts` help text, and the `i18n` strings it uses.
- `UPDATE: REFERENCE.md`, `tools/README.md`, `README.md` where it shows `npm run wire`.

## Steps

1. One help entry per subcommand with its flags.
2. `tools/README.md` keeps its reasons for a strict schema and points at `ahpc wire check`.

## Validation

- Every flag in the help is one the command reads.

## Resume

