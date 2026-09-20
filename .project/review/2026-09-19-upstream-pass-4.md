---
title: Upstream pass 4, VS Code 8e35945b to 832cf23c5
status: built
date: 2026-09-19
refs:
  - code://REFERENCE.md - the clone recipe and the revisions this pass started from
  - code://UPSTREAM.md - the running list this pass adds to, one box per item below
  - git://4f1c2fe - the `do-check` skill, which is how this pass was made
---

# Upstream pass 4

VS Code `8e35945b` (2026-09-12) to `832cf23c5` (2026-09-19): 68 commits in the workbench chat tree and 230 files under `src/vs/sessions`. **The wire did not move.** `git diff 8e35945b..832cf23c5 -- src/vs/platform/agentHost/common/state/protocol/` is empty and the vendored `.ahp-version` is still `fd0471d4`, so nothing below is a protocol change: this client's `CommandMap` and its action set take nothing from the range, and no new client-to-host request or `_meta` appears either.

Paths are relative to the clone root at `832cf23c5`, or to this repository when prefixed `src/`. Two trees are cited often and are abbreviated below: **`agentHost/`** is `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/`, and **`sessions/`** is `src/vs/sessions/`.

## The clone was missing the other client

`src/vs/sessions` - the Sessions window - was not in the sparse checkout. It is the reference client now, and 230 files changed under it in this range, so a read that stayed in the workbench tree was reading the older half of the client and could not see the newer one. It is in the set now; `REFERENCE.md` and the `do-check` skill both say a path left out of the sparse set is a path no search can see.

## Taken

Six things a client of this protocol could now draw that this one does not. Each is new in the range, against a reference read at `832cf23c5`.

- **`responseRoundEnded` closes the open reasoning section and draws no row.** `agentHost/stateToProgressAdapter.ts:506` maps a `systemNotification` whose `_meta.kind` is `responseRoundEnded` to an empty thinking part and returns before a row is built; the kind is declared at `src/vs/platform/agentHost/common/meta/agentSystemNotificationMeta.ts:25`. Here `src/ahp/live.ts:604-605` maps every system notification to `{ kind: 'systemNotification', id, content }` and `src/blocks.ts:49` draws it, so a round that ends with no text and no tool calls draws an empty notice where the reference settles the thinking section. One wire read, one code path.
- **A queued message keeps the model it will run on.** `agentHost/agentHostSessionHandler.ts:2252-2253,2512-2513` carries `model.id` and `model.config` for the pending message and the active turn. Here `src/ahp/live.ts:1255` (`queued()`) keeps the message and drops its model, so the queue cannot say what each queued turn will run on.
- **Reopening a session restores the last turn's model configuration.** `agentHost/stateToProgressAdapter.ts:990` puts `turn.message.model.config` into the history entry, and the renderer hands it back at `src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts:1347` (`requestModelByIdentifier(identifier, configuration?)`), which an agent-host session reaches through `agentHost/agentHostSessionHandler.ts:841,1919`. Here `src/control.ts:28,300,739-758` sets `MODEL` from the session detail and reads `MODEL_CONFIG` only from what was chosen in this run, so reopening loses the model's settings.
- **A completed response says what it changed.** `src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts:3376-3384` attaches a `ChatEditStatsButton` to the completed response, built by `src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatEditStatsButton.ts` from the turn's file edits. Here `src/blocks.ts` has the changeset and no per-turn count, so the terminal shows the diff but not how much of it was this turn.
- **Authentication a tool needs is a blocking state of its own.** `src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts:5509` (`getPersistentProgressState`) treats a part of kind `mcpAuthenticationRequired` as persistent progress, the test is at `:5535`, and the render branches are at `:2065` and `:4145`. Here `src/blocks.ts` passes a host tool status through with no case for it, so a tool waiting on a sign-in reads as an ordinary running call.
- **A session's own pull requests are told from the ones it inherited.** `sessions/services/sessions/common/session.ts:400` (`getSessionOwnedGitHubPullRequestRefs`) counts a pull request as owned when it was recorded as a reference with a stable id, or when it is in `_meta.github.pullRequestUrls` minus `initialPullRequestUrls`, or is listed in `associatedPullRequestUrls`, and the provider uses it at `sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts:402,445`. Here `src/state.ts:634` (`pullRequest()`, `:654` `pullRequestLabel()`) takes the first URL as the session's pull request, so one that came with the checkout is presented as this session's. The two keys behind the rule are a host convention and not core wire; see Left open.

