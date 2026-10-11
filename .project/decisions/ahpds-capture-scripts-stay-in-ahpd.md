---
title: ahpd's capture scripts stay in ahpd until a client needs a tester
status: accepted
date: 2026-10-11
supersedes: decisions/the-recording-proxy-is-ahpcs.md
refs:
  - "[code://src/wire.ts](../../src/wire.ts) - the viewer `ahpc wire` draws a capture with, which stays"
  - "file:///github/ahpd/scripts/tee.mjs - the recording proxy, which stays in ahpd"
  - "file:///github/ahpd/tools/validate.mjs - the capture check, which stays in ahpd"
---

## Context

Plan cli/02 moved ahpd's recording proxy and capture check into ahpc, and added `stats`, `channel` and `diff` beside them.
These tools are parsers that debug ahpd.
They do not make ahpc a more useful client, and work on ahpc is for ahpc as a client.

## Decision

`scripts/tee.mjs`, `tools/validate.mjs` and any other capture parser stay in ahpd while nobody needs a tester that is exposed to users.
ahpc keeps `--wire` and the `ahpc wire <file>` viewer, and adds no `wire proxy`, `check`, `stats`, `channel` or `diff`.

Softov, 2026-10-11: "scripts on ahpd are parser for debuging ahpd, for now while there is no need for exposed tester, leave it on ahpd."

## Consequences

ahpd keeps two capture tools and a third line shape, and the validator copies in the two repositories can drift apart.
ahpc work stays on what a person does with a host.
When somebody needs an exposed tester, the parked plan is [cli/02](../plans/cli/02-the-wire-is-proxied-and-analysed/deferred.md).

## Options

- Move the proxy and the check into ahpc, as `ahpc wire proxy` and `ahpc wire check`. Lost: it puts ahpd's debugging tools into the client before any user needs them.
