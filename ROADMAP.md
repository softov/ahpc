# What is next, and why

This is the client. The host has its own roadmap and its own `A-` series; entries here are `B-`, and one that waits on the other side says so by name. Each entry says what it costs a person today, and each ends with the two or three ways it could go - so a decision is a choice between named options rather than an open question.

Each entry carries a **reference code** so a conversation, a commit or an issue can name one without quoting it. `B-01-xx` is something missing; `B-02-xx` is something wrong. A code belongs to its entry for as long as the entry exists and is not reused after it is removed - a number that came back meaning something else would make every older reference to it silently wrong, which is why the numbering starts where it does.

What has shipped is not listed. This file is what is left; `git log` is what was done, in the words the change was made in.

---

# What this client is a client of

Worth saying once, because it is the mirror of what the host's roadmap says about itself, and because getting it backwards would shape every entry below.

**This client is not ahpd's front end.** It speaks AHP, and the protocol has more than one host - VS Code's is the other implementation, and a session opened there is one this client can drive. Nothing here may name a harness, and nothing here may assume a host serves everything ahpd serves: a scope a host does not advertise must simply not appear, a method it answers `-32601` to must be a control that is not drawn, and both of those are the *normal* case rather than an error path.

That cuts the other way too. A feature is not unnecessary because ahpd is the only host that has it today - ahpd is one host of several, and a screen built against the protocol works against the next one.

---

# How a gap gets found here

The host's roadmap says a gap is found by diffing the protocol's sources on every bump and by reading the reference client. Both are true here as well, and neither is what found the two entries at the top of this file.

**Drive the protocol layer, not the seam.** Every test in this repository but one drives `fakeHost`, which implements the seam `live.ts` produces rather than the protocol underneath it. That is a good seam and a bad net: a defect between `HostConnection` and the wire is invisible to all of it, which is how this client came to leak every subscription it ever opened and to treat a dropped socket as the end of the session. `test/reconnect.test.ts` is the first test that drives `liveHost` itself, over an in-memory transport against a host scripted frame by frame, and it exists because that is the only place those defects were visible.

**Read what the host actually answers, not what the seam asked for.** `listSessions` asked for a hundred rows for the life of this client, and the number was invisible from every screen: the catalogue looked complete because a hundred was more than anybody had. It stopped being invisible when the catalogue on the other side grew past it. A limit this client sets is a limit only this client can see.

**Point it at a host that is not ours.** One evening against VS Code's agent host produced more findings than any amount of reading did: an expected refusal printing on every command, a protocol version negotiated that this client has no implementation of, and a transcript that comes back empty because the snapshot carries no turns. Two of those are entries below and none of them was visible against ahpd, because ahpd and ahpc agree with each other by construction.

---

## B-01-08 - Against a VS Code host, no conversation can be read at all

`fetchTurns` is not called anywhere in this client, and no screen offers to load more. History is whatever arrived in the subscription snapshot.

**How big that is depends on the host, and one of them sends none.** ahpd puts the newest fifty turns in the snapshot, which made this look like a paging entry: the fifty-first turn back was unreachable and the rest was fine. Against VS Code's agent host, `session history` on three different sessions printed no turns and no fault - the channel resolved and the snapshot carried nothing. So on that host the snapshot is not a short history, it is no history, and `fetchTurns` is not the way to read *more* of a conversation but the only way to read *any* of it.

**What it costs today.** Against ahpd, a session's own beginning - the message that started it, the one a person scrolls up to find - is the first thing to fall off. Against a host that sends no turns in the snapshot, the transcript is empty and this client has no way to fill it.

**Suggestions.** (1) `loadOlderTurns(uri)` on the seam, driven by a scroll to the top of the transcript and by `session history --all` on the command line. The turns come back as `chat/turnsLoaded`, which is an action, so the reducer path that already exists handles them and no second way of getting a turn onto the screen is invented. (2) The same, plus one automatic fetch when a chat opens on a host whose snapshot was empty - which is what makes it work against VS Code rather than merely better against ahpd. (3) Fetch the whole history whenever a session is opened, which is simpler and is a client deciding to download a year of somebody's conversation because they clicked on it.

