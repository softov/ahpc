---
title: Telling somebody the version is old
domain: screen
status: built
priority: medium
created: 2026-09-18
revalidated: 2026-09-18
requires: []
changes: []
creates: []
decisions:
  - decisions/update-check-reads-dist-tags.md
  - decisions/update-check-is-a-file-refreshed-in-the-background.md
  - decisions/update-check-compares-versions-by-hand.md
  - decisions/update-check-fails-silently.md
  - decisions/update-notice-is-drawn-not-printed.md
  - decisions/ahpc-and-ahpd-share-no-package.md
refs:
  - git://aa7b91e - ROADMAP.md "Telling somebody the version is old" as written on 2026-09-06, the prose this plan starts from
  - code://.project/ideas/deliberate-duplication.md - the idea that makes `update.ts` a second copy
  - code://src/config.ts#L8-L49 - `Config`, which gains `updateCheck?: boolean`
  - code://src/config.ts#L55-L63 - `configHome()` and `configPath(tool)`; `statePath(tool, file)` goes beside them
  - code://src/version.ts#L24 - `version()`, the current version, `unknown` when there is no manifest
  - code://src/main.tsx#L26-L32 - `--version`, answered before any front end loads; untouched
  - code://src/tui.tsx#L176-L200 - the screen's flag switch, where `--no-update-check` goes
  - code://src/tui.tsx#L326-L343 - the config file read under the flags, then `still()` for a non-TTY, then the app
  - code://src/tui.tsx#L231 - `still(options)`, one frame and exit; may draw the notice, never fetches
  - code://src/app.tsx#L394-L415 - `ChatStatus`, which draws `HOST_ERROR` or the hints; gains the notice between them
  - code://src/state.ts#L166 - `HOST_ERROR`, the store key pattern for `UPDATE_NOTICE`
  - code://src/flags.ts#L44-L64 - `SWITCHES`, which must list `--no-update-check` so neither front end swallows the word after it
  - code://src/cli/main.ts#L386-L392 - `ahpc status`, which gains the line and the `update` field under `--json`
  - code://src/mcp/serve.ts#L42 - `SERVER = { name: 'ahpc', version: version() }`, the other reader of `version()`
  - code://test/scenario.ts - the screen test harness; the status row is read from it
  - https://registry.npmjs.org/-/package/@softov/ahpc/dist-tags - the endpoint; `{"latest":"0.4.0"}` on 2026-09-18
---

## Goal

A person running an old `@softov/ahpc` finds out from the screen's status row and from `ahpc status`, without the screen ever waiting on the network to open and without a byte on stdout while the frame is up.
The check is off with a flag, an environment variable, a configuration key or the absence of a terminal, honours a registry mirror, and says nothing at all when it cannot answer.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "dist-tags|update-check|updateCheck|NO_UPDATE_NOTIFIER" src/` - nothing; the check does not exist in any form.
- `rg -n "fetch\(" src/` - the MCP HTTP transport and the AHP client; none with the shape of a one-off bounded GET, so `update.ts` writes its own.
- `rg -n "process.env\." src/` - `XDG_CONFIG_HOME`, `AHPC_HOST`, `AHPC_TOKEN`, `AHPC_RECORD`; the pattern is "flag, then environment, then file".
- `rg -n "HOST_ERROR" src/` - set by `failed()` in `control.ts#L442`, drawn by `ChatStatus`; the notice follows the same route with its own key.
- `rg -n "unref\(" src/` - none; the screen is held open by the terminal and the socket.

### Runtime path

```
ahpc (screen) -> gates: --no-update-check | NO_UPDATE_NOTIFIER | CI | updateCheck:false | not a TTY
  -> readUpdate() from ~/.config/ahpc/update.json -> newer(latest, version())?
  -> store.set(UPDATE_NOTICE, '@softov/ahpc 0.5.0 is on npm, this is 0.4.0')
  -> ChatStatus: HOST_ERROR ? refusal : UPDATE_NOTICE ? notice : hints
  -> if the file is missing or older than 6h: refresh now; then every 6h, unref'ed
  -> refresh: GET <registry>/-/package/@softov/ahpc/dist-tags, 5s timeout
     -> 200 with { latest: string }: write update.json; anything else: nothing
ahpc --static -> readUpdate() -> the notice in the one frame if any; no fetch
ahpc status   -> readUpdate() -> a third line, or `update` under --json; no fetch
ahpc --version -> untouched
```

### Gaps

