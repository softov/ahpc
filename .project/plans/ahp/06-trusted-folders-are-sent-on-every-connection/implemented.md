---
title: Trusted folders are sent to the host on every connection - implemented
date: 2026-10-07
refs:
  - "[code://src/ahp/trust.ts](../../../../src/ahp/trust.ts) - `trustedUris` and `pushTrust`"
  - "[code://src/connect.ts](../../../../src/connect.ts) - `Where.trust` and the `onConnected` that sends the list"
  - "[code://src/config.ts](../../../../src/config.ts) - the `trust` key"
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts) - the list the CLI builds, and `--trust` in the help"
  - "[code://src/tui.tsx](../../../../src/tui.tsx) - the list the screen builds, and `--trust` in its usage"
  - "[code://src/flags.ts](../../../../src/flags.ts) - `--trust` in the one flag vocabulary"
  - "[code://test/trust.test.ts](../../../../test/trust.test.ts) - the eight cases"
  - "[code://README.md](../../../../README.md) - the key, the flag and the section that explains both"
---

A connection now tells its host which folders this client trusts.
It says so on the first connection, and again after each reconnect, because a host drops what it holds when a socket closes.
A folder is trusted when the config file lists it, or when a command names it with `--cwd` and `--trust`.
An empty list sends nothing.

## What was built

- [`code://src/ahp/trust.ts`](../../../../src/ahp/trust.ts) - `trustedUris` expands `~`, resolves and encodes each path, and drops a duplicate; `pushTrust` dispatches `root/configChanged` with `workspaceTrust` on `ahp-root://` and swallows a throw.
- [`code://src/connect.ts`](../../../../src/connect.ts) - `Where.trust`, and an `onConnected` that awaits `pushTokens` and then `pushTrust`.
- [`code://src/config.ts`](../../../../src/config.ts) - the `trust` key.
- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `where()` builds the list from the config file, and adds `--cwd` when the run says `--trust`. `cli()` refuses `--trust` without `--cwd` with one sentence on stderr and exit 2. The help names the flag on `session new`, `exec` and `terminal new`.
- [`code://src/tui.tsx`](../../../../src/tui.tsx) - the screen builds the same list from the file and `--path`, and its usage names `--trust`.
- [`code://src/flags.ts`](../../../../src/flags.ts) - `--trust` in `SWITCHES`.
- [`code://test/trust.test.ts`](../../../../test/trust.test.ts) - eight cases.
- [`code://README.md`](../../../../README.md) - a `trust` row, a `### Trusted folders` section, and `--trust` in the three command tables.

## Verified

- `npm run typecheck` clean, `npm run build` clean.
- `npm test` - 676 passed, 1 failed. The failure is `test/smoke.test.tsx > the composer is the front door > puts where the session runs on a row of its own, and asks only what the host asks`, which expects the composer chip to contain `ahpc`. The chip draws the last segment of the working directory, and this run is in the worktree `build-agents-8ab748de`. The case fails at the unmodified baseline in this worktree, and its subject is untouched by this plan.
- `node .agents/skills/do-spec/scripts/lint-prose.mjs .project/plans/ahp/06-trusted-folders-are-sent-on-every-connection` found nothing.

## Departures from the plan

- The plan's file list names neither `src/flags.ts` nor the screen's usage text. `test/cli.test.ts` fails any flag the CLI reads or the screen parses that the one vocabulary does not hold, so `--trust` cannot exist without the first. A parser that accepts a flag the help omits is a defect, which is the second.
- Step 8 asks the screen to add `--path` to the list and names no refusal. So the screen accepts `--trust` with no `--path`, and trusts the file's list alone. The CLI refuses the same shape, because step 6 says so.
- The refusal of step 6 sits in `cli()` rather than in `where()`, because `where()` throws `Fault`, which exits 1, and the step wants exit 2.

## Left for later

- The run against a live ahpd 0.10.0, where a session in a listed folder loads the project's own `CLAUDE.md`. It needs a host, so it is Softov's to do. The plan's checklist records it as the one open item.
- `createSession` still writes its folder as a plain `file://` URI with no encoding, while `trustedUris` encodes. The host compares folders rather than text, so the two spellings meet, as the plan's risks note.
