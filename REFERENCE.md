# Where to look things up

Two things outside this repository decide whether it is correct, and neither is
a dependency: nothing here imports them and nothing here builds against them.
They are read.

The host side of the same pass is `REFERENCE.md` in `ahpd`, and the two
repositories are separate on purpose - they share no package. This file covers
what this client is read against; for what this client does with an answer, see
[docs/DESIGN.md](docs/DESIGN.md) and [docs/CONFORMANCE.md](docs/CONFORMANCE.md).

## The specification

<https://microsoft.github.io/agent-host-protocol/>

Prose, and the authority on what an action means. The pages a client needs:
`specification/session-channel` for the session state a client folds,
`specification/chat-channel` for turns and messages, and `reference/session`
for `SessionState` field by field.

The prose is not the whole answer. Twice now the shape that mattered was in the
repository behind it rather than on the site - `_meta`'s well-known keys are
documented nowhere and are visible in a conformance case, and the changeset
scoping is a comment in a types file. What `docs/CONFORMANCE.md` describes is
how the gap is closed here: a strict JSON Schema generated from the package's
own declarations, `npm run wire -- <capture>` over a recording, and
`test/conformance.test.ts` over the frames a run just produced.

## The reference host

VS Code is the other implementation of this protocol, and the only one to check
a design against. It is checked out locally, sparse, because the whole of VS
Code is not the point:

```bash
git clone --filter=blob:none --sparse --depth 1 \
  https://github.com/microsoft/vscode.git /github/externals/vscode
cd /github/externals/vscode
git sparse-checkout set src/vs/platform/agentHost \
  src/vs/workbench/contrib/chat/browser/agentSessions \
  src/vs/workbench/contrib/chat/browser/actions \
  src/vs/workbench/contrib/chat/browser/chatSessions \
  src/vs/workbench/contrib/chat/common
```

It is **MIT-licensed**: read it for the design, and keep the prose here ours.
Nothing has been copied and nothing should be.

**Last read against:** VS Code `8e35945b` (2026-09-12) and the protocol
repository at `a21274d` (2026-09-12), on 2026-09-13. What each pass found and
what it asked of this repository is [UPSTREAM.md](UPSTREAM.md); the next pass
starts from these two revisions rather than from wherever the clone was left.
`git log <that>..HEAD -- src/vs/workbench/contrib/chat` is the client half of
the list, and `src/vs/platform/agentHost/common/state/protocol/` is the
directory to read first, because it is the wire. The `.md` files there were
reflowed to one-line paragraphs in September 2026, so read them with
`git diff --word-diff`; a plain diff of one is the whole file.

What is in it, and why each part earned its keep here:

| path | what it settled |
| --- | --- |
| `src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/` | the window that talks to a host: what VS Code **sends** to one and what it reads back. `agentHostSessionHandler.ts` is the session lifecycle, `stateToProgressAdapter.ts` turns host state into the line a turn shows, `agentSessionApprovalModel.ts` is how an approval a host asks for is answered, and `openSessionLinkOpener.contribution.ts` is the click on an `agent-host-session://` link |
| `src/vs/workbench/contrib/chat/browser/widget/` | how that window draws a turn - `chatListRenderer.ts`, the progress, subagent and thinking parts, the tool confirmation parts. It is the second opinion on what a client must be able to draw from state alone, which is the whole of what this client does |
| `src/vs/platform/agentHost/common/state/protocol/` | the wire. Read it first, because everything here is an implementation of it, and it is unchanged more often than not |
| `src/vs/platform/agentHost/common/openSessionLink.ts` | the `agent-host-session://` link a host's tools answer with, and the scheme this client opens from a transcript |
| `src/vs/platform/agentHost/common/state/sessionTransport.ts` | the transport seam, and the reconnect a client has to survive without losing the state it already folded |
| `src/vs/platform/agentHost/node/shared/sessionServerTools.ts`, `common/serverToolNames.ts` | the tools a host gives the agent, and the names this client's tool server has to agree with when an agent elsewhere drives a session here |

Read it when a design question has an answer somebody has already had to find.
Do not read it to decide what this client should be: it is an editor's window,
and this one is a terminal.

## The fake host

[`src/ahp/fake.ts`](src/ahp/fake.ts) is the scripted host the screen runs
against with nothing else set up. It is half of every check here: a screen that
works against [`src/ahp/live.ts`](src/ahp/live.ts) and not against the fake has
a state assumption neither of them states. `--wire <file>` writes what actually
crossed, either way, in the lines `ahpd --wire` writes, so a disagreement is
read from the capture rather than argued.

## What this repository is building

`.project/` is the record of what is planned, decided and set aside, and it
is read before code is proposed. [`.project/plans/index.md`](.project/plans/index.md)
is the entry: one row per plan, and a reference file per domain
(`plans/<domain>/00-<domain>.md`) saying what exists today. A plan is a
folder with a `plan.md`, one file per task, and `implemented.md` once it is
built. Every decision is a file under `decisions/`; a plan only links them,
and a choice with no file is not a decision. What is not planned yet is one
file each under `ideas/`, and a plan starts from one of them.

The format is specai 0.1, and the rules are in the `do-spec` skill under
[`.agents/skills/do-spec/`](.agents/skills/do-spec/SKILL.md): frontmatter on
every file, a path is an identity and nothing is moved, and every plan,
task and decision names the code it is about as `code://<path>`, which is
how to find what has been decided about a file:
`rg -n "code://src/state.ts" .project/`.
