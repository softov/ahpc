---
title: An automation is read before it is run, and the changes screen follows the session
domain: screen
status: built
priority: high
created: 2026-09-26
revalidated: 2026-09-26
requires: []
changes: []
creates: []
decisions:
  - decisions/enter-opens-an-automation-and-r-runs-it.md
refs:
  - "[code://src/control.ts#L548-L554](../../../../src/control.ts#L548-L554) - `forgetChanges`, called from `open()` and `close()`"
  - "[code://src/screens.tsx#L180](../../../../src/screens.tsx#L180) - `SessionsScreen`, the split and drawer the automations screen copies"
  - "[code://src/screens.tsx#L1169](../../../../src/screens.tsx#L1169) - `ChangesScreen`, whose two fetches now drop a stale answer"
  - "[code://src/screens.tsx#L1375](../../../../src/screens.tsx#L1375) - `NewAutomationScreen`, the form"
  - "[code://src/screens.tsx#L1574](../../../../src/screens.tsx#L1574) - `AutomationsScreen`, the list and the detail pane"
  - "[code://src/view/automations.tsx](../../../../src/view/automations.tsx) - `automationFields`, `runLine`, `nextOf` and `AutomationRuns`"
  - "[code://src/ahp/live.ts#L996-L1060](../../../../src/ahp/live.ts#L996-L1060) - `automationRun()` and `automation()`, the decoding"
  - "[code://src/ahp/types.ts#L760-L825](../../../../src/ahp/types.ts#L760-L825) - `AutomationRun` and `Automation`"
  - "[code://.project/review/2026-09-26-before-launch.md](../../../../.project/review/2026-09-26-before-launch.md) - the review this plan takes its first items from"
  - npm://@microsoft/agent-host-protocol@^0.9.0 - `AutomationEntry`, `AutomationDefinition`, `AutomationRunSummary` and `Message.origin`
---

## Goal

A person on the automations screen can read what an automation will do before anything runs: its prompt, directory, harness, model, schedule, what happens to missed runs, when it next fires, and what each past run did and why a failed one failed.
Enter opens that, `r` runs, and a run with a session opens it.
The form takes the prompt as a paragraph.
On a narrow terminal the session list gives way to the detail pane while the pane is out.
The changes screen shows the open session's changeset, not the one before it.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "CHANGE_AT|CHANGE_SCOPES|CHANGE_ROW" src/` - set only by `ChangesScreen` and `changes.scope`; `open()` and `close()` reset `OPEN_FILE` and nothing else, so a scope URI under the last session was read on the next one.
- `rg -n "definition\.|lifecycle" src/ahp/live.ts` - `automation()` read the title, the first schedule and `enabled`; the message, the session template, event triggers, `misfirePolicy`, timestamps and run errors were dropped.

### Runtime path

```
ahp-automations:// snapshot + automation/set -> live.ts automation() -> AUTOMATIONS
  -> AutomationsScreen: AutomationList | SessionDetails(automationFields) + AutomationRuns
  -> enter/right: automation.openDetails · left: automation.closeDetails · r: automation.run
  -> run row enter -> controller.open(session) -> chat
```

### Gaps

- The detail pane reads the retained window of runs only; `fetchAutomationRuns` paging is not wired, and the pane says when older runs exist.
- Templates and paging older runs are in the review's list, not here.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [Enter opens an automation, and r runs it](../../../decisions/enter-opens-an-automation-and-r-runs-it.md) | Softov, 2026-09-26 |

| What | Source | Task |
| --- | --- | --- |
| Below the split, an open detail pane is the whole screen on the session list | Softov, 2026-09-26: "in session list... when size is small. make only sidebar right visible when its open" | 02 |
| The automations screen uses the same split, drawer and keys | Softov, 2026-09-26: "maybe like sessions ui" | 03 |
| The prompt is a `TextArea` labelled Prompt | Softov, 2026-09-26: "maybe the Says.. as prompt and text area is a better input" | 04 |
| The message carries `origin: { kind: 'automation' }` | `AutomationDefinition.message` in the protocol: "Its origin kind MUST be automation" | 04 |
| The form asks harness, model, the model's settings, the host's session settings and the misfire policy | Softov, 2026-09-26: "automation is missing fields. on form, harness, model, and the others pickers" | 05 |
| An automation can be edited, and an edit sends each field whole from the held definition, keeping `_meta`, event triggers, the schedule trigger's id, attachments and a custom agent | Softov, 2026-09-26: "automation has not way to edit"; the protocol's "Clients MUST preserve unknown entries when updating the definition" | 06 |
| `ctrl+p commands` and `f1 help` sit at the header's right end while nothing else is there, and leave the footer | Softov, 2026-09-26: "ctrl+p could be removed from bottom... and moved to top title right... until something is there"; "add on top f1-help" | 07 |
| ctrl+c stops a running turn or interrupts the shell as before; anywhere else the first press arms and says so on the status row, and a second within 800 ms quits; ctrl+q quits at once | Softov, 2026-09-26: "only with ctrl+c in sequence in a interval less than 800ms" | 07 |
| `e` edits and on/off moves to `o` | (defaulted: `e` is the letter for edit; Softov may choose another) | 06 |
| The form fits 24 rows in themes that draw no input borders; a boxed theme needs about 36 | (defaulted: the scroll view does not follow focus, so the alternative was dropping fields) | 05 |

## Proposed architecture

- **Data flow** - `automation()` keeps the definition's message, session template, event trigger titles, misfire policy and timestamps; `automationRun()` keeps lifecycle times, the scheduled occurrence, catch-up and the error message.
- **State flow** - `AUTOMATION_SIDEBAR` is three-state like `SIDEBAR`; `AUTOMATION_ROW` is seeded with the first row so the pane is never empty on arrival.
- **Source-of-truth files** - [`code://src/view/automations.tsx`](../../../../src/view/automations.tsx), [`code://src/screens.tsx`](../../../../src/screens.tsx)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - the changes screen forgets the last session](task-01-the-changes-screen-forgets-the-last-session.md) | done | - |
| [02 - a narrow catalogue draws one pane](task-02-a-narrow-catalogue-draws-one-pane.md) | done | - |
| [03 - an automation is read before it is run](task-03-an-automation-is-read-before-it-is-run.md) | done | 02 |
| [04 - the prompt is a paragraph](task-04-the-prompt-is-a-paragraph.md) | done | - |
| [05 - the form asks what the run's session is made with](task-05-the-form-asks-what-the-session-is-made-with.md) | done | 04 |
| [06 - an automation can be edited](task-06-an-automation-can-be-edited.md) | done | 05 |
| [07 - the palette and help keys are at the top, and ctrl+c asks twice](task-07-the-palette-and-help-keys-are-at-the-top-and-ctrl-c-asks-twice.md) | done | - |

## Risks and tradeoffs

- `r` is refresh on the session list and run here - separate scopes, and the hint row names it on each screen.
- The hint row on the automations screen now has one more entry and elides harder under 80 columns.

## Resume state

- **Done so far:** tasks 01-07 done 2026-09-26; see [implemented.md](implemented.md).
- **Next action:** none; what is left is in the review's list.
- **Watch out for:** a changeset URI names one session, so any new changes-screen store key has to be reset in `forgetChanges`.

## Final verification checklist

- [x] `npx tsc --noEmit -p tsconfig.json` clean.
- [x] `npx vitest run` passes (603).
- [x] Checked by hand by Softov, 2026-09-26.
- [x] `plans/index.md` updated.
