---
title: A turn's usage is printed
status: done
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

`TurnUsage` at `src/ahp/types.ts:516` gained `cacheWriteTokens`, `reasoningTokens`, `context` `{ used, size }` and `price` `{ amount, currency }`, each naming its `_meta` key in its doc comment; `context` and `price` say why they are not folded into the counts and `cost`.
`usage` at `src/ahp/live.ts:1226` reads the four keys with the type checks the sibling fields use, drops a context with only one half, and counts a report that carries only these as a usage.
`usageLine` at `src/cli/main.ts:378` builds `in … · out … · cache read/written · reasoning … · amount currency · context used/size` from the parts present, and `printTurns` prints it under the turn's text when it is not empty.
`test/meta.test.ts` has the four-keys case, the absent case, a context-only report and a half context, and `test/cli.test.ts` has the history case.

Departures: the parsing cases went to `test/meta.test.ts`, where the `usage()` cases already live, rather than `test/usage.test.tsx`, which renders the usage screen over the fake host and never runs `usage()`; the plan's Answers table says the screen's panel does not change, so those cases have nothing to observe there.
The fake host's seeded turn `t2` (`src/ahp/fake.ts:828`) gained a usage report, so the history case has a turn to print it under; the seed is what `session history` and `chat history` are tested against.
A cache count with only one half is printed as `cache <n> read` or `cache <n> written` rather than defaulting the other half to zero.
