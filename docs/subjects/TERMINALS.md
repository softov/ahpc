# Terminals

Shells running on the host. Any client can open one, type into it, and read its output.

## Screen

The palette (`ctrl+p`) has **Show terminals** and **New terminal**. In the terminal screen:

| Command | |
| --- | --- |
| New terminal | Open a shell |
| Next terminal, Previous terminal, Go to terminal | Move between them |
| Switch terminal focus | Between the terminal and the list |
| Interrupt | Send `ctrl+c` to the shell |
| Clear terminal | Clear the output |
| Rename terminal | Give it a name |
| Close terminal | Close it |

## Commands

| Command | | Flags |
| --- | --- | --- |
| `terminal list` | What is running | `--json` |
| `terminal new` | Open a shell | `--cwd DIR` `--trust` `--name N` |
| `terminal send <uri> <text>` | Type into it | |
| `terminal watch <uri>` | Follow its output | `--timeout S` |
| `terminal rm <uri>` | Close it | |

## MCP tools

Served with `--mcp-tools terminals`.

<McpTools group="terminals" />

## Host support

Terminals are AHP's [terminal channel](https://microsoft.github.io/agent-host-protocol/specification/terminal-channel).
