# Tool server

The tool server lets an agent somewhere else drive the sessions on your host through ahpc. That agent can be Claude Code, Claude Desktop, VS Code, or a script. It can list and create sessions, read a transcript, send a message and wait for the answer, and answer what the agent asks.

| Command | How it serves |
| --- | --- |
| `ahpc mcp` | MCP on stdin and stdout. The MCP client starts ahpc and talks to it |
| `ahpc serve` | MCP and a plain JSON API on an HTTP port, shared by many callers. Runs until stopped |

Both connect to the host the same way as every other command: `--host`, the token, and the config file. See [Connect](../start/CONNECT.md). With no host, they serve the scripted host, which is a safe way to try a client.

## Add it to a client

Each example connects to a host on the same machine. For a host on another machine, change the `--host` address and add a token.

### Claude Code

::: code-group

```sh [Linux, macOS]
claude mcp add ahp -- ahpc --host ws://127.0.0.1:9187 mcp
```

```sh [Windows]
claude mcp add ahp -- cmd /c ahpc --host ws://127.0.0.1:9187 mcp
```

:::

On Windows, npm installs `ahpc` as `ahpc.cmd`, which Claude Code cannot start directly. `cmd /c` starts it.

`-s user` makes the server available in every project, not only the current one.

For a remote host, pass the token. A token file keeps the secret out of Claude Code's settings:

::: code-group

```sh [Token file]
claude mcp add ahp-remote -s user -- ahpc --host ws://203.0.113.5:9187 --connection-token-file /home/me/.config/ahpc/remote-token mcp
```

```sh [Token in the environment]
claude mcp add ahp-remote -s user -e AHPC_TOKEN=<token> -- ahpc --host ws://203.0.113.5:9187 mcp
```

```sh [Windows]
claude mcp add ahp-remote -s user -e AHPC_TOKEN=<token> -- cmd /c ahpc --host ws://203.0.113.5:9187 mcp
```

:::

::: warning
`-e AHPC_TOKEN=<token>` writes the token as plain text into Claude Code's settings (`~/.claude.json` for `-s user`). Use the token file where you can.
:::

### Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ahp": {
      "command": "ahpc",
      "args": ["--host", "ws://127.0.0.1:9187", "mcp"]
    }
  }
}
```

On Windows, use `"command": "cmd"` and put `"/c", "ahpc"` first in `args`.

### VS Code

In `.vscode/mcp.json`, or the user `mcp.json`:

```json
{
  "servers": {
    "ahp": {
      "type": "stdio",
      "command": "ahpc",
      "args": ["--host", "ws://127.0.0.1:9187", "mcp"]
    }
  }
}
```

### Any other MCP client

Start `ahpc --host <url> mcp` as a stdio server. Add `--connection-token-file <path>` or the `AHPC_TOKEN` environment variable for a host with a token.

## The tools

Thirteen tools are always served: sessions, turns, answering, and the list of automations. More come in groups, and each group is off until you ask for it with `--mcp-tools`:

```sh
ahpc --host ws://127.0.0.1:9187 mcp --mcp-tools resources,changes
```

| Group | Tools |
| --- | --- |
| (always) | `list_sessions` `show_session` `list_agents` `new_session` `dispose_session` `session_history` `send_turn` `queue_turn` `cancel_turn` `wait_for_attention` `confirm_tool_call` `answer_question` `list_automations` |
| `resources` | `list_directory` `read_file` `write_file` `make_directory` `delete_path` `move_path` `copy_path` |
| `terminals` | `list_terminals` `new_terminal` `send_to_terminal` `read_terminal` `dispose_terminal` |
| `automations` | `run_automation` `set_automation_enabled` `remove_automation` |
| `changes` | `list_changesets` `show_changes` |

The groups are off by default because a model reads every tool it is given. Thirteen tools serve the common case, which is driving a session, better than thirty.

`--mcp-tools` takes a comma-separated list and can be repeated. `--mcp-tools all` turns on every group.

A tool in a group that is off is not listed, so the server names the groups that are off in its `initialize` reply, as instructions for the model. Calling a tool from such a group is refused with the flag that turns it on.

Each tool's arguments are in the [MCP tools](../reference/MCP-TOOLS.md) reference.

## How a turn works

`send_turn` blocks until the turn ends and returns what the agent said. A turn that stops to ask a person something is not finished. `wait_for_attention` says what it wants, and `confirm_tool_call` or `answer_question` answers it.

A caller that puts a `progressToken` in the request's `_meta` gets a `notifications/progress` message for each tool the agent calls. The result still arrives whole at the end.

## Files

`read_file` and `write_file` take a `file://` URI on the host, not a path on the machine running ahpc. They may be different machines.

`write_file` checks that the file did not change since it was read, unless it is passed `force`. Writing needs the host to have granted write access to that directory. A host that has not refuses with `-32009`, and ahpc cannot grant it for the model.

## `ahpc serve`

```sh
ahpc --host ws://127.0.0.1:9187 serve --serve-port 7431
```

| Path | |
| --- | --- |
| `POST /mcp` | MCP over HTTP |
| `POST /api/<tool>` | One tool. The arguments are the body, the answer is the body |
| `GET /api` | The tools there are |

The JSON API is for anything that does not speak MCP, such as a shell script or a webhook:

```sh
curl -XPOST localhost:7431/api/new_session -d '{"workingDirectory":"/work"}'
curl -XPOST localhost:7431/api/send_turn -d '{"session":"claude:/…","text":"what is in this directory"}'
```

With a `progressToken`, the POST is answered with an SSE stream: the progress notifications, then the result. Without one, it is one JSON object.

| Flag | Default | |
| --- | --- | --- |
| `--serve-host <host>` | `127.0.0.1` | The address to listen on |
| `--serve-port <port>` | `7431` | The port |
| `--serve-token <token>` | none | A bearer token callers must send |
| `--serve-origin <url>` | none | A browser origin to let in. Repeatable |
| `--mcp-tools <groups>` | none | Extra tool groups, as for `mcp` |

::: danger
Anyone who can reach the port can drive every session on the host. Set `--serve-token` before you use `--serve-host 0.0.0.0`.
:::

A request with a browser `Origin` header is refused unless the origin is the server's own or one named with `--serve-origin`. Loopback alone does not protect you: a web page in your browser can send a request to `127.0.0.1`. Programs send no `Origin` and are let in.
