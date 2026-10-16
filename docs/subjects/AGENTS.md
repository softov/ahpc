# Agents

An agent is a harness the host serves, such as Claude, with the models it offers. A new session picks one. The host also offers slash commands and completions.

## Screen

A new session asks for the agent and the model first. In a session, the palette (`ctrl+p`) has **Choose harness** and **Choose model**. `/` lists the slash commands, and `@` completes a file path on the host.

## Commands

| Command | | Flags |
| --- | --- | --- |
| `agents` | The agents the host serves, with their models | `--json` |
| `models` | Every model, grouped by agent | `--json` |
| `commands` | The slash commands the host offers | `--json` |
| `completions <uri> <text>` | What the host would complete | `--offset N` `--json` |

The provider name from `agents` is what `session new --agent` and `exec --agent` take.

## MCP tools

Always served.

<McpTools names="list_agents" />

## Host support

Every AHP host lists its agents. Slash commands and completions depend on the host.
