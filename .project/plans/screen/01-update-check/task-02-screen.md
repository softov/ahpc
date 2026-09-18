---
title: The screen refreshes in the background and its status row says when a release is out
status: todo
depends: [task-01-update-module.md]
layer: screen
refs:
  - code://src/config.ts#L8-L49 - `Config`, which gains `updateCheck?: boolean`
  - code://src/tui.tsx#L176-L200 - the flag switch, where `--no-update-check` goes
  - code://src/tui.tsx#L326-L343 - the config read under the flags; `still()` for a non-TTY; then the app
  - code://src/tui.tsx#L231 - `still(options)`, the one-frame path, which may draw the notice and never fetches
  - code://src/state.ts#L166 - `HOST_ERROR`, the key pattern for `UPDATE_NOTICE`
  - code://src/app.tsx#L394-L415 - `ChatStatus`, which gains the third state
  - code://src/flags.ts#L44-L64 - `SWITCHES`, which gains `--no-update-check`
  - code://test/smoke.test.tsx - where the status-row case goes
---

## Objective

A screen opened without any gate draws `@softov/ahpc <latest> is on npm, this is <current>` on its status row when `update.json` says so, with a refusal still winning the row, refreshes the file every six hours without holding the process open, and redraws the row from the file after each refresh.

## Files

- `UPDATE: src/config.ts:8-49` - `updateCheck?: boolean`, documented as "ask npm whether a newer version exists, six hours apart; `false` never asks".
- `UPDATE: src/flags.ts:44-64` - `--no-update-check` under "The screen's own".
- `UPDATE: src/tui.tsx:176-200` - `options.updateCheck`, default `true`, `--no-update-check` sets `false`; the config key under it the way `boodFloat` is.
- `UPDATE: src/tui.tsx:326-343` - after the config read: `checkingUpdates(options, env, isTTY)`; before `createApp`: `updateNotice(name, version())`; after `createApp`: the store write and the timers.
- `UPDATE: src/state.ts:166` - `export const UPDATE_NOTICE = '$/chat/update' as BindingPath;` beside `HOST_ERROR`.
- `UPDATE: src/app.tsx:394-415` - `ChatStatus` reads `UPDATE_NOTICE` and draws it in `muted` when there is no error (decision 5).

## Steps

1. `checkingUpdates(options, env = process.env, tty = process.stdout.isTTY): boolean` in `tui.tsx`: `false` when `options.updateCheck === false`, `env.NO_UPDATE_NOTIFIER !== undefined`, `env.CI !== undefined`, or `!tty`.
2. `updateNotice(name, current): string | null`: `readUpdate()` and the sentence when `found.name === name && newer(found.latest, current)`; `null` otherwise. Called by the screen and by `still()`; never by `--version`.
3. In `tui()` after `createApp`: `const say = () => app.store.set(UPDATE_NOTICE, updateNotice(name, current))`; `say()` now; if `checkingUpdates`, `const refresh = () => refreshUpdate({ name, registry: registry() }).then(say)`; `if (stale(readUpdate())) void refresh()` and `setInterval(() => void refresh(), 6h).unref()`. `refreshUpdate` never rejects (decision 4), so `say` runs after every attempt and reads whatever the file says.
4. In `still()`: the store write only; no timer, no fetch.
5. `ChatStatus`: `const notice = useStoreValue<string | null>(UPDATE_NOTICE, null)`; the row draws `error`, else `notice` in `muted`, else `<Hints />`.
6. The name is `@softov/ahpc`, read from the manifest `version()` reads, so a fork under another name checks its own.

## Validation

- `test/update.test.ts` gains: `checkingUpdates` with each gate; `updateNotice` with a file that names another package (silence), an older `latest` (silence), a newer one (the sentence).
- `test/smoke.test.tsx` gains two cases: with `UPDATE_NOTICE` set in the store, the status row reads the sentence, and with `HOST_ERROR` also set, the row reads the refusal; with `UPDATE_NOTICE` set from `null` to a sentence while the screen is up, the row changes.
- By hand: `npm_config_registry=http://127.0.0.1:<port>` against a `node:http` one-liner answering `{"latest":"9.9.9"}`; first `ahpc` draws nothing and writes the file; second draws the sentence; `CI=1 ahpc` draws nothing and leaves no file; `ahpc --static | cat` fetches nothing.
- By hand: `ctrl+c` quits promptly with the interval scheduled, which is what `unref()` is for.
- `npm test` and `npm run typecheck` green.

## Resume

