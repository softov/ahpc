# Resources

Files and directories on the host, by `file://` URI. The URI is a path on the host, not on the machine running ahpc.

## Screen

`f` in a session opens the files in its workspace. `@` in the composer completes a path on the host.

## Commands

| Command | | Flags |
| --- | --- | --- |
| `resource list <uri>` | A directory | `--json` |
| `resource read <uri>` | A file, to stdout | |
| `resource stat <uri>` | Its type and size, without reading it | `--json` |
| `resource write <uri> [file]` | Write it, from a file or from stdin | `--create-only` `--force` |
| `resource rm <uri>` | Delete a file or directory | `--recursive` |
| `resource mkdir <uri>` | Make a directory | |
| `resource mv <uri> <to>` | Move or rename | `--fail-if-exists` |
| `resource cp <uri> <to>` | Copy | `--fail-if-exists` |

```sh
ahpc resource read file:///work/api/README.md
echo "notes" | ahpc resource write file:///work/api/NOTES.md
```

A write is refused when the file changed since ahpc read it, so two clients cannot overwrite each other. `--force` writes anyway.

## MCP tools

Served with `--mcp-tools resources`.

<McpTools group="resources" />

## Publish a folder to the host

A host can also read files from the client. ahpc shares nothing until `--publish` names a folder:

```sh
ahpc --host ws://127.0.0.1:9187 --publish ~/notes
```

| Flag | |
| --- | --- |
| `--publish <dir>` | Share this folder, read only |
| `--publish-writable` | Let the host write to it too |

The host reads the files at `virtual://<clientId>/<path>`. The folder is shared only while the screen is open.

## Host support

The host decides which directories it serves and which a client may write to. A write it does not allow is refused with `-32009`.
