---
title: Ahp - what exists today
domain: ahp
revalidated: 2026-09-24
---

The ahp domain is this client's half of the wire: the shapes the protocol declares, the live connection that speaks it, the channels it holds open, and the scripted host the tests and a bare `ahpc` run against.
It is `src/ahp/`, and it is the only place that imports `@microsoft/agent-host-protocol`.
Everything above it - `src/control.ts`, `src/screens.tsx`, `src/cli/` - reaches the host through `HostConnection`, which is why a front end never sees a JSON-RPC code.

## Packages

- `code://src` - one package, `@softov/ahpc`; the wire is not a package of its own and `src/ahp/` is its whole surface.
- `npm://@microsoft/agent-host-protocol@^0.9.0` - the protocol client, its reducers and its `Mirror`, loaded lazily so the suite runs with it absent.

## Contracts

- `code://src/ahp/connection.ts` - `HostConnection`, the seam `src/control.ts`, `src/cli/main.ts` and `src/mcp/` are written against.
- `code://src/ahp/types.ts` - the flattened shapes the screens read, and `SessionFlag`.
- `code://src/ahp/live.ts` - `liveHost(options)`, the reconnecting connection, and `reason(error)`, where every refusal becomes words.
- `code://src/ahp/auth.ts` - `authRequiredOf`, `askFor` and `attempt`: the one reading of a `-32007` and the one retry a credential buys.
- `code://src/ahp/channels.ts` - `openChannels`, who is holding which channel and what the host said on it.
- `code://src/ahp/fake.ts` - `fakeHost()`, the scripted host.
- `code://src/ahp/publish.ts`, `code://src/ahp/operate.ts`, `code://src/ahp/status.ts` - what this client serves back, the changeset operation negotiation, and the status bits.

## Runtime path

```
ahpc [flags] -> connect(Where) -> liveHost(...) -> ahp.Client over a WebSocket
  -> initialize(initialSubscriptions: [ahp-root://]) -> Mirror + openChannels
  -> the root channel's snapshots fill mirror.root.agents, whose protectedResources name what needs a token
  -> a question: client.request -> the host's result, or an RpcError with a code
  -> a refusal: reason(error) -> onRefusal for the words, and onAuthRequired when a -32007 names resources
  -> a directly awaited request rejects with its code -> attempt() -> the sign-in prompt -> the same call once more
  -> HostConnection -> controller (screen) or cli (shell)
```

## Tests

- `code://test/scenario.ts` - the `Scripted` transport and the `Session` reader the wire tests drive.
- `code://test/reconnect.test.ts` - the live connection, including the `-32007` reading and `auth/required`.
- `code://test/resilience.test.ts` - a word the reducer cannot read.
- `code://test/live.test.tsx`, `code://test/fake.test.ts` - the screen over the scripted host, and the fixture itself.
- `code://test/auth.test.ts`, `code://test/auth.test.tsx` - the refusal read, the one retry, and the sign-in prompt over the refusing fixture.
- `code://test/conformance.test.ts` - the frames the suite produced, against the strict schema.

## Known gaps

- A `-32007` is read and printed and nothing else happens: no credential is asked for and the refused act is not run again.
  Built by [01 - Sign in when a host refuses](01-sign-in-when-a-host-refuses/plan.md) on 2026-09-24; what it left is in its [deferred.md](01-sign-in-when-a-host-refuses/deferred.md).
- The live auth states the reference client uses as a fallback - an MCP server that is `authRequired`, a tool call carrying `auth` - are drawn inertly here and do not become a resource to ask for.
- The tool server in `src/mcp/` answers a refusal to a model rather than to a person, and has no prompt of its own.
- Nothing is authenticated until the host has refused, and the prompt asks the person every time: it does not read `AHPC_TOKEN_<RESOURCE>`, which this client's own shell half documents, and it keeps nothing between refusals.
  An agent declaring a required resource therefore fails per turn inside a session that was created without complaint, which is not a refusal this client can read.
  A reconnect makes it worse: the host keeps credentials per connection and the reconnect loop never returns to `connect`, so a resumed connection is an unauthenticated one.
  Planned by [02 - Push a token before the host refuses](02-a-token-before-the-host-refuses/plan.md).
