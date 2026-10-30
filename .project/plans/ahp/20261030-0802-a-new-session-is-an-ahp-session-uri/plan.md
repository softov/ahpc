---
title: A new session is an `ahp-session:` URI
domain: ahp
status: planned
priority: high
created: 2026-10-30
revalidated: 2026-10-30
refs:
  - "[code://src/ahp/live.ts#L2383-L2418](../../../../src/ahp/live.ts#L2383-L2418) - `createSession` names a new session `${provider}:/<uuid>`, with a comment on why"
  - "[code://src/links.ts#L61-L70](../../../../src/links.ts#L61-L70) - `sessionOfLink`, whose comment says this client starts a session as `<provider>:/`"
  - "[code://src/ahp/fake.ts#L1606](../../../../src/ahp/fake.ts#L1606) - the fake host already names a session `ahp-session:/`"
  - "[code://test/scenario.test.ts#L39-L40](../../../../test/scenario.test.ts#L39-L40) - expects a created session to start with `claude:/`"
  - file:///github/ahpd/.project/plans/host/126-a-new-session-is-an-ahp-session-uri/plan.md - ahpd holds every new session as `ahp-session:/<uuid>`, and lists ahpc's change as this repository's plan
  - git://4a658abe - the ahpd commit read
  - https://github.com/microsoft/agent-host-protocol/blob/main/docs/specification/session-channel.md - "The session's provider (e.g. \"copilot\") is **not** encoded in the URI scheme"
  - https://github.com/microsoft/vscode/commit/bd64649be19f2da0f09c2ab84c066c6c764b83be - "Use proper ahp-session: scheme URIs for new AH sessions", 2026-10-05
---

## Goal

ahpc creates every new session as `ahp-session:/<uuid>`, as the protocol and VS Code do.
The provider goes in the `provider` field of `createSession`, as it does now.
A session another client created under `<provider>:/<id>` still opens, because ahpc reads the provider from the summary.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg -n "provider}:/" src` - one place makes a session URI: `createSession` in `live.ts`.
- `rg -n "split\(':'\)|schemeOf" src` - ahpc reads no provider from a session's scheme; it reads `SessionSummary.provider`.
- `rg -n "claude:/" test` - `test/scenario.test.ts` expects the old name.

### Runtime path

```
session new / exec -> createSession { channel: ahp-session:/<uuid>, provider } -> host -> the session under that URI
```

### Gaps

- `createSession` names a session after its provider, which the protocol says not to do.
- The comment on `createSession` gives VS Code's old scheme reading as the reason. VS Code reads `provider` since `bd64649be19`.
- The comment on `sessionOfLink` says this client starts a session as `<provider>:/`.

## Answers

| What | Source | Task |
| --- | --- | --- |
| Every session ahpc creates is `ahp-session:/<uuid>`. | Softov, 2026-10-30: "update some fixes and adjusts like session ahp-session://" | 01 |
| ahpc names it so on every host, with no check of `vscode.ahpSessionUris`. | `(defaulted: VS Code checks it only for a native host, and ahpc reaches a host over a socket)` | 01 |
| `sessionOfLink` keeps its match on the id under any scheme. | `(defaulted: old sessions keep their <provider>:/ names on ahpd)` | 01 |

## Proposed architecture

- **Data flow** - `createSession` sends `ahp-session:/<uuid>` as the channel, with `provider`, and returns that URI.
- **Event flow** - no change.
- **State flow** - no change.
- **Layer responsibilities** - `src/ahp/live.ts`: the name · `src/links.ts`: comment only.
- **Source-of-truth files** - [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A new session is `ahp-session:`](task-01-a-new-session-is-ahp-session.md) | todo | - |

## Risks and tradeoffs

- A VS Code from before 2026-10-05 cannot open a session ahpc made - VS Code 1.143 reads `provider`, and ahpd makes `ahp-session:` sessions too.

## Resume state

- **Done so far:** planned 2026-10-30.
- **Next action:** [task-01-a-new-session-is-ahp-session.md](task-01-a-new-session-is-ahp-session.md).
- **Open questions:** none.
- **Watch out for:** ahpd before host/126 holds the session as `<provider>:/<id>` and keeps the `ahp-session:` URI as an alias, so both names reach it.

## Final verification checklist

- [ ] `npm run typecheck` and `npm test` pass.
- [ ] Against ahpd, `ahpc session new` prints an `ahp-session:/` URI, and `ahpc session list` lists it under that URI.
- [ ] Against ahpd, `ahpc exec hi` runs and disposes its session.
