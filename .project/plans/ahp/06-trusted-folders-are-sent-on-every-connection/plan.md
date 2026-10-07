---
title: Trusted folders are sent to the host on every connection
domain: ahp
status: active
priority: high
created: 2026-10-07
revalidated: 2026-10-07
decisions:
  - decisions/a-folder-is-trusted-by-config-or-by-flag.md
refs:
  - "[code://src/connect.ts#L18-L40](../../../../src/connect.ts#L18-L40) - `Where`, what both front ends pass to `connect`"
  - "[code://src/connect.ts#L124](../../../../src/connect.ts#L124) - `onConnected` sends tokens on every connection; trust goes beside it"
  - "[code://src/ahp/tokens.ts#L63](../../../../src/ahp/tokens.ts#L63) - `pushTokens`, the pattern `pushTrust` mirrors"
  - "[code://src/ahp/live.ts#L68](../../../../src/ahp/live.ts#L68) - `onConnected`, called after the first connection and after each reconnect"
  - "[code://src/ahp/live.ts#L2221-L2224](../../../../src/ahp/live.ts#L2221-L2224) - `dispatch`, which sends an action as it is"
  - "[code://src/ahp/live.ts#L2365](../../../../src/ahp/live.ts#L2365) - how `createSession` writes a folder as a URI"
  - "[code://src/config.ts#L8-L65](../../../../src/config.ts#L8-L65) - the config keys; `trust` is added here"
  - "[code://src/cli/main.ts#L232-L255](../../../../src/cli/main.ts#L232-L255) - `where()`, which reads `--cwd` and the config file"
  - "[code://src/tui.tsx#L219](../../../../src/tui.tsx#L219) - the screen's `--path`"
  - "[code://test/reconnect.test.ts#L1576-L1631](../../../../test/reconnect.test.ts#L1576-L1631) - the test that a token is sent on every connection, the template for the trust tests"
  - https://github.com/softov/ahpd - ahpd 0.10.0 reads `workspaceTrust` from `root/configChanged`, the way VS Code sends it
---

## Goal

ahpc tells each host which folders it trusts, the way VS Code does.
Then a Claude or pi session that ahpc starts in a trusted folder loads the project's own files, and an ACP agent runs there.
A folder is trusted when it is in the config list, or when a command names it with `--cwd` and `--trust`.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg "workspaceTrust|trustedUris|rootConfig" src test` - nothing; ahpc sends no root config today.
- `rg "ahp-root://" src/ahp/live.ts` - the root channel is used only for requests and the subscription, never for an action.

### Runtime path

```
config.json `trust` + `--trust --cwd` -> Where.trust -> connect() -> onConnected -> pushTrust -> dispatch root/configChanged on ahp-root:// -> host trusts the folders
```

### Gaps

- `Where` has no field for trusted folders.
- `Config` has no `trust` key.
- Nothing sends `root/configChanged`.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [A folder is trusted by the config list or by --trust, never by --cwd alone](../../../decisions/a-folder-is-trusted-by-config-or-by-flag.md) | Softov, 2026-10-07 |

| What | Source | Task |
| --- | --- | --- |
| The action is `{ type: 'root/configChanged', config: { workspaceTrust: { enabled: true, trustedUris } } }` on `ahp-root://`, the shape VS Code sends | ahpd 0.10.0 and a VS Code wire capture | 01 |
| It is sent on every connection, reconnects included, because the host keeps trust per connection | ahpd decision `the-sender-decides-on-a-host-with-no-people` | 01 |
| An empty list sends nothing | `(defaulted: nothing sent is the same as untrusted, and sends no frame for nothing)` | 01 |
| A folder is written as `pathToFileURL(resolve(path)).href`; a leading `~` is the home folder | `(defaulted: a path with a space must match on the host, which decodes file URIs)` | 01 |
| The screen takes `--trust` for its `--path`; a workspace picked later is not trusted unless it is in the list | decision 1 | 01 |
| A failure to send is swallowed, as `pushTokens` does | [code://src/ahp/tokens.ts#L63](../../../../src/ahp/tokens.ts#L63) | 01 |

## Proposed architecture

- **Data flow** - `where()` and the screen read `trust` from the config file and add `--cwd` or `--path` when `--trust` is set. The list goes to `connect` as `Where.trust`.
- **Event flow** - `onConnected` calls `pushTokens` and then `pushTrust`, on the first connection and on each reconnect.
- **State flow** - nothing is kept; the list is read from `Where` each time.
- **Layer responsibilities** - `src/ahp/trust.ts`: `trustedUris(paths)` and `pushTrust(host, uris)` · `src/connect.ts`: wires them · `src/cli/main.ts`, `src/tui.tsx`: build the list.
- **Source-of-truth files** - [`code://src/ahp/trust.ts`](../../../../src/ahp/trust.ts)

```ts
// src/ahp/trust.ts
export function trustedUris(paths: readonly string[]): string[];
export async function pushTrust(
  host: { dispatch?(uri: string, action: unknown): unknown },
  uris: readonly string[],
): Promise<void>;
// src/connect.ts
export interface Where { /* ... */ trust?: string[] }
// src/config.ts
export interface Config { /* ... */ trust?: string[] }
```

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The host is told the trusted folders on every connection](task-01-the-host-is-told-the-trusted-folders.md) | implemented | - |
| [02 - Docs](task-02-docs.md) | implemented | 01 |

## Risks and tradeoffs

- A list with a parent folder such as `/github` trusts every project under it. The README says so.
- `createSession` writes its folder with plain `file://` and no encoding. The host compares folders, not text, so the two spellings meet.

## Resume state

- **Done so far:** both tasks. `src/ahp/trust.ts` exists with `trustedUris` and `pushTrust`. `connect` calls `pushTrust` after `pushTokens` on every connection. The CLI and the screen build `Where.trust` from the config list, and add `--cwd` or `--path` when the run says `--trust`. `README.md` documents the key and the flag, and `test/trust.test.ts` holds eight cases. See [implemented.md](implemented.md).
- **Next action:** none. The one checklist item left is the run against a live ahpd 0.10.0.
- **Open questions:** none.
- **Watch out for:** the fake host never calls `onConnected`, so the trust tests use the scripted live host.

## Final verification checklist

- [x] `npm run typecheck` and `npm test` pass.
- [ ] Against ahpd 0.10.0, a Claude session in a folder from the list loads the project's `CLAUDE.md`. Needs a live host, so it is left to Softov.
- [x] `plans/index.md` updated.
