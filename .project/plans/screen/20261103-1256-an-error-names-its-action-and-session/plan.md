---
title: An error on the screen names its action and its session, and stays on that session
domain: screen
status: active
priority: high
created: 2026-11-03
revalidated: 2026-11-03
refs:
  - git://fd341f0 - the commit of this repository the facts were checked at
  - git://c97d8459 - the ahpd commit read for the refusal
  - "[code://src/control.ts#L484-L498](../../../../src/control.ts#L484-L498) - `failed` and `told`, which send every refusal to one slot with no action and no session"
  - "[code://src/control.ts#L87](../../../../src/control.ts#L87) - `Controller.report`, which the screens call with an error only"
  - "[code://src/control.ts#L826-L881](../../../../src/control.ts#L826-L881) - `open`: \"mark as read\" through `told`, the subscription, and `host.detail` whose `catch` reports without a check of `OPEN`"
  - "[code://src/control.ts#L883-L895](../../../../src/control.ts#L883-L895) - `close`, which leaves `HOST_ERROR` as it is"
  - "[code://src/control.ts#L1028-L1034](../../../../src/control.ts#L1028-L1034) - `disposeSession`, which reports and then closes"
  - "[code://src/screens.tsx#L288-L290](../../../../src/screens.tsx#L288-L290) - the session list asks `detail` for the highlighted row and reports a refusal"
  - "[code://src/state.ts#L482-L485](../../../../src/state.ts#L482-L485) - `reportHostError`, which writes `HOST_ERROR`"
  - "[code://src/ahp/auth.ts#L23-L24](../../../../src/ahp/auth.ts#L23-L24) - `WRAPPER`, the pattern for the SDK's `RPC error <code>: ` start"
  - "[code://src/ahp/live.ts#L2080-L2092](../../../../src/ahp/live.ts#L2080-L2092) - `sent`, which waits `ANSWER_MS`, ten seconds, for an echo"
  - "[code://test/smoke.test.tsx#L1859-L1891](../../../../test/smoke.test.tsx#L1859-L1891) - the test of a -32001 refusal on the session list"
  - "[code://src/i18n/en/commands.ts#L154-L155](../../../../src/i18n/en/commands.ts#L154-L155) - the catalogue keys for the screen's own refusals"
---

## Goal

Every refusal on the status row says which action failed and on which session.
A refusal of one session does not show on the page of another session or on the new session page.
On 2026-11-03, Softov opened a session that the host could not serve, then went to a new session.
The new session page showed `RPC error -32001: No agent for session dsh:/session-… (-32001)`, and ten seconds later "The host did not answer in 10 seconds".
Nothing said that both lines were about the first session.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.
The brief `briefs/an-error-names-its-session.md` was never committed; this plan holds all of it.

### Searches performed

- `grep -n "failed(\|told(" src/control.ts` - 17 calls; 9 `told` calls send an action on a session.
- `grep -rn "controller.report(" src/screens.tsx` - 9 calls, each after a read the screen asked for.
- `grep -rn "HOST_ERROR" src` - a snapshot, `refresh` and a changes answer clear it; `open` and `close` do not.
- `grep -rn "No agent for session" ahpd/packages/sdk/src` - ahpd refuses with -32001 at four places in `sessionmethods.ts`.

### Runtime path

```
open(uri) -> told(setRead) + subscribe + detail(uri).catch(failed) -> reportHostError -> HOST_ERROR -> app.tsx status row
```

### Gaps

- `failed`, `told` and `report` take no action and no session.
- `open` and `close` leave the last refusal on the row.
- A refusal that arrives after the person moved on is drawn on the new page.
- The code of an RPC error shows twice.
- A refusal that no reader claimed goes from `onRefusal` to the row with no session and no check of `OPEN`.
- The session list reads the highlighted session, and the host's refusal of that read reaches the row as well as the pane.
- The session list subscribes to each row the highlight passes, with no wait.

## Answers

