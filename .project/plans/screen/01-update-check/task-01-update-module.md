---
title: The update module compares, reads and refreshes, and is tested without a network
status: done
depends: []
layer: shared
refs:
  - code://src/config.ts#L55-L63 - `configHome()` and `configPath(tool)`; `statePath(tool, file)` goes beside them
  - code://src/version.ts#L24 - `version()`, whose `unknown` the comparison must survive
  - code://test/cli.test.ts - a test that points `XDG_CONFIG_HOME` at a temporary directory, the pattern for the file tests
---

## Objective

`src/update.ts` exists with `newer`, `readUpdate`, `stale`, `registry` and `refreshUpdate`, the same five as ahpd's copy, and `test/update.test.ts` proves them against a local HTTP server and a temporary configuration directory with the same table ahpd's test holds, in the same order.

## Files

- `CREATE: src/update.ts` - the five functions; a comment at the top names `ahpd`'s `packages/server/src/update.ts` as the other copy (decision 6).
- `UPDATE: src/config.ts:62-63` - add `statePath(tool, file)` after `configPath(tool)`: `join(configHome(), tool, file)`, with a comment saying it is for files the tool writes, which is why they are not in `config.json`.
- `CREATE: test/update.test.ts` - the table, the file round trip, the server cases.

## Steps

1. `statePath(tool, file)` in `config.ts`; `updatePath = () => statePath('ahpc', 'update.json')` in `update.ts`.
2. `export interface Update { name: string; latest: string; checkedAt: string }`.
3. `export const newer = (latest: string, current: string): boolean` per decision 3: parse `^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$`; either side failing to parse is `false`; compare the three numbers; equal numbers are `true` only when `current` has a prerelease and `latest` does not.
4. `export const registry = (env = process.env): string`: `env.npm_config_registry` with a trailing `/` removed, else `https://registry.npmjs.org`.
5. `export function readUpdate(): Update | undefined`: `JSON.parse(readFileSync(updatePath()))`; anything wrong, including a shape with no string `latest`, is `undefined` (decision 4).
6. `export async function refreshUpdate(options: { name: string; registry?: string; timeoutMs?: number }): Promise<void>`: GET `${registry}/-/package/${name}/dist-tags` with `AbortSignal.timeout(timeoutMs ?? 5000)` and `Accept: application/json`; on `ok` and a body that parses to `{ latest: string }`, `mkdirSync(dirname, { recursive: true })` and write `{ name, latest, checkedAt: new Date().toISOString() }`; every other outcome returns without throwing and without writing (decision 4).
7. `export const stale = (found: Update | undefined, now = Date.now(), maxAgeMs = 6 * 60 * 60 * 1000): boolean`: `true` when there is no file, when `checkedAt` does not parse, or when it is older than `maxAgeMs`.

## Validation

- `test/update.test.ts`, the same cases as ahpd's `test/update.test.ts`:
  - `newer` table: `0.5.0 < 0.6.0`, `0.9.0 < 0.10.0`, `0.5.0 = 0.5.0`, `0.6.0 > 0.5.0` (local ahead, false), `0.5.0-beta.1 < 0.5.0`, `0.5.0 vs 0.5.0-beta.1` (false), `unknown`, `""`, `1.2` (false both ways).
  - `readUpdate` with `XDG_CONFIG_HOME` in a temporary directory: absent file, broken JSON, wrong shape, good file.
  - `refreshUpdate` against `node:http` on `127.0.0.1`: `200 {"latest":"9.9.9"}` writes the file; `404`, `200 <html>`, a socket that never answers with `timeoutMs: 200`, and a closed port each leave the directory as it was.
  - `registry()`: unset, set, set with a trailing slash.
  - `stale`: absent, fresh, seven hours old, unparseable `checkedAt`.
- `npm test` and `npm run typecheck` green.

## Resume

Done 2026-09-18. `src/update.ts` with `newer`, `registry`, `readUpdate`, `stale`, `refreshUpdate`, `MAX_AGE_MS` and `updatePath`, plus `checkingUpdates` and `updateNotice` (task 03 had them moving here; they started here). `statePath(tool, file)` in `config.ts`; `manifest()` in `version.ts`, which `version()` wraps. `test/update.test.ts` is ahpd's file with the names changed: 37 cases, and the `newer` table is byte-identical to ahpd's.

