---
title: Sign in when a host refuses, and run the refused act once more
domain: ahp
status: built
priority: high
created: 2026-09-23
revalidated: 2026-09-24
requires: []
changes: []
creates: []
decisions:
  - decisions/the-sign-in-prompt-is-a-modal-layer.md
  - decisions/one-accepted-credential-runs-the-act-again.md
  - decisions/a-refusal-with-no-resource-is-drawn.md
  - decisions/a-non-interactive-run-does-not-retry.md
  - decisions/the-prompt-does-not-keep-the-secret.md
refs:
  - code://src/ahp/live.ts#L1382-L1389 - `liveHost`, the one place a connection is made
  - code://src/ahp/live.ts#L105-L114 - `onAuthRequired`, the callback this plan gives somewhere to go
  - code://src/ahp/live.ts#L1424-L1434 - `notified`, where the `auth/required` notification is read and its `reason` kept
  - code://src/ahp/live.ts#L1512-L1535 - `reason`, where a `-32007`'s `data.resources` is read and its `reason` is not
  - code://src/ahp/live.ts#L1956-L1982 - `authenticate` and `protectedResources`
  - code://src/ahp/live.ts#L2124-L2160 - `listSessions`, an awaited act that rejects with the host's code
  - code://src/ahp/live.ts#L1883-L1899 - `dispatch`, fire-and-forget, which this plan does not cover
  - code://src/ahp/connection.ts#L250-L280 - the seam's `authenticate` and `protectedResources`
  - code://src/connect.ts#L41-L52 - `sink`, the box a connection callback writes into before there is an app
  - code://src/connect.ts#L60-L104 - `connect`, and the sentence a refusal prints today
  - code://src/app.tsx#L478-L492 - `registerChat`, which builds the controller in `onBoot` before `app.start()` resolves
  - code://src/control.ts#L50-L191 - the `Controller` interface, every method this plan either wraps or leaves
  - code://src/control.ts#L227-L232 - `createController`, where the asker and its layer live
  - code://src/control.ts#L442-L446 - `failed`, where a rejection lands today with nothing to re-run
  - code://src/control.ts#L541-L546 - `refresh`, whose own `catch` is why the retry wraps the call and not the method
  - code://src/control.ts#L848-L867 - `create`, whose post-await `refresh`, `open` and `send` must never run twice
  - code://src/control.ts#L1122-L1141 - the palette's modal, opened on the `modal` layer with a scrim
  - code://src/state.ts#L165-L194 - `HOST_ERROR` and `INPUT_STATUS`, the free text the store holds today
  - code://src/state.ts#L428-L439 - `reportHostError`
  - code://src/app.tsx#L497-L543 - the component registration list and the one layer opened over every screen
  - code://src/blocks.ts#L89-L99 - a tool call waiting on a sign-in, already drawn as a notice
  - code://src/view/customizations.tsx#L34-L42 - an MCP server's `authRequired` label, drawn and not answerable
  - code://src/screens.tsx#L873-L912 - the find box, the text field the interface already has in a row
  - code://src/screens.tsx#L1420-L1524 - the form, `TextInput` and `FormActions` pattern
  - code://src/cli/main.ts#L360-L372 - `cli`, one host for the whole command
  - code://src/cli/main.ts#L1255-L1300 - `signIn` and `tokenVariable`, the credential sources a shell already has
  - code://src/main.tsx#L40-L66 - a `Fault` is a sentence and anything else is a stack
  - code://test/reconnect.test.ts#L1436-L1512 - the existing `onAuthRequired` cases
  - code://test/scenario.ts#L168-L178 - `authRequired` on the scripted host
  - code://test/scenario.ts#L416-L426 - where the scripted host answers `listSessions` and `authenticate`
  - code://test/live.test.tsx#L1-L30 - `renderApp` from `@textui/testing` over `fakeHost`, the screen harness this plan's test follows
  - code://src/ahp/fake.ts#L1970-L1987 - the fixture's `authenticate`, which validates the resource and already remembers a token
  - code://UPSTREAM.md#L15 - the unchecked upstream item this is adjacent to, which is the tool-call state and not this
  - code://DEVELOPER.md#L53-L54 - a widget those packages do not have is a textui change first, and this plan needs none
  - file:///github/ahpapp/src/auth-required.ts#L65-L121 - `authRequiredOf`, `failureWords` and `authRequiredReason`, the reading this ports
  - file:///github/ahpapp/src/auth-required.ts#L133-L145 - `refusalStep`, where a second refusal and a no-resource refusal both stop
  - file:///github/ahpapp/src/auth-required.ts#L239-L248 - `retryAllowed`, the one-attempt rule
  - file:///github/ahpapp/src/auth-gate.tsx#L176-L215 - `waiters` and `settle`, the per-resource answer this plan copies
  - file:///github/ahpapp/src/auth-gate.tsx#L223-L256 - `attempt`, the one loop every act shares
  - file:///github/ahpapp/src/auth-gate.tsx#L356-L371 - the sheet drawn above the navigator, which the modal layer is here
  - file:///github/ahpapp/src/components/ResourceAuth.tsx#L64-L74 - closing drops the draft, the secret discipline
  - npm://@microsoft/agent-host-protocol@^0.9.0 - `AuthRequiredErrorData`, whose resources are `ProtectedResourceMetadata` and so carry `resource_name`
  - npm://@textui/core@^0.6.1 - `LayerEntry`, whose planes are base, floating, modal, notification and debug
  - npm://@textui/widgets@^0.6.1 - `TextInput.mask`, the field that replaces every character for a secret
