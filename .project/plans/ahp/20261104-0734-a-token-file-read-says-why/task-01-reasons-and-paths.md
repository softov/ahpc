---
title: Reasons and paths
status: implemented
depends: []
layer: "ahp"
refs:
  - "[code://src/config.ts#L169-L182](../../../../src/config.ts#L169-L182) - `readTokenFile`"
  - "[code://src/config.ts#L109](../../../../src/config.ts#L109) - `loadConfig`"
---

## Objective

`readTokenFile` reports why a read failed, and a config path is read from the config file's folder.

## Files

- `UPDATE: src/config.ts:109-182` - give `Config` the folder it was read from, and report the read failure by its code
- `UPDATE: test/cli.test.ts` - the cases in *Validation*

## Steps

1. Keep the folder of the config file that `loadConfig` read, beside the values it returns.
2. Expand a leading `~/` in `connectionTokenFile` to the home folder.
3. Resolve a relative `connectionTokenFile` against the config file's folder.
4. Read a `--connection-token-file` path as the shell gave it.
5. Keep the current sentence for `ENOENT`.
6. Say `Cannot read <path>: permission denied.` for `EACCES` and `EPERM`.
7. Say `<path> is a folder, not a token file.` for `EISDIR`.
8. Say `Cannot read <path>: <message>.` for any other failure.
9. Add the cases in *Validation*.

## Validation

- A missing file gives the sentence that names `--connection-token-file`.
- A file with mode `000` gives the permission sentence.
- A folder gives the folder sentence.
- A config file with `connectionTokenFile: "~/t"` reads `<home>/t`.
- A config file with a relative path reads it from the config file's folder, from another working folder.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.
