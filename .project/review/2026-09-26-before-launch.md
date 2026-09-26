---
title: Before launch, the 0.5.1 commits and what ahpapp has
status: active
date: 2026-09-26
refs:
  - git://4eb3564 - 0.5.1, where the commit review starts
  - git://136fd3f - HEAD when this was read
  - file:///github/ahpapp - the app, read at 86c4d23 for what this client lacks
  - "[code://.project/plans/screen/06-automations-read-before-run/plan.md](../plans/screen/06-automations-read-before-run/plan.md) - the plan that took the first items"
  - "[code://.project/plans/ahp/04-no-token-on-disk-and-no-prompt-from-a-tick/plan.md](../plans/ahp/04-no-token-on-disk-and-no-prompt-from-a-tick/plan.md) - the plan that fixed findings 3 and 4"
---

# Before launch

Two passes: the seven commits since 0.5.1 (sign-in on refusal, the token prompt, the connection token file), and the app's features this client does not have.
`tsc` was clean and 596 tests passed before plan 06; 603 pass after it.

## The commits since 0.5.1

Findings 3 and 4 were confirmed by reading the code; the rest are from the review pass and should be read again before they are fixed.

1. **The shell's refusal advice does not work outside `ahpc auth`.** `needsToken` at `src/cli/main.ts:468-471` says "Pass --token, set AHPC_TOKEN_X, or pipe one in: ahpc auth X". On `session list`, `--token` is the connection token, nothing but `signIn` reads `AHPC_TOKEN_<RESOURCE>`, and `ahpc auth X` authenticates a connection that closes when it exits. Until ahp/02 lands the sentence should say a one-shot command cannot carry a resource token. `signInSentence` at `src/connect.ts:576-581` has the same problem.
2. **`--token` means two things in `ahpc auth`.** `signIn` reads it as the resource token (`src/cli/main.ts:1314`) and `where()` reads it as the connection token, so `ahpc auth X --token T --connection-token-file F` fails with "not both" and without the file flag T replaces the connection token. Give the resource token its own flag.
3. **Fixed in ahp/04.** **A dismissed sign-in prompt comes back on every tick.** `reread` (`src/control.ts:586`) runs through `guard` on every status event via `refreshSoon`, so a host that protects `listSessions` reopens the modal after Escape and takes the keyboard from the composer. Background reads should call the host without `guard`; only `r` should ask.
4. **Fixed in ahp/04.** **`--wire` and `AHPC_RECORD` write resource tokens to disk.** `write('client', ...)` in `src/ahp/live.ts:341` appends every frame verbatim, `authenticate` included, which breaks the decision [a token is kept for the process and never written down](../decisions/a-token-is-kept-for-the-process-and-never-written-down.md). Redact `params.token` on `authenticate` frames.
5. **A bad token file prints a stack trace in the screen.** `connectionToken` throws inside `tui()` (`src/tui.tsx:348`) and `src/main.tsx:69` does not catch it; the shell prints one line. The screen also reads a configured `connectionTokenFile` when no host is set, so a missing file stops the scripted host.
6. **`readTokenFile` calls every read failure a missing file** (`src/config.ts:549-554`), including EACCES and a directory. A `~` in the config's path is not expanded and a relative path resolves against the working directory.
7. **Smaller, in the prompt.** A failure can be written under a newer ask for another resource (`src/control.ts:744-747`); enter while `authenticate` is in flight submits twice; `dispose` leaves waiters unsettled.
8. **Two comments disagree.** `src/cli/main.ts:446-448` says nothing is retried because the act may already have done something, while the screen retries `createSession`, `createChat` and three automation calls.

Missing tests: the retry of a non-idempotent call, `cli()` turning `-32007` into an exit 1, `auth/required` opening the prompt, the conflicting flags, and the screen's token-file error. Finding 3's test came with ahp/04.
Docs: `--connection-token-file` and `connectionTokenFile` are not in the README's configuration table, the sign-in prompt is not mentioned, and `AHPC_TOKEN_<RESOURCE>` is listed as if every command read it.
Plan ahp/02 is `planned` and nothing of it is built; commit 4b1de8d is a plan revision whose subject reads like code.

## What ahpapp has

### Taken in plan 06

- Enter no longer runs an automation; it opens a detail pane, and `r` runs.
- The prompt, session template, event triggers, misfire policy, timestamps and run errors are decoded and drawn.
- A run with a session opens it.
- A switched-off automation says paused rather than nothing scheduled.
- The prompt is a paragraph, and the message carries the `automation` origin the protocol requires.
- An automation can be edited, and the form asks harness, model, the model's settings, the host's session settings and the misfire policy. The app does the same at `app/(tabs)/automations.tsx:920-987` and `src/components/AutomationSessionFields.tsx:145-300`.
- The changes screen resets when another session opens. The app keys its changeset state by URI (`src/useChangeset.ts:78-84`).

### Not taken yet, in the order worth doing

1. **A live changeset.** `live.ts` never emits a `changes` event, so review ticks, operation status and new files do not redraw until the screen is entered again. The app folds `changesetReducer` over the channel (`src/useChangeset.ts:114-139`).
2. **Older runs.** The app pages with `fetchAutomationRuns` (`src/useAutomations.ts:135-144`); here the pane says older runs exist and stops.
3. **New gated on `automations.create`** (`app/(tabs)/automations.tsx:714-718`).
4. **Rename a session** with `session/titleChanged` (`src/session-row-actions.ts:36-100`).
5. **Totals on the changes screen**, the sum of added and removed lines (`app/changes.tsx:237-243`).
6. **Templates** for a new automation (`src/automation-templates/index.json`). Optional.
7. **Unread and waiting filters** on the session list (`src/session-filter.ts`). Optional; the list already sorts by urgency.

Dev containers, computers, host detail and the multi-host shell are left out: they are not core protocol, or this client talks to one host by design.
The app added third-party notices before its launch (ca6ee8b); this client should check that its package ships the notices its dependencies require.
