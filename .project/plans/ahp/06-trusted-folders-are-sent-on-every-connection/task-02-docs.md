---
title: Docs
status: todo
depends: [task-01-the-host-is-told-the-trusted-folders.md]
layer: "docs"
refs:
  - "[code://README.md](../../../../README.md) - where the config keys and flags are listed"
---

## Objective

The README says what a trusted folder is, how to list one in the config file, and what `--trust` does.

## Files

- `UPDATE: README.md` - the `trust` key, the `--trust` flag, and what an untrusted folder loses.

## Steps

1. Add `trust` to the config key list with an example.
2. Add `--trust` to the flags of `session new`, `exec` and `terminal new`.
3. Write two sentences: an untrusted folder loads no project files, and the host refuses an ACP agent there.
4. Write one sentence: a parent folder trusts every folder under it.

## Validation

- Run `node ~/.claude/skills/do-spec/scripts/lint-prose.mjs` on this plan folder. It finds nothing.
- Read the README section by hand against `src/config.ts` and `src/cli/main.ts`.

## Resume

