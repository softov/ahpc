---
title: ahpc offers 0.10.0
status: todo
depends: []
layer: ahp
refs:
  - "[code://src/ahp/live.ts#L188-L210](../../../../src/ahp/live.ts#L188-L210) - `VERSIONS` and the comment above it"
---

## Objective

ahpc offers `0.10.0` after `1.0.0` at `initialize`, and a host that answers `0.10.0` works as a `1.0.0` host.

## Files

- `UPDATE: src/ahp/live.ts:188-210` - add `0.10.0` to `VERSIONS` after `1.0.0`, and say in the comment which host answers it.
- `UPDATE: test/reconnect.test.ts` - the handshake and canvas cases, or a test file beside it that holds handshake tests.

## Steps

1. Search `src` for each use of the negotiated version, and make each one read `0.10.0` as `1.0.0`.
2. Add `'0.10.0'` to `VERSIONS` after `'1.0.0'`.
3. Write a test: the `initialize` request offers `1.0.0, 0.10.0, 0.9.0, 0.8.0, 0.7.0` in that order.
4. Write a test: a host answers `0.10.0`, and the session list loads.
5. Write a test: a host sends `chat/canvasesChanged` and `canvas/stateChanged`, and the chat continues.

## Validation

- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume
