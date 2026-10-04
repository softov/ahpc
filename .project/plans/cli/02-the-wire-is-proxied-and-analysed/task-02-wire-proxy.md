---
title: wire proxy records any client's traffic
status: todo
depends: [task-01-one-reader.md]
layer: "cli"
refs:
  - "file:///github/ahpd/scripts/tee.mjs - the proxy this replaces, for its flags"
  - "file:///github/ahpd/packages/server/src/wire.ts - `lineFor`, the line to write"
---

## Objective

`ahpc wire proxy --listen <port> --upstream <ws url> --out <file>` relays every WebSocket connection to the upstream and appends each frame, both ways, as a message plus `_ahpLog` line.

## Files

- `CREATE: src/wireproxy.ts`.
- `UPDATE: src/cli/main.ts` - `wire proxy` before `wire <file>`, needing no host connection.
- `CREATE: test/wireproxy.test.ts`.

## Steps

1. Flags: `--listen` (default 9204), `--bind` (default `127.0.0.1`), `--upstream` (required), `--out` (default `ahp-wire.jsonl`), `--quiet`.
2. Each incoming connection opens one upstream connection with the same path, query and headers; frames are relayed as text in order, and either side closing closes the other with the same code.
3. Each frame is written as `lineFor` writes it, `connectionId` the proxy's own count, `transport: "websocket"`; the file is created `0600`.
4. Unless `--quiet`, one line per frame on stdout, as the viewer's row text.

## Validation

- A test with an in-process host: two clients through the proxy, both connections' frames written, in order, with distinct `connectionId`s; the file mode is `0600`.
- By hand: ahpc through the proxy to ahpd; `ahpc wire` draws the capture.

## Resume

