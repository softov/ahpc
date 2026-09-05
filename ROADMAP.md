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

# Batch 2 - The message

The model selection and the draft both live on `Message`, and this client
carries neither outbound.

## B-01-20 - `Message.model` carries the selection, and the form that resolves it

**Clause.** `chat-channel.md:38`: `ChatState.draft` is the message being composed "including its model/agent selection". `chat-channel.md:66`: `createChat`'s `initialMessage` carries "its own `model` / `agent` selection". `state.schema.json` on `configSchema`: "Clients present this as a form and pass the resolved values in `ModelSelection.config`."

**Missing.** `say` and `queue` send `{ id }` with no `config`, so a model's own options can be read and never chosen. The specification puts the selection on the message; that is what gets built, whether or not another client exercises it.

**Steps.**
1. Carry `ModelSelection` whole outbound: `say`, `queue`, and `createChat`'s `initialMessage`.
2. Build the form from the open model's `configSchema` - the `ConfigProperty` decoder already reads it - and send the resolved values as `ModelSelection.config`.
3. Where a session config property and the model's schema name the same key, take the values from the model and the title and words from the host's schema.
4. Test: a scripted host receiving `model: { id, config }`, and a model whose schema offers one value.

## B-01-24 - `ChatState.draft`

**Clause.** `chat-channel.md:38` and `ChatState.draft`'s own declaration: "Clients MAY periodically sync their local input state into this field so a draft survives reloads and is visible to other clients viewing the same chat. Eager syncing is **not** required — clients SHOULD debounce and MAY sync only at convenient points. When presenting input UI for an existing chat, clients SHOULD use any `draft` to initialize their input state. Cleared (set to `undefined`) once the message is sent."

**Missing.** The composer neither reads the draft when opening a chat nor writes one. A message half-typed here is invisible everywhere else and lost on restart.

**Steps.**
1. Initialise the composer from `ChatState.draft` when a chat opens.
2. Dispatch `chat/draftChanged`, debounced, and on leaving the screen.
3. Clear it when the message is sent.
4. Test: a draft in the opening snapshot reaches the composer; typing produces one debounced dispatch, not one per key.

---

# Batch 3 - Presence and the terminal

## B-01-12 - `session/activeClientSet`

**Clause.** `SessionState.activeClients` and its declaration: membership is host-managed, clients add or refresh themselves with `session/activeClientSet`, and the host removes them on unsubscribe. The reference client sends it on `createSession` as `activeClient`, with its `clientId` and its tools.

**Missing.** Never dispatched, so this client never appears in another client's `activeClients` and the header shows nobody.

**Steps.**
1. Dispatch on opening a session view, and pass `activeClient` on `createSession`.
2. Draw the session's `activeClients` in the header.
3. Test: the dispatch on open, and the header after the list changes.

## B-01-11 - The four terminal actions

**Clause.** `terminal-channel.md:84` lists the client-dispatchable set: `terminal/input`, `terminal/resized`, `terminal/claimed`, `terminal/titleChanged`, `terminal/cleared`. `terminal-channel.md:120-125` gives each one's reduction: `resized` sets `cols`/`rows`, `claimed` sets `claim`, `titleChanged` sets `title`, `cleared` resets `content`. `terminal-channel.md:114`: clients MUST check `supportsCommandDetection` before relying on command boundaries.

**Missing.** Only `terminal/input` is dispatched, so the host is never told how wide this client draws and output wraps at a width nobody chose.

**Steps.**
1. Dispatch `terminal/resized` on mount and on every resize.
2. Commands for clear, rename and claim.
3. Check `supportsCommandDetection` before drawing anything derived from command boundaries.
4. Test: the frame on mount and on a size change.

---

# Batch 4 - Resources, both directions

The `resource*` family is symmetrical. This client serves none of it and sends
a third of it.

## B-01-10 - The write half

**Clause.** `CommandMap` declares `resourceWrite`, `resourceDelete`, `resourceMkdir`, `resourceMove`, `resourceCopy` and `resourceResolve` alongside the three this client sends. `commands.ts`: `-32008 NotFound` if the URI does not exist, `-32009 PermissionDenied` if not permitted, and the receiver enforces access through the `resourceRequest` flow.

