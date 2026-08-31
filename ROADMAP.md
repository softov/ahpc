# What is next, and why

This is the client. The host has its own roadmap and its own `A-` series; entries here are `B-`, and one that waits on the other side says so by name. Each entry ends with the two or three ways it could go, so a decision is a choice between named options rather than an open question.

Each entry carries a **reference code** so a conversation, a commit or an issue can name one without quoting it. `B-01-xx` is something missing; `B-02-xx` is something wrong. A code belongs to its entry for as long as the entry exists and is not reused after it is removed — a number that came back meaning something else would make every older reference to it silently wrong.

What has shipped is not listed. This file is what is left; `git log` is what was done, in the words the change was made in.

Verified against a live host, not read off the source.

---

# What this client is a client of

Worth saying once, because it is the mirror of what the host's roadmap says about itself, and because getting it backwards would shape every entry below.

**This client is not ahpd's front end.** It speaks AHP, and the protocol has more than one host — VS Code's is the other implementation, and a session opened there is one this client can drive. Nothing here may name a harness, and nothing here may assume a host serves everything ahpd serves: a scope a host does not advertise must simply not appear, a method it answers `-32601` to must be a control that is not drawn, and both of those are the *normal* case rather than an error path.

That cuts the other way too. A feature is not unnecessary because ahpd is the only host that has it today — ahpd is one host of several, and a screen built against the protocol works against the next one.

---

## B-01-02 — The changes screen draws one changeset

A session offers several — what this conversation changed, what one turn changed, what changed between two, what the working tree has — and the screen draws the first that needs no filling in, then nothing else.

`ahpc changes --list` and `--scope` reach all of them from a shell, so the client can *read* every scope its host serves. The screen has no way to choose one, which means per-turn diffs exist, are captured on both sides, are fetchable, and are invisible to anybody looking at the screen. A turn's scope needs a turn picked out of the transcript, which is where the id is; `compare` needs two, which is a selection rather than a control and is the harder half.

Nothing waits on the host any more: the scripted host now answers a different changeset per scope, so this is buildable and checkable without a daemon running.

**Suggestions.** (1) A control row on the changes screen, like the composer's — the scopes with no variables are a picker, and the ones with variables are greyed until a turn is selected. (2) Reach the per-turn scope from the *transcript* instead: a key on a turn that opens the changes screen already scoped to it, which is where a person is when they want it and needs no picker at all. (3) Do both — the picker for `session` and `uncommitted`, the transcript for `turn` — and leave `compare` until somebody asks for it, since selecting two turns is a mode and the other two are not.

## B-01-03 — A file can be ticked off, and nothing draws the tick

`capabilities.review` says whether a changeset's files can be marked read, and `reviewed` says which are. Both are carried through the connection, both reach the shell, and both are now in the scripted host. The screen renders neither: there is no checkbox, and a file already ticked from elsewhere looks exactly like one nobody has read.

Small, and it belongs with B-01-02 — they are the same screen, and a person reading a diff wants to choose *which* diff and mark their way through it in the same breath.

**Suggestions.** (1) A glyph in the changes list and a key to toggle it, which is the whole feature and about twenty lines. (2) That, plus hiding reviewed files behind a filter, which is what makes review useful on a changeset of forty files rather than four. (3) Only draw it where the catalogue entry says `reviewable` — worth stating because the flag is per changeset, and a checkbox on a scope the host will not keep is a control that silently does nothing.

## B-01-07 — A changeset offers verbs and nothing here can press one

A host advertises `operations` on a changeset — commit, discard, revert — with a status per operation and a `confirmation` on the destructive ones that a client **MUST** display before invoking. ahpd serves all of it. This client does not carry `operations` across the seam at all, so there is nothing to draw and nothing to invoke.

There is a second half that is easy to miss and is the whole reason the first half is safe. An operation that writes is refused `-32009` until the connection holds a `resourceRequest` grant on what it would write, and the refusal *carries the request that would unlock it*. So the flow is: press, be refused, ask, press again — and a client that only knows how to press shows a button that fails and cannot explain why.

