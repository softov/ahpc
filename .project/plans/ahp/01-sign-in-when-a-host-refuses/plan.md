---
title: Sign in when a host refuses, and run the refused act once more
domain: ahp
status: planned
priority: high
created: 2026-09-23
revalidated: 2026-09-23
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
  - code://src/ahp/live.ts#L1424-L1434 - `notified`, where the `auth/required` notification is read
  - code://src/ahp/live.ts#L1512-L1535 - `reason`, where a `-32007`'s `data.resources` is read
  - code://src/ahp/live.ts#L1956-L1982 - `authenticate` and `protectedResources`
  - code://src/ahp/live.ts#L2124-L2155 - `listSessions`, an awaited act that rejects with the host's code
  - code://src/ahp/live.ts#L1883-L1899 - `dispatch`, fire-and-forget, which this plan does not cover
  - code://src/ahp/connection.ts#L250-L280 - the seam's `authenticate` and `protectedResources`
  - code://src/connect.ts#L41-L52 - `sink`, the box a connection callback writes into before there is an app
  - code://src/connect.ts#L60-L104 - `connect`, and the sentence a refusal prints today
  - code://src/tui.tsx#L400-L411 - where `sink.report` is filled once the app exists
  - code://src/control.ts#L50-L191 - the `Controller` interface, every method this plan either wraps or leaves
  - code://src/control.ts#L442-L446 - `failed`, where a rejection lands today with nothing to re-run
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
  - code://src/ahp/fake.ts#L1970-L1987 - the fixture's `authenticate`, which accepts anything and remembers it
  - UPSTREAM.md#L15 - the unchecked upstream item this is adjacent to, which is the tool-call state and not this
  - DEVELOPER.md#L53-L54 - a widget those packages do not have is a textui change first, and this plan needs none
  - file:///github/ahpapp/src/auth-required.ts#L65-L89 - `authRequiredOf`, the reading this ports
  - file:///github/ahpapp/src/auth-required.ts#L239-L248 - `retryAllowed`, the one-attempt rule
  - file:///github/ahpapp/src/auth-gate.tsx#L223-L246 - `attempt`, the one loop every act shares
  - file:///github/ahpapp/src/auth-gate.tsx#L356-L371 - the sheet drawn above the navigator, which the modal layer is here
  - file:///github/ahpapp/src/components/ResourceAuth.tsx#L64-L74 - closing drops the draft, the secret discipline
  - npm://@textui/core@^0.6.1 - `LayerEntry`, whose planes are base, floating, modal, notification and debug
  - npm://@textui/widgets@^0.6.1 - `TextInput.mask`, the field that replaces every character for a secret
---

## Goal

When a host refuses with `-32007`, or announces `auth/required`, the person is asked for a credential where they already are and the refused act runs exactly once more once the host takes it.
Today the refusal is read correctly and then printed: `connect.ts` writes a sentence telling a person to run `ahpc auth <resource>`, the footer keeps the host's words, and the act that was refused is gone.
A terminal client has no sheet, so the prompt is a modal over whatever screen the refusal came from, a non-interactive run is told what to do and exits, and a refusal that names no resource is drawn rather than guessed at.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "onAuthRequired|auth/required|-32007|AuthRequired" src test` - the callback is declared at `src/ahp/live.ts:114`, filled from the notification at `:1425-1432` and from a refusal's `data` at `:1524-1533`, printed at `src/connect.ts:81`, and already asserted at `test/reconnect.test.ts:1454` and `:1496`; nothing opens anything or retries.
- `rg -n "TextInput|SearchBox|useForm|FormActions" src` - a text field exists in two shapes: `SearchBox` in a row (`src/screens.tsx:253`, `:885`, `src/view/wire.tsx:138`) and `TextInput` inside a `Form` with `FormActions` (`src/screens.tsx:1431-1519`); `@textui/widgets`' `TextInput` carries a `mask` prop documented as "replace every character, for secrets", so no widget has to be added.
- `rg -n "layers.open" src` - three modals already open on the `modal` plane: the palette and two composer pickers (`src/control.ts:1128`, `:1162`, `:1195`), plus the creature on `floating` (`src/app.tsx:536`); `@textui/core`'s `LayerEntry` carries `scrim`, `trapFocus`, `dismissOnEscape` and an `onClose(reason)`.
- `rg -n "AHPC_TOKEN|tokenVariable|authenticate" src/cli src/ahp` - a resource's credential comes from `--token`, then `tokenVariable(resource)`, then a pipe (`src/cli/main.ts:1275-1280`), while `--token` is the *connection* token everywhere else (`src/cli/main.ts:228`), and the two meanings must not be merged.
- `rg -n "authRequired" src` - an MCP server's `authRequired` state is labelled "sign in" (`src/view/customizations.tsx:40`) and a tool call's auth state is drawn as a notice (`src/blocks.ts:89-99`); neither is a `-32007` and this plan does not make either a prompt.
- `rg -n "refuseWith|refuse\\b" test/scenario.ts` - the scripted host refuses a *subscribe* with a chosen code and data (`test/scenario.ts:78`, `:362-368`) but answers `listSessions` and `authenticate` unconditionally (`:416-426`), so a request-level refusal that clears after a token has to be added.

### Runtime path

```
authenticate or refusal on the wire
  -> live.ts: notified('auth/required') or reason(-32007 with data.resources) -> onAuthRequired(resources, reason)
  -> connect.ts: today sink.report('... needs signing in to: ahpc auth <resource>')
  -> [this plan] an asker installed after boot, the way sink.report is: state AUTH_ASK + app.layers.open('auth', modal)
  -> SignInPrompt: TextInput(mask) and submit -> controller.signIn(resource, token) -> host.authenticate
  -> accepted: the ask is cleared, the layer closes, and the held act's promise runs once more