| What | Source | Task |
| --- | --- | --- |
| A refusal starts with its action and its session | Softov, 2026-11-03: "It could have like a prefix to know what." | 01 |
| A refusal of one session does not show on another session's page | Softov, 2026-11-03: "Prefix and scope" | 02 |
| The form is `<action>, <session>: <reason>`, and `<action>: <reason>` with no session | `(defaulted: the shortest form that says both)` | 01 |
| The session is its title from the list, or its URI when the list has no title | `(defaulted: a title is what the person sees; a URI never misleads)` | 01 |
| The `RPC error <code>: ` start is removed with `WRAPPER`, and the code is shown once at the end | `(defaulted: one copy of the code)` | 01 |
| An error of the screen itself, such as "not an agent-host-session:// link", keeps its own sentence | `(defaulted: it already says what it is about)` | 01 |
| An `error` event of the open session's subscription keeps its text | `(defaulted: it is about the session on screen, and the subscription closes when another opens)` | 01 |
| The action names are catalogue keys in English, Portuguese and Spanish | `(defaulted: every screen string goes through the catalogue)` | 01 |
| `open` and `close` clear the row | `(defaulted: the page that the refusal was about is gone)` | 02 |
| A refusal that arrives after `OPEN` changed is not drawn | `(defaulted: drawn, it is the line Softov saw)` | 02 |
| A refusal of a read that the session list started shows in the pane only, not on the row | Softov, 2026-11-03: "Pane only" | 03 |
| A refusal that no reader claimed is named `Read session` for a channel, and `Send` for a dispatch | `(defaulted: the two kinds the connection can tell apart)` | 03 |
| A refusal of a channel that is not a session or a chat keeps its message | `(defaulted: it is not about a session)` | 03 |
| The session list reads a session only after the highlight stays on it for 300 ms | Softov, 2026-11-03: "Wait 300 ms" | 03 |
| A dispatch to a refused channel still waits ten seconds | Not asked for; out of this plan | - |

## Proposed architecture

- **Data flow** - `failed(error, about?)` and `told(sending, about?)` take `{ action, session? }`. The prefix is written in one function, `refusal(about, reason)`. `Controller.report` passes `about` through.
- **State flow** - `failed` reads `OPEN` when the call is made, and draws the refusal only if `OPEN` is the same when it arrives. `open` and `close` set `HOST_ERROR` to `null`.
- **Layer responsibilities** - `src/control.ts`: the prefix, the check of `OPEN`, the clears · `src/screens.tsx`: names the action at each `report` · `src/i18n/*/commands.ts`: the action names.
- **Source-of-truth files** - [`code://src/control.ts`](../../../../src/control.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A refusal names its action and its session](task-01-a-refusal-names-its-action-and-session.md) | implemented | - |
| [02 - A refusal stays on the page it came from](task-02-a-refusal-stays-on-its-page.md) | implemented | 01 |
| [03 - A channel refusal names its session, or stays in the pane](task-03-a-channel-refusal-names-its-session.md) | todo | 02 |

## Risks and tradeoffs

- A refusal that arrives after the person moved on is lost - a refused action changed nothing, so the person can do it again.
- The status row text changes - the pending checks for screen/09, 10 and 11 read the row, and their files get the new text.

## Resume state

- **Done so far:** tasks 01 and 02 are implemented and merged in PR 3. See [implemented.md](implemented.md). The check by hand on 2026-11-03 found the `onRefusal` path.
- **Next action:** [task-03-a-channel-refusal-names-its-session.md](task-03-a-channel-refusal-names-its-session.md).
- **Open questions:** none.
- **Watch out for:** `disposeSession` reports and then closes; with task 02, the close would clear the report. Report after the close.

## Final verification checklist

- [ ] `npm run typecheck` and `npm test` pass.
- [ ] Against ahpd, opening a session with no agent and then pressing `ctrl+n` leaves the new session page with no refusal.
- [ ] Against ahpd, a refused action on the open session shows its action and the session title.