## Already had

Read in the range and already true here; the reference line is what it was checked against.

- The config surface is schema-driven, one command per host-advertised key: `src/control.ts:331-334` skips a property with no values and requires `sessionMutable` on an open session, and `:384-400` resolves `enumDynamic` through `host.configCompletions`. The reference picker does the same at `sessions/contrib/providers/agentHost/browser/agentHostSessionConfigPicker.ts:241,614,940,1017,1086`.
- A session is created with the whole config bag rather than patched afterwards: `src/control.ts:848-856`, as the reference captures it before the send (`sessions/services/sessions/browser/sessionsManagementService.ts:758,939,1065`).
- `isolation` and `branch` are ordinary host schema keys here too, chosen by value and dispatched as config (`src/control.ts:262,1057`).
- `_meta` is read as the open map it is: `src/state.ts:624` says so beside `pullRequest()`, and `_meta.git` / `_meta.github` are read at `:542-660`.
- An unknown `_meta` capability flag is ignored and an unknown server-initiated method is refused: `src/ahp/live.ts:1352-1361`. That is the correct answer for a client that serves no `vscode/*` extension method.
- The tool progress line is drawn (`_meta.progressMessage`, `src/ahp/live.ts:560`), a pending question blocks (`src/blocks.ts`, `src/screens.tsx:911`), reasoning and tool calls keep host stream order, and the model id and its config per turn are drawn (`src/blocks.ts:34-35`).
- Archived sessions are listed and filtered, and the read flag is already mapped to the protocol (`src/control.ts:830`).
- Auth is a manual one-shot here (`src/connect.ts:81`), so the reference's rejected-credential quarantine and clear-on-removal work have nothing to act on. No `authenticate` or `auth/required` payload changed in the range either.

## Read and not taken

Kept so the next pass starts by reading it rather than re-deriving it.

