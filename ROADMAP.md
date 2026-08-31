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

## B-01-07 — The verbs cannot be pressed from the screen

`ahpc changes --run` invokes them from a shell, and the changes screen draws them with their status and gets no further. What is missing is a place to ask: the protocol says a client **MUST** display an operation's `confirmation` before invoking, and this application has no prompt — the shell answers that with `--yes`, and a full-screen client cannot.

**Suggestions.** (1) A modal confirm over the changes screen, which every destructive control this client grows later will want as well. (2) A two-key press — the verb, then enter to mean it — which needs no new component and is a convention nobody has agreed to. (3) Leave it in the shell, and record that the screen shows what may be done and the command line does it, which is true today and is a smaller client.

## B-01-04 — The filesystem is only a completion

`resourceList` and `resourceRead` are on the connection, behind `ahpc resource`, and now on the scripted host too — but the only place a host's filesystem is *drawn* is the `@` completion in the composer. A host that serves files is one a person could browse; this client makes them type a path they cannot see.

The host no longer only serves the read half, which changes what this is worth: `resourceWrite`, `Delete`, `Mkdir`, `Move` and `Copy` are all served now, behind a `resourceRequest` grant. A browser over a tree that can be written is a different proposition from one over a tree that cannot.

The dependency question is settled — take the fiddly parts, keep our own layout — so what is left is only how much to build. `@textui/textide`'s `Explorer` is a whole screen with its own opinions and is the part *not* being taken.

**Suggestions.** (1) A minimal tree of our own over `resourceList`, opening into the diff viewer this client already has — smallest thing that stops people typing paths they cannot see. (2) That, plus writing through `resourceWrite` behind the grant, which is the first place this client would ever change somebody's files and wants the same confirmation B-01-07 is waiting on. (3) Leave it: the `@` completion reaches the same tree, and a browser is a convenience rather than a gap.

## B-01-05 — A diff is drawn from scratch here

`filediff.tsx` renders a changeset file from `before` and `after` text. `@textui/textide-git` already exports a diff renderer with `DiffMode`, `DiffCell` and `DiffPair`, hunk parsing (`parseHunks`, `hunkAt`, `patchFor`) and gutter marks — the parts this screen either has thinner versions of or does without.

Decided: adopt `parseHunks`, `hunkAt`, `patchFor` and the gutter marks, and keep our own layout. The hunk maths is fiddly and is not this client's business; the pane is.

**Suggestions.** (1) Take the four and leave `filediff.tsx`'s layout alone, which is the decision as made. (2) Take the gutter as well, so a long file scrolls by hunk rather than by line — the thing our version does without and the one people notice. (3) Take nothing yet and record the decision, so the next person reads it here instead of re-arguing it.

---

# Notes

**On depending on nothing.** This client depends on no agent SDK and on no particular host. Anything added here that names one harness is a mistake, and `--claude` was one: it made a client that could talk to any host need one specific host installed to talk to any of them. B-01-04 and B-01-05 are the live version of that question — TextUI is not a harness, but it is a dependency, and the answer should be the same for both entries.

**On the scripted host.** It implements every optional method on the seam except `close`, and `test/fake.test.ts` names them, so a method added to `HostConnection` and not to the fake fails there rather than being noticed a screen later. It has already earned this once: it delivers its opening snapshot *synchronously* inside `subscribe`, which a socket does not, and that difference was hiding a real bug in `until()` — every waiting command failed against the scripted host and worked against a daemon.

**On reusing TextUI.** Decided, so it is not re-argued per screen: take the fiddly parts and keep our own layout. `parseHunks`, `hunkAt`, `patchFor` and the gutter marks from `@textui/textide-git` are hard to get right and are not this client's business; the panes are. That is B-01-05's answer and B-01-04's, and it is why neither is a dependency question any more.
