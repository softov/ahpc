# Get started

ahpc is a client. It does not run agents or models. It connects to an AHP host, such as [ahpd](https://github.com/softov/ahpd) or VS Code's agent host, and drives the sessions there.

## Install

::: code-group

```sh [npm]
npm install -g @softov/ahpc
```

```sh [npx]
npx @softov/ahpc
```

:::

The package is `@softov/ahpc`. The command it installs is `ahpc`. Node 22 or later.

## Try it with no host

A scripted host is built in. With no `--host`, ahpc runs against it, so you can see the screen before you set anything up:

```sh
ahpc
```

## Connect to a real host

```sh
ahpc --host ws://127.0.0.1:9187
```

If the host needs a token, add `--token <token>`. For ahpd, the token is in `~/.config/ahpd/connection-token`:

```sh
ahpc --host ws://127.0.0.1:9187 --connection-token-file ~/.config/ahpd/connection-token
```

To stop typing `--host`, put it in the [config file](CONFIGURE.md):

```json
{ "host": "ws://127.0.0.1:9187", "connectionTokenFile": "/home/me/.config/ahpd/connection-token" }
```

## Three ways to use it

| | |
| --- | --- |
| [Screen](../use/SCREEN.md) | `ahpc` with no command. Chat with an agent, approve its tool calls, browse its changes |
| [Commands](../use/COMMANDS.md) | `ahpc session list`, `ahpc prompt <uri> "..."`. One command, an answer, and exit |
| [Tool server](../use/TOOL-SERVER.md) | `ahpc mcp`. Another agent, such as Claude Code, drives the sessions on your host |

## Next

- [Connect](CONNECT.md) to a host on another machine.
- [Configure](CONFIGURE.md) trusted folders, theme and keys.
