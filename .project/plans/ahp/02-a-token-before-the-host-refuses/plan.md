---
title: Push a token before the host refuses, and look for one before asking
domain: ahp
status: planned
priority: high
created: 2026-09-24
revalidated: 2026-09-24
requires:
  - plans/ahp/01-sign-in-when-a-host-refuses/plan.md
changes: []
creates: []
decisions:
  - decisions/a-token-is-kept-for-the-process-and-never-written-down.md
  - decisions/every-declared-resource-is-authenticated-on-connect.md
refs:
  - "[code://src/connect.ts#L82-L120](../../../../src/connect.ts#L82-L120) - `connect`, the one place a connection is made and the only place an upfront push can go"
  - "[code://src/connect.ts#L72-L80](../../../../src/connect.ts#L72-L80) - the `auth` box, filled by the controller and reporting a sentence until it is"
  - "[code://src/control.ts#L498-L512](../../../../src/control.ts#L498-L512) - `askSignIn`, which opens the layer without consulting anything first"
  - "[code://src/control.ts#L524-L541](../../../../src/control.ts#L524-L541) - `signIn`, where the host takes a credential and nothing is kept"
  - "[code://src/control.ts#L486-L496](../../../../src/control.ts#L486-L496) - `settle`, the one way a waiter is answered, and its re-entrancy guard"
  - "[code://src/cli/main.ts#L1290-L1312](../../../../src/cli/main.ts#L1290-L1312) - `signIn`, the shell's chain of `--token`, the resource's variable and a pipe"
  - "[code://src/cli/main.ts#L1324-L1327](../../../../src/cli/main.ts#L1324-L1327) - `tokenVariable`, private to the shell today"
  - "[code://src/cli/main.ts#L794-L797](../../../../src/cli/main.ts#L794-L797) - `needsToken`, the sentence that promises a variable the screen ignores"
  - "[code://src/ahp/live.ts#L1386-L1387](../../../../src/ahp/live.ts#L1386-L1387) - `endpoint`, where the *connection* token is baked in once and so already lasts the process"
  - "[code://src/ahp/live.ts#L1748-L1800](../../../../src/ahp/live.ts#L1748-L1800) - the reconnect loop, which never returns to `connect` and is why an upfront push cannot live there"
  - "[code://src/ahp/live.ts#L1688-L1700](../../../../src/ahp/live.ts#L1688-L1700) - `advertised`, already reading `protectedResources` off every agent"
  - "[code://src/ahp/connection.ts#L259-L280](../../../../src/ahp/connection.ts#L259-L280) - `authenticate` and `protectedResources`, both optional on the seam"
  - "[code://src/ahp/auth.ts](../../../../src/ahp/auth.ts) - the reading and the one retry, the module this plan's new one sits beside"
  - "[code://test/auth.test.tsx](../../../../test/auth.test.tsx) - the six cases describing the prompt's loop, which must keep passing untouched"
  - npm://@microsoft/agent-host-protocol@^0.9.0 - `AgentInfo.protectedResources`, the static half of what a host wants a token for
  - file:///home/softov/projects/ahpx/src/session/connect-helper.ts#L118-L128 - `authenticateUpfront`, the same step in ahpx and the comment naming why
  - file:///home/softov/projects/ahpx/src/auth/handler.ts#L77-L93 - `resolveToken`, ahpx's chain before it prompts
  - file:///github/ahpapp/src/useResourceAuth.ts#L110-L121 - `sendSaved`, the reference's re-send, reached only by a person pressing it
  - file:///github/ahpd/packages/sdk/src/host.ts#L5647 - the host's `-32007` for a credential it does not know
  - file:///github/ahpd/packages/sdk/src/host.ts#L5589 - its `-32602` for a resource it does not advertise, which is not a bad token
  - file:///github/ahpd/packages/sdk/src/host.ts#L5656-L5680 - `connection.principal` and `connection.tokens`, kept per connection and gone after a reconnect
---

## Goal

A person signs a host in once rather than once per run, and an agent that requires a token works without a refusal having to happen first.
Today this client authenticates only when it has been refused, and asks the person every time: the screen consults neither the environment variable its own shell half documents nor anything on disk.
That leaves two holes. A host whose agent declares a required resource rejects every turn inside a session it created without complaint, which is not a refusal this client can read and so never opens the prompt. And a person who set the variable the refusal sentence told them to set is asked anyway.
There is a third, found while planning: the host keeps credentials per connection and this client's reconnect loop never returns to `connect`, so a reconnect leaves it unauthenticated with nothing to push.
This plan closes all three: a resource token is resolved from the environment and then from a cache that lives as long as the process, pushed for every declared resource on every connection including a remade one, and looked for before the prompt is ever drawn.
Nothing is written to disk, because the case a file would buy is the one the environment variable already covers.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "protectedResources|authenticate\(" src/` - this client calls `authenticate` in exactly two places, `src/cli/main.ts:1311` for the `ahpc auth` command and `src/control.ts:531` for the prompt. Nothing authenticates on connect, and `protectedResources` is asked for only by `ahpc auth` listing what a host protects.
- `rg -n "AHPC_TOKEN|tokenVariable" src/` - `tokenVariable` is private to `src/cli/main.ts` and used by `signIn` and by `needsToken`. The screen has no access to it and does not look for one.
- Read `src/ahp/live.ts:1386-1402` and `:1748-1800` - the *connection* token is baked into `endpoint` once and `openTransport` is reused by the reconnect loop, so that token already lasts the process and needs nothing. The loop builds a fresh client, resumes channels and moves to `connected` without returning to `connect`, which is why an upfront push placed in `connect` would run exactly once.
- `rg -n "RpcError\(-32007|RpcError\(-32602" /github/ahpd/packages/sdk/src/host.ts` - the host answers a credential it does not know with `-32007` and a resource it does not advertise with `-32602`, so a bad token and a bad request are distinguishable at the client.
- `rg -n "32007|rejectionReason" /github/ahpd/packages/sdk/src/host.ts` - the sibling host refuses a dispatch with `rejectionReason: reason`, a plain sentence carrying no code, which is why a refusal that is not a request rejection cannot be read as one.
- Read `/home/softov/projects/ahpx/src/auth/handler.ts` and `src/session/connect-helper.ts` - ahpx resolves explicit token, then `AHPX_TOKEN`, then a GitHub-specific source, then its stored file, and pushes for every declared resource straight after connect. Its comment names the failure this plan's task 02 is for.
- Read `/github/ahpapp/src/storage.ts` and `src/useResourceAuth.ts` - the reference keeps a token per resource in the Keychain, so both sibling clients persist and this one alone does not.
- `rg -n "sendSaved" /github/ahpapp/src/` - the reference keeps a credential and re-sends it, but only from a pressable labelled "Send the saved one": it never re-authenticates on its own, and its `forget` comment states that the host drops what it holds when the socket closes.
- `Not found: any reader of AHPC_TOKEN_* outside src/cli/main.ts - searched "AHPC_TOKEN|tokenVariable|resolveToken" in src/ and test/.`

### Runtime path

```
ahpc -> connect(Where) -> liveHost(...) -> connected
  -> [this plan, task 02] on every connection, first and remade:
     protectedResources() -> for each: resolveToken() -> authenticate(), silently, failures swallowed
     a -32007 on one of these drops the cached entry; a -32602 or a dropped link does not
  -> the screen runs, and a refusal still arrives as it does today
    -> attempt() -> askSignIn(one)
    -> [this plan, task 03] resolveToken(one.resource) first
       -> found: authenticate() -> settle(resource) -> the act runs once more, nothing drawn
       -> found but refused: forgetToken() -> fall through to the prompt
       -> nothing: the prompt, exactly as today
    -> signIn(resource, token) accepted -> [task 03] remember(resource, token), in memory, for this process
```

### Gaps

- No token is resolved anywhere but in `ahpc auth`; `src/control.ts:498` opens the layer with nothing consulted.
- The reconnect loop is inside `liveHost` and `connect`'s tail never runs again, while the host keeps credentials per connection, so every reconnect leaves this client unauthenticated.
- `tokenVariable` is unreachable from `src/control.ts`, because `src/cli/` is not something the controller may import.
- Nothing authenticates before it is refused, so an agent declaring a required resource fails per turn with no refusal this client can read.
- `Not found: any hook that fires when a connection becomes usable - searched "onConnected|onReady|moveTo\('connected'\)" in src/ahp/live.ts.` Task 02 adds one, because there are two places a connection becomes usable and both need it.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [A resource token is kept for the process and never written down](../../../decisions/a-token-is-kept-for-the-process-and-never-written-down.md) | Softov, 2026-09-24: "no file write.. memory", "we store process lifetime. repush.. and if 1th failure in auth (not a generic error) we forget", "Keep reading it, never write one". Supersedes the file-based decision of the same day. |
| 2 | [Every declared resource is authenticated on connect, silently](../../../decisions/every-declared-resource-is-authenticated-on-connect.md) | Softov, 2026-09-24: "On connect, all declared, silent". |

What this plan settled without one:

| What | Source | Task |
| --- | --- | --- |
| The cache is a module-private map in `src/ahp/tokens.ts` and never the reactive store, which keeps the superseded reasoning about a secret every screen binds to | `code://src/control.ts#L486-L496` | 01 |
| `tokenVariable` moves to `src/ahp/tokens.ts` rather than being duplicated, because the screen needs it and may not import `src/cli/` | `code://src/cli/main.ts#L1324-L1327` | 01 |
| The push is answered in `connect` but *fired* from `liveHost`, because `connect` runs once and a reconnect needs the same push | `code://src/ahp/live.ts#L1748-L1800` | 02 |
| A silently resolved token that the host refuses falls through to the prompt and the entry is dropped, rather than failing the act | decision 1's forgetting rule | 03 |
| The silent path answers waiters through the existing `settle`, so there is one way a waiter is answered and the re-entrancy guard keeps its meaning | `code://src/control.ts#L486-L496` | 03 |

## Proposed architecture

- **Data flow** - `src/ahp/tokens.ts` answers "a resource token for this, or nothing" from `AHPC_TOKEN_<RESOURCE>` and then a module-private map, and takes one back when the host says the credential is not one it knows. It is the only thing that holds a resource token.
- **Event flow** - two callers. `liveHost` fires a hook whenever a connection becomes usable and `connect` answers it by pushing for every declared resource, silently, first connection and every reconnect alike. `askSignIn` asks the same question for one resource before it draws anything, and the prompt is what happens when the answer is nothing.
- **State flow** - the store still holds no secret and `AUTH_ASK` is unchanged. The new state is a private map with the lifetime of the process, and nothing reaches disk or an environment variable.
- **Layer responsibilities** - `src/ahp/tokens.ts`: the chain, the cache and the forgetting rule, with no renderer, no store and no socket, beside `src/ahp/auth.ts` which has the same discipline · `src/ahp/live.ts`: the hook that says a connection is usable · `src/connect.ts`: answering it · `src/control.ts`: the look before the ask and the remember after the accept · `src/cli/main.ts`: gives up its private `tokenVariable` and keeps its own `--token` and pipe.
- **Source-of-truth files** - `code://src/ahp/tokens.ts` (created by task 01, so not yet a link), [`code://src/connect.ts`](../../../../src/connect.ts), [`code://src/control.ts`](../../../../src/control.ts).

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The chain and the cache](task-01-the-chain-and-the-cache.md) | todo | - |
| [02 - Pushed on every connection](task-02-pushed-on-every-connection.md) | todo | 01 |
| [03 - The prompt looks first](task-03-the-prompt-looks-first.md) | todo | 01 |

## Risks and tradeoffs

- A credential now lives longer than the prompt that collected it, which is what the first decision in this chain protected against.
  The mitigation is that it lives no longer than the process, in a module-private map rather than the reactive store, and reaches neither disk nor an environment variable. What the superseded reasoning actually guarded, a secret every screen binds to and every test dump prints, is still guarded.
- A stale cached token is a new failure mode this client did not have.
  The mitigation is the forgetting rule: a `-32007` drops the entry and the person is asked as if nothing had been cached, while a `-32602`, a dropped link or a host fault leaves it alone. Task 03 step 3 forbids resolving twice for one ask so a bad entry cannot loop.
- A host whose authentication is briefly broken answers `-32007` to a good credential and costs the person a retype.
  Accepted rather than mitigated: the failure mode is a prompt, not a lockout, and counting failures to tell a broken host from a bad token would be a second retry rule beside the one `attempt` already has.
- The push sends `authenticate` to hosts that would never have refused, now on every reconnect rather than once.
  The mitigation is that it is skipped entirely when the seam offers no `protectedResources` or no `authenticate`, and that a resource with no token resolves to nothing and is not sent. What is left is traffic proportional to what the host itself declared, on an event that is already expensive.
- Re-pushing on every reconnect is more eager than the reference, where a person presses "Send the saved one".
  Accepted deliberately: a phone reconnects on a person's schedule and a terminal reconnects on the network's, so the same rule would mean a prompt every time a link flaps. Decision 1 names this.
- A `--wire` capture now records a sign-in that nobody typed.
  The mitigation is that this was already true of `ahpc auth` and of the prompt, the flag is explicit, and no new place sends a token beyond the two this plan names.
- Authenticating the fixture would change what every existing screen test sees.
  The mitigation is task 02 step 6: the upfront push is for a live connection, and `test/auth.test.tsx` passing untouched is the check that it stayed there.
- A test that runs with a real `AHPC_TOKEN_*` exported would silently skip the prompt and pass for the wrong reason.
  The mitigation is that task 01 and task 03 both name an environment with none set, and the six existing prompt cases are the canary: they only pass when nothing resolves.

## Resume state

- **Done so far:** nothing. The plan was written on 2026-09-24 out of a comparison against ahpapp and ahpx, after plan 01 shipped, and amended the same day: the token file was dropped for a process-lifetime cache, and the reconnect question below was answered by reading the code rather than left open.
- **Next action:** [task-01-the-chain-and-the-cache.md](task-01-the-chain-and-the-cache.md).
- **Open questions:**
  1. Whether a resource's token should carry an expiry the way `ahpc auth --expires-in` allows - proposed: no, the cache holds what was typed and the host owns the lifetime, and an expiry this client invented would be a second clock.
- **Watch out for:** `--token` is the *connection* token for every command (`src/cli/main.ts:229`) and the *resource* token only for `ahpc auth` (`src/cli/main.ts:1302`). They are close enough that merging them is the obvious mistake, and this plan is about the second only: the first is already baked into `endpoint` at `src/ahp/live.ts:1386` and already lasts the process.
  A push placed in `connect`'s tail looks right and is wrong, because the reconnect loop at `src/ahp/live.ts:1748` never returns there. Task 02 step 1 exists for the session that tries it anyway.
  The prompt's existing six cases pass only when no `AHPC_TOKEN_*` is set, so a failure there after task 03 is most likely leaked environment rather than broken behaviour.

## Final verification checklist

- [ ] A token in `AHPC_TOKEN_<RESOURCE>` answers a refusal with no prompt drawn, and the refused act runs once more.
- [ ] A token cached by an earlier accepted sign-in does the same, within the same run.
- [ ] A cached token the host answers `-32007` to opens the prompt and leaves no entry behind; one it answers `-32602` to is still cached.
- [ ] A host declaring a resource this process has a token for is authenticated on the first connection **and again after a forced reconnect**, with nothing drawn and no prompt.
- [ ] A host that serves no `protectedResources`, or whose `authenticate` throws, still yields a usable connection.
- [ ] Nothing is written to disk and no environment variable is set: no file appears across a resolve, a remember and a forget.
- [ ] `test/auth.test.tsx`'s six existing cases pass untouched.
- [ ] `npm test` and `npm run typecheck` green.
- [ ] `plans/index.md` carries the row, and `00-ahp.md` names `src/ahp/tokens.ts` and the connection hook.
