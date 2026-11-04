---
title: ahpc speaks protocol 1.0.0 - implemented
date: 2026-10-07
refs:
  - git://32f177c
  - "[code://package.json#L56](../../../../package.json#L56)"
  - "[code://src/ahp/live.ts#L210](../../../../src/ahp/live.ts#L210)"
---

ahpc installs `@microsoft/agent-host-protocol` 1.0.0 and offers 1.0.0 first, so against ahpd it runs at 1.0.0.
A host on an older version still settles on 0.9.0, 0.8.0 or 0.7.0.

## What was built

- [`code://package.json#L56`](../../../../package.json#L56) - `@microsoft/agent-host-protocol` at `^1.0.0`, with `package-lock.json` and `deno.lock` on 1.0.0.
- [`code://src/ahp/live.ts#L210`](../../../../src/ahp/live.ts#L210) - `VERSIONS` is `['1.0.0', '0.9.0', '0.8.0', '0.7.0']`.
- [`code://tools/ahp.strict.schema.json`](../../../../tools/ahp.strict.schema.json) - regenerated from 1.0.0 with `npm run schema`.
- [`code://test/conformance.test.ts`](../../../../test/conformance.test.ts) - the `expiresIn` exception is gone, because 1.0.0 declares the field.
- `README.md`, `docs/CONFORMANCE.md` and `UPSTREAM.md` say 1.0.0.
- All of it shipped in ahpc commit `32f177c`.

## Verified

- 2026-10-07: `npm run typecheck` passes, and `npm test` passes 677 tests.
- 2026-10-07: an ahpd 0.10.0 host logged the ahpc connection as "speaking 1.0.0".
- Softov approved the close on 2026-10-07.

## Departures from the plan

- None.

## Left for later

- No test pins `VERSIONS`, so a later edit could drop `1.0.0` with the suite green.
- Drawing what 1.0.0 adds is a later plan, from the ideas [a chat is read and archived](../../../ideas/a-chat-is-read-and-archived.md), [a chat moves to another session](../../../ideas/a-chat-moves-to-another-session.md), [a chat lists its background work](../../../ideas/a-chat-lists-its-background-work.md), [an MCP server start can be backgrounded](../../../ideas/an-mcp-server-start-can-be-backgrounded.md), [a changeset says it is recomputing](../../../ideas/a-changeset-says-it-is-recomputing.md), [an answered question shows its answers](../../../ideas/an-answered-question-shows-its-answers.md).
