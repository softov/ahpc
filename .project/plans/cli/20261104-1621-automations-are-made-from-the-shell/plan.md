---
title: Automations are made, changed, copied and moved from the shell
domain: cli
status: planned
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://e8c5a80 - the commit the facts were checked at, and the last commit that holds briefs/doc-pictures-come-from-a-seeded-test-host.md
  - "[code://src/cli/main.ts#L1496-L1573](../../../../src/cli/main.ts#L1496-L1573) - `automation`: list, show, triggers, runs, run, enable, disable and rm"
  - "[code://src/ahp/connection.ts#L559-L565](../../../../src/ahp/connection.ts#L559-L565) - `createAutomation` and `updateAutomation` on the seam"
  - "[code://src/ahp/live.ts#L2537-L2570](../../../../src/ahp/live.ts#L2537-L2570) - the two, over `automation/createRequested` and `automation/updateRequested`"
  - "[code://src/screens.tsx#L1755-L1777](../../../../src/screens.tsx#L1755-L1777) - the definition the screen's form sends, with its schedule trigger"
  - "[code://.project/ideas/cli-verbs-the-library-already-has.md](../../../ideas/cli-verbs-the-library-already-has.md) - the idea whose automation verbs this plan builds"
  - "[code://.project/decisions/ahpc-and-ahpd-share-no-package.md](../../../decisions/ahpc-and-ahpd-share-no-package.md) - the format is written twice, each copy naming the other"
  - file:///github/ahpd/packages/server/src/commands/automation.ts - `ahpd automation export` and `import`, with `--vscode`, `--out` and `--folder`
  - file:///github/ahpd/packages/server/src/scheduled.ts - `automationFile` and `readAutomationFile`, ahpd's own `.automation.md`
  - file:///github/ahpd/packages/server/src/blueprint.ts - VS Code's `.automation.md`, as VS Code's `automationBlueprint.ts` reads it
  - npm://@cofold/yaml@^0.3.0 - the YAML parser ahpd reads these files with
---

## Goal

`ahpc automation` makes, changes, copies, exports and imports an automation, with any host.
The file is ahpd's own `.automation.md`, or VS Code's with `--vscode`, so a file moves between `ahpd automation`, `ahpc automation` and VS Code.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `ahpc help` - the automation verbs are list, show, triggers, runs, run, enable, disable and rm.
- `rg "createAutomation|updateAutomation" src` - on the seam, on both hosts and on the screen, and in no command.

### Runtime path

```
ahpc automation new|edit|duplicate|import -> createAutomation | updateAutomation -> automation/createRequested | automation/updateRequested
ahpc automation export -> the automation's state -> ahpd's file or VS Code's file
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| The verbs `new`, `edit`, `duplicate`, `import` and `export` | Softov, 2026-11-04: "new, import and export, edit, duplicate, run, delete, (enable, disable if existing)" | 01, 02 |
| `run`, `enable`, `disable` stay, and delete stays `automation rm`, as `session rm` and `chat rm` | (defaulted: they exist; `rm` is the delete every other noun has) | - |
| The file is ahpd's own by default, and VS Code's with `--vscode`, as `ahpd automation` does | (defaulted: copies the sibling's command, so a file moves between the two) | 02 |
| `export` prints the file, or writes it with `--out PATH` | (defaulted: as `ahpd automation export`) | 02 |
| `import` makes a new automation, switched off, in `--folder` or the folder the file names | (defaulted: as `ahpd automation import`) | 02 |
| YAML is read and written with `@cofold/yaml` | Softov, 2026-11-04: "Add @cofold/yaml" | 02 |
| The two file formats are copies of ahpd's, each naming the other | [decision](../../../decisions/ahpc-and-ahpd-share-no-package.md) | 02 |
| `new` is switched on, as the screen's form makes one | (defaulted: the screen sends `enabled: true`) | 01 |
| `new` takes `--title`, `--prompt`, `--folder`, `--agent`, and a trigger: `--schedule <cron>` with `--time-zone`, or `--on <event>` | (defaulted: the fields the screen's form fills) | 01 |
| `edit` changes only the fields it is given | (defaulted: as the screen's edit) | 01 |
| `duplicate` makes a copy named `<title> (copy)`, switched off | (defaulted: a copy that runs at once doubles the work) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - new, edit and duplicate](task-01-new-edit-and-duplicate.md) | todo | - |
| [02 - import and export move a file](task-02-import-and-export-move-a-file.md) | todo | 01 |

## Risks and tradeoffs

- ahpd's own file follows ahpd's store. A change there is a change to the copy here; the test fixture is the file `ahpd automation export` writes today.

## Resume state

- **Done so far:** planned 2026-11-04.
- **Next action:** [task-01-new-edit-and-duplicate.md](task-01-new-edit-and-duplicate.md).
- **Open questions:** none.
- **Watch out for:** a host without automations answers with `This host serves no automations.`, as the other verbs do.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [ ] Against ahpd, a file from `ahpd automation export` imports with `ahpc automation import`, and back.
