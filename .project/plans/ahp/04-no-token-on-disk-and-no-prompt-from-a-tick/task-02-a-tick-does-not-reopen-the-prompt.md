---
title: A tick does not reopen the sign-in prompt
status: done
depends: []
layer: "src/control.ts, src/app.tsx"
refs:
  - "[code://src/control.ts#L598-L604](../../../../src/control.ts#L598-L604) - `reread`"
  - "[code://src/control.ts#L666-L671](../../../../src/control.ts#L666-L671) - `refresh(ask)`"
  - "[code://src/app.tsx#L603-L604](../../../../src/app.tsx#L603-L604) - the first read"
---

## Objective

Only a catalogue read a person caused opens the sign-in prompt. Decision [only-a-read-somebody-asked-for-opens-the-sign-in-prompt](../../../decisions/only-a-read-somebody-asked-for-opens-the-sign-in-prompt.md).

## Files

- `UPDATE: src/control.ts` - `reread` without `guard`; `refresh(ask = false)`; `session.refresh` and `openLink` pass `true`.
- `UPDATE: src/app.tsx` - the first read passes `true`.
- `UPDATE: test/auth.test.tsx` - one case.

## Steps

1. Call `host.listSessions()` directly in `reread`.
2. Give `refresh` an `ask` argument, false by default, and go through `guard` only when it is true. Document it on `Controller`.
3. Pass `true` at start-up, in `session.refresh` and in `openLink`. Leave the reads after archive, read, dispose, create and `toSessions` silent.

## Validation

- `test/auth.test.tsx`: with the fixture protecting the catalogue, Escape closes the prompt; a rename in the fixture triggers a reread that is refused and leaves it closed; `refresh()` leaves it closed; `ctrl+r` opens it. The case fails with the old guarded reads.

## Resume

Done on 2026-09-26.
