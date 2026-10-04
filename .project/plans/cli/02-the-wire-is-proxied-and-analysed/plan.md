---
title: The wire is proxied, checked, counted, followed by channel and compared, from ahpc
domain: cli
status: planned
priority: high
created: 2026-10-04
revalidated: 2026-10-04
requires: []
changes: []
creates: []
decisions:
  - decisions/the-recording-proxy-is-ahpcs.md
refs:
  - "[code://src/wire.ts#L47-L54](../../../../src/wire.ts#L47-L54) - `parseWireLine`, which takes `{ at, from, frame }` lines only"
  - "[code://src/wire.ts#L64](../../../../src/wire.ts#L64) - `describer`, which pairs a response with its request"
  - "[code://src/cli/main.ts#L355-L385](../../../../src/cli/main.ts#L355-L385) - the `wire` command, which needs no host"
  - "[code://tools/validate.mjs](../../../../tools/validate.mjs) - the strict-schema check, run as `npm run wire`"
  - "[code://tools/schema.mjs](../../../../tools/schema.mjs) - generates `tools/ahp.strict.schema.json` from the protocol package"
  - "file:///github/ahpd/scripts/tee.mjs - the proxy being replaced: `{ at, from, frame }` with `frame` a raw string"
  - "file:///github/ahpd/packages/server/src/wire.ts - ahpd's `--wire`: the message at the root and `_ahpLog { ts, dir, connectionId, transport, byteLength, truncated? }` beside it, VS Code's shape"
  - "file:///github/ahpd/packages/sdk/test/fixtures/wire.jsonl - ahpd's census fixture: one bare message per line"
---

## Goal

`ahpc wire` reads every capture shape in use, records any client's traffic as a proxy, and answers four questions about a capture: is it valid, what is in it, what happened on one channel, and how does it differ from another.

## Reconnaissance

### Searches performed

- `ahpc help`: `--wire <file>` records ahpc's own connection; `wire <file>` draws a capture with `--follow`, `--filter`, `--json`.
- Four line shapes: ahpc's `{ at, from, peer, frame }`; `tee.mjs`'s `{ at, from, frame: "<raw>" }`; ahpd `--wire`'s message plus `_ahpLog`; ahpd's fixture, a bare message. `parseWireLine` takes the first alone.

### Runtime path

```
ahpc wire proxy --listen P --upstream URL --out F -> ws server -> ws client upstream -> each frame both ways -> F
ahpc wire <check|stats|channel|diff> F -> readCapture(F) -> WireLine[] -> describer -> report
```

## Decisions locked in

| Decision | Task |
| --- | --- |
| [The recording proxy and the capture tools are ahpc commands, and ahpd keeps none](../../../decisions/the-recording-proxy-is-ahpcs.md) | 02, 03 |

| What | Source | Task |
| --- | --- | --- |
| `wire check`, `wire stats`, `wire channel <uri>` and `wire diff` | Softov, 2026-10-04, asked "Which analysis commands should ahpc get over a capture?": all four | 03, 04, 05, 06 |
| One reader takes all four shapes; a bare message has no time or direction and is read as one, in file order | (defaulted: the census fixture is the capture ahpd keeps in git) | 01 |
| The proxy writes ahpd's and VS Code's shape, message plus `_ahpLog`, with `transport: "websocket"` | (defaulted: ahpd decided captures are VS Code's shape; one proxy writing a fourth shape is the drift the decision removes) | 02 |
| ahpc's own `--wire` keeps writing its shape | (defaulted: out of this plan; the reader takes both) | - |
| The proxy passes the connection token and every header through and never writes the token to the capture's name or header lines; the capture file is `0600` | (defaulted: ahpd's `--wire` makes its files `0600` because a capture holds what clients sent in `authenticate`) | 02 |
| `wire check` is `tools/validate.mjs` as a command over the shared reader; `npm run wire` runs it | (defaulted: one check, the one that exists) | 03 |
| Task 03 ports ahpd's checker as ahpd host/43 p1 leaves it, which pairs a request with its answer by `id` | (defaulted: that plan is finishing the checker this one ports) | 03 |
| `wire stats` counts per method, action type and channel, frame sizes, request-to-response latency by method, and errors by code | Softov's option text, 2026-10-04 | 04 |
| `wire channel <uri>` prints one channel's frames in order, the subscribe or snapshot first and each action after, with `--json` | Softov's option text, 2026-10-04 | 05 |
| `wire diff A B` lists methods, action types and field paths one capture has and the other lacks, field paths taken per method and action type | Softov's option text, 2026-10-04 | 06 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - One reader for every capture shape](task-01-one-reader.md) | todo | - |
| [02 - wire proxy](task-02-wire-proxy.md) | todo | 01 |
| [03 - wire check](task-03-wire-check.md) | todo | 01, ahpd host/43 p1 |
| [04 - wire stats](task-04-wire-stats.md) | todo | 01 |
| [05 - wire channel](task-05-wire-channel.md) | todo | 01 |
| [06 - wire diff](task-06-wire-diff.md) | todo | 01 |
| [07 - Help, REFERENCE.md and tools/README.md](task-07-docs.md) | todo | 02, 03, 04, 05, 06 |

## Risks and tradeoffs

- A capture of `authenticate` holds tokens; the proxy's file is `0600`, and `stats`, `channel` and `diff` print no string values from `authenticate` params.
- `wire diff` over two hosts' captures reports fields that differ by design as well as gaps; it lists, it does not judge.

## Resume state

- **Next:** task 01.

## Final verification checklist

- [ ] `ahpc wire proxy` between ahpc and ahpd records a session; `ahpc wire` draws it; `wire check` passes it.
- [ ] `wire stats`, `wire channel`, `wire diff` run on ahpd's `packages/sdk/test/fixtures/wire.jsonl` and on a `--wire` capture.
- [ ] `npm test`, `npx tsc --noEmit` pass.
- [ ] `plans/index.md` updated.