---

## Goal

When a host refuses with `-32007`, or announces `auth/required`, the person is asked for a credential where they already are and the refused act runs exactly once more once the host takes it.
Today the refusal is read correctly and then printed: `connect.ts` writes a sentence telling a person to run `ahpc auth <resource>`, the footer keeps the host's words, and the act that was refused is gone.
A terminal client has no sheet, so the prompt is a modal over whatever screen the refusal came from, a non-interactive run is told what to do and exits, and a refusal that names no resource is drawn rather than guessed at.
The change is the screen and the shell only: `src/mcp/` reads the same seam and keeps answering a raw refusal to a model, and a fire-and-forget dispatch is never re-sent.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "onAuthRequired|auth/required|-32007|AuthRequired" src test` - the callback is declared at `src/ahp/live.ts:114`, filled from the notification at `:1425-1432` and from a refusal's `data` at `:1524-1533`, printed at `src/connect.ts:81`, and already asserted at `test/reconnect.test.ts:1454` and `:1496`; nothing opens anything or retries.
- `rg -n "TextInput|SearchBox|useForm|FormActions" src` - a text field exists in two shapes: `SearchBox` in a row (`src/screens.tsx:253`, `:885`, `src/view/wire.tsx:138`) and `TextInput` inside a `Form` with `FormActions` (`src/screens.tsx:1431-1519`); `@textui/widgets`' `TextInput` carries a `mask` prop documented as "replace every character, for secrets", so no widget has to be added.
- `rg -n "layers.open" src` - three modals already open on the `modal` plane: the palette and two composer pickers (`src/control.ts:1128`, `:1162`, `:1195`), plus the creature on `floating` (`src/app.tsx:536`); `@textui/core`'s `LayerEntry` carries `scrim`, `trapFocus`, `dismissOnEscape` and an `onClose(reason)`.
- `rg -n "AHPC_TOKEN|tokenVariable|authenticate" src/cli src/ahp` - a resource's credential comes from `--token`, then `tokenVariable(resource)`, then a pipe (`src/cli/main.ts:1275-1280`), while `--token` is the *connection* token everywhere else (`src/cli/main.ts:228`), and the two meanings must not be merged.
- `rg -n "authRequired" src` - an MCP server's `authRequired` state is labelled "sign in" (`src/view/customizations.tsx:40`) and a tool call's auth state is drawn as a notice (`src/blocks.ts:89-99`); neither is a `-32007` and this plan does not make either a prompt.
- `rg -n "refuseWith|refuse\\b" test/scenario.ts` - the scripted host refuses a *subscribe* with a chosen code and data (`test/scenario.ts:78`, `:362-368`) but answers `listSessions` and `authenticate` unconditionally (`:416-426`), so a request-level refusal that clears after a token has to be added.
- `rg -n "renderApp" test src` - the screen harness is `renderApp` from `@textui/testing` (`test/live.test.tsx:2`, `:22` over `fakeHost`), not `test/scenario.ts`, whose header says it drives `liveHost` itself and not the seam `fakeHost` implements (`test/scenario.ts:1-20`); task 02 follows `test/live.test.tsx`.
- `rg -n "waiters|settle|askSheet" /github/ahpapp/src/auth-gate.tsx` - the reference holds a *list* of waiters keyed by resource and `settle(accepted)` answers the waiter for the accepted resource `true` and the rest `false` (`:176-215`); one waiter per connection would strand every act but the newest.
- `rg -n "ProtectedResourceMetadata" node_modules/@microsoft/agent-host-protocol/dist/types/common` - the protocol's resource metadata names the friendly string `resource_name` (`state.d.ts:86`), and `AuthRequiredErrorData` is `{ resources: ProtectedResourceMetadata[] }` (`errors.d.ts:104-106`) with no `reason`, so a reason reaches this client only on the `auth/required` notification.
- `rg -n "catch \\(error\\) \\{ failed" src/control.ts` - `refresh`, `createChat`, `disposeChat` and `disposeSession` catch their own rejection (`:545`, `:585`, `:591`, `:843`), so the retry has to wrap the single `await host.<call>()` inside them rather than the method.
- `rg -n "createController\\(|layers.open" src/app.tsx src/tui.tsx` - the controller is built in `onBoot` before `app.start()` resolves (`src/app.tsx:483`), and the bood layer is opened at the same point (`:536`), so the asker can be installed and its layer opened there without touching `src/tui.tsx`.

### Runtime path

```
two refusal paths, one prompt
  - a notification or a refused channel
    -> live.ts: notified('auth/required') or reason(-32007 with data.resources) -> onAuthRequired(resources, reason)
    -> connect.ts: today sink.report('... needs signing in to: ahpc auth <resource>')
    -> [this plan] connect.ts fills the module-level `auth` box; the controller, built in onBoot, points it at `askSignIn`
    -> askSignIn(one): state AUTH_ASK + app.layers.open({ id: 'auth', layer: 'modal' }) + a waiter on a list keyed by resource
    -> SignInPrompt: TextInput(mask) and submit -> controller.signIn(resource, token) -> host.authenticate
    -> accepted: settle(resource) clears the ask, closes the layer, and resolves every waiter for that resource true
  - a directly awaited request (listSessions, createSession, disposeSession, ...)
    -> client.request rejects with the host's code intact; reason() is not called on this path
    -> attempt(once): authRequiredOf(error) -> askSignIn(one) -> once() runs the same single `await host.<call>()` once more
