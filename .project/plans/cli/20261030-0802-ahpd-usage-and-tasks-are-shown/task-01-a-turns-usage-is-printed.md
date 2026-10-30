---
title: A turn's usage is printed
status: todo
depends: []
layer: "ahp, cli"
refs:
  - "[code://src/ahp/live.ts#L1200-L1240](../../../../src/ahp/live.ts#L1200-L1240) - `usage`"
  - "[code://src/cli/main.ts#L379-L388](../../../../src/cli/main.ts#L379-L388) - `printTurns`"
---

## Objective

`TurnUsage` carries `reasoningTokens`, `cacheWriteTokens`, `context` and `price` from ahpd's keys.
`session history` prints one usage line under each turn that has usage.

## Files

- `UPDATE: src/ahp/types.ts:511-531` - add `reasoningTokens`, `cacheWriteTokens`, `context` `{ used, size }` and `price` `{ amount, currency }`, each with a doc comment that names its key.
- `UPDATE: src/ahp/live.ts:1200-1240` - read `ahpd.reasoningTokens`, `ahpd.cacheWriteTokens`, `ahpd.context` and `ahpd.cost`; a usage with only these is still a usage.
- `UPDATE: src/cli/main.ts:379-388` - print `  in <n> · out <n> · cache <n>/<n> · reasoning <n> · <amount> <currency> · context <used>/<size>`, with only the parts that are present.
- `UPDATE: test/usage.test.tsx` - the cases in *Validation*.
- `UPDATE: test/cli.test.ts` - the history case in *Validation*.

## Steps

1. Add the four fields to `TurnUsage`.
2. Read each key in `usage`, only when it has the right type.
3. Count a usage with only these keys as present.
4. Add the usage line to `printTurns`, with only the parts present.
5. Add the tests.

## Validation

- `test/usage.test.tsx`: a `chat/usage` with the four `ahpd.*` keys fills the four fields.
- `test/usage.test.tsx`: a `chat/usage` with none of them leaves them absent.
- `test/cli.test.ts`: `session history` prints the usage line under a turn with usage, and none under a turn without.
- `npm test` passes.

## Resume