```

### Gaps

- No asker; `src/connect.ts:81-86` turns a refusal into a sentence and there is no path from it back to a person's keyboard.
- No retry; a refused act rejects into `src/control.ts:442-446` or a channel refusal into `sink` (`src/ahp/live.ts:1556-1561`), and neither holds the act to run again.
- No prompt; nothing under `src/view/` or in `src/screens.tsx` asks for a credential, and the store has only `HOST_ERROR` and `INPUT_STATUS` as free text (`src/state.ts:165-194`).
- A `-32007` in a shell is a stack trace, because it is not a `Fault` and `src/main.tsx:57-63` prints the stack over a host that is working.
- The fixture cannot refuse a request; `src/ahp/fake.ts:1978-1985` accepts any token and `test/scenario.ts:416-426` always answers `listSessions`, so neither can express "refused until signed in".
- `Not found: any reader of a refusal that opens something - searched "onAuthRequired|authRequired|prompt|signIn|credential|AuthGate" in src/ and test/.`

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
| The asker is installed after boot on a module-level box, exactly the way `sink.report` is, because a refusal can arrive before the application exists | `code://src/connect.ts#L41-L52`, `code://src/tui.tsx#L410` | 02 |
| A refusal is read by its code and never by its message text, so a host that words one differently is still read | `file:///github/ahpapp/src/auth-required.ts#L65-L89` | 01 |
| Only the first resource a refusal names is asked for, and a notification's single resource is its own | `file:///github/ahpapp/src/auth-required.ts#L213-L237` | 01 |
| The prompt is keyed by the ask so a second one starts with an empty field, and closing clears it | `file:///github/ahpapp/src/components/ResourceAuth.tsx#L64-L74` | 02 |
| Only an awaited request is wrapped; a fire-and-forget dispatch is not | `code://src/ahp/live.ts#L1883-L1899` | 02 |

## Proposed architecture

- **Data flow** - the connection reads a refusal in `reason()` at `src/ahp/live.ts:1512` and a notification in `notified()` at `:1424`, and calls `onAuthRequired`; `src/connect.ts` turns that into an `AuthAsk` and hands it to an installed asker instead of printing it.
  The prompt submits through `controller.signIn`, which calls `host.authenticate`.
