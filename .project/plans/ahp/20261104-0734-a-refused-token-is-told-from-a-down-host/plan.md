---
title: A refused connection token is told apart from a host that is down
domain: ahp
status: built
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://7551c40 - the commit the facts were checked at, and the last commit that holds the brief `briefs/a-refused-token-is-told-from-a-down-host.md`
  - "[code://src/connect.ts#L151-L158](../../../../src/connect.ts#L151-L158) - every failure to connect says `Could not reach`"
  - "[code://src/ahp/live.ts#L1534](../../../../src/ahp/live.ts#L1534) - the token on the URL"
  - "[code://src/ahp/live.ts#L1905-L1958](../../../../src/ahp/live.ts#L1905-L1958) - the reconnect loop"
  - "[code://src/connect.ts#L135](../../../../src/connect.ts#L135) - `onState`, the report path the screen already draws"
  - file:///github/ahpd/packages/server/src/http.ts - at ahpd `4d703f16`, a plain request gets 401 for a token the handshake would refuse, and 426 for one it would admit
---

## Goal

When the socket fails to open, ahpc finds out whether the host refused the token, and says so.
It does this at start and on each failed reconnect.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `Could not reach` in `src/` - only `connect` says it, at start.
- `moveTo(` in `src/ahp/live.ts` - a reconnect attempt that fails is caught and says nothing.
- `sink.report` - the screen draws it on the status row as `HOST_ERROR`.

### Runtime path

```
openTransport fails -> whyNoConnection(url, token) -> 401 | 426 | nothing -> one sentence
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| After the socket fails, one plain HTTP request to the same address tells a refused token from a down host | Softov, 2026-11-04: "Ask with one request" | 01 |
| A failed reconnect asks the same, and the status row says the reason while the retries go on | Softov, 2026-11-04: "Start and reconnect" | 02 |
| The request has a 3 second timeout, and `wss://` is asked as `https://` | (defaulted: a short wait on a path that is already a failure) | 01 |
| The line clears when the connection comes back | (defaulted: a reason for a state that ended is wrong on screen) | 02 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - One request tells why the first connection failed](task-01-one-request-tells-why.md) | done | - |
| [02 - A reconnect says why it cannot get back](task-02-a-reconnect-says-why.md) | done | 01 |

## Risks and tradeoffs

- A host other than ahpd may answer the plain request with another status. Then the "Could not reach" sentence names the token as a possible cause.
- Each failed retry costs one more request. The backoff already spaces the retries.

## Resume state

- **Done so far:** tasks 01 and 02 done, as [implemented.md](implemented.md) says. Softov checked it against ahpd on 2026-11-04.
- **Next action:** none.
- **Open questions:** none.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [x] By hand, against ahpd with a wrong token, the start says the token was refused.
