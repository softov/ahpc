# What is left to build

Pending implementation, and nothing else. Not decisions, not findings, not why
something is the way it is - that is what `git log` is for. When this file is
empty it gets deleted.

Each item says what is missing, which part of the protocol it is, and the steps
to finish it. `B-xx` codes are stable so a commit can name one, and are not
reused.

Two hosts have to work: ahpd and VS Code's agent host. Nothing here may assume
a host serves everything ahpd serves.

---

## B-01-09 - Signing in

**Missing.** `authenticate` at every layer. `-32007` arrives as text; `auth/required` reaches the client and is routed nowhere.

**Blocks.** Any host with a protected resource. ahpd advertises them for its harness.

**Plan.**
1. `authenticate(resource, token)` on `HostConnection`, `fake.ts` and `live.ts`.
2. Resolve a token: `--token` flag, then an environment variable named for the resource, then a TUI prompt. On the command line, refuse and name the variable.
3. Push it, retry the operation that failed.
4. Re-push on `auth/required` with `reason: 'expired'`.
5. Test: a scripted host refusing with `-32007`, then accepting.

## B-01-11 - Telling the host about the terminal

**Missing.** `terminal/resized`, `terminal/cleared`, `terminal/claimed`, `terminal/titleChanged`. All four are client-dispatchable; only `terminal/input` is sent.

**Blocks.** Output wraps at a width nobody chose, because the host is never told how wide this client draws. VS Code's client dispatches `terminal/resized` on connect - it is in the capture.

**Plan.**
1. Dispatch `terminal/resized` from the terminal view's own resize, and once when it opens.
2. Commands for clear, rename and claim, drawn only where the host serves them.
3. Test: assert the frame on mount and on a size change.

## B-01-12 - Being visible in a session

**Missing.** `session/activeClientSet` is never dispatched, so this client never appears in another client's `activeClients` and the session header shows nobody.

**Blocks.** Two people on one session cannot see each other.

**Plan.**
1. Dispatch on opening a session view. Removal is host-managed on unsubscribe, which this client now sends.
2. Draw the session's own `activeClients` in the header.
3. Test: the dispatch on open, and the header after an `activeClients` change.

## B-01-14 - Folding the handshake

**Missing.** `initialSubscriptions` and `locale` on `initialize`. The root channel is a separate `subscribe` afterwards.

**Plan.**
1. Pass `initialSubscriptions` on the first connection and apply the snapshots - the reconnect supervisor already does exactly this on its `initialize` fallback.
2. Pass `locale` from the environment.
3. Test: assert one round trip rather than two.

## B-01-15 - Automations from the command line

**Missing.** `ahpc automation` entirely. `listAutomationTriggerDefinitions` is never called, so only a schedule can be authored - an event trigger cannot be offered because this client never asks what events exist. Run history is never paged.

**Plan.**
1. `ahpc automation list|show|new|run|enable|disable|rm|runs`, over the seam that already exists.
2. Call `listAutomationTriggerDefinitions` before drawing the trigger form; offer event triggers where the host has them.
3. Page run history with the cursor the host returns.

## B-01-16 - The host's log, and files that change

**Missing.** `otlp/exportLogs` is served on an advertised template and nothing expands it. `createResourceWatch` is served and nothing creates one, so the changeset and file screens re-read on a timer.

**Plan.**
1. A resource watch behind the changeset and file screens, released on close - the channel registry already does the releasing.
2. `ahpc logs [--level L] [--follow]`, expanding `InitializeResult.telemetry.logs`.
3. Test: the watch is created on open and released on close.

## B-01-18 - Forks, side chats, and values that must be looked up

**Missing.** `createChat.source`, so a fork or a side chat cannot be started even where an agent advertises `capabilities.multipleChats: { fork, sideChat }` - the reference host does. `sessionConfigCompletions` is never called, so a property with `enumDynamic` renders as free text.

**Blocks.** Choosing a branch to base a worktree on. The reference host's `branch` property carries `enumDynamic` while isolation is `worktree`, which is a host offering to list them.