- **Event flow** - an awaited act that rejects is caught by an `attempt` helper, which reads the code with `authRequiredOf`, asks, and on an accepted credential calls the same `once()` again; a channel or notification refusal has no act, so it opens the prompt with nothing to retry.
- **State flow** - one new store path holds the ask (the resource, the host's name for it, the reason and the host's words) and is cleared when the layer settles; nothing is persisted and no secret is stored.
- **Layer responsibilities** - `src/ahp/auth.ts`: the reading, the ask shape and the retry rule, with no renderer and no store · `src/connect.ts`: the asker box and the mapping from the connection's callback · `src/state.ts`: the ask path · `src/control.ts`: `attempt` applied to the forwarded methods, plus `askSignIn` and `signIn` · `src/view/auth.tsx`: the prompt component · `src/app.tsx`: the component registration · `src/tui.tsx`: installing the asker · `src/ahp/fake.ts` and `test/scenario.ts`: a host that refuses until it is given a token · `src/cli/main.ts`: the `Fault`.
- **Source-of-truth files** - `code://src/ahp/auth.ts`, `code://src/control.ts`, `code://src/connect.ts`.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The refusal is read once, and the fixture can refuse](task-01-the-refusal-is-read-once.md) | todo | - |
| [02 - The prompt, and the act once more](task-02-the-prompt-and-one-more-attempt.md) | todo | 01 |
| [03 - A refusal in a non-interactive run](task-03-a-refusal-in-a-non-interactive-run.md) | todo | 01 |

## Risks and tradeoffs

- The retry runs the act from its own start, so a method that acts before its await would repeat that part.
  The mitigation is that only a method forwarding a single awaited call is wrapped, and task 02 names the interface so a later method with a side effect is a deliberate decision rather than an accident.
- Opening a modal steals focus from the composer mid-sentence.
  The mitigation is the layer's own `trapFocus`, which restores what it took on close, and the composer's draft lives in the store rather than in the field.
- A second refusal while a prompt is open could stack a second prompt.
  The mitigation is a single layer id, so the newest ask replaces the shown resource rather than drawing above it.
- `--wire` records both directions, so a sign-in lands in the capture file.
  The mitigation is that this is already true of `ahpc auth` and the flag is explicit, and the plan adds no new place a token is sent.
- A `-32007` is a code in a numeric field on a request and words in a `rejectionReason` on a dispatch.
  The mitigation is that both are read where they arrive, by code for the first and by the code inside the text for the second, and a removal of either read is what the tests would notice.
- Adding a refusal mode to the fixture could make existing cases refuse.
  The mitigation is that it is opt-in on both the fake host and the scripted transport, so nothing that does not ask for it changes.

## Resume state

- **Done so far:** nothing; the plan is written and the five decisions are locked in.
- **Next action:** [task-01-the-refusal-is-read-once.md](task-01-the-refusal-is-read-once.md).
- **Open questions:**
  1. Whether the modal layer takes a component registered in `app.tsx` with props, the way the palette does - proposed: yes, `app.layers.open({ id: 'auth', layer: 'modal', node: { component: 'SignInPrompt' } })`, exactly as `src/control.ts:1128` opens the palette, to confirm when task 02 draws it.
  2. Whether one `attempt` wrapper is enough for the controller methods, or a method that re-reads something after its await needs its own - proposed: the wrapper covers a single forwarded call, and anything more is left unwrapped and reported.
  3. Whether a refusal arriving before the app exists needs to be held and replayed into the prompt, or the printed sentence is enough - proposed: the sentence is the pre-boot answer, and the asker takes over once installed, the way `sink.report` does.
- **Watch out for:** `--token` is the connection token for every command and the resource token only for `ahpc auth` (`src/cli/main.ts:228` against `:1275`), so nothing here may read it as a resource token outside that command.
  `LiveHostOptions.onAuthRequired` already calls the callback for a `-32007` that is read as words rather than thrown, so a second notification path must not be added beside it.

## Final verification checklist

- [ ] `test/auth.test.ts` reads a `-32007` with and without resources, a dispatch rejection whose words carry the code, and the one-retry rule, and asks nothing for a refusal that names no door.
- [ ] `test/auth.test.tsx` drives the modal over the fake host: refused, prompted, accepted, and the act served exactly once more; a refused credential leaves the prompt open and runs nothing; a second refusal after the retry stops.
- [ ] `test/reconnect.test.ts` still passes, and the scripted host can refuse a request and clear the refusal after `authenticate`.
- [ ] A shell run against a host that refuses prints one sentence and exits 1, with no stack trace and no prompt.
- [ ] `npm test` green.
- [ ] `npm run typecheck` green.
- [ ] `plans/index.md` updated.
