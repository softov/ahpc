---
title: Command ids read noun.verb
status: done
depends: []
layer: "ahpc screen"
refs:
  - "[code://src/control.ts#L1175](../../../../src/control.ts#L1175) - every command id and the default bindings"
  - "[code://src/tui.tsx#L409](../../../../src/tui.tsx#L409) - where the config's `keys` are bound to ids"
  - "[code://src/screens.tsx#L688-L710](../../../../src/screens.tsx#L688-L710) - `slashCommands`"
---

## Objective

Every command in the palette slot has a noun.verb id, per [decision 1](../../../decisions/a-command-id-reads-noun-verb.md), and a config that binds an old id still works.
Commands outside the palette slot keep their ids: nobody types them.

The table, from the scheme Softov chose on 2026-09-30 (plural to show, singular to act); ids not listed are already noun.verb and stay.

| Old | New |
| --- | --- |
| `go.automations` `go.sessions` `go.changes` `go.files` `go.skills` `go.mcp` `go.usage` `go.settings` `go.hosts` `go.terminal` | `automations.show` `sessions.show` `changes.show` `files.show` `skills.show` `mcp.show` `usage.show` `settings.show` `hosts.show` `terminals.show` |
| `go.back` `help.keys` `app.config` `session.toggleArchived` | `screen.back` `keys.show` `config.show` `archived.show` |
| `bood.toggle` `view.markdown` `view.theme` `view.shell` | `creature.toggle` `markdown.toggle` `theme.change` `layout.change` |
| `compose.harness` `compose.model` `compose.workspace` `compose.workspace.path` `compose.start` | `harness.choose` `model.choose` `workspace.choose` `workspace.type` `session.start` |
| `automation.remove` `automation.openDetails` `automation.closeDetails` | `automation.delete` `automation.showDetails` `automation.hideDetails` |
| `session.refresh` `session.filter` `session.openDetails` `session.closeDetails` | `sessions.refresh` `sessions.filter` `session.showDetails` `session.hideDetails` |
| `chat.openLink` `chat.side` `chat.stop` `chat.approve` `chat.deny` `chat.send` | `link.open` `sidechat.new` `turn.stop` `tool.approve` `tool.deny` `message.send` |
| `chat.focusComposer` `chat.focusTranscript` `chat.clearQueue` `terminal.list` | `composer.focus` `transcript.focus` `queue.clear` `terminals.list` |
| `wire.openFrame` `wire.closeFrame` | `frame.open` `frame.close` |

## Files

- `UPDATE: src/control.ts` - ids renamed; an `ALIASES` map from old id to new.
- `UPDATE: src/tui.tsx` - a `keys` entry naming an old id is bound to the new one.
- `UPDATE: test/*.test.tsx` - ids the tests type or execute.
- `UPDATE: README.md`, `docs/` - any id they name.

## Steps

1. Rename per the table, and add every old id to `ALIASES`.
2. Resolve aliases where `keys` is read, so the binding lands on the new id.

## Validation

- A test binds `'ctrl+y': 'go.sessions'` and ctrl+y opens the sessions screen.
- The slash test types `/sessions.show`.
- `npx vitest run` passes.

## Resume

Done 2026-09-30.
Every id in the table renamed in `src`, `test` and `docs`; `RENAMED` and `commandIdFor` in `src/control.ts` carry the old ids, read in `keys()` and in the startup check in `src/tui.tsx`.
The focus id `terminal.list` shared the old command's name and was renamed with it.
`test/keys.test.tsx` binds `go.sessions` and reaches the sessions screen; the slash walk test now types `/session.`, since no id starts `go.` any more.
