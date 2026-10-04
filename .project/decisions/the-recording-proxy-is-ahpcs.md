---
title: The recording proxy and the capture tools are ahpc commands, and ahpd keeps none
status: accepted
date: 2026-10-04
refs:
  - "[code://src/wire.ts](../../src/wire.ts) - the capture reader `ahpc wire` draws from"
  - "file:///github/ahpd/scripts/tee.mjs - the proxy this replaces"
  - "file:///github/ahpd/tools/validate.mjs - the capture check this replaces, beside ahpc's own copy"
---

## Context

Recording what a client and a host exchanged took three tools in two repositories: `ahpc --wire` for ahpc's own connection, ahpd's `scripts/tee.mjs` for any client, and a `tools/validate.mjs` in each repository for the schema check.
The two validators are copies, and `tee.mjs` writes a third line shape that neither `ahpc wire` nor ahpd's `--wire` writes.

## Decision

`ahpc wire proxy` is the recording proxy, and `ahpc wire check`, `stats`, `channel` and `diff` are the capture tools; ahpd removes `scripts/tee.mjs` and its capture validator and points at ahpc.

Softov, 2026-10-04, asked "Where should the recording proxy live?": "ahpc wire proxy, retire tee.mjs".

## Consequences

One reader, one proxy and one check, next to the viewer that draws a capture.
Taking a capture of a client that cannot be restarted with `--wire` now needs ahpc installed.
ahpd's test census keeps its own `tools/wire.mjs` and strict schema, because its suite runs without ahpc, per [ahpc and ahpd share no package](ahpc-and-ahpd-share-no-package.md).

## Options

- An `ahpc wire proxy` beside ahpd's `tee.mjs`. Lost: two proxies writing two shapes, drifting apart.