**Suggestions.** (1) Carry `operations` on `Changeset`, add `invoke(changeset, operationId, target?)` and `requestResource(uri, write)` to the seam, and answer a `-32009` by asking for the grant named in its own `data` before retrying once — which turns the negotiation into something a person never sees. (2) The same, but surface the grant as a prompt rather than retrying, on the grounds that "this will write to your repository" is exactly the moment a person should be asked and the protocol has already stopped to ask. (3) Read-only: draw the operations with their status and confirmation, greyed, and invoke none — honest, cheap, and worth almost nothing, since a button that cannot be pressed is a label.

## B-01-04 — The filesystem is only a completion

`resourceList` and `resourceRead` are on the connection, behind `ahpc resource`, and now on the scripted host too — but the only place a host's filesystem is *drawn* is the `@` completion in the composer. A host that serves files is one a person could browse; this client makes them type a path they cannot see.

There is something to reuse rather than build. TextUI's `@textui/textide` exports `Explorer` and `Editor` over a `ResourceProvider` — `{ scheme, stat, list?, read?, write? }` — which is close enough to `resourceList` / `resourceRead` that a provider backed by the protocol is a small adapter rather than a screen. `readonly: true` is already in its options, which is exactly what a host serving only the read half offers.

**Suggestions.** (1) Write the adapter and mount `Explorer` as a screen, reusing the tree, the icons and the keys. (2) Adapter plus `Editor` as a read-only viewer, so opening a file has somewhere to open into — the same component the changes screen would want for a whole-file view. (3) Build a minimal list of our own instead, if depending on `textide` from a client that deliberately depends on almost nothing is a trade worth refusing — that is the decision, and it is about dependency shape rather than about the code.

## B-01-05 — A diff is drawn from scratch here

`filediff.tsx` renders a changeset file from `before` and `after` text. `@textui/textide-git` already exports a diff renderer with `DiffMode`, `DiffCell` and `DiffPair`, hunk parsing (`parseHunks`, `hunkAt`, `patchFor`) and gutter marks — the parts this screen either has thinner versions of or does without.

Worth naming because it is the same question as B-01-04 and should be answered the same way: either this client reuses TextUI's components or it deliberately does not, and answering differently per screen is how two diff renderers end up in one application.

**Suggestions.** (1) Adopt the `textide-git` renderer and delete ours, keeping only the protocol-to-diff mapping. (2) Adopt only `parseHunks` and the gutter, which are the fiddly parts, and keep our own layout. (3) Keep ours and record that this client draws its own, so nobody re-opens it — the current one works, and a shared component that has to serve an IDE may not fit a chat client's pane.

## B-01-06 — A session cannot be taken out of the client

Everything a session is — its detail, its config, its turns, its changesets — can be read one command at a time and never as one document. There is no way to hand somebody a session, keep one after a host is gone, or diff two of them.

Export is the half that is possible: it is what `session show`, `session history` and `changes` already return, assembled. Import is not, and saying so is the point of the entry — nothing in the protocol carries a turn *into* a host, so a session read out of one cannot be put back into another.

**Suggestions.** (1) `ahpc session export <uri>` as one JSON document, which is assembly of what exists and needs nothing new. (2) That, plus a readable form — Markdown, one heading per turn — which is what somebody actually pastes into a ticket. (3) Leave it, and let `--json` on each command be the export, which is true today and costs a person three commands and a script.

---

# Notes

**On depending on nothing.** This client depends on no agent SDK and on no particular host. Anything added here that names one harness is a mistake, and `--claude` was one: it made a client that could talk to any host need one specific host installed to talk to any of them. B-01-04 and B-01-05 are the live version of that question — TextUI is not a harness, but it is a dependency, and the answer should be the same for both entries.

**On the scripted host.** It implements every optional method on the seam except `close`, and `test/fake.test.ts` names them, so a method added to `HostConnection` and not to the fake fails there rather than being noticed a screen later. Anything added to the seam for B-01-07 goes on both sides in the same commit — the drift that entry would otherwise reintroduce is the one B-01-01 existed to fix.