```

### Gaps

- No asker; `src/connect.ts:81-86` turns a refusal into a sentence and there is no path from it back to a person's keyboard.
- No retry; a refused act rejects into `src/control.ts:442-446` or a channel refusal into `sink` (`src/ahp/live.ts:1556-1561`), and neither holds the act to run again.
- No prompt; nothing under `src/view/` or in `src/screens.tsx` asks for a credential, and the store has only `HOST_ERROR` and `INPUT_STATUS` as free text (`src/state.ts:165-194`).
- A `-32007` in a shell is a stack trace, because it is not a `Fault` and `src/main.tsx:57-63` prints the stack over a host that is working.
- The fixture cannot refuse a request; `src/ahp/fake.ts:1978-1985` validates a resource and remembers a token but never enforces one, and `test/scenario.ts:416-426` always answers `listSessions`, so neither can express "refused until signed in".
- The notification path reads `resource.description` where the protocol names the friendly string `resource_name` (`src/ahp/live.ts:1430` against `ProtectedResourceMetadata.resource_name`), so a name read there is lost today; this plan reads `resource_name` and carries it as the ask's name.
- `Not found: any reader of a refusal that opens something - searched "onAuthRequired|authRequired|prompt|signIn|credential|AuthGate|waiters" in src/, test/ and .project/.`

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |
| 1 | [The sign-in prompt is a modal layer, opened wherever the refusal happened](../../../decisions/the-sign-in-prompt-is-a-modal-layer.md) | (defaulted: the interface already has the modal plane, the scrim, the trap and the text field, and the refusal can arrive on any screen.) |
| 2 | [One accepted credential runs the refused act exactly once more](../../../decisions/one-accepted-credential-runs-the-act-again.md) | (defaulted: the reference's discipline, `file:///github/ahpapp/src/auth-gate.tsx#L15-L24`, and the user's words "retry the refused act exactly once".) |
| 3 | [A refusal that names no resource is drawn, never guessed at](../../../decisions/a-refusal-with-no-resource-is-drawn.md) | (defaulted: `authentication.md` requires the resource to match one the host named, and `authenticate` refuses a guessed one before sending.) |
| 4 | [A non-interactive run says what to do and exits, and never retries](../../../decisions/a-non-interactive-run-does-not-retry.md) | (defaulted: there is nobody to ask, and a command that had already acted would repeat itself.) |
| 5 | [The prompt does not keep the secret it was given](../../../decisions/the-prompt-does-not-keep-the-secret.md) | (defaulted: the host holds the token for the connection once `authenticate` is accepted.) |

What this plan settled without one:

| What | Source | Task |
| --- | --- | --- |
| The asker is installed inside `createController`, on the module-level box, the way `sink.report` is, because the controller exists before `app.start()` resolves and a refusal can arrive before it does | `code://src/connect.ts#L41-L52`, `code://src/app.tsx#L478-L492` | 02 |
| A refusal is read by its code and never by its message text, so a host that words one differently is still read | `file:///github/ahpapp/src/auth-required.ts#L65-L89` | 01 |
| Only the first resource a refusal names is asked for, and the host's name for it is read from `resource_name` on the same entry | `file:///github/ahpapp/src/auth-required.ts#L213-L237`, `npm://@microsoft/agent-host-protocol@^0.9.0` | 01 |
| The prompt is keyed by the ask so a second one starts with an empty field, and closing clears it | `file:///github/ahpapp/src/components/ResourceAuth.tsx#L64-L74` | 02 |
| Only an awaited request is wrapped; a fire-and-forget dispatch is not | `code://src/ahp/live.ts#L1883-L1899` | 02 |
| The retry wraps the single `await host.<call>()` at a call site, never the controller method, because `refresh` and the create/dispose methods catch their own rejection | `code://src/control.ts#L541-L546`, `code://src/control.ts#L848-L867` | 02 |
| One modal id and a list of waiters keyed by resource: the newest resource is what is drawn, and one accepted credential answers the waiter for that resource only | `file:///github/ahpapp/src/auth-gate.tsx#L176-L215` | 02 |

## Proposed architecture

- **Data flow** - the connection reads a refusal in `reason()` at `src/ahp/live.ts:1512` and a notification in `notified()` at `:1424`, and calls `onAuthRequired`; `src/connect.ts` turns that into an `AuthAsk` and hands it to an installed asker instead of printing it.
  The prompt submits through `controller.signIn`, which calls `host.authenticate`.
- **Event flow** - an awaited act that rejects is caught by an `attempt` helper, which reads the code with `authRequiredOf`, asks, and on an accepted credential calls the same `once()` again; a channel or notification refusal has no act, so it opens the prompt with nothing to retry.
- **State flow** - one new store path holds the ask (the resource, the host's name for it, the reason and the host's words) and is cleared when the waiter list settles; the reason is only ever set by an `auth/required` notification, because `AuthRequiredErrorData` carries none; nothing is persisted and no secret is stored.
- **Layer responsibilities** - `src/ahp/auth.ts`: the reading, the ask shape and the retry rule, with no renderer and no store · `src/connect.ts`: the asker box and the mapping from the connection's callback · `src/state.ts`: the ask path · `src/control.ts`: `attempt` applied to each single `await host.<call>()`, plus `askSignIn`, `settle`, `signIn` and the installed asker · `src/view/auth.tsx`: the prompt component · `src/app.tsx`: the component registration · `src/ahp/fake.ts` and `test/scenario.ts`: a host that refuses until it is given a token · `src/cli/main.ts`: the `Fault`.
- **Source-of-truth files** - `code://src/ahp/auth.ts`, `code://src/control.ts`, `code://src/connect.ts`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The refusal is read once, and the fixture can refuse](task-01-the-refusal-is-read-once.md) | done | - |
| [02 - The prompt, and the act once more](task-02-the-prompt-and-one-more-attempt.md) | done | 01 |
| [03 - A refusal in a non-interactive run](task-03-a-refusal-in-a-non-interactive-run.md) | done | 01 |

## Risks and tradeoffs

- The retry repeats a call, and a method that acts after its await would repeat that part too.
  The mitigation is that the wrapper goes around the single `await host.<call>()` and never around the method: `refresh` wraps its `listSessions` inside the existing `try` (`src/control.ts:543`), and `create` wraps only its `createSession` (`:856`) so the `refresh`, `open` and `send` that follow (`:861-866`) cannot run twice. Task 02 names both.
- Opening a modal steals focus from the composer mid-sentence.
  The mitigation is the layer's own `trapFocus`, which restores what it took on close, and the composer's draft lives in the store rather than in the field.
- A refusal while a prompt is open could leave an act waiting forever, or answer one for the wrong resource.
  The mitigation is the reference's waiter list: `askSignIn` pushes `{ resource, settle }`, the newest resource is what `AUTH_ASK` draws, and `settle(accepted)` answers only the waiter whose resource the host took (`file:///github/ahpapp/src/auth-gate.tsx#L176-L215`).
- The shell prints the connection's sentence and then a `Fault`, or prints neither.
  The mitigation is that the two paths are disjoint: a directly awaited request never calls `onAuthRequired`, because `reason()` is not on that path, so its `Fault` is the only line; a refused channel never rejects, so the connection's sentence is the only line.
- `--wire` records both directions, so a sign-in lands in the capture file.
  The mitigation is that this is already true of `ahpc auth` and the flag is explicit, and the plan adds no new place a token is sent.
- A `-32007` is a code in a numeric field on a request and words in a `rejectionReason` on a dispatch.
  The mitigation is that both are read where they arrive, by code for the first and by the code inside the text for the second, and a removal of either read is what the tests would notice.
- Adding a refusal mode to the fixture could make existing cases refuse.
  The mitigation is that it is opt-in on both the fake host and the scripted transport, so nothing that does not ask for it changes.
- `src/mcp/` reads the same `HostConnection` and gets none of this.
  The mitigation is that the Goal states it: a refusal answered to a model is unchanged, and `deferred.md` records it if the plan closes with it still true.

## Resume state

- **Done so far:** every task, on 2026-09-24. The plan was revalidated against the tree on the same day, which corrected the retry to a call-site wrapper, moved the asker into `createController`, made the second ask a waiter list, and named the ask's name from `resource_name`. What exists now is in [implemented.md](implemented.md); what waits is in [deferred.md](deferred.md).
- **Next action:** none. The plan is built.
- **Open questions:**
  1. Whether the layer receives the ask as node props or the prompt reads `AUTH_ASK` alone - settled: the component reads the store, as `ChangesList` and `FileList` do, and the node carries no props.
  2. Whether a refusal that arrives while the layer is open redraws the field empty - settled: the newest ask replaces what `AUTH_ASK` draws; a refused credential clears the field and keeps the host's words for the same resource.
- **Watch out for:** `--token` is the connection token for every command and the resource token only for `ahpc auth` (`src/cli/main.ts:228` against `:1275`); the catch added there does not touch it.
  `LiveHostOptions.onAuthRequired` is called by `reason()` for a `-32007` and by `notified()` for `auth/required`; a directly awaited request rejection reaches neither, so the retry lives on the request path and was not added to the callback path.

## Final verification checklist

- [x] `test/auth.test.ts` reads a `-32007` with and without resources, takes the ask's name from `resource_name`, reads a dispatch rejection whose words carry the code, and applies the one-retry rule, and asks nothing for a refusal that names no door.
- [x] `test/auth.test.tsx` drives the modal over the fake host: refused, prompted, accepted, and the act served exactly once more; a refused credential leaves the prompt open and runs nothing; a second refusal after the retry stops; two refused acts at once are both answered by one credential, the matching one retried and the other told no.
- [x] `test/reconnect.test.ts` still passes, and the scripted host can refuse a request and clear the refusal after `authenticate`.
- [x] A shell run against a host that refuses prints one sentence and exits 1, with no stack trace and no prompt.
- [x] `npm test` green.
- [x] `npm run typecheck` green.
- [x] `plans/index.md` carries the row with the status `built`.