## B-02-02 - This client offers a protocol version it cannot speak

`VERSIONS` in `src/ahp/live.ts` is `['1.0.0', '0.9.0', '0.8.0', '0.7.0']`, and the package this client is built from declares `PROTOCOL_VERSION = '0.9.0'`. The registry that declares it is explicit about what the first entry means: *"The first entry MUST equal `PROTOCOL_VERSION` - the version 'new code speaks' is by definition the most preferred one."* This client's first entry is a version it has no implementation of.

**Revalidated, because the reason it is there turns out to be right.** The comment above the list says a VS Code host accepts `^1.0.0` and nothing 0.x, and that reads like an excuse until you check it. `negotiateProtocolVersion` in the reference tree takes the client's list and keeps only entries where `isCompatibleProtocolVersion(offered, current)` holds, and that function's first test is that the **majors must match**. A host running `current = '1.0.0'` therefore rejects `0.9.0`, `0.8.0` and `0.7.0` outright - not as too old, but as a different major. So against VS Code's host, `1.0.0` is not this client's preference: it is the only entry of the four that can be accepted at all, and removing it does not make this client conformant-and-compatible, it makes it conformant-and-unable-to-connect.

**So the decision stands and the exposure is real.** If a 1.0.0 host answers `1.0.0`, this client proceeds under a version whose wire format it has never seen, using a library built for 0.9.0.

**What it costs today, now that it has been run.** This was written as a risk with nothing observed behind it. It has since been exercised: connected to VS Code's agent host, this client negotiated `1.0.0` and read every answer with 0.9.0 code. The catalogue came back and rendered; the transcripts came back empty (`B-01-08`). Whether those empty transcripts are a host that expects `fetchTurns` or a field that moved between the two versions cannot be told apart from here, and that is exactly the failure mode this entry predicted - it does not look like a version problem, it looks like a screen that is wrong.

**Suggestions.** (1) Find out what 1.0.0 actually changed and either implement it or stop offering it - the delta is readable in the local MIT-licensed checkout, and this is the host roadmap's `Q-001` seen from the other side. Until somebody reads it, every other option here is a guess. (2) Keep offering it and *say so*: record in this file and in the comment that the claim being made is "we believe 0.9.0 and 1.0.0 differ in nothing this client reads", which is a claim somebody can check rather than a list somebody can misread. (3) Drop `1.0.0` and accept `-32005` from VS Code's host, which is honest, conformant, and gives up the only third-party host in existence.

## B-01-09 - A host that wants signing in cannot be signed into

`authenticate` is absent at every layer, and `-32007` arrives as text in a refusal. `auth/required` now reaches this client - the protocol notifications stopped being discarded when the catalogue started reading them - and there is nothing to route it to.

**What it costs today.** A host with any protected resource is unusable from here: the operation fails, the message says authentication is required, and there is no way to provide it without leaving the client. This is not a corner - ahpd advertises protected resources for the harness it runs.

**Suggestions.** (1) `authenticate()` on the seam, with the token resolved from a flag, then an environment variable named after the resource, then a prompt in the TUI and a refusal naming the variable on the command line. Push it and retry the operation that failed. (2) The same, and re-push on `auth/required` with `reason: 'expired'`, which is the case a long-lived client actually meets. (3) Leave it and document that this client cannot drive a host with protected resources, which is a smaller claim than the client currently makes for itself.

## B-01-10 - The filesystem is readable and not writable

`resourceList`, `resourceRead` and `resourceRequest` are served. `resourceWrite`, `resourceDelete`, `resourceMkdir`, `resourceMove`, `resourceCopy` and `resourceResolve` are not, at any layer.

**What it costs today.** The file browser is a viewer. A host that serves its write half - ahpd does, behind the grant this client already knows how to ask for - offers nothing this client can reach, and the grant negotiation that is already implemented is negotiating for a capability nothing here uses.

