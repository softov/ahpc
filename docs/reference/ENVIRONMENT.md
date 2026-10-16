# Environment

| Variable | |
| --- | --- |
| `AHPC_HOST` | The host to connect to. `--host` wins over it |
| `AHPC_TOKEN` | A token for the host. `--token` and `--connection-token-file` win over it |
| `AHPC_TOKEN_<RESOURCE>` | A token for one protected resource. See [Connect](../start/CONNECT.md#protected-resources) |
| `AHPC_RECORD` | Record every frame to this file, as `--wire` does |
| `AHPC_DEBUG` | `1` prints the stack under an error, for a bug report |
| `XDG_CONFIG_HOME` | Where the config folder is. `~/.config` when unset |
| `VISUAL`, `EDITOR` | The editor `ctrl+g` opens |
| `NO_UPDATE_NOTIFIER`, `CI` | Set to anything, the screen does not check npm for a newer version |
| `npm_config_registry` | The registry the update check asks |
