---
title: Automations are made, changed, copied and moved from the shell - implemented
date: 2026-11-04
refs:
  - git://a5a02c9 - the main this was built on
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts)"
  - "[code://src/automation-file.ts](../../../../src/automation-file.ts)"
  - "[code://test/automation-author.test.ts](../../../../test/automation-author.test.ts)"
  - "[code://test/automation-file.test.ts](../../../../test/automation-file.test.ts)"
---

`ahpc automation` now has `new`, `edit`, `duplicate`, `export` and `import`, with any host that serves automations.
A file is ahpd's own `.automation.md`, or VS Code's with `--vscode`, so a file moves between `ahpc`, `ahpd automation` and VS Code.

## What was built

- [`code://src/automation-file.ts`](../../../../src/automation-file.ts) - ahpd's file and VS Code's file, both ways, copied from ahpd's `records.ts`, `scheduled.ts` and `blueprint.ts`.
- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `authorAutomation`: the five verbs, their refusals and their help lines.
- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - `automationTriggers` also answers each trigger's events.
- [`code://src/flags.ts`](../../../../src/flags.ts) - `--vscode` takes no value.
- [`code://package.json`](../../../../package.json) - `@cofold/yaml` ^0.3.0, in `package-lock.json` and `deno.lock` too.
- [`code://docs/subjects/AUTOMATIONS.md`](../../../../docs/subjects/AUTOMATIONS.md) - the verbs, the flags of `new`, and the two files.

## Verified

- `test/automation-file.test.ts` reads both fixtures, which ahpd's own functions wrote, and writes back the same text.
- `test/automation-file.test.ts` also checks that ahpd's file becomes VS Code's, and that an event trigger is refused.
- `test/automation-author.test.ts` runs `new`, `edit`, `duplicate`, `export` and `import` against the scripted host, with their refusals.
- `npm run typecheck`, `npm run build` and `npm run docs:build` passed, and `npx vitest run` passed 914 tests in 46 files.
- Against ahpd's demo host, every verb ran; an event automation fired on a finished turn, and `export --vscode` refused it.

## Departures from the plan

- Task 01 - `--on` takes `<type>:<event>`, such as `session:turnCompleted`, because the protocol's event trigger names both.
- Task 01 - `new` and `edit` also take `--model`, and `--time-zone` alone moves a held schedule to another zone.
- Task 01 - `duplicate` drops ahpd's note of a pinned chat, as ahpd's import does.
- Task 02 - `docs/reference/CLI.md` is built from `ahpc help`, so it changed with the help lines and needed no edit.
- Task 02 - `deno.lock` gained the three `@cofold/yaml` lines by hand. `deno install` rewrote the whole file, and the file on main already fails `deno install --frozen`.
- `docs/use/COMMANDS.md` names `automation new` and `automation export` in its row.

## Left for later

- `ahpc automation runs` printed no run of an automation whose `automation show` listed one, against the demo host. This plan did not change that verb.
