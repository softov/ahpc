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
  - decisions/a-token-is-kept-in-a-file-of-its-own.md
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
  - "[code://src/config.ts#L65-L80](../../../../src/config.ts#L65-L80) - `configHome` and `statePath`, and the rule that a program-written file sits beside `config.json`"
  - "[code://src/ahp/live.ts#L1688-L1700](../../../../src/ahp/live.ts#L1688-L1700) - `advertised`, already reading `protectedResources` off every agent"
  - "[code://src/ahp/connection.ts#L259-L280](../../../../src/ahp/connection.ts#L259-L280) - `authenticate` and `protectedResources`, both optional on the seam"
  - "[code://src/ahp/auth.ts](../../../../src/ahp/auth.ts) - the reading and the one retry, the module this plan's new one sits beside"
  - "[code://test/auth.test.tsx](../../../../test/auth.test.tsx) - the six cases describing the prompt's loop, which must keep passing untouched"
  - npm://@microsoft/agent-host-protocol@^0.9.0 - `AgentInfo.protectedResources`, the static half of what a host wants a token for
  - file:///home/softov/projects/ahpx/src/session/connect-helper.ts#L118-L128 - `authenticateUpfront`, the same step in ahpx and the comment naming why
  - file:///home/softov/projects/ahpx/src/auth/handler.ts#L77-L93 - `resolveToken`, ahpx's chain before it prompts
  - file:///home/softov/projects/ahpx/src/auth/handler.ts#L188-L233 - `storeToken` and `loadToken`, the 0600 write and the corrupt-file behaviour
  - file:///github/ahpapp/src/storage.ts#L120-L130 - the reference's Keychain, with ordinary storage as its fallback
---

## Goal

A person signs a host in once rather than once per run, and an agent that requires a token works without a refusal having to happen first.
Today this client authenticates only when it has been refused, and asks the person every time: the screen consults neither the environment variable its own shell half documents nor anything on disk.
That leaves two holes. A host whose agent declares a required resource rejects every turn inside a session it created without complaint, which is not a refusal this client can read and so never opens the prompt. And a person who set the variable the refusal sentence told them to set is asked anyway.
This plan closes both: a token is resolved from the environment and then from a file of this client's own, pushed for every declared resource when the connection comes up, and looked for before the prompt is ever drawn.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "protectedResources|authenticate\(" src/` - this client calls `authenticate` in exactly two places, `src/cli/main.ts:1311` for the `ahpc auth` command and `src/control.ts:531` for the prompt. Nothing authenticates on connect, and `protectedResources` is asked for only by `ahpc auth` listing what a host protects.
- `rg -n "AHPC_TOKEN|tokenVariable" src/` - `tokenVariable` is private to `src/cli/main.ts` and used by `signIn` and by `needsToken`. The screen has no access to it and does not look for one.
- `rg -n "configPath|statePath|0o600" src/` - `statePath` exists for exactly this and is used by nothing yet; its comment says a program-rewritten file goes beside `config.json` rather than in it. No file in this client is written with restricted permissions today.
- `rg -n "32007|rejectionReason" /github/ahpd/packages/sdk/src/host.ts` - the sibling host refuses a dispatch with `rejectionReason: reason`, a plain sentence carrying no code, which is why a refusal that is not a request rejection cannot be read as one.
- Read `/home/softov/projects/ahpx/src/auth/handler.ts` and `src/session/connect-helper.ts` - ahpx resolves explicit token, then `AHPX_TOKEN`, then a GitHub-specific source, then its stored file, and pushes for every declared resource straight after connect. Its comment names the failure this plan's task 02 is for.
- Read `/github/ahpapp/src/storage.ts` and `src/useResourceAuth.ts` - the reference keeps a token per resource in the Keychain, so both sibling clients persist and this one alone does not.
- `Not found: any reader of AHPC_TOKEN_* outside src/cli/main.ts - searched "AHPC_TOKEN|tokenVariable|resolveToken|loadToken" in src/ and test/.`

### Runtime path

```
ahpc -> connect(Where) -> liveHost(...) -> connected
  -> [this plan, task 02] protectedResources() -> for each: resolveToken() -> authenticate(), silently, failures swallowed
  -> the screen runs, and a refusal still arrives as it does today
    -> attempt() -> askSignIn(one)
    -> [this plan, task 03] resolveToken(one.resource) first
       -> found: authenticate() -> settle(resource) -> the act runs once more, nothing drawn
       -> found but refused: forgetToken() -> fall through to the prompt
       -> nothing: the prompt, exactly as today
    -> signIn(resource, token) accepted -> [task 03] rememberToken(resource, token)
```

### Gaps

- No token is resolved anywhere but in `ahpc auth`; `src/control.ts:498` opens the layer with nothing consulted.
- Nothing this client writes is written with restricted permissions, and `statePath` has no callers.
- `tokenVariable` is unreachable from `src/control.ts`, because `src/cli/` is not something the controller may import.
- Nothing authenticates before it is refused, so an agent declaring a required resource fails per turn with no refusal this client can read.
- `Not found: a test that sets XDG_CONFIG_HOME - searched "XDG_CONFIG_HOME" in test/.` Task 01 is the first, and every task after it depends on that isolation.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [A token is kept in a file of its own, and looked for before anybody is asked](../../../decisions/a-token-is-kept-in-a-file-of-its-own.md) | Softov, 2026-09-24: "Env var, then a stored file". Supersedes `the-prompt-does-not-keep-the-secret`. |
| 2 | [Every declared resource is authenticated on connect, silently](../../../decisions/every-declared-resource-is-authenticated-on-connect.md) | Softov, 2026-09-24: "On connect, all declared, silent". |

What this plan settled without one:

| What | Source | Task |
| --- | --- | --- |
| The token file is `statePath('ahpc', 'tokens.json')` and never `configPath`, because `config.json` is hand-written and this is not | `code://src/config.ts#L72-L80` | 01 |
| `tokenVariable` moves to `src/ahp/tokens.ts` rather than being duplicated, because the screen needs it and may not import `src/cli/` | `code://src/cli/main.ts#L1324-L1327` | 01 |
| The upfront push lives in `connect` rather than in the controller, because it must happen for a shell run too and before there is a screen | `code://src/connect.ts#L82-L120` | 02 |
| A silently resolved token that the host refuses falls through to the prompt and the entry is dropped, rather than failing the act | decision 1's stale-token consequence | 03 |
| The silent path answers waiters through the existing `settle`, so there is one way a waiter is answered and the re-entrancy guard keeps its meaning | `code://src/control.ts#L486-L496` | 03 |

## Proposed architecture

- **Data flow** - `src/ahp/tokens.ts` answers "a token for this resource, or nothing", reading `AHPC_TOKEN_<RESOURCE>` and then the token file, and writes one back when a host has accepted it. It is the only thing that touches the file.
- **Event flow** - two callers. `connect` pushes for every declared resource once, at connection time, silently. `askSignIn` asks the same question for one resource before it draws anything, and the prompt is what happens when the answer is nothing.
- **State flow** - the store still holds no secret and `AUTH_ASK` is unchanged. The new state is a file, outside the process, and the only in-memory copy remains the field until it is submitted.
- **Layer responsibilities** - `src/ahp/tokens.ts`: the chain and the file, with no renderer, no store and no socket, beside `src/ahp/auth.ts` which has the same discipline · `src/connect.ts`: the upfront push · `src/control.ts`: the look before the ask and the remember after the accept · `src/cli/main.ts`: gives up its private `tokenVariable` and keeps its own `--token` and pipe.
- **Source-of-truth files** - `code://src/ahp/tokens.ts` (created by task 01, so not yet a link), [`code://src/connect.ts`](../../../../src/connect.ts), [`code://src/control.ts`](../../../../src/control.ts).

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The chain and the file](task-01-the-chain-and-the-file.md) | todo | - |
| [02 - Upfront on connect](task-02-upfront-on-connect.md) | todo | 01 |
| [03 - The prompt looks first](task-03-the-prompt-looks-first.md) | todo | 01 |

## Risks and tradeoffs

- A secret now outlives the process, which was the whole of what the superseded decision protected against.
  The mitigation is the file's own discipline: its own file and never `config.json`, 0600 through a temporary file and a rename, 0700 on the directory, and nothing in the store or the config.
- A stale token is a new failure mode this client did not have.
  The mitigation is task 03 step 2: a stored token the host refuses is dropped and the person is asked exactly as if nothing had been stored, and step 3 forbids resolving twice for one ask so a bad entry cannot loop.
- The upfront push sends `authenticate` to hosts that would never have refused.
  The mitigation is that it is skipped entirely when the seam offers no `protectedResources` or no `authenticate`, and that a resource with no token resolves to nothing and is not sent. What is left is traffic proportional to what the host itself declared.
- A `--wire` capture now records a sign-in that nobody typed.
  The mitigation is that this was already true of `ahpc auth` and of the prompt, the flag is explicit, and no new place sends a token beyond the two this plan names.
- Authenticating the fixture would change what every existing screen test sees.
  The mitigation is task 02 step 6: the upfront push is for a live connection, and `test/auth.test.tsx` passing untouched is the check that it stayed there.
- A test that reads the real `XDG_CONFIG_HOME` would read a developer's own tokens and could write to them.
  The mitigation is that task 01 establishes the temporary-directory pattern before anything else uses the file, and every later task's validation names it.

## Resume state

- **Done so far:** nothing. The plan was written on 2026-09-24 out of a comparison against ahpapp and ahpx, after plan 01 shipped.
- **Next action:** [task-01-the-chain-and-the-file.md](task-01-the-chain-and-the-file.md).
- **Open questions:**
  1. Whether a resource's token should carry an expiry the way `ahpc auth --expires-in` allows - proposed: no, the file records what was typed and the host owns the lifetime, and an expiry this client invented would be a second clock.
  2. Whether the upfront push should also run after a reconnect - proposed: yes if the host forgot the credential, but only once it is known whether `liveHost` re-runs `connect`'s tail on a reconnect, which task 02 has to find out and record.
- **Watch out for:** `--token` is the *connection* token for every command (`src/cli/main.ts:229`) and the *resource* token only for `ahpc auth` (`src/cli/main.ts:1302`); this plan touches neither meaning and must not merge them.
  The prompt's existing six cases pass only when no `AHPC_TOKEN_*` is set and `XDG_CONFIG_HOME` is temporary, so a failure there after task 03 is most likely leaked environment rather than broken behaviour.

## Final verification checklist

- [ ] A token in `AHPC_TOKEN_<RESOURCE>` answers a refusal with no prompt drawn, and the refused act runs once more.
- [ ] A token in the file does the same, and a typed one the host accepts is in the file afterwards.
- [ ] A stored token the host refuses opens the prompt and leaves no entry behind.
- [ ] A host declaring a resource this machine has a token for is authenticated at connect, with nothing drawn and no prompt.
- [ ] A host that serves no `protectedResources`, or whose `authenticate` throws, still yields a usable connection.
- [ ] The token file is 0600 and its directory 0700, and no secret reaches the store or `config.json`.
- [ ] `test/auth.test.tsx`'s six existing cases pass untouched.
- [ ] `npm test` and `npm run typecheck` green.
- [ ] `plans/index.md` carries the row, and `00-ahp.md` names `src/ahp/tokens.ts`.
