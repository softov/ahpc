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

## B-01-05 — A diff is drawn from scratch here, and will stay that way

Closed as **not viable**, and the reasoning is worth keeping so nobody re-opens it.

Two things were checked and neither was known when this entry was written. `@textui/textide-git` is `private: true` at `0.1.0` and is **not published** — ahpc consumes `@textui/core@0.3.0` and friends from npm, so reusing it means publishing it, vendoring it, or making this repository a member of the TextUI workspace. That is a decision about two projects rather than about a screen.

And the overlap is much smaller than this entry claimed. Every diff primitive there — `parseHunks`, `pairsOf`, `classify`, `hunkOfLine` — takes **unified diff text**: lines starting with `+`, `-` and `@@`, as `git diff` writes them. This client never has one. AHP carries a changeset as `before` and `after` content refs, so `filediff.tsx` computes `diffLines(before, after)` and there is no patch anywhere in the pipeline to parse. What is genuinely shared is `scrollDiff`, which is three lines, and the gutter marks.

So the decision recorded against this entry — take the fiddly parts, keep our own layout — was answering a question that does not arise: the fiddly part is hunk parsing, and hunk parsing needs a format this protocol does not carry.

**Suggestions.** (1) Close it, which is what this says. (2) If per-hunk staging is ever wanted here, the missing piece is a host that can *produce* a patch — `changeset/*` has no such thing today, so it is a protocol gap rather than a client one, and belongs on the host's roadmap. (3) Publish `textide-git` anyway if some other screen wants its components, and re-open this with what actually overlaps rather than with what looked like it did.

---

# Notes

**On depending on nothing.** This client depends on no agent SDK and on no particular host. Anything added here that names one harness is a mistake, and `--claude` was one: it made a client that could talk to any host need one specific host installed to talk to any of them. B-01-04 and B-01-05 are the live version of that question — TextUI is not a harness, but it is a dependency, and the answer should be the same for both entries.

**On the scripted host.** It implements every optional method on the seam except `close`, and `test/fake.test.ts` names them, so a method added to `HostConnection` and not to the fake fails there rather than being noticed a screen later. It has already earned this once: it delivers its opening snapshot *synchronously* inside `subscribe`, which a socket does not, and that difference was hiding a real bug in `until()` — every waiting command failed against the scripted host and worked against a daemon.

**On what is left of TextUI reuse.** Two entries were closed by the same discovery rather than by being built: `@textui/textide` and `@textui/textide-git` are `private: true` and unpublished, and this client takes `@textui/core` from npm. The file browser was built here instead; the diff was closed outright, because its reusable parts read a unified patch AHP does not carry.

**On checking a schedule without understanding one.** `src/schedule.ts` reads the protocol's five-field grammar and stops there: it will say `60 is not a minute`, and it will not say when an expression next comes round. That second question is the host's - it owns the clock and the zone - and it answers it by sending back `nextRunAt`. A client that computed its own would be a second answer to a question somebody is going to be woken up by. What the check is for is the moment of typing: a daemon keeps a definition whose expression it could not read, and reports the problem to its own log, where the person who made the typo will never see it.

**On asking twice.** Running a destructive verb from the screen asks two questions, not one: the operation's own `confirmation`, and then whether to grant the host write access. They read like the same question and are not — "discard this file" is about a file, and the grant is about the repository — so a client that folded them together would be one where saying yes to a diff quietly hands over the working tree.

**On reusing TextUI.** It was decided to take the fiddly parts and keep our own layout, and then it turned out there is nothing to take: `@textui/textide` and `@textui/textide-git` are both `private: true` and unpublished, and their diff primitives read a unified patch that AHP never carries. Recorded because the decision was sound and the premise under it was mine and was wrong — see B-01-05.
