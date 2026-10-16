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
| `automation run <uri>` | Run it now | |
| `automation enable <uri>` | Turn it on | |
| `automation disable <uri>` | Turn it off | |
| `automation rm <uri>` | Delete it | |

## MCP tools

`list_automations` is always served:

<McpTools names="list_automations" />

Running and changing an automation needs `--mcp-tools automations`:

<McpTools group="automations" />

## Host support

Automations are AHP's [automation channel](https://microsoft.github.io/agent-host-protocol/specification/automation-channel). `automation triggers` shows what this host can trigger on.
