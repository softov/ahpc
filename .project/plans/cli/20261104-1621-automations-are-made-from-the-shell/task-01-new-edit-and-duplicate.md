---
title: new, edit and duplicate
status: done
depends: []
layer: "cli"
refs:
  - "[code://src/cli/main.ts#L1496-L1573](../../../../src/cli/main.ts#L1496-L1573) - the verbs this task adds to"
  - "[code://src/screens.tsx#L1755-L1777](../../../../src/screens.tsx#L1755-L1777) - the definition to build the same way"
---

## Objective

`ahpc automation new`, `edit <uri>` and `duplicate <uri>` make and change automations, with the fields the screen's form has.

## Files

- `UPDATE: src/cli/main.ts:1496-1573` - the three verbs, and the refusal that lists every verb.
- `UPDATE: src/cli/main.ts:106-113` - the help lines.
- `UPDATE: docs/subjects/AUTOMATIONS.md` - the shell commands.
- `UPDATE: docs/reference/CLI.md` - the three verbs.
- `UPDATE: test/` - the cases in *Validation*, beside the automation command tests.

## Steps

1. Build the definition for `new` from `--title`, `--prompt`, `--folder` and `--agent`.
2. Add a schedule trigger for `--schedule` and `--time-zone`, as the screen's form does.
3. Add an event trigger for `--on <event>`, from the kinds `automation triggers` lists.
4. Send it with `createAutomation`, with `enabled: true`, and print the new URI.
5. For `edit`, send only the given fields with `updateAutomation`.
6. For `duplicate`, read the automation, and create a copy titled `<title> (copy)`, switched off.
7. Refuse `new` without `--prompt` or a trigger, with one sentence.

## Validation

- A test: `new` with a schedule creates one automation with that cron and zone.
- A test: `new --on <event>` creates an event trigger.
- A test: `edit --title T` changes the title and nothing else.
- A test: `duplicate` makes a switched-off copy.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume
