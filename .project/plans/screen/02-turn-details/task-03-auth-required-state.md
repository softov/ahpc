---
title: A tool call waiting on a sign-in draws as a blocking row of its own
status: done
depends: [task-02-edit-stats.md]
layer: src/blocks.ts
refs:
  - code://src/ahp/types.ts#L116-L117 - `ToolCallStatus`, which gains `auth-required`
  - code://src/ahp/types.ts#L126-L156 - `ToolCall`, which gains the sign-in challenge
  - code://src/ahp/live.ts#L546-L587 - `toolCall()`, where the status is cast and the challenge is dropped
  - code://src/blocks.ts#L52-L54 - the `toolCall` case that forwards every status
  - code://src/view/customizations.tsx#L34-L43 - the server-level `authRequired`, which this row is not
  - code://test/live.test.tsx#L254-L277 - the scripted-host suite where the status is decoded
  - code://test/smoke.test.tsx#L2316-L2328 - the `blocks` suite where the row is checked
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts#L5503-L5507 - `isBlockingToolState`, which counts a tool waiting for authentication as blocking
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts#L5535-L5537 - `getPersistentProgressState`, which keeps a tool in `WaitingForAuthentication` as persistent progress
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/widget/chatListRenderer.ts#L2108-L2114 - the `Authentication required` row the reference draws for it
---

## Objective

A tool call whose host status is `auth-required` draws as one sign-in notice naming the call and the server, never as an ordinary tool row, and the MCP server's own `authRequired` state still draws in the customizations panel.

## Files

- `UPDATE: src/ahp/types.ts:116-117` - add `'auth-required'` to `ToolCallStatus`.
- `UPDATE: src/ahp/types.ts:126-156` - `ToolCall` gains `auth?: { resource: string; name?: string; reason?: string; description?: string }`.
- `UPDATE: src/ahp/live.ts:546-587` - map `call.status` onto the union without the blind cast, and when the status is `auth-required` read `call.auth.resource.resource`, its `resource_name`, its `reason` and its `description`.
- `UPDATE: src/blocks.ts:52-54` - in `case 'toolCall'`, when the call's status is `auth-required`, push a `notice` naming the call and the server and do not push the tool block.
- `UPDATE: test/live.test.tsx:254-277` - the `connect()` suite gains an auth-required tool call.
- `UPDATE: test/smoke.test.tsx:2316-2328` - the `blocks` suite gains the row cases.

## Steps

1. Add the status member and remove the cast, so a status this client does not know is handled deliberately rather than passed through as a string.
2. Read the challenge from `call.auth`: the protected resource's `resource` URL is what a person can act on, `resource_name` is the readable name when the host sends it, and `reason` and `description` are the host's own words for why.
3. Compose one sentence naming the call and then the server, as in `read_file needs a sign-in: https://api.github.com`, and use `description` or `reason` only when the host sent one.
4. Draw it as a `notice` block with the call's id and the turn's id, so the transcript has one row that neither reads as a running tool call nor claims the turn failed.
5. Leave `src/view/customizations.tsx` alone: the MCP server state is a different fact about a different thing, and it keeps its `sign in` row.

## Validation

- `test/live.test.tsx` in the `connect()` suite: a scripted tool call with `status: 'auth-required'` and an `auth` challenge yields a call whose status is the new member and whose `auth` carries the resource and the reason.
- `test/smoke.test.tsx` in `describe('blocks')`: a `Turn` with an auth-required call maps to `['header', 'notice']` and the notice names the tool and the server; a `running` call still maps to `['header', 'tool']`.
- `test/customizations.test.tsx` stays green, so the server-level state is untouched.
- `npm test` green.
- `npm run typecheck` green.

## Resume

Done 2026-09-20.
`ToolCallStatus` gained `auth-required`, `ToolCall` gained `auth`, and `toolCall()` maps the host's status through an explicit table and reads the challenge from `call.auth`.
`toBlocks` draws an `auth-required` call as one `notice` naming the call and the server, and a tool row keeps the narrowing so `@textui/chat` never sees the new status.
`screens.tsx` narrows the pending input in a small `hitlInput` helper for the same reason, which the plan did not name; see implemented.md.
`test/live.test.tsx` covers the decoded call in `a call waiting on a sign-in`, `test/smoke.test.tsx` covers the notice and the running row, and `test/customizations.test.tsx` is green.
Nothing is left.