- **Subagent identity on a tool call** - `_meta.toolKind` of `subagent`, `_meta.subagentDescription`, `subagentAgentName`, `subagentChatUri`, and `ToolResultSubagentContent` - is read by the reference at `agentHost/stateToProgressAdapter.ts:378-404`, but **that read predates this range**: the file's whole diff for the range is 19 lines and touches none of it. A subagent row collapsing into an ordinary tool row is a gap of long standing, not something this pass found, and it is not a change to port.
- **Turn token counts, per-turn credits, the Auto routing result and the model context window** are read at `agentHost/stateToProgressAdapter.ts:637,645,665-676,683-700` and `src/vs/workbench/contrib/chat/common/languageModels.ts:274,358`. Only the last is new in the range (`maxContextWindowTokens` and `getModelContextWindowTotal`), and `src/ahp/live.ts:1050` reads usage for the model id alone and shows no token surface, so there is nowhere to put any of it. Left open.
- **Subagent `modelId`, `modelName` and credits** (`agentHost/stateToProgressAdapter.ts:2653,2775,2794`): what is new there is the model id, and its value originates in VS Code's own `src/vs/workbench/contrib/chat/common/tools/builtinTools/runSubagentTool.ts`, not in host state.
- **The config picker's curation** - `sandboxEnabled`, `worktreeBranchTrack` and `worktreeCreateNewBranch` hidden, `isolation` offered only when it can be `worktree`, with its own order (`sessions/contrib/providers/agentHost/browser/agentHostSessionConfigPicker.ts:241-268,270-291`): window taste. This client shows every property the host advertises, in the host's order, and the host obeys whatever value it is sent.
- **The Dev Container handoff** as a local draft state machine (`sessions/contrib/providers/agentHost/browser/devContainerAgentHostSessionsProvider.ts:139-373`), the workspace mode submenu (`sessions/contrib/chat/browser/sessionWorkspacePicker.ts:1518-1545`), and the picker-visibility service (`sessions/services/sessions/common/sessionPickerVisibility.ts:15-45`): window flows riding the `vscode/devContainers/*` extension methods, which are not core AHP.
- **Artifacts and references as a surface** - pills, removal by stable id through `vscode/removeSessionArtifact`, `isArtifact` demoted to presentation (`sessions/contrib/chat/browser/sessionArtifacts.ts:170-236`, `sessions/contrib/providers/agentHost/browser/agentHostSessionArtifacts.ts:132`): this client has no artifact surface at all. The host id is stable regardless of `isArtifact`, so a terminal that later draws them inherits removal for free, but the request itself is an extension method. Left open.
- **`markRead(session, { preserveExplicitUnread })`** (`sessions/services/sessions/browser/sessionsManagementService.ts:1225-1240`): the read flag is already mapped here.
- **Menus, context keys and the WSL / `@hostAuthority` remote forms** (`sessions/browser/menus.ts:61-72`, `sessions/common/contextkeys.ts:112`, `sessions/browser/openInVSCodeUtils.ts:48-60`): VS Code re-organising its own window, over an authority encoding no host sends.
- **The window's own rendering**: the working-progress logo and its CSS, the thinking and tool-chain CSS, theme colours, the archive nudge's compact layout, `editorChatUsage`, and the debug-log export's zip assembly. A terminal cannot draw CSS, and a host feeds none of it.
- **The transport's connection diagnostics stream** (`src/vs/platform/agentHost/common/connectionDiagnostics.ts`, `src/vs/platform/agentHost/browser/agentHostProtocolClient.ts:278`): connect, reconnect and close-code evidence rather than AHP frames, with no consumer outside its own service.

## Left open

- **Is the owned-pull-request rule a contract this client may rely on?** `initialPullRequestUrls` and `associatedPullRequestUrls` sit in the open `_meta.github` map, defined at `src/vs/platform/agentHost/common/state/sessionState.ts:1682-1684`, a file that has not changed since before the floor, and they appear nowhere in the frozen wire directory. A host that does not send them makes every pull request read as inherited - this repository's own host sends neither (`packages/sdk/src/host.ts:2088` in `ahpd`). Settled by finding the keys in an upstream protocol document or in a second host implementation.
- **Does this client want a usage surface?** Per-turn tokens, per-turn cost and the model's context window are all reachable, and the context window is newly declared, but there is nowhere to draw them until either the history row or a `/usage` screen grows one.
- **Should `agentHost/sessionArtifacts` be drawn?** The host now guarantees a stable id per recorded entry, so a terminal view is possible; it needs a spec rather than a protocol answer.
- **Will `vscode/removeSessionArtifact` become a core AHP method?** Today it is an accept-or-refuse extension method, so a client that does not serve it can only refuse it.
- **Do the picker curations encode host rules or display choices?** The host accepts whatever value it is sent, so only parity of taste is at stake.
- **Does any host outside VS Code implement `vscode/devContainers/*`?** If one does, the connect payload's `remoteWorkspaceFolder` and `hostWorkspaceFolder` are the only host-visible parts, and both are currently extension-scoped.

## What the plan should be

The first item is the cheapest and the only one that changes what an existing chat draws: one `_meta` read and one branch, no new state. The model items (`queued()` keeping its model, and `MODEL_CONFIG` seeded on open) are one concern about the same field and can land together. The edit stats, the auth-required state and the owned-pull-request filter are independent, and the last of them is worth doing only if the Left open above is answered in its favour.
