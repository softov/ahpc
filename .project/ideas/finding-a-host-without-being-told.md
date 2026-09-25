---
title: Finding a host without being told where it is
created: 2026-09-24
---

A person points this client at a host by hand: `--host ws://127.0.0.1:9187`, and a secret through `--token`, `AHPC_TOKEN`, `--connection-token-file` or the config file. Every one of those is something somebody has to know and type. The editor's own client does not work that way.

VS Code keeps an **agent host endpoint registry**: a directory of entries, each one a running host, carrying the endpoint it listens on, the `connectionToken` to present, the `protocolVersion` it speaks, and the `pid` and `instanceId` of the process behind it. A client reads the directory, drops the entries whose process is gone, dedupes what is left, and connects. Nobody types an address and nobody copies a secret, because the host wrote both down where a client on the same machine can read them. The directory is owner-only, and the code checks it: `0700`, a real directory rather than a symlink, owned by the current user, with a Windows ACL where there is no mode to set.

Neither half of this pair does any of it. `ahpd` writes no registry entry, so there is nothing to find; `ahpc` reads no registry, so there would be nothing to find it with. The two ends have to be built together, which is what makes this an idea rather than a plan for one repository.

What it would be worth: a bare `ahpc` finds the host already running on this machine and connects to it with the credential that host generated, which is the whole of what `--host` and a token file are being typed for today. It also gives a client something to say when more than one host is running, which right now it cannot even know.

What would have to be decided first. Whether the registry is the protocol's business or the two implementations' own convention, because a format invented here is one no other client can read, and the point of matching the editor is that its clients and this one could eventually find the same hosts. Whether a client may write into the registry at all, or only ever read it, which is the same asymmetry the connection token file already has: the host generates the secret and the client presents it. And what a stale entry is, given that liveness by `pid` is the editor's answer and a host on another machine has no pid this one can ask about.

Adjacent, and smaller: a rejected connection token is reported as `Could not reach ws://...: TransportError: websocket failed to open`, which is what an unreachable port says too. A person who pasted the wrong secret and a person whose host is not running read the same sentence.
