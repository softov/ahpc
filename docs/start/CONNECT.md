# Connect

ahpc needs two things: the host's address and, if the host asks for one, a token.

## The host

| Source | Example |
| --- | --- |
| Flag | `--host ws://127.0.0.1:9187` |
| Environment | `AHPC_HOST=ws://127.0.0.1:9187` |
| Config file | `"host": "ws://127.0.0.1:9187"` |

A flag wins over the environment, and the environment wins over the file. With none of them, ahpc uses the scripted host.

The address is `ws://` or `wss://`.

## The token

| Source | Example |
| --- | --- |
| Flag | `--token <token>` |
| Flag | `--connection-token-file <path>` |
| Environment | `AHPC_TOKEN=<token>` |
| Config file | `"connectionTokenFile": "<path>"` |
| Config file | `"token": "<token>"` |

ahpc reads them in that order and uses the first one it finds. `--token` and `--connection-token-file` together is an error.

Prefer a file to the token itself. A path is safe in a config file you share or back up; a token is not. The file is read as written: give an absolute path, because ahpc does not expand `~` (your shell does, on the command line).

ahpd writes its token to `~/.config/ahpd/connection-token`. On the same machine, point ahpc at that file:

```sh
ahpc --host ws://127.0.0.1:9187 --connection-token-file ~/.config/ahpd/connection-token
```

## A host on another machine

The host must listen on the network and have a token. For ahpd, see [Remote access](https://softov.github.io/ahpd/server/REMOTE) in its docs. Then:

```sh
ahpc --host ws://203.0.113.5:9187 --token <token>
ahpc --host wss://ahpd.example.com --token <token>
```

ahpd can give each person their own token. See [Users](https://softov.github.io/ahpd/server/USERS) in its docs.

## Protected resources

Some hosts protect a resource, such as a model API, and ask the client for a token for it. `ahpc auth` lists what the host protects, and `ahpc auth <resource>` sends a token:

```sh
ahpc auth
ahpc auth https://api.anthropic.com --token <token> --expires-in 3600
```

ahpc also reads a token for a resource from `AHPC_TOKEN_<RESOURCE>`. The name is the resource URL without its scheme, in capitals, with every run of characters that are not letters or digits turned into `_`. For `https://api.anthropic.com` it is `AHPC_TOKEN_API_ANTHROPIC_COM`.

## Check the connection

```sh
ahpc status
```

`ahpc status` prints the host, the connection, and whether a newer ahpc is on npm. `ahpc config` prints the config file and the values in force, and it works without a host.
