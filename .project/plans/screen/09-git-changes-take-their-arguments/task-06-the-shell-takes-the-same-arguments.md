---
title: The shell takes the same arguments
status: implemented
depends: [task-01-an-operation-carries-its-arguments.md, task-04-a-pull-request-is-prepared-in-a-form.md]
layer: "cli"
refs:
  - "[code://src/cli/main.ts#L664-L720](../../../../src/cli/main.ts#L664-L720) - `ahpc changes --run`"
  - "[code://src/flags.ts#L43-L65](../../../../src/flags.ts#L43-L65) - `SWITCHES`, where `--draft` must be listed"
  - file:///github/ahpd/packages/sdk/src/changes.ts - the keys the reference host reads
---

## Objective

`ahpc changes --run commit --message "..."` commits with that message.
`ahpc changes --run create-pr --title "..." [--body "..."] [--draft]` runs `prepare-pull-request` first when it is offered, keeps what was not given from the draft, sends its `context` back, and prints the link.
`--json` prints the follow-up as well as the message.

## Files

- `UPDATE: src/cli/main.ts:664-720` - the flags, the prepare step, the printed link.
- `UPDATE: src/flags.ts:43-65` - `--draft` in `SWITCHES`.
- `UPDATE: src/cli/main.ts:70-80` - the usage lines for `changes`, with the four flags.
- `UPDATE: test/cli.test.ts` - the cases below.

## Steps

1. Reuse task 01's `commitMeta` and `createPrMeta`; the shell does no decoding of its own.
2. With no `--title` and no draft title, stop with a sentence that asks for `--title`.

## Validation

- `test/cli.test.ts`:
  - The host records the `--message`.
  - `create-pr` records `expectedContext` from the fake draft.
  - The shell prints the link.
  - `--json` carries `followUp`.
- `npx vitest run` passes.

## Resume

Implemented. The usage text has two new lines under `changes`, and `--draft` is in `SWITCHES`.
