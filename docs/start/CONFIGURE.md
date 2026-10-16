# Configure

The config file is `$XDG_CONFIG_HOME/ahpc/config.json`, or `~/.config/ahpc/config.json`. `--config-file <path>` reads another one.

```json
{
  "host": "ws://127.0.0.1:9187",
  "connectionTokenFile": "/home/me/.config/ahpd/connection-token",
  "theme": "paper-light",
  "trust": ["~/work/api"]
}
```

A flag wins over an environment variable, and an environment variable wins over the file. A file that is not there is fine. A file that is there and is broken stops ahpc with an error.

`ahpc config` prints the path and the values in force. Every key is in the [Config file](../reference/CONFIG-FILE.md) reference.

## Trusted folders

The host loads a project's own files, and runs an ACP agent, only in a folder you trust. `trust` lists those folders, and every connection sends the list to the host:

```json
{ "trust": ["~/work/api", "/github/ahpc"] }
```

- A folder is a path on the machine ahpc runs on. A leading `~` is your home folder.
- A parent trusts every folder under it, so `/github` trusts `/github/ahpc`. Keep the list narrow.
- `--trust` adds the folder that `--cwd` (or `--path` on the screen) names, for that one run:

```sh
ahpc session new --cwd /github/ahpc --trust
ahpc exec "run the tests" --cwd /github/ahpc --trust
```

A workspace you pick on the screen is not trusted until the config file lists it.

## Keys

`keys` maps a chord to a command id, or to `null` to unbind it:

```json
{
  "keys": {
    "ctrl+g": "editor.open",
    "ctrl+t": null,
    "ctrl+y": "session.new"
  }
}
```

- Naming a chord replaces every default on it.
- A chord bound to an id no command has is reported at startup.
- `ctrl+c`, `ctrl+d`, `ctrl+h`, `ctrl+i`, `ctrl+j`, `ctrl+m` and `ctrl+[` cannot be rebound. A terminal sends them as interrupt, end of file, backspace, tab, newline, return and escape.

`f1` on the screen shows the keys that work where you are.

## Theme, language and layout

| Key | Flag | |
| --- | --- | --- |
| `theme` | `--theme` | The theme to open on. `alt+t` changes it on the screen |
| `lang` | `--lang` | `en`, `pt-br` or `es` |
| `shell` | `--shell` | The screen layout |

## Update check

The screen asks npm, at most every six hours, whether a newer `@softov/ahpc` exists. When there is one, the status row says so, and `ahpc status` prints it too.

The check never delays the screen and is silent when it fails. It uses `npm_config_registry` when that is set.

Turn it off with any of:

- `--no-update-check`
- `"updateCheck": false` in the config file
- `NO_UPDATE_NOTIFIER` or `CI` set to anything
