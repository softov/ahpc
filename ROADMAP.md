# What is left to build

Pending implementation. Every item names the clause it comes from, in
`docs/specification/` of the protocol repository or in the package's own
declarations. Where the specification says how something works, that is what
gets built - there is no choice to be made and none is offered here.

Batches are ordered so each one stands on its own and can be finished, tested
and landed before the next begins. When the last is done this file is deleted.

`B-xx` codes are stable so a commit can name one, and are not reused.

Two hosts have to work: ahpd and VS Code's agent host. Neither is the
specification, and where an implementation and the specification disagree, the
specification is what this client follows.

---

# Batch 6 - The rest of the surface

## B-01-18 - Completions, forks and side chats

**Clause.** `sessionConfigCompletions` in `CommandMap`, driven by a property whose schema carries `enumDynamic` - the reference host sets it on `branch` while isolation is `worktree`. `createChat.source` and `capabilities.multipleChats: { fork, sideChat }`, which the reference host advertises.

**Missing.** Neither is called, so a dynamic property renders as free text and a fork cannot be started.

**Steps.**
1. Call `sessionConfigCompletions` for any property whose schema says `enumDynamic`; draw the result as choices.
2. Offer fork and side chat exactly where `multipleChats` advertises each.
3. Test: a scripted host with `enumDynamic` on one property.

## B-01-15 - Automations from the command line

**Clause.** `automation-channel.md:82`: before dispatching `automation/removed` a client SHOULD verify the target advertises `AutomationOperation.Remove`. `listAutomationTriggerDefinitions` in `CommandMap` is how a client learns which triggers a host has.

**Missing.** No `ahpc automation`. Trigger definitions are never fetched, so only a schedule can be authored. Run history is never paged.

**Steps.**
1. `ahpc automation list|show|new|run|enable|disable|rm|runs`.
2. Call `listAutomationTriggerDefinitions` before drawing the trigger form.
3. Verify `Remove` is advertised before dispatching a removal.
4. Page run history with the host's cursor.

## B-01-16b - The host's log

**Clause.** `telemetry-channel.md:13`: clients MUST treat the telemetry URI as opaque apart from expanding the well-known template variables, and subscribe with the value advertised on `InitializeResult.telemetry` after expansion. `:39`: a host that emits none omits `telemetry`; clients SHOULD subscribe only to signals they can process.

**Missing.** Nothing expands the template, so a host's own log is unreadable from here.

**Steps.**
1. `ahpc logs [--level L] [--follow]`, expanding `InitializeResult.telemetry.logs` and subscribing to signals this client renders.
2. Draw nothing where `telemetry` is absent.

## B-01-21 - Checking what this client sends

**Not a clause - the tool that checks the clauses.** `tools/validate.mjs` reads what a host sent; nothing reads what this client sends, and both captures it has run against are another client's traffic.

**Steps.**
1. Route client frames by method into the package's `*Params` declarations.
2. Run it over the captures on disk - the client half is in the same files.
3. `--record <file>` on `ahpc`, so a capture can be made from a session.
4. Fix what it finds.