**Suggestions.** (1) Add the six to the seam and to `ahpc resource` as `write`, `rm`, `mkdir`, `mv`, `cp`, `stat`, using `resourceResolve`'s `etag` as `ifMatch` on a read-modify-write and surfacing `-32011` as the conflict it is rather than a generic failure. (2) Take `resourceResolve` and `resourceWrite` only, which is the pair that makes editing possible and leaves the rest for when a screen wants them. (3) Leave it and let the browser be a browser, which is defensible for a chat client and stops being defensible the moment somebody wants to fix a file the agent got wrong.

## B-01-11 - A terminal is read, and only typed into

`terminal/input` is dispatched. `terminal/resized`, `terminal/cleared`, `terminal/claimed` and `terminal/titleChanged` are not dispatched anywhere, and all four are client-dispatchable.

**What it costs today.** The host is never told how wide this client is drawing the terminal, so output wraps at a width nobody chose. There is no way to clear the scrollback, rename a terminal, or take one that a session is holding. `terminal/cleared` is newly served by ahpd, so the host half of that one is waiting on this side.

**Suggestions.** (1) Dispatch `resized` from the terminal view's own resize and offer clear, rename and claim as commands - four dispatches, one screen. (2) Dispatch `resized` alone, because it is the one whose absence makes the output wrong rather than merely fixed. (3) Leave it, and accept a terminal that is a log with a keyboard.

## B-01-12 - Nothing says this client is in the session

`session/activeClientSet` is never dispatched, so this client never appears in another client's `activeClients`, and the session header shows nobody - including the people who are actually there.

**What it costs today.** Two people on one session cannot see each other. That is most of the reason a sessions server exists rather than a local agent, and this client is invisible in it.

**Suggestions.** (1) Dispatch on opening a session view and let the host remove it - membership is host-kept, and removal already happens on unsubscribe, which this client now sends. (2) The same, and draw the session's own `activeClients` in the header, which is the half a person can see. (3) Leave it, and be a client that watches without being watchable.

## B-01-13 - A dispatch the host refuses looks like one that did nothing

`ActionEnvelope.rejectionReason` is never read. Neither is `origin`.

**Revalidated, because the audit's framing of this one was wrong for this client.** The specification's reconcile loop is: apply optimistically, match the echo by `origin.clientSeq`, revert on `rejectionReason`. This client applies nothing optimistically - it waits for the host's echo for everything - so there is no prediction to revert and **nothing here is out of spec**. Write-ahead is a thing a client may do, not a thing it must.

What is wrong is smaller and is not about reconciliation at all. A host that refuses an action now says so, in words, in an envelope this client drops on the floor. So the flag does not move, the screen does not change, and nobody is told why. Before ahpd emitted rejections that was invisible; it emits them now.

**What it costs today.** An action the host will not take is indistinguishable from one that worked and changed nothing.

**Suggestions.** (1) Read `rejectionReason` and show it, and leave the optimistic half alone - that is the whole defect, and it is a branch in the event handler. (2) Take the optimistic path as well, for the small safe set only - draft, queue order, read and archive flags, review ticks - matching the echo by `origin.clientSeq` and reverting on a rejection. Not turn content. (3) Leave it, and accept that a refusal is silent.

## B-01-14 - The handshake is more round trips than it needs

`initialize` sends `clientId`, `protocolVersions` and `clientInfo`, and the automations channel is now asked for only where `InitializeResult.automations` advertised it. What is left is that `initialSubscriptions` is not sent, so the root channel is a separate `subscribe` afterwards, and neither is `locale`. `capabilities` is deliberately absent - see the decisions below.

**What it costs today.** A round trip that could have been folded into the handshake, on every connection and every reconnect. Small, and the reason it is still written down is that the reconnect path now does the same thing twice a day rather than once a launch.

**Suggestions.** (1) Pass `initialSubscriptions` and apply the snapshots that come back - the supervisor already does exactly this on the `initialize` fallback, so the shape exists and only the first connection does not use it. (2) The same plus `locale`, which costs one field and is the only way a host can localise anything it sends. (3) Leave it: it is one round trip, and nobody has felt it.

## B-01-15 - Automations are a screen and not a command

