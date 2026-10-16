# Commands

`ahpc <command>` runs one command and exits, without the screen.

```sh
ahpc --host ws://127.0.0.1:9187 session list
ahpc prompt claude:/abc123 "what is in this directory"
```

The host and the token come from the same places as for the screen. See [Connect](../start/CONNECT.md).

## Output

Output is for reading. `--json` gives the same answer for a program:

```sh
ahpc session list --json | jq -r '.[].resource'
```

When a command fails, it prints one line saying why. `AHPC_DEBUG=1` also prints the stack, for a bug report.

## Session URIs and links

Most commands take a session URI, which `ahpc session list` prints. Anywhere a `<uri>` is asked for, an `agent-host-session://` link works too. That is the link a host's session tools answer with.

## Commands by subject

| Subject | Commands |
| --- | --- |
| [Sessions](../subjects/SESSIONS.md) | `session list`, `session new`, `session show`, `session history`, `session export`, ... |
| [Turns](../subjects/TURNS.md) | `prompt`, `exec`, `queue`, `cancel`, `watch`, `confirm`, `answer` |
| [Chats](../subjects/CHATS.md) | `chat list`, `chat new`, `chat show`, `chat history`, `chat rm` |
| [Agents](../subjects/AGENTS.md) | `agents`, `models`, `commands`, `completions` |
| [Changes](../subjects/CHANGES.md) | `changes`, `content` |
| [Resources](../subjects/RESOURCES.md) | `resource list`, `resource read`, `resource write`, ... |
| [Terminals](../subjects/TERMINALS.md) | `terminal list`, `terminal new`, `terminal send`, `terminal watch`, `terminal rm` |
| [Automations](../subjects/AUTOMATIONS.md) | `automation list`, `automation run`, `automation enable`, ... |
| [Customizations](../subjects/CUSTOMIZATIONS.md) | `customizations`, `session customizations`, `session toggle` |
| [Telemetry](../subjects/TELEMETRY.md) | `logs` |

Every command and flag is in the [CLI reference](../reference/CLI.md).

## Anything else

| Command | |
| --- | --- |
| `status` | The connection, and whether a newer ahpc is on npm |
| `config` | The config file path and the values in force. Works without a host |
| `auth` | What the host protects. See [Connect](../start/CONNECT.md#protected-resources) |
| `dispatch <uri> <type>` | Send one protocol action as is. `--field k=v`, repeatable. `--chat` for a chat action |
| `mcp`, `serve` | The [tool server](TOOL-SERVER.md) |
| `wire <file>` | Watch a [recording](RECORDING.md) |
| `help` | Every command |
| `--version` | The version |
