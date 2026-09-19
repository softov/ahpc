---
title: README.md says how the check works
status: done
depends: [task-02-screen.md, task-03-status-verb.md]
layer: docs
refs:
  - code://README.md#L61-L114 - "Interactive", where the status row is described
  - code://README.md#L162-L175 - "The host", where `ahpc status` is
  - code://README.md#L304-L338 - "Configuration", which lists every key
  - code://.project/ideas/deliberate-duplication.md - the idea that gains the second copy
---

## Objective

A person reading README.md knows the flag, the key, the two environment variables, the file, the six hours and the registry variable, and the deliberate-duplication idea names the second copy.

## Files

- `UPDATE: README.md:304-338` - `updateCheck` in the configuration keys, and a short subsection "Knowing when it is old": the file, the interval, `--no-update-check`, `NO_UPDATE_NOTIFIER`, `CI`, `npm_config_registry`, that a piped or `--static` run never asks, and that nothing is ever said on failure.
- `UPDATE: README.md:162-175` - one sentence on `ahpc status`.
- `UPDATE: .project/ideas/deliberate-duplication.md` - one line naming `update.ts` as the second copy.

## Steps

1. Write the README rows and subsection in the file's own voice; it is one paragraph per line, so match it.
2. Add the line to the deliberate-duplication idea.
3. Mark this plan `built`, write `implemented.md`, update `plans/index.md` and `00-screen.md`'s known gaps.

## Validation

- Every path and flag named in the docs exists: `rg -n "no-update-check|updateCheck|update.json" README.md src`.
- Relative links in `.project/` resolve.

## Resume

Done 2026-09-18. README: the `status` row, a Configuration row, and a "Knowing when it is old" subsection. The deliberate-duplication idea names `update.ts` as the second copy.

