---
title: A refused connection token reads exactly like an unreachable host
status: open
date: 2026-09-26
severity: minor
refs:
  - "[code://src/ahp/live.ts#L1386-L1402](../../src/ahp/live.ts#L1386-L1402) - `endpoint` and `openTransport`, where the secret goes on the URL"
  - "[ideas/finding-a-host-without-being-told.md](../ideas/finding-a-host-without-being-told.md) - where this was first written down"
  - "[plans/ahp/03-a-connection-token-from-a-file/plan.md](../plans/ahp/03-a-connection-token-from-a-file/plan.md) - the plan that met it"
---

## Symptom

A host that rejects the connection token closes the socket during the handshake, and this client says:

```
Could not reach ws://127.0.0.1:9187: TransportError: websocket failed to open
```

A host that is not running at all says the same sentence.
Observed while verifying plan ahp/03 against a live `ahpd`: the correct token connected, and both a wrong token and no token produced the line above.

## Cause

The token travels as `?tkn=` on the URL, because the SDK's transport is built on the global `WebSocket` whose options carry `protocols` only.
A server that refuses it answers the HTTP upgrade rather than the protocol, so nothing reaches this client except a failed socket.
Whether the close code or status is available through that transport is not known.

## Impact

Somebody who pasted the wrong secret is told to check whether the host is up, and somebody whose host is down is told nothing about the secret.
It is the first thing a person meets when a token file is stale, which is the case plan ahp/03 made easy to have.

## Workaround

none

## Fix

Say which of the two it was, if the transport exposes the close code or the upgrade status.
If it does not, name both possibilities in the sentence rather than only the reachable one.
