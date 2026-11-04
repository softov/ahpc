---
title: import and export move a file
status: done
depends: [task-01-new-edit-and-duplicate.md]
layer: "cli"
refs:
  - file:///github/ahpd/packages/server/src/scheduled.ts - ahpd's own file, to copy
  - file:///github/ahpd/packages/server/src/blueprint.ts - VS Code's file, to copy
  - file:///github/ahpd/packages/server/src/commands/automation.ts - the command's flags and sentences, to copy
---

## Objective

`ahpc automation export <uri>` writes the automation as ahpd's file, or VS Code's with `--vscode`.
`ahpc automation import <file>` makes a new automation from either.

## Files

- `CREATE: src/automation-file.ts` - ahpd's file and VS Code's file, both ways, each naming its copy in ahpd.
- `UPDATE: src/cli/main.ts:1496-1573` - `export` and `import`.
- `UPDATE: package.json` - add `@cofold/yaml`.
- `UPDATE: package-lock.json` - the lock for it.
- `CREATE: test/fixtures/automation.md` - a file from `ahpd automation export`.
- `CREATE: test/fixtures/automation-vscode.md` - a file from `ahpd automation export --vscode`.
- `CREATE: test/automation-file.test.ts` - the cases in *Validation*.
- `UPDATE: docs/subjects/AUTOMATIONS.md` - export and import.
- `UPDATE: docs/reference/CLI.md` - the two verbs.

## Steps

1. Copy ahpd's `automationFile` and `readAutomationFile` to `src/automation-file.ts`, without the owner and time stamps.
2. Copy ahpd's blueprint reading and writing for VS Code's file to the same module.
3. Add a comment on each copy that names its file in ahpd.
4. Write `export`: print the file, or write it with `--out PATH`; `--vscode` writes VS Code's and refuses what it cannot hold.
5. Write `import`: read ahpd's file, or VS Code's with `--vscode`, and create the automation switched off.
6. Run it in `--folder`, or in the folder the file names; refuse with ahpd's sentence when there is none.
7. Refuse a VS Code file read without `--vscode` with `This is a VS Code automation file. Add --vscode.`

## Validation

- `test/automation-file.test.ts`: the ahpd fixture reads to the definition `ahpd` wrote, and writes back the same text.
- `test/automation-file.test.ts`: the VS Code fixture reads and writes back the same text.
- A test: `export` then `import` makes a switched-off copy with the same triggers.
- A test: `--vscode` refuses an automation with an event trigger.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume
