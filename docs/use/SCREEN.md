# Screen

`ahpc` with no command opens the screen, on a new session.

```sh
ahpc --host ws://127.0.0.1:9187
```

| Flag | |
| --- | --- |
| `--session <uri>` | Open on this session. A session URI or an `agent-host-session://` link |
| `--path <dir>` | The workspace a new session starts in |
| `--trust` | Trust `--path` for this run. See [trusted folders](../start/CONFIGURE.md#trusted-folders) |
| `--theme <id>` | The theme to open on |
| `--lang <code>` | `en`, `pt-br` or `es` |
| `--publish <dir>` | Share a folder with the host. See [Resources](../subjects/RESOURCES.md#publish-a-folder-to-the-host) |

## Moving between screens

The first screen is [a new session](NEW-SESSION.md). `esc` goes back one screen, and from a new session it goes to the session list.

| Screen | How to get there |
| --- | --- |
| [New session](NEW-SESSION.md) | The first screen. `ctrl+n` from anywhere |
| [Session list](../subjects/SESSIONS.md#screen) | `esc` on a new session |
| [Session](SESSION.md) | `enter` on a row of the session list, or `--session <uri>` |
| Changes, files, skills, MCP servers, usage, settings | One key in a session. See [Session](SESSION.md#its-screens) |
| [Chats](../subjects/CHATS.md#screen) | **Switch chat** in the palette, in a session |
| [Terminals](../subjects/TERMINALS.md#screen) | **Show terminals** in the palette |
| [Automations](../subjects/AUTOMATIONS.md#screen) | **Show automations** in the palette |

Each screen names its main keys on its last row. The keys that work on every screen, and the palette, are in [Keys](KEYS.md).
