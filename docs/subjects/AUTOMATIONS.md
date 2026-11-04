# Automations

An automation runs a prompt on its own: on a schedule, or when a trigger the host supports fires. Each run is a session, and the host keeps the history.

## Screen

The palette (`ctrl+p`) has **Show automations**. In the list:

| Key | |
| --- | --- |
| `n` | New automation |
| `e` | Edit |
| `r` | Run now |
| `o` | Turn on or off |
| `d` | Delete |
| `right` / `left` | Show or hide details |

## Commands

| Command | | Flags |
| --- | --- | --- |
| `automation list` | Every automation | `--json` |
| `automation show <uri>` | One of them | `--json` |
| `automation triggers` | The triggers this host supports | `--json` |
| `automation runs <uri>` | Its run history, every page | `--json` |
| `automation new` | Make one, turned on | `--prompt`, `--schedule`, `--time-zone`, `--on`, `--title`, `--agent`, `--model`, `--folder` |
| `automation edit <uri>` | Change the fields given | the flags of `new` |
| `automation duplicate <uri>` | A copy, turned off, titled `<title> (copy)` | |
| `automation export <uri>` | Print it as a file, or write it | `--out`, `--vscode` |
| `automation import <file>` | Make one from a file, turned off | `--folder`, `--vscode` |
| `automation run <uri>` | Run it now | |
| `automation enable <uri>` | Turn it on | |
| `automation disable <uri>` | Turn it off | |
| `automation rm <uri>` | Delete it | |

`new` needs `--prompt` and a trigger: `--schedule` with a cron expression, or `--on <type>:<event>`, such as `--on session:turnCompleted`.
`automation triggers` lists the types this host has.
`--time-zone` defaults to your own.

### Files

`export` writes ahpd's `.automation.md`: the definition as YAML front matter, and the message as the body.
`ahpd automation import` reads the same file, so an automation moves between hosts.
With `--vscode`, `export` writes VS Code's `.automation.md`, and refuses an automation that file cannot hold, such as one with an event trigger.

`import` reads ahpd's file, or VS Code's with `--vscode`.
The new automation runs in `--folder`, or in the folder an ahpd file names.
VS Code's file names no folder, so it needs `--folder`.

## MCP tools

`list_automations` is always served:

<McpTools names="list_automations" />

Running and changing an automation needs `--mcp-tools automations`:

<McpTools group="automations" />

## Host support

Automations are AHP's [automation channel](https://microsoft.github.io/agent-host-protocol/specification/automation-channel). `automation triggers` shows what this host can trigger on.