The catalogue, create, update, run and remove exist on the seam and in the TUI. There is no `ahpc automation` on the command line, `listAutomationTriggerDefinitions` is never called, and run history is never paged.

**What it costs today.** Nothing an automation does can be scripted, which is a strange shape for a feature whose whole purpose is doing things without a person present. And because trigger definitions are never fetched, only a schedule can be authored here - an event trigger is not offerable, because this client never asks the host what events it has.

**Suggestions.** (1) `ahpc automation list|show|new|run|enable|disable|rm|runs`, and call `listAutomationTriggerDefinitions` before drawing the trigger form. (2) The command line first and event triggers later, since the two are independent and the first is what makes the feature usable from a script. (3) Leave it as a screen.

## B-01-16 - The host's log and its files have no reader

`otlp/exportLogs` is served by ahpd on an advertised template and nothing here expands it. `createResourceWatch` is served and nothing here creates one, so the changeset and file screens re-read on a timer where the host would have told them.

**What it costs today.** Debugging a host means reading the daemon's own output somewhere else. And a file that changes under an open screen is seen when the screen next looks, which is the polling this client's own notes say it should not be doing.

**Suggestions.** (1) `ahpc logs [--level L] [--follow]`, expanding `InitializeResult.telemetry.logs`, and a resource watch behind the changeset and file screens - released on close, which the channel registry now does by itself. (2) The watch first: it removes a poll, and the log command is a convenience. (3) Leave both, and keep re-reading.

## B-01-17 - A resource this client could serve, it does not

AHP is symmetrical, and the package answers a host-initiated request with `-32601` because no handler is installed.

**Revalidated: this is in spec, and it is not a defect.** `ServerCommandMap` is what a host *may* ask; a client that serves none of it and says `MethodNotFound` is answering correctly, and the package's default exists to make sure the host does not leak a pending request waiting for an answer that never comes. This entry is a *feature* that is absent, not a rule that is broken.

**What it costs today.** Nothing, and it will cost nothing until this client has something worth publishing. It pairs with the host's `A-01-15`, which is blocked on the same unanswered question - the protocol has no way for a client to register a URI scheme, so a host with several clients cannot know whose `virtual://` is whose.

**Suggestions.** (1) Wait, and let the first thing that wants publishing decide the shape. (2) Serve one explicitly opted-in directory under a `virtual://ahpc/…` prefix, refusing everything else with `-32009`, and never by default - a client that serves its filesystem to any host it connects to is a mistake, not a feature. (3) Close it and say this client is a consumer only.

## B-01-18 - Forks, side chats, and values that have to be looked up

`createChat.source` is never sent, so a fork or a side chat cannot be started from here even where an agent advertises `capabilities.multipleChats`. `sessionConfigCompletions` is never called, so a config property whose values are dynamic renders as free text.

**What it costs today.** Little, and only against a host that advertises them - ahpd advertises neither today. It is here so that a capability a host does grow is not unreachable by accident.

**Suggestions.** (1) Read the agent's capabilities and offer fork and side chat exactly where they are advertised, which is the rule the rest of this client already follows. (2) Wait until a host advertises one, and take both then. (3) Take `sessionConfigCompletions` only alongside the first property that needs it, which is the host's `A-01-03c` seen from here.

## B-01-05 - A diff is drawn from scratch here, and will stay that way

Closed as **not viable**, and the reasoning is worth keeping so nobody re-opens it.

`@textui/textide-git` is `private: true` at `0.1.0` and is **not published** - this client consumes `@textui/core` and friends from npm, so reusing it means publishing it, vendoring it, or making this repository a member of the TextUI workspace. That is a decision about two projects rather than about a screen.

And the overlap is much smaller than this entry once claimed. Every diff primitive there - `parseHunks`, `pairsOf`, `classify`, `hunkOfLine` - takes **unified diff text**: lines starting with `+`, `-` and `@@`, as `git diff` writes them. This client never has one. AHP carries a changeset as `before` and `after` content refs, so `filediff.tsx` computes `diffLines(before, after)` and there is no patch anywhere in the pipeline to parse. What is genuinely shared is `scrollDiff`, which is three lines, and the gutter marks.

