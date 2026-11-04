---
title: The provider is the host's first agent, not claude
domain: screen
status: built
priority: high
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://e8c5a80 - the commit the facts were checked at, and the last commit that holds briefs/doc-pictures-come-from-a-seeded-test-host.md
  - "[code://src/control.ts#L352](../../../../src/control.ts#L352) - the provider is `claude` until the host says otherwise"
  - "[code://src/control.ts#L1253-L1262](../../../../src/control.ts#L1253-L1262) - `settings`, which asks `resolveConfig` for the provider"
  - "[code://src/control.ts#L1417](../../../../src/control.ts#L1417) - the command gates, which find the agent by the provider"
  - "[code://src/control.ts#L1443-L1456](../../../../src/control.ts#L1443-L1456) - `listAgents`, which reads the host's agents"
  - "[code://src/control.ts#L977](../../../../src/control.ts#L977) - an open session sets the provider"
  - "[code://src/control.ts#L2398](../../../../src/control.ts#L2398) - a picked agent sets the provider"
  - "[code://src/screens.tsx#L580-L593](../../../../src/screens.tsx#L580-L593) - the effect that reads the settings on the new session screen"
---

## Goal

A host with no `claude` agent shows no error when ahpc starts.
On 2026-11-04, every still against the `notes` example host drew `Read settings: No provider called claude (-32002)` in red.
The provider starts empty, and becomes the first agent the host lists.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `rg "'claude'" src/control.ts` - line 352 sets it, and lines 1258 and 1417 fall back to it.
- `rg "store.set\(PROVIDER" src` - three writers: boot, an open session, a picked agent.

### Runtime path

```
boot -> PROVIDER '' -> listAgents -> PROVIDER = first agent -> settings() -> resolveConfig(provider)
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| Fixed in this change, not left as a problem | Softov, 2026-11-04: "Fix it in this plan" | 01 |
| The provider starts empty, and becomes the first agent the host lists | Softov, 2026-11-04: "Fix it in this plan" (the fix as asked) | 01 |
| Settings are not read while the provider is empty | (defaulted: a read with no provider is the refusal this removes) | 01 |
| An open session and a picked agent still set the provider | (defaulted: unchanged) | 01 |
| A host that lists no agent leaves the provider empty and reads nothing | (defaulted: there is nothing to start a session with) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The provider comes from the host](task-01-the-provider-comes-from-the-host.md) | done | - |

## Risks and tradeoffs

- A host that lists `claude` second starts on its first agent. That is the host's order, and the picker changes it.

## Resume state

- **Done so far:** planned and built 2026-11-04; see [implemented.md](implemented.md).
- **Next action:** none.
- **Open questions:** none.
- **Watch out for:** the scripted host lists `claude` first, so the existing tests keep their provider.

## Final verification checklist

- [x] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
- [x] Against a host with no `claude` agent, the screen starts with no error.
