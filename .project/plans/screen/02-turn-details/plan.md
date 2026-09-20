---
title: Three corrections to what a chat turn draws
domain: screen
status: planned
priority: high
created: 2026-09-19
revalidated: 2026-09-19
requires: []
changes: []
creates: []
decisions: []
refs:
  - code://src/ahp/live.ts#L590-L631 - `parts()`, the decoder that turns `responseParts` into the turn's own parts
  - code://src/ahp/live.ts#L604-L605 - the `systemNotification` case that maps every notification, a round-ended one included, to a drawn part
  - code://src/ahp/live.ts#L546-L587 - `toolCall()`, which reads a result's `content` for text and file uris and never for the edit counts
  - code://src/ahp/types.ts#L158-L164 - `ResponsePart`, the union that gains the round-ended part
  - code://src/ahp/types.ts#L116-L117 - `ToolCallStatus`, which the protocol's `auth-required` is cast into without a member
  - code://src/ahp/types.ts#L126-L156 - `ToolCall`, which gains the per-call edit counts and the sign-in challenge
  - code://src/ahp/types.ts#L256-L279 - `FileEdit.diff`, the `{ added, removed }` a `fileEdit` tool result carries
  - code://src/blocks.ts#L30-L38 - the turn header, whose `meta` line is where a completed turn's count goes
  - code://src/blocks.ts#L40-L61 - the part switch, where a round-ended notification and an auth-required call each need a case
  - code://src/blocks.ts#L49-L54 - the `systemNotification` and `toolCall` cases as they are today
  - code://src/screens.tsx#L741 - `toBlocks(turns, queued)`, memoised into the transcript's blocks
  - code://src/screens.tsx#L895-L906 - `ChatTranscript`, which draws one row per block
  - code://src/view/customizations.tsx#L34-L43 - the MCP server state `authRequired`, which is the server's state and not this tool call's
  - code://test/smoke.test.tsx#L2316-L2328 - the `blocks` suite the two drawing cases join
  - code://test/live.test.tsx#L254-L277 - the `connect()` suite driven from a scripted host, where the decoders are checked
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L504-L509 - `systemNotificationToChatPart` settles the thinking section for `responseRoundEnded` and builds no row
  - file:///github/externals/vscode/src/vs/platform/agentHost/common/meta/agentSystemNotificationMeta.ts#L24-L25 - `ResponseRoundEnded`, the kind a round that ended with no text or tool calls carries
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts#L3375-L3398 - the completed response that aggregates its parts' edit diffs into a stats button
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatEditStatsButton.ts#L17-L48 - `aggregateChatEditDiffs` and `setDiff`, the `+A` and `-R` the response shows
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts#L5503-L5507 - `isBlockingToolState`, which counts a tool waiting for authentication as blocking
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts#L5535-L5537 - `getPersistentProgressState`, which keeps a tool in `WaitingForAuthentication` as persistent progress
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts#L2108-L2114 - the `Authentication required` persistent-progress row the reference draws
---

## Goal

Three corrections to what a chat turn draws.
A round that the host ends with neither text nor tool calls settles the reasoning above it and leaves no empty notice on screen.
A completed turn's header says how many lines its files gained and lost.
A tool call that is waiting on a sign-in draws as a blocked row of its own rather than as an ordinary call.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "systemNotification|_meta" src/ahp/live.ts` - the `_meta` reads are `progressMessage` on a running tool call and the message-level keys; `_meta.kind` on a notification is read nowhere.
- `rg -rn "responseRoundEnded" src test` - nothing in this repository names the kind.
- `rg -n "fileEdit|\.diff|edits" src/ahp/live.ts` - `diff` is read once, by the changeset decoder at `:1109`; `toolCall()` reads only `text`, `preview` and file uris.
- `rg -n "auth-required|authRequired" src test` - only the MCP server state; no tool call status carries it.
- `rg -n "ToolCallStatus" node_modules/@microsoft/agent-host-protocol/src/types/channels-chat/state.ts` - the protocol declares `auth-required` at `:1045`, and this client's union does not have it.
- `rg -n "responseRoundEnded" node_modules/@microsoft/agent-host-protocol` - nothing; the kind lives on the open `_meta` map rather than in the wire types.
- `rg -n "ChatEditStatsButton|getPersistentProgressState|mcpAuthenticationRequired" src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts` in the clone - the review's `:943-951` and `:1737,1763` have drifted at `832cf23c5`; the verified lines are the ones in the `refs` above.

### Runtime path

```
host chat/responsePart -> liveHost parts() folds responseParts -> Turn.parts in the store
  -> ChatScreen useMemo toBlocks(turns, queued) -> ChatTranscript draws one row per block
  -> responseRoundEnded: parts() keeps a part that draws nothing, which settles the reasoning above it
  -> fileEdit results: toolCall() sums diff.added and diff.removed onto the call
     -> toBlocks totals the turn's calls and writes "+A -R" on the header's meta line
  -> auth-required: toolCall() keeps the status and its challenge
     -> toBlocks draws a sign-in notice instead of a tool row
