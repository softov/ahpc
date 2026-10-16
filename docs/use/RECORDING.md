# Recording

ahpc can record every frame it sends and receives, and check a recording against the protocol.

## Record

```sh
ahpc --host ws://127.0.0.1:9187 --wire capture.jsonl
AHPC_RECORD=capture.jsonl ahpc session list
```

`--wire <file>`, or `AHPC_RECORD=<file>`, appends one JSON line per frame:

```json
{ "at": "...", "from": "...", "peer": "...", "frame": { } }
```

`ahpd --wire` writes the same lines, so a capture from the client and one from the host read the same way, with `ahpc wire` or with `jq`.

## Watch

```sh
ahpc wire capture.jsonl --follow
```

`ahpc wire <file>` shows one row per frame: the time, the direction, the method or action type, and the channel. Select a row to see the frame.

| Flag | |
| --- | --- |
| `--follow` | Keep reading as the file grows |
| `--filter <text>` | Only rows that contain the text |
| `--json` | One line per frame, for a script |

Off a terminal, it prints one line per frame.

## Check against the protocol

From a clone of the repository:

```sh
npm run schema               # a strict JSON Schema from the protocol package's types
npm run wire -- capture.jsonl
```

`npm run wire` reports every frame that does not match the schema. What ahpc implements, and where it differs from the protocol, is in [Conformance](../CONFORMANCE.md).