**Missing.** All six, at every layer. The browser is a viewer and the grant negotiation this client implements is negotiating for a capability nothing uses.

**Steps.**
1. All six on `HostConnection`, `fake.ts` and `live.ts`.
2. `ahpc resource write|rm|mkdir|mv|cp|stat`.
3. Read-modify-write carries `resourceResolve`'s `etag` as `ifMatch`; `-32011` draws as a conflict.
4. Rename, delete and new-file in the browser, each asking the operation's own confirmation and the grant separately.
5. Test: a stale `ifMatch`, and a refused grant.

## B-01-16a - Resource watches

**Clause.** `resource-watch-channel.md:15`: the watch URI is receiver-assigned and opaque. `:37`: there is no dispose command - the receiver MUST release the watcher once every subscriber has unsubscribed. `:68`: the receiver MUST gate `createResourceWatch` through the same permission flow, returning `-32009` with a `resourceRequest` payload when denied.

**Missing.** No watch is ever created, so the changeset and file screens re-read on a timer.

**Steps.**
1. Create a watch behind the changeset and file screens; release on close, which the channel registry already does.
2. Treat the returned channel as opaque.
3. Handle `-32009` with its `resourceRequest` payload through the grant flow that already exists.
4. Test: created on open, unsubscribed on close, and a denied watch asking for the grant.

## B-01-17 - Answering what a host asks

**Clause.** `subscriptions.md:13`: "The same nine `resource*` request methods plus `createResourceWatch` may also be initiated by the server. Used for host-driven per-session filesystem providers and for fetching client-published URIs (e.g. `virtual://my-client/...` plugins)." `commands.ts`: the receiver enforces access via the same permission/`resourceRequest` flow regardless of which peer initiated, and `-32009` is the declared refusal.

**Missing.** All ten. The package's default answers `-32601`, which is legal, but this client implements no part of the protocol's reverse direction.

**Steps.**
1. A request handler layer, so a host-initiated method is routed rather than falling to the package default. Refuse every URI with `-32009` until something is published.
2. `--publish <dir>`, served under `virtual://ahpc/` - the scheme shape the specification's own examples and conformance tests use - with every path resolved and checked to be inside it.
3. Serve the read half against it; refuse the write half unless `--publish-writable` is given.
4. `createResourceWatch` over the same directory.
5. Test: a host reading a published file, and being refused a path outside the directory.

---

# Batch 5 - Authentication

## B-01-09 - `authenticate`

**Clause.** `authentication.md:90`: the `resource` field MUST match a resource the server advertised, statically via `protectedResources` or dynamically via an MCP challenge. `:115`: `expiresIn` MUST be a positive integer when supplied. `:117`: a client that retained the original token response MUST subtract elapsed time before forwarding it, and MUST omit `expiresIn` when the expiry is unknown; an empty token revokes. `:131-133`: `-32007` MAY be returned from **any** command and its `data` MUST be an `AuthRequiredErrorData` describing what needs authenticating. `:200`: on `auth/required` with `reason: 'expired'` the client MUST acquire a new credential and MUST NOT blindly replay the challenged token. `:202`: the notification is ephemeral, so clients SHOULD re-check after reconnecting. `:63`: absent `required` means required.

**Missing.** `authenticate` at every layer. `-32007` arrives as text and its `data` is discarded; `auth/required` reaches this client and is routed nowhere.

**Steps.**
1. `authenticate(resource, token, expiresIn?)` on the seam, `fake.ts` and `live.ts`.
2. Read `AuthRequiredErrorData` off any `-32007` and name the resources it lists.
3. Resolve a token: `--token`, then an environment variable named for the resource, then a TUI prompt; on the command line, refuse and name the variable. Send only a `resource` the host advertised.
4. Compute `expiresIn` by subtracting elapsed time, omit it when unknown, and send an empty token to revoke.
5. On `auth/required` with `reason: 'expired'`, acquire again rather than replay. Re-check after every reconnect.
6. Test: `-32007` from a command that is not `authenticate`; an expired challenge; a resource the host never advertised.

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
