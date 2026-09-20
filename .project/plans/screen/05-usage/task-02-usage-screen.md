---
title: A usage screen shows what the open chat has spent
status: done
depends: [task-01-usage-data.md]
layer: screen
refs:
  - code://src/screens.tsx#L1788-L1820 - `SkillsScreen` and `McpScreen`, the smallest screens to sit beside
  - code://src/screens.tsx#L1873-L1919 - `HostsScreen`, which asks `controller.agents()` and lists what a harness offers
  - code://src/app.tsx#L491-L526 - the component registration list
  - code://src/app.tsx#L538-L558 - the screen registration list
  - code://src/control.ts#L1393-L1410 - `go.skills` and `go.mcp`, the Screens command pattern
  - code://src/control.ts#L2494-L2526 - the chat-scoped letter bindings, where `u` goes
  - code://src/state.ts#L25 - `TURNS`, the store key the screen reads
  - code://src/state.ts#L196 - `OPEN`, the gate the command's `when` reads
  - code://src/ahp/fake.ts#L948-L975 - the fixture's claude models, which gain a context window
  - code://src/ahp/fake.ts#L1135-L1138 - the agent turn `reply()` builds, which gains a usage report
  - code://test/usage.test.tsx - the screen test this task creates
  - code://test/changes.test.tsx#L22-L40 - the `renderApp` over `fakeHost` harness the new test copies
  - file:///github/externals/vscode/src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/stateToProgressAdapter.ts#L628-L661 - `formatTurnResponseDetails` and `formatTurnModelName`, the reference's footer
---

## Objective

`usage` is a screen reached by `u` on the chat and by `go.usage` in the palette, and it draws one row per turn of the open chat with its prompt, completion and cached tokens and its cost, the model that turn billed to with what automatic routing resolved to, the session total the host reports, and the model's context window against the most recent turn's prompt tokens.

## Files

- `CREATE: test/usage.test.tsx` - the screen test.
- `UPDATE: src/screens.tsx:1788-1820` - `UsageScreen` beside `McpScreen`, reading `TURNS` and the catalogue.
- `UPDATE: src/app.tsx:504-515` - `['UsageScreen', UsageScreen]` in the component list, and the import at `:23-25`.
- `UPDATE: src/app.tsx:538-555` - `{ id: 'usage', component: 'UsageScreen' }` in the screen list.
- `UPDATE: src/control.ts:1393-1410` - `go.usage` beside `go.mcp`, `category: 'Screens'`, `when: OPEN`.
- `UPDATE: src/control.ts:2523-2526` - `{ keys: 'u', commandId: 'go.usage', scopeId: CHAT_SCOPE }`.
- `UPDATE: src/ahp/fake.ts:948-975` - a `contextWindow` on each claude model.
- `UPDATE: src/ahp/fake.ts:1135-1138` - a `usage` on the agent turn `reply()` builds.

## Steps

1. `UsageScreen` in `src/screens.tsx`: `useStoreValue<Turn[]>(TURNS, [])`, `const session = openSession(app.store)`, and `useState<Agent[]>([])` filled by `controller.agents()` in a `useEffect` the way `HostsScreen` does at `:1879-1881`.
2. The catalogue row is the session's own harness, `agents.find((one) => one.provider === session?.provider)`, and the row for a turn is `models.find((one) => one.id === (turn.usage?.model ?? turn.model?.id))`.
3. For each turn with a `usage`, draw the billed model: when `usage.resolvedModel` is set the row reads the requested id, an arrow, and the resolved id, otherwise it reads `usage.model`, else `turn.model?.id`, else the sentence "the host did not say".
4. Draw the counts on the row as the input tokens under `in` and the output tokens under `out`, with the cache-read tokens under `cached` when the host sent them, and the cost with the word credits beside it when there is one.
5. A turn with no `usage` draws one muted row saying it reported nothing, which is the reference's `hasReportedUsage` answer and not a row of zeroes.
6. Above the rows draw the session total from the last turn that has a `usage.sessionCost`, or the sum of the per-turn costs when no turn has one, and the context line from the most recent turn that has a usage and a resolvable model row: the turn's input tokens, a slash, and the row's `contextWindow` when it carries one, and one sentence saying the host does not say when it does not.
7. Register the component and the screen in `src/app.tsx`, add `go.usage` in `src/control.ts` with `when: OPEN`, and bind `u` in the chat scope beside `p`.
8. Give the fixture a `contextWindow` on each claude model at `src/ahp/fake.ts:948-975` and a `usage` on the agent turn `reply()` builds at `:1138`, so the screen test has real numbers.

## Validation

- `test/usage.test.tsx` uses `renderApp` with `fakeHost` as `test/changes.test.tsx` does: `go.usage` pushes the `usage` screen; `u` on the chat reaches it; a row shows the model, both token counts and the cost; the context line shows the window against the latest turn; a session whose turns carry no usage shows the "nothing reported" row and no context line.
- `test/fake.test.ts` and every case that counts the fixture's models or turns stay green.
- `npm test` green.
- `npm run typecheck` green.
- By hand: open a session, press `u`, and read the numbers against what the host reported.

## Resume

Done 2026-09-20.
`UsageScreen` in `src/screens.tsx` reads `TURNS` and the session's own catalogue row, one row per agent turn with its tokens and cost, the session total the host reports, and the context window against the most recent turn.
It is registered in `src/app.tsx`, reached by `go.usage` in the palette and by `u` in the chat scope in `src/control.ts`.
The fixture's claude models carry a width and `reply()` builds a turn with a usage report, and `test/usage.test.tsx` covers the command, the key, a row, the context line and the nothing-reported session.
Nothing is left, and the plan's own verification against a live host is the one thing a person still has to do.
