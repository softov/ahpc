---
title: Keep resource tokens out of recordings, and keep a dismissed sign-in prompt dismissed
domain: ahp
status: built
priority: high
created: 2026-09-26
revalidated: 2026-09-26
requires: []
changes: []
creates: []
decisions:
  - decisions/a-token-is-kept-for-the-process-and-never-written-down.md
  - decisions/only-a-read-somebody-asked-for-opens-the-sign-in-prompt.md
refs:
  - "[code://src/ahp/live.ts#L331-L335](../../../../src/ahp/live.ts#L331-L335) - `redacted`, the frame as it may be written down"
  - "[code://src/ahp/live.ts#L337-L363](../../../../src/ahp/live.ts#L337-L363) - `tee`, which appends every frame for `--wire` and `AHPC_RECORD`"
  - "[code://src/control.ts#L598-L604](../../../../src/control.ts#L598-L604) - `reread`, run on every status tick"
  - "[code://src/control.ts#L666-L671](../../../../src/control.ts#L666-L671) - `refresh(ask)`"
  - "[code://test/conformance.test.ts#L211-L218](../../../../test/conformance.test.ts#L211-L218) - the recording check"
  - "[code://test/auth.test.tsx#L155-L179](../../../../test/auth.test.tsx#L155-L179) - the dismissal check"
  - "[code://.project/review/2026-09-26-before-launch.md](../../../review/2026-09-26-before-launch.md) - findings 3 and 4, where both came from"
---

## Goal

Two launch fixes from the review of the commits since 0.5.1.
A recording made with `--wire` or `AHPC_RECORD` no longer holds the resource token an `authenticate` frame carried, and a sign-in prompt somebody dismissed stays dismissed until they ask for the catalogue again.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "appendFileSync" src/` - `tee` in `src/ahp/live.ts` is the only writer of frames, so redacting there covers both `--wire` and `AHPC_RECORD`.
- `rg -n "guard\(\(\) => host.listSessions" src/control.ts` - two sites, `reread` and `refresh`.
- `rg -n "controller.refresh\(" src/` - start-up, `session.refresh` and `openLink` are reads a person caused; archive, read, dispose, create and going back to the list are reads after an act that was itself guarded.

### Runtime path

```
status event -> refreshSoon -> reread -> host.listSessions -> refusal -> failed -> status bar
r / ctrl+r / palette -> session.refresh -> refresh(true) -> guard -> refusal -> sign-in prompt
authenticate -> tee.write -> JSON.parse -> redacted -> appendFileSync
```

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [A token is kept for the process and never written down](../../../decisions/a-token-is-kept-for-the-process-and-never-written-down.md) | Existing; the recording broke it. |
| 2 | [Only a read somebody asked for opens the sign-in prompt](../../../decisions/only-a-read-somebody-asked-for-opens-the-sign-in-prompt.md) | Softov, 2026-09-26: "ok do then." |

What this plan settled without one:

| What | Source | Task |
| --- | --- | --- |
| The token is replaced with `[redacted]` rather than the field dropped, so the frame still validates against the schema and a reader sees that a token was sent | `code://tools/validate.mjs` | 01 |
| Only `authenticate` is redacted; the connection token travels in the URL, which the recording never writes | `code://src/ahp/live.ts#L337-L363` | 01 |

## Proposed architecture

- **Data flow** - `tee` parses a frame, passes it through `redacted`, then appends it. `refresh(ask)` reads through `guard` only when `ask` is true; `reread` never does.
- **Layer responsibilities** - `src/ahp/live.ts`: what a recording may hold · `src/control.ts`: which reads may ask · `src/app.tsx`: the first read, which asks.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - No resource token in a recording](task-01-no-token-in-a-recording.md) | done | - |
| [02 - A tick does not reopen the prompt](task-02-a-tick-does-not-reopen-the-prompt.md) | done | - |

## Risks and tradeoffs

- A frame that is not JSON is written as text and not redacted. This client only sends JSON, so the case is a host sending garbage, which carries no token of ours.
- A host that starts refusing mid-session no longer interrupts; the status bar says so and `r` asks. That is the point of decision 2.

## Resume state

- **Done so far:** both tasks, on 2026-09-26.
- **Next action:** none. The plan is built.
- **Open questions:** none.
- **Watch out for:** a new call to `controller.refresh()` is silent by default. Pass `true` only where a person caused the read.

## Final verification checklist

- [x] A recording of an `authenticate` holds `[redacted]` and not the token, and the check fails with the redaction removed.
- [x] After Escape, a catalogue tick and a plain `refresh()` leave the prompt closed, `ctrl+r` opens it, and the check fails with the old guarded reads.
- [x] `npm test` green, 620 tests. `npx tsc` green.
- [x] `plans/index.md` carries the row.
