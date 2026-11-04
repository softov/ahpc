---
title: A refused connection token is told apart from a host that is down
created: 2026-11-04
replaces:
  - problems/a-refused-connection-token-reads-like-an-unreachable-host.md
refs:
  - git://3bcf162 - the commit of this repository the facts were checked at, and the last commit that holds the problem
  - "[code://src/connect.ts#L151-L158](../../src/connect.ts#L151-L158) - every failure to connect says `Could not reach <host>`"
  - "[code://src/ahp/live.ts#L1534](../../src/ahp/live.ts#L1534) - the token goes on the URL as `?tkn=`"
  - file:///github/ahpd/packages/server/src/http.ts - at ahpd `4d703f16`, a plain request gets 401 when the handshake would refuse the token, and 426 when it would admit it
---

# A refused connection token is told apart from a host that is down

When the socket fails to open, ahpc finds out whether the host refused the token, and says so.
Today a wrong token and a host that is down both say `Could not reach <host>`.
Softov, 2026-11-04: "Ask with one request".

## What others do

- ahpd answers a plain HTTP request on its port by the token.
- The answer is 401 for a token the handshake would refuse, and 426 for one it would admit.
- The global `WebSocket` gives a client no status code for a failed upgrade, so the socket alone cannot tell the two apart.

## What ahpc has today

- Every failure to connect prints `Could not reach <host>: <error>` and exits 1 ([`code://src/connect.ts#L151-L158`](../../src/connect.ts#L151-L158)).
- The token goes on the URL as `?tkn=` ([`code://src/ahp/live.ts#L1534`](../../src/ahp/live.ts#L1534)).

## Who writes

- `/github/ahpc` is on `main` at `3bcf162`, and no pull request is open.
- No other brief or plan changes `src/connect.ts` or the connection failure.

## The change

- After the socket fails to open, ahpc sends one plain HTTP request to the same address, with the same `?tkn=`, and a short timeout.
- A 401 says that the host refused the connection token.
- A 426 says that the host is up and admitted the token, but the connection failed.
- No answer, or any other answer, keeps `Could not reach <host>`, and names the token as a second possible cause.
- A `wss://` host gets the request as `https://`.
- A test covers each of the three answers.
