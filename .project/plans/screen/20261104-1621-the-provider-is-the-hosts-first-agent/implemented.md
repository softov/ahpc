---
title: The provider is the host's first agent, not claude - implemented
date: 2026-11-04
refs:
  - git://a5a02c9 - the main this was built on
  - "[code://src/control.ts](../../../../src/control.ts)"
  - "[code://src/screens.tsx](../../../../src/screens.tsx)"
  - "[code://test/provider.test.tsx](../../../../test/provider.test.tsx)"
---

A new session starts on the first agent the host lists.
Until the host lists one, the provider is empty and no settings are read, so a host with no `claude` agent draws no error.

## What was built

- [`code://src/control.ts`](../../../../src/control.ts) - `PROVIDER` starts empty, and the boot agent list and `listAgents` set it to the first agent while it is empty.
- [`code://src/control.ts`](../../../../src/control.ts) - `settings` answers an empty config with no session and no provider, and sends nothing.
- [`code://src/screens.tsx`](../../../../src/screens.tsx) - the new session screen reads no settings while the provider is empty, and sends `create` with no `claude` default.

## Verified

- `test/provider.test.tsx`: a host with `notes` and `echo` starts on `notes`.
- `test/provider.test.tsx`: a host with no agents reads no settings, and the scripted host starts on `claude`.
- The first two cases fail on the code before this change.
- `npm run typecheck` and `npm run build` passed, and `npx vitest run` passed 899 tests in 45 files.
- Against ahpd's demo host, the stills of `new` and `sessions` drew no error, and the build before this change drew `No provider called claude (-32002)`.

## Departures from the plan

- Step 3 - the boot already listed the agents, so the first agent is set there and in `listAgents`, with no new call.
