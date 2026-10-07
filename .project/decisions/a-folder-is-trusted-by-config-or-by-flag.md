---
title: A folder is trusted by the config list or by --trust, never by --cwd alone
status: accepted
date: 2026-10-07
refs:
  - "[code://src/connect.ts#L124](../../src/connect.ts#L124) - the hook that sends on every connection"
  - "[code://src/config.ts#L8-L65](../../src/config.ts#L8-L65) - the config file the list lives in"
---

## Context

From ahpd 0.10.0, a host treats a folder as untrusted until the connection sends `workspaceTrust`.
In an untrusted folder, a Claude or pi session does not load the project's own files, and an ACP agent is refused.
VS Code sends the folders its window trusts. ahpc sends nothing, so every ahpc session is untrusted.

## Decision

ahpc trusts the folders in the `trust` list of its config file, and the `--cwd` of a command run with `--trust`.
A folder named only by `--cwd` or by the screen's workspace is not trusted.

Source: Softov, 2026-10-07, asked "ahpc: which folders does it tell the host it trusts?" and chose "Config list + --trust".

## Consequences

- A build preset that needs the project's files works once its folder is in the config list.
- A folder that ahpc is pointed at by mistake loads nothing from the project.
- The screen's workspace can change while it runs; a new workspace is not trusted unless it is in the list.

## Options

- Every `--cwd` is trusted: the simplest, but any folder ahpc is pointed at loads its project files.
- The config list only: no way to trust one folder for one run.