**Plan.**
1. Call `sessionConfigCompletions` for any property whose schema says `enumDynamic`, and draw the answer as choices.
2. Offer fork and side chat exactly where `multipleChats` advertises each.
3. Test: a scripted host with `enumDynamic` on one property.

## B-01-20 - Narrowing the effort choice to the model

**Missing.** The session-wide effort control offers every value even when the model running under it accepts only some. The model's own `options` are drawn beside it as facts.

**Not** a per-turn control: the reference client sends the effort level as session config and never sends `ModelSelection.config`.

**Plan.**
1. Where a session config property and the open session's model both name the same key, take the values from the model and the key, title and words from the host's session schema.
2. Leave the model's row as it is where nothing matches.
3. Test: a model accepting one level, against a session schema offering five.

## B-01-17 - Answering what a host asks

**Missing.** All ten of `ServerCommandMap` - `resourceRead`, `resourceWrite`, `resourceList`, `resourceCopy`, `resourceDelete`, `resourceMove`, `resourceResolve`, `resourceMkdir`, `resourceRequest`, `createResourceWatch`. The package installs a default that answers `-32601`, so nothing hangs, and refusing is a legal answer - the registry says the receiver decides whether to allow, deny or prompt. But zero of ten implemented is zero of the protocol's reverse half.

**Blocks.** Nothing today: the reverse direction exists so a host can read URIs the client *published*, and this client publishes none. Neither capture contains a single host-initiated request. It is the one part of the protocol this client has no implementation of at all.

**Serving anything by default would be a mistake**, so the content is opt-in and the refusal is the default rather than the gap.

**Plan.**
1. A request handler layer on the connection, so a host-initiated method is routed rather than falling through to the package's default. Refuse every URI with `-32009` until something opts in.
2. `--publish <dir>`, serving that directory and nothing else under `virtual://ahpc/`, with every path resolved and checked to be inside it.
3. Implement the read half against it - `resourceRead`, `resourceList`, `resourceResolve`, `resourceRequest` - and refuse the write half unless `--publish-writable` is given.
4. `createResourceWatch` over the same directory, so a host is told rather than polling.
5. Test: a scripted host reading a published file, and being refused a path outside the directory and a scheme that is not ours.

**One thing this cannot settle.** The protocol has no way for a client to register a URI scheme, so a host talking to two clients cannot tell whose `virtual://` is whose. `virtual://ahpc/` is a convention this client is choosing. The host's roadmap has the same question from its side.

## B-01-21 - Checking what this client sends

**Missing.** `tools/validate.mjs` reads what a host sent. Nothing reads what this client sends, and both captures it has run against are another client's traffic.

**Blocks.** Nothing visibly, which is the point: both hosts turned out to be sending undeclared fields, and this client builds outbound payloads with the same conditional spreads that caused it.

**Plan.**
1. Route client frames by method into the package's `*Params` declarations, next to the existing URI-to-state map.
2. Run it over the captures already on disk - the client half is in the same files.
3. A `--record <file>` flag on `ahpc` writing its own frames, so a capture can be made from a session rather than borrowed.
4. Fix whatever it finds.

## B-01-10 - Writing to the host's filesystem

**Missing.** `resourceWrite`, `resourceDelete`, `resourceMkdir`, `resourceMove`, `resourceCopy` and `resourceResolve`, at every layer. `resourceList`, `resourceRead` and `resourceRequest` are served, so the browser is a viewer and the grant negotiation this client implements is negotiating for a capability nothing uses.

**Plan.**
1. All six on `HostConnection`, `fake.ts` and `live.ts`.
2. `ahpc resource write|rm|mkdir|mv|cp|stat`.
3. Read-modify-write carries `resourceResolve`'s `etag` as `ifMatch`, and `-32011` is drawn as the conflict it is rather than a generic failure.
4. Rename, delete and new-file keys in the browser, behind the write grant, each asking the operation's own confirmation and the grant separately.
5. Test: a scripted host refusing on a stale `ifMatch`, and one refusing the grant.