```

### Gaps

- `responseRoundEnded` is a host convention on the open `_meta` map, so neither the wire types nor this client name it today.
- No per-turn edit total exists: `ToolResultFileEditContent.diff` is dropped where a tool call is flattened, and `Turn` carries no diff of its own.
- The client's `ToolCallStatus` has no `auth-required`, so the protocol value passes through a cast and `blocks.ts` draws it as an ordinary call.
- `@textui/chat`'s `ChatToolCallStatus` has no `auth-required` either, so the row is drawn from a block kind that already exists rather than from the tool row.
- `Not found: a per-turn diff field on Turn - searched "fileEdit|edits|diff" in src/ahp/live.ts and node_modules/@microsoft/agent-host-protocol; the protocol puts edits on tool results and changesets, not on the turn.`

## Decisions locked in

No decision file is created by this plan; every choice it settles is recorded in the second table.

| # | Decision | Rationale / source |
| --- | --- | --- |

| What | Source | Task |
| --- | --- | --- |
| A notification is matched on `_meta.kind`, and `responseRoundEnded` becomes a part that draws nothing | `(defaulted: the reference reads the same key at file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L505-L508)` | 01 |
| The round-ended part stays in `Turn.parts`, so the part above it is no longer last, and `toBlocks` also closes that block explicitly | `(defaulted: streaming is already a field on the reasoning block)` | 01 |
| Every other notification kind keeps drawing its notice, content or no content | `(defaulted: only responseRoundEnded is named by the reference)` | 01 |
| The per-turn count is summed from the `fileEdit` diffs on the turn's own tool results | `(defaulted: ToolResultFileEditContent carries diff and the result is already read for its files)` | 02 |
| The count is drawn as `+A -R` on the header's `meta` line, and nothing is drawn when both totals are zero | `(defaulted: the header is the turn's own row, and its meta already carries the elapsed time)` | 02 |
| A tool call in `auth-required` is drawn as one notice row naming the call and the server, not as a tool row | `(defaulted: @textui/chat has no auth-required status, and a notice is the one row that neither reads as running nor claims the turn failed)` | 03 |
| The tool-level `auth-required` stays apart from the MCP server state `authRequired`, which the customizations panel already draws | `code://src/view/customizations.tsx#L34-L43` | 03 |

## Proposed architecture

- **Data flow** - `parts()` reads `_meta.kind` and emits a `roundEnded` part for `responseRoundEnded`, and `toolCall()` sums each `fileEdit` result's `diff` onto the call and keeps the protocol's status with its auth challenge. Nothing above `live.ts` sees the wire.
- **Event flow** - a delta or a tool-call event already rewrites the whole turn list through `writeTurns`, so every correction here arrives as a redraw of the same blocks and needs no new event.
- **State flow** - `TURNS` stays the only conversation state: the round-ended part lives inside `turn.parts`, the edit counts live on the `ToolCall` that earned them, and no second store key or per-turn cache is introduced.
- **Layer responsibilities** - `src/ahp/live.ts`: read `_meta.kind`, sum the diffs, keep the status and the challenge · `src/ahp/types.ts`: the `roundEnded` part variant, `ToolCall.edits` and `ToolCall.auth` · `src/blocks.ts`: the row each of the three draws · `src/screens.tsx`: unchanged, it already memoises `toBlocks`.
- **Source-of-truth files** - `code://src/ahp/live.ts`, `code://src/ahp/types.ts`, `code://src/blocks.ts`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A round-ended notification draws nothing](task-01-response-round-ended.md) | todo | - |
| [02 - The turn header carries its edit counts](task-02-edit-stats.md) | todo | - |
| [03 - A tool waiting on a sign-in is its own row](task-03-auth-required-state.md) | todo | 02 |

## Risks and tradeoffs

- Tasks 02 and 03 both edit `toolCall()` and the `toolCall` case in `toBlocks`, so 03 is ordered behind 02 and rebases on it.
- A host that sends no `diff` on a `fileEdit` shows no count, which is the honest answer rather than a zero.
- The header's `meta` line already carries `running` or the elapsed time, and a wide count is truncated by the component at a narrow width rather than wrapped.
- Reading `_meta.kind` is reading an open map, so the check is one string comparison and an unknown kind keeps its notice.
- The round-ended part is invisible, so a find over the transcript cannot land on it, which matches a row that is not drawn.

## Resume state

- **Done so far:** nothing; the plan is written and no code is touched.
- **Next action:** [task-01-response-round-ended.md](task-01-response-round-ended.md).
- **Open questions:** none.
- **Watch out for:** `parts()` is also where a failed turn's `error` part is decoded, so the new case belongs inside the `systemNotification` case rather than beside it. `ToolCallStatus` is cast from a string today, so adding the member also means removing the blind cast.

## Final verification checklist

- [ ] `test/live.test.tsx` holds a scripted turn whose parts end with a `responseRoundEnded` notification, and the reader's turn has no notice part.
- [ ] `test/smoke.test.tsx` holds the round-ended, edit-count and sign-in block cases.
- [ ] `npm test` green.
- [ ] `npm run typecheck` green.
- [ ] `plans/index.md` updated.
