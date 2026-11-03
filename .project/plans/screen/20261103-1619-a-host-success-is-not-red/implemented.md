---
title: The host's answer to a changeset verb is not drawn as a refusal - implemented
date: 2026-11-03
refs:
  - "[code://src/state.ts](../../../../src/state.ts) - `HOST_NOTE`"
  - "[code://src/control.ts](../../../../src/control.ts) - `answered` and `forgetChanges`"
  - "[code://src/app.tsx](../../../../src/app.tsx) - the status row"
  - "[code://test/changes.test.tsx](../../../../test/changes.test.tsx) - the commit case, the clear case and the unread case"
---

The status row shows the host's answer to a changeset verb in the success tone.
A refusal stays in the danger tone.

## What was built

- [`code://src/state.ts`](../../../../src/state.ts) - `HOST_NOTE`, after `HOST_LINK`.
- [`code://src/control.ts`](../../../../src/control.ts) - `answered` writes the host's sentence to `HOST_NOTE`, and clears `HOST_ERROR`. A link clears `HOST_NOTE`. An answer that this client cannot read stays in `HOST_ERROR`. `forgetChanges` clears `HOST_NOTE`.
- [`code://src/app.tsx`](../../../../src/app.tsx) - the status row draws `HOST_NOTE` in the success tone, after the link and before the update notice.
- [`code://test/changes.test.tsx`](../../../../test/changes.test.tsx) - the commit case reads the success tone and an empty `HOST_ERROR`. A new case reads that the sentence goes when another session opens. The unread case reads an empty `HOST_NOTE`.

## Verified

- `npm run typecheck` and `npm run build` clean.
- `npx vitest run` - 839 of 839 passed.
- With the sentence written to `HOST_ERROR` again, the commit case and the clear case fail.
- With no clear in `forgetChanges`, the clear case fails.
