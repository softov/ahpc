---
title: CLI - what exists today
domain: cli
revalidated: 2026-10-04
---

The shell front end: `ahpc <command>` runs one command against a host and exits, or reads a file with no host at all. It is `src/cli/main.ts` (parsing and every command) and `src/cli/render.ts` (lines and tables), over the AHP client in `src/ahp/`; `ahpc wire <file>` is `src/wire.ts` (reading a capture) and `src/wiretui.tsx` (drawing it).

## Packages

- `code://src` - one package, `@softov/ahpc`; `src/main.tsx` loads `cli/main.ts` when a command word is given.

## Contracts

- [`code://src/ahp/connection.ts`](../../../src/ahp/connection.ts) - `HostConnection`, everything a command can ask a host.
- [`code://src/wire.ts`](../../../src/wire.ts) - `WireLine` `{ at, from, peer, frame }`, the capture line `--wire` writes and `ahpc wire` reads.

## Runtime path

```
main.tsx -> cli/main.ts run(args) -> connect -> HostConnection -> one command -> render.ts -> exit code
main.tsx -> cli/main.ts 'wire' -> wiretui.tsx -> wire.ts parseWireLine / describer / follow
```

## Tests

- [`code://test/cli.test.ts`](../../../test/cli.test.ts) - the commands against the fake host.
- [`code://test/wire.test.tsx`](../../../test/wire.test.tsx) - reading and drawing a capture.

## Known gaps

- A chat channel cannot be read: `session show` and `session history` take session URIs only.
- A refusal other than `-32007` is printed with the client library's stack.
- `ahpc wire` reads only its own line shape; ahpd's `--wire` writes VS Code's traffic-log shape and its test fixture is bare frames.
- There is no proxy and no analysis of a capture beyond the viewer.
