# Telemetry

The host's own log, and the tokens and cost each session uses.

## Log

```sh
ahpc logs --follow
ahpc logs --level warn
```

| Flag | |
| --- | --- |
| `--follow` | Keep printing until stopped |
| `--level <level>` | The level to ask the host for |

The log is live only: the host does not replay old lines. Without `--follow`, `logs` prints what arrives in the next moment and exits. The log comes from the telemetry channel the host advertises.

## Usage

`u` in a session opens the usage screen: the tokens each turn used, its cost, the session's total, and how full the model's context window is. The numbers are the ones the host reports. A host that reports none shows none.

## MCP tools

None.

## Host support

The log is AHP's [telemetry channel](https://microsoft.github.io/agent-host-protocol/specification/telemetry-channel).
