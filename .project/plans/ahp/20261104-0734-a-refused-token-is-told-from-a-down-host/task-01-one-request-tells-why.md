---
title: One request tells why the first connection failed
status: todo
depends: []
layer: "ahp"
refs:
  - "[code://src/connect.ts#L151-L158](../../../../src/connect.ts#L151-L158) - the catch that says `Could not reach`"
  - "[code://src/ahp/live.ts#L1534](../../../../src/ahp/live.ts#L1534) - the token on the URL as `?tkn=`"
---

## Objective

A failed first connection says whether the host refused the token, admitted it, or did not answer.

## Files

- `CREATE: src/ahp/refused.ts` - `whyNoConnection(url, token)`, the plain request and the sentence for its answer
- `UPDATE: src/connect.ts:151-158` - say the sentence from `whyNoConnection` in place of `Could not reach`
- `CREATE: test/refused.test.ts` - the cases in *Validation*, against a local HTTP server

## Steps

1. Write `whyNoConnection` in `src/ahp/refused.ts`, with the URL and the token.
2. Send one GET to the same address with `?tkn=`, as `http` for `ws` and `https` for `wss`.
3. Stop the request after 3 seconds.
4. Return "The host at <url> refused the connection token." for a 401.
5. Return "The host at <url> is up, but the connection failed: <error>." for a 426.
6. Return "Could not reach <url>: <error>. If it is running, check the connection token." otherwise.
7. Use the sentence in the catch in `src/connect.ts`.
8. Add the cases in *Validation*.

## Validation

- A server that answers 401 gives the refused sentence.
- A server that answers 426 gives the "is up" sentence.
- No server gives the "Could not reach" sentence that names the token.
- The request carries the token as `?tkn=`.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
