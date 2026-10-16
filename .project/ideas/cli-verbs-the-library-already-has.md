---
title: CLI verbs the library already has
created: 2026-10-15
---

ahpc is a client that works with no ahpd behind it.
So the CLI should do what the protocol and VS Code's window do.
The library already makes almost every protocol call, but the CLI shows only part of them.
`ahpc dispatch <uri> <type> --field k=v` sends any action.
But a field is only text, a boolean or a number, so an action with an object or an array cannot go through it.

## Automation files

`ahpc automation export <id>` writes an automation as VS Code's `.automation.md` file, and `ahpc automation import <file> --folder <path>` makes one from it.
The work is in the client, over `automation/createRequested` and the automation's state, so it works with any host.
The rules are those of VS Code's `automationBlueprint.ts`, as in ahpd's host/95.
That is the keys `version`, `id`, `name`, `description` and `schedule`, and the prompt as the body.
Export refuses what the format cannot hold, and import makes a new automation that is switched off.
ahpd's host/95 does the same as an `ahpd automation` command.

## Verbs the library has and the CLI does not

| Area | Verb | Library | Protocol |
| --- | --- | --- | --- |
| Automation | create | `createAutomation` (`src/ahp/live.ts:2435`) | `automation/createRequested` |
| Automation | edit the title, prompt or schedule | `updateAutomation` (`src/ahp/live.ts:2460`), used now only for enable and disable | `automation/updateRequested` |
| Automation | duplicate | `createAutomation` with a copy | `automation/createRequested` |
| Session config | look up a value, and show the settings before `session new` | `configCompletions`, `resolveConfig` (`src/ahp/connection.ts`), used only by the TUI | `sessionConfigCompletions`, `resolveSessionConfig` |
| Chat | set a draft | `setDraft`, TUI only | `chat/draftChanged` |
| Terminal | resize, clear, rename, claim | `src/ahp/live.ts:2625-2649`, TUI only | `terminal/resized`, `cleared`, `titleChanged`, `claimed` |
| Resources | watch a folder | `watchResource`, TUI only | `createResourceWatch` |

## Verbs the library does not have

| Area | Verb | Protocol |
| --- | --- | --- |
| Automation | stop a run | `automationRun/cancelRequested` |
| Session | rename | `session/titleChanged` |
| Session | add, remove or replace a working folder | `session/workingDirectorySet`, `Removed`, `Replaced` |
| Session | start or stop an MCP server | `session/mcpServerStartRequested`, `StopRequested` |
| Chat | archive one chat | `chat/isArchivedChanged` |
| Chat | cut a chat back to a turn, to edit and send again | `chat/truncated` |
| Chat | resume a turn | `chat/turnResume` |
| Chat | reorder the queue | `chat/queuedMessagesReordered` |
| Tools | confirm a tool result, change a tool call's content | `chat/toolCallResultConfirmed`, `chat/toolCallContentChanged` |
| Annotations | set, update and remove | `annotations/*` |
| Root | change the host's config | `root/configChanged` |

## A host's own methods

A host lists its own methods in `initialize`, as ahpd does with `ahpd.methods`.
ahpc reads none of them, and has no command that calls a method by name.
A `ahpc call <method> --json <params>` would reach them with no code per host.