**Suggestions.** (1) Close it, which is what this says. (2) If per-hunk staging is ever wanted here, the missing piece is a host that can *produce* a patch - `changeset/*` has no such thing today, so it is a protocol gap rather than a client one, and belongs on the host's roadmap. (3) Publish `textide-git` anyway if some other screen wants its components, and re-open this with what actually overlaps rather than with what looked like it did.

---

# Decisions that put this client outside the specification

Four were checked against the protocol's own declarations and the reference implementation rather than against memory. Two are real and are entries above; two turned out to be conformant and are recorded here so nobody re-opens them.

**Offering a version this client does not implement.** Real, and it is `B-02-02`. The package's registry states the first offered version MUST be the one the code speaks, and this client's is not. Checked and not excused: the reason it is there is sound, which is what makes it a decision rather than a bug.

**Showing a truncated catalogue as a whole one.** Real in effect if not in letter, and it is `B-02-01`. Nothing in the specification forbids asking for a hundred rows. What it forbids is nothing - `nextCursor` is offered and this client drops it - and the result is a screen that is confidently wrong, which is the class of defect the host's audit was written about.

**Not reconciling against `origin`.** Checked and **conformant**. Write-ahead is what a client *may* do; this one applies nothing optimistically and so has nothing to revert. The real gap is that it never reads `rejectionReason`, which is `B-01-13` and is about telling a person, not about reconciling state.

**Declaring no `ClientCapabilities`.** Checked and **conformant**. The field is a set of presence flags and absence means unsupported - which is exactly true here: `mcpApps` is the only flag defined, a terminal cannot host a View sandbox, and claiming it would invite traffic this client could not answer. Keep it absent, and keep it absent deliberately.

---

# Notes

**On depending on nothing.** This client depends on no agent SDK and on no particular host. Anything added here that names one harness is a mistake, and `--claude` was one: it made a client that could talk to any host need one specific host installed to talk to any of them.

**On the scripted host, and on what it cannot see.** `fakeHost` implements every optional method on the seam except `close`, and `test/fake.test.ts` names them, so a method added to `HostConnection` and not to the fake fails there rather than being noticed a screen later. It has already earned this once: it delivers its opening snapshot *synchronously* inside `subscribe`, which a socket does not, and that difference was hiding a real bug in `until()`.

What it cannot see is anything below the seam, and that blind spot is not small - a leaked subscription and a connection that never came back both lived there for the life of this project. `test/reconnect.test.ts` drives the protocol layer directly and is where that class of test belongs.

**On checking a schedule without understanding one.** `src/schedule.ts` reads the protocol's five-field grammar and stops there: it will say `60 is not a minute`, and it will not say when an expression next comes round. That second question is the host's - it owns the clock and the zone - and it answers it by sending back `nextRunAt`. A client that computed its own would be a second answer to a question somebody is going to be woken up by. What the check is for is the moment of typing: a daemon keeps a definition whose expression it could not read, and reports the problem to its own log, where the person who made the typo will never see it.

**On asking twice.** Running a destructive verb from the screen asks two questions, not one: the operation's own `confirmation`, and then whether to grant the host write access. They read like the same question and are not - "discard this file" is about a file, and the grant is about the repository - so a client that folded them together would be one where saying yes to a diff quietly hands over the working tree.

**On why a refused resume is not a failure.** The supervisor treats a `reconnect` the host *refuses* differently from one the socket loses: a refusal falls back to `initialize`, and only a transport failure is retried. That asymmetry is not general - it is true because `clientId` on ahpd is per process, so a restarted daemon has genuinely never heard of this client and will go on refusing for as long as it is asked. A host that persisted client ids across a restart would make a refusal worth retrying and the fallback dead weight. The constraint and the code belong together: if that changes on a host this client talks to, this is the thing to revisit.

**On letting go of a channel.** A subscription is per channel and not per reader, so a second reader must not subscribe again and the first to leave must not unsubscribe. That is counted in `src/ahp/channels.ts` rather than in the screens, because a screen that gets it wrong takes down a stream some other screen is reading, and the failure looks like the host having stopped rather than like a mistake here.
