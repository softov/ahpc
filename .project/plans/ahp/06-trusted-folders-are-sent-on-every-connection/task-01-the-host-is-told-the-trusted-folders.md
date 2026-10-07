---
title: The host is told the trusted folders on every connection
status: implemented
depends: []
layer: "ahp, cli, screen"
refs:
  - "[code://src/connect.ts#L124](../../../../src/connect.ts#L124) - where `pushTrust` is called"
  - "[code://test/reconnect.test.ts#L1576-L1631](../../../../test/reconnect.test.ts#L1576-L1631) - the test to copy"
---

## Objective

On every connection, ahpc sends `root/configChanged` with the trusted folders, and sends nothing when the list is empty.

## Files

- `CREATE: src/ahp/trust.ts` - `trustedUris` and `pushTrust`, as typed in the plan.
- `UPDATE: src/config.ts:8-65` - add `trust?: string[]`.
- `UPDATE: src/connect.ts:18-40` - add `Where.trust`.
- `UPDATE: src/connect.ts:124` - call `pushTrust` after `pushTokens`.
- `UPDATE: src/cli/main.ts:232-255` - build `Where.trust` from the config list and `--trust` with `--cwd`.
- `UPDATE: src/cli/main.ts` - add `--trust` to the help of `session new`, `exec` and `terminal new`.
- `UPDATE: src/tui.tsx:219` - read `--trust` and add `--path` to the list.
- `CREATE: test/trust.test.ts` - the cases below.

## Steps

1. Write `trustedUris`: expand a leading `~`, resolve the path, and return `pathToFileURL(path).href` without duplicates.
2. Write `pushTrust`: return when the list is empty or `dispatch` is missing.
3. In `pushTrust`, dispatch the action from the plan on `ahp-root://`, and swallow a throw.
4. Add `trust` to `Config` and `Where`.
5. In `where()`, add `--cwd` to the config list when the command has `--trust`.
6. Refuse `--trust` without `--cwd` with one sentence on stderr and exit code 2.
7. In `connect`, call `pushTrust(host, trustedUris(where.trust ?? []))` after `pushTokens`.
8. In the screen, add `--path` to the config list when the command has `--trust`.

## Validation

- `test/trust.test.ts` holds these cases:
  - `it('writes a path as a file URI, with ~ as the home folder and a space encoded')`
  - `it('sends root/configChanged with workspaceTrust on ahp-root:// when connected')`
  - `it('sends the trust again after a reconnect')`
  - `it('sends nothing when the list is empty')`
  - `it('does not fail the connection when the dispatch throws')`
  - `it('trusts the --cwd of a command run with --trust, and not without it')`
  - `it('refuses --trust without --cwd')`
- Run `npm run typecheck` and `npm test`. Both pass.

## Resume

All eight steps are built, and `test/trust.test.ts` holds all seven named cases plus one more.

Three things the plan did not name, each forced by something already in the tree:

- `src/flags.ts` gained `--trust` in `SWITCHES`. `test/cli.test.ts` fails any flag the CLI reads or the screen parses that the one vocabulary does not hold, so the flag cannot exist without it.
- The screen's `USAGE` gained a `--trust` block. A parser that accepts a flag and a help that omits it is a defect, and task 02's README table is not the screen's help.
- `where` became exported as `where(rest: string[])`, so a test can build the trusted list without a live socket. It mirrors the exported `needsToken`.

Two readings the plan left open, both taken literally:

- The refusal of step 6 sits in `cli()`, not in `where()`. `where()` can only throw `Fault`, which exits 1, and the step wants 2.
- The screen does not refuse `--trust` without `--path`. Step 8 asks for the addition to the list and names no refusal, so the screen trusts the config file's list alone in that run.

