---
title: ahpc connects through a private Dev Tunnel
created: 2026-11-04
refs:
  - git://2306729 - the commit of ahpc the facts were checked at
  - git://8429bd2b - the commit of ahpd the facts were checked at
  - "[code://src/ahp/live.ts#L558](../../src/ahp/live.ts#L558) - ahpc opens its socket with the protocol package's `WebSocketTransport.connect(url)`"
  - "[code://src/ahp/live.ts#L1543](../../src/ahp/live.ts#L1543) - the host's connection token goes in `?tkn=`"
  - "[code://src/ahp/refused.ts#L16](../../src/ahp/refused.ts#L16) - the plain GET that reads why a host refused, to the same address"
  - "[code://src/config.ts#L156-L168](../../src/config.ts#L156-L168) - `--token`, `--connection-token-file` and `AHPC_TOKEN`, the pattern for a second secret"
  - npm://@microsoft/agent-host-protocol@1.0.0 - `dist/ws/transport.js`: `connect` takes no headers, and `fromSocket` wraps a socket that is already open
  - npm://@microsoft/dev-tunnels-management@1.3.61 - `tunnelRequestOptions.d.ts`: `tokenScopes` asks the service for access tokens, returned in `Tunnel.accessTokens`
  - https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/security - client access tokens and the `X-Tunnel-Authorization` header, page updated 2026-02-12
  - https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/cli-commands - `devtunnel token TUNNELID --scopes connect`, page updated 2026-02-12
  - https://github.com/softov/ahpd/blob/8429bd2b/packages/tunnel-devtunnel/src/kind.ts#L94-L102 - the `anonymous` operation on a devtunnel tunnel
  - https://github.com/softov/ahpd/blob/8429bd2b/packages/tunnel-devtunnel/src/service.ts#L320-L327 - ahpd's tunnel plugin already calls the Dev Tunnels management API
---

# ahpc connects through a private Dev Tunnel

Softov wants ahpc to reach an ahpd daemon through a Dev Tunnel port that is not anonymous. On 2026-11-04 ahpc could not connect to `https://lrfbfdpc-37537.brs.devtunnels.ms/`: the tunnel answered the WebSocket upgrade with a 302 to a GitHub sign-in. It connected only after the port got anonymous access. With anonymous access, anybody with the URL reaches the port, and the daemon's connection token is the only guard left.

## What others do

- **Dev Tunnels, for a client with no browser.** A tunnel port is private by default. A "client access token" lets the bearer connect to any port of one tunnel. A web client sends it as `X-Tunnel-Authorization: tunnel <TOKEN>`. A request with that header also skips the anti-phishing page. A token expires after 24 hours. Only a user identity with manage access can refresh it. ([security](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/security))
- **The `devtunnel` CLI.** `devtunnel token TUNNELID --scopes connect` issues such a token, to share access without anonymous access. `devtunnel connect TUNNELID` forwards a local port over SSH with the CLI's own sign-in. ([cli-commands](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/cli-commands))

## What ahpc has today

- ahpc opens its socket with `WebSocketTransport.connect(url)` ([`code://src/ahp/live.ts`](../../src/ahp/live.ts#L558)). That function builds the global `WebSocket` with the URL and the subprotocols only. Its own comment says "Custom HTTP headers are not supported".
- The same class has `WebSocketTransport.fromSocket(socket)`, which wraps a socket that is already open.
- The host's token goes in the query, as `?tkn=` ([`code://src/ahp/live.ts`](../../src/ahp/live.ts#L1543)). The plain GET that reads a refusal goes to the same address ([`code://src/ahp/refused.ts`](../../src/ahp/refused.ts#L16)).
- ahpc takes the host's token from `--token`, `--connection-token-file` or `AHPC_TOKEN` ([`code://src/config.ts`](../../src/config.ts#L156-L168)).
- ahpc has no `ws` dependency, and needs Node 22 or later.
- On Node 24.19.0, `new WebSocket(url, { headers })` sends the header on the upgrade. A local server saw `X-Tunnel-Authorization` on 2026-11-04.

## What ahpd has today

- A devtunnel tunnel has an `anonymous` operation that turns anonymous access on or off ([kind.ts](https://github.com/softov/ahpd/blob/8429bd2b/packages/tunnel-devtunnel/src/kind.ts#L94-L102)). This is what made ahpc connect.
- ahpd's tunnel plugin calls the Dev Tunnels management API with the connector's GitHub token ([service.ts](https://github.com/softov/ahpd/blob/8429bd2b/packages/tunnel-devtunnel/src/service.ts#L320-L327)). That API returns a connect token when a request names `tokenScopes`. No ahpd operation asks for one today.

## Who writes

- ahpc: open PR #23 changes the docs only. No branch on `ahpio/ahpc` touches `src/ahp/live.ts`, `src/ahp/refused.ts`, `src/config.ts` or `src/connect.ts`.
- ahpd: a token operation would touch `packages/tunnel-devtunnel/src/kind.ts` and `service.ts`. This brief did not check ahpd's branches.

## The change

- ahpc takes a Dev Tunnels connect token, from a flag and an environment variable, as it takes the host's token.
- ahpc opens the WebSocket itself with `X-Tunnel-Authorization: tunnel <token>`, and wraps the open socket with `WebSocketTransport.fromSocket`.
- The plain GET that reads a refusal sends the same header.
- A person gets the token from `devtunnel token <id> --scopes connect`. As a second way, ahpd could offer a token operation on a devtunnel tunnel, through the management client it already holds.

## Open points

- Only Node 24.19.0 was tested. Whether Node 22's global `WebSocket` sends `headers` is not checked.
- A connect token lasts 24 hours, and ahpc cannot refresh it. A session that reconnects after that fails until the person gives a new token.
- Whether the ahpd token operation is part of this change, or a brief of its own in ahpd.