- No `update.ts`: the fetch, the file, the comparison and the gates are all new.
- No `updateCheck` key in `Config`, no `--no-update-check` in `SWITCHES` or the screen's switch, no environment variable read for it.
- No `UPDATE_NOTICE` key in `state.ts`; `ChatStatus` knows two states and needs three.
- `Not found: a helper for files the tool writes - searched "configPath|statePath|writeFile" in src/config.ts; only configPath(tool) exists.`

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [The update check reads npm's dist-tags endpoint and nothing larger](../../../decisions/update-check-reads-dist-tags.md) | Softov, ROADMAP.md, 2026-09-06 |
| 2 | [The answer is read from a file, and only the screen refreshes it](../../../decisions/update-check-is-a-file-refreshed-in-the-background.md) | Softov, ROADMAP.md, 2026-09-06 |
| 3 | [Versions are compared by a function written here, not by a semver package](../../../decisions/update-check-compares-versions-by-hand.md) | Softov, ROADMAP.md, 2026-09-06 |
| 4 | [Every failure of the update check is nothing to report](../../../decisions/update-check-fails-silently.md) | Softov, ROADMAP.md, 2026-09-06 |
| 5 | [The update notice is a line the screen draws in its status area, never one written to stdout](../../../decisions/update-notice-is-drawn-not-printed.md) | Softov, ROADMAP.md, 2026-09-06; the precedence and the live row, Softov, 2026-09-18 |
| 6 | [ahpc and ahpd share no package, and carry deliberate copies instead](../../../decisions/ahpc-and-ahpd-share-no-package.md) | Softov, ROADMAP.md "Deliberate duplication", 2026-09-06 |

| What | Source | Task |
| --- | --- | --- |
| Off with `--no-update-check`, or `NO_UPDATE_NOTIFIER` or `CI` set to anything, or `updateCheck: false` in `config.json`, or no terminal | ROADMAP.md at aa7b91e | 01, 02 |
| `npm_config_registry` is the registry when set, trailing slash removed; `https://registry.npmjs.org` otherwise | ROADMAP.md at aa7b91e | 01 |
| The file is `update.json` under `~/.config/ahpc/`, `{ name, latest, checkedAt }`, the same shape ahpd writes | ROADMAP.md at aa7b91e; the shape Softov, 2026-09-18 | 01 |
| Six hours between refreshes, measured from `checkedAt` | ROADMAP.md at aa7b91e | 02 |
| The request times out after five seconds | Softov, 2026-09-18 | 01 |
| The sentence reads `@softov/ahpc <latest> is on npm, this is <current>`; the package name so `npm i -g` can be typed from it, no advice | Softov, 2026-09-18 | 02, 03 |
| `ahpc status --json` carries `update: { latest }` only when there is something newer; `ahpc status` prints the line only then, and nothing when current or unknown | Softov, 2026-09-18 | 03 |
| `config.ts` gains `statePath(tool, file)` for files the tool writes | Softov, 2026-09-18 | 01 |
| On the status row the notice loses to a refusal and beats the key hints | Softov, 2026-09-18 | 02 |
| A refresh that lands while the screen is open updates the row | Softov, 2026-09-18 | 02 |

## Proposed architecture

- **Data flow** - `src/update.ts` owns `newer(latest, current)`, `readUpdate()`, `stale()`, `registry()` and `refreshUpdate({ name, registry })`; it is the copy of ahpd's `packages/server/src/update.ts` and says so at the top. `tui.tsx` and `cli/main.ts` decide whether the check is on and call it; nothing else imports it.
- **Event flow** - `tui()` calls `refreshUpdate` once when stale and on a six-hour `setInterval` that is `unref()`ed, after the app is created and never awaited. The notice is set in the store from the file when the screen opens, and set again from the file each time a refresh resolves, so a release that lands while the screen is up reaches the row.
- **State flow** - `update.json` is the only durable state, written whole on each successful fetch. `UPDATE_NOTICE` in the store is the sentence or `null`, set from the file on open and after each refresh, and cleared by nothing else.
- **Layer responsibilities** - `src/update.ts`: the check · `src/config.ts`: `statePath()` and the `updateCheck` key · `src/tui.tsx`: the gates, the flag, the store write, the timer · `src/app.tsx`: the row · `src/cli/main.ts`: the `status` line · `README.md`: what a person reads.
- **Source-of-truth files** - `code://src/update.ts`, `code://src/config.ts`, `code://src/state.ts`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The update module](task-01-update-module.md) | done | - |
| [02 - The screen checks and draws](task-02-screen.md) | done | 01 |
| [03 - `ahpc status` reads the file](task-03-status-verb.md) | done | 01 |
| [04 - Docs and the roadmap](task-04-docs.md) | done | 02, 03 |

## Risks and tradeoffs

- A test that fetches from a real registry is a test that fails offline. The test serves `dist-tags` from a `node:http` server on `127.0.0.1` and points `npm_config_registry` at it.
- `fetch` is a global on Node 22, Bun and Deno, so `update.ts` imports nothing for it; `unref()` exists on all three.
- The status row is one line; a long sentence truncates at the end the way a refusal does, which is why the sentence carries no advice.
- The screen's tests run under `@textui/testing` with no TTY; the "no terminal" gate would silence the check there, so the screen tests set the store key directly and the module tests cover the fetch.

## Resume state

- **Done so far:** every task, 2026-09-18; see [implemented.md](implemented.md).
- **Next action:** none.
- **Open questions:** none.
- **Watch out for:** `--static` and a piped stdout both go through `still()` and must not fetch. `SWITCHES` must list the flag or `ahpc --no-update-check session list` loses the word after it.

## Final verification checklist

- [x] `npm test` green, with `test/update.test.ts` in it and a status-row case in `test/smoke.test.tsx` (28 files, 534 tests).
- [x] `npm run typecheck` green.
- [x] By hand: `npm_config_registry` at a fake server answering `9.9.9`; the second `ahpc` shows the sentence on the status row; `ahpc status` prints it; `CI=1 ahpc` shows nothing and writes no file; `ahpc --static` fetches nothing.
- [x] README.md names the flag, the key and both environment variables.
- [x] `plans/index.md` updated.
