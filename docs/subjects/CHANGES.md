# Changes

The files a session changed, grouped in changesets: for example every change in the session, or only the last turn's. The host also says what can be done with them, such as stage, commit, or create a pull request.

## Screen

`c` in a session opens the changes.

| Key | |
| --- | --- |
| `]` | Next changeset |
| `r` | Mark this file reviewed |
| `x` | Choose something to do with the changes |
| `s` / `u` | Stage, unstage |
| `delete` | Discard |
| `c` | Commit |
| `p` | Create a pull request |
| `esc` | Back to the file list |

The operations are the ones the host offers for that changeset.

## Commands

| Command | | Flags |
| --- | --- | --- |
| `changes <uri>` | The files a session changed | `--json` |
| `content <uri> <file>` | One changed file, in full | |

`changes` takes these flags:

| Flag | |
| --- | --- |
| `--list` | Every changeset the session offers |
| `--scope <name>` | One changeset, such as `turn` |
| `--turnId <id>` | What a chosen scope needs, here the turn |
| `--reviewed <file>`, `--unreviewed <file>` | Mark a file reviewed, or clear it. Repeatable |
| `--operations` | What may be done to the changeset |
| `--run <id>` | Do one of them. `--file f` for one file, `--yes` to skip the confirmation |
| `--message <m>` | The message, for commit |
| `--title <t>` `--body <b>` `--draft` | For create pull request |

`--run` needs `--scope`, and takes an id that `--operations` lists. When the host asks for a confirmation, `--run` prints it and stops unless you pass `--yes`.

```sh
ahpc changes "$S" --list
ahpc changes "$S" --scope <name> --operations
ahpc changes "$S" --scope <name> --run commit --message "Fix the parser"
```

## MCP tools

Served with `--mcp-tools changes`.

<McpTools group="changes" />

## Host support

The changesets and their operations come from the host. ahpc shows what it offers and adds none of its own.
