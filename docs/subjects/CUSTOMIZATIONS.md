# Customizations

Skills, prompts, agents and MCP servers that plugins and directories give a session. Each can be on or off for a session.

## Screen

In a session:

| Key | |
| --- | --- |
| `k` | Skills and commands: what plugins and directories gave this session |
| `p` | MCP servers: which servers this session has, and whether they answered |

## Commands

| Command | | Flags |
| --- | --- | --- |
| `customizations` | What the host offers before any session exists | `--kind k` `--json` |
| `session customizations <uri>` | What one session has | `--json` |
| `session toggle <uri> <id>` | Turn one on | `--off` |

## MCP tools

None.

## Host support

What a session has depends on the host, its plugins, and the session's workspace.
