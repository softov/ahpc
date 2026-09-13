# Keeping up with the reference host

What VS Code's agent host changed since this client was last read against it, and what each change asks of this repository. One pass per review; a box is ticked by the commit that lands the work. The host side of the same pass is `UPSTREAM.md` in `ahpd`, and the method - which clone, which directories, in what order - is in that repository's `REFERENCE.md`.

## Pass 2 - 2026-09-13

VS Code `3aa54039` (2026-08-29) to `8e35945b` (2026-09-12), 206 agentHost commits. Protocol repository `fd0471d` to `a21274d`, dependabot only: `@microsoft/agent-host-protocol@0.9.0` is still current.

### Protocol

- [x] **`1.0.0` comes out of `VERSIONS`.** VS Code's vendored `PROTOCOL_VERSION` went from `1.0.0` back to `0.9.0` when it resynced to protocol `fd0471d4`; the `1.0.0` this client was written around was a VS Code-local jump that never reached the protocol repository's `main`, and no host speaks it now. The host accepts `^0.9.0` and picks the highest compatible offer, so the entry was skipped rather than harmful, but the comment above the list says the opposite of what is true, and offering a version the installed types do not describe is the wrong kind of forward-compatibility. The automations normalisation stays - it is cheap and the old spelling is in Insiders builds from that window - with its comment corrected the same way.

### What the reference host now puts on the wire

- [x] **`_meta.progressMessage` on a running tool call** is drawn as the running line. Transient, meaningful only while the call is `running`; upstream `dd12d29d`.
- [x] **A message carrying `_meta['vscode.chat.requestHiddenFromTranscript']`** keeps its response and loses its request row. Upstream's host-notice turns (Agent Merge status, workspace transitions) arrive as `systemNotification` messages the host appended to carry a message, and drawing the request as though somebody typed it is wrong. Its sibling `vscode.chat.hiddenFromTranscript` hides the whole turn, and each has a text-prefix spelling (`<!-- vscode-request-hidden-from-transcript -->`, `<!-- vscode-hidden-from-transcript -->`) for a host that cannot write `_meta`; the reference client reads all four in one place (`readMessageMeta`, `sessionState.ts`), so this one does too.
- [ ] **`_meta.git.pullRequestState`** (`open`, `closed`, `merged`) beside the branch in the sessions catalogue, where the host reports it.

### Read and not taken

- `authenticate.expiresIn` and `auth/required` with `reason: 'expired'`: already sent and already honoured, since 0.3.0.
- `activity: null` in `root/sessionSummaryChanged`: this client re-lists the catalogue on every summary change rather than merging the partial, so a `null` is as good as an omission here.
- The reconnect "baseline debt" fix (`8e27ac16`) and its client half, `beginSnapshotRefresh`: on a host that has forgotten this client, `initialize` is sent again with the held channels and every one of them is re-opened from a fresh snapshot, so there is no pre-restart state to replay deltas onto.
- Session server tools, `sandboxEnabled`, `shellInitScripts`, Agent Merge, `vscode/removeSessionArtifact`: an editor's, or Copilot's.

## Pass 1 - 2026-09-05

VS Code `3aa54039`, protocol `fd0471d`, during the 0.3.0 work. No list was kept.
