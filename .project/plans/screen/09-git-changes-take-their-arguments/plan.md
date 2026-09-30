---
title: A commit asks for its message, a pull request is prepared in a form, and what the host sends back is shown
domain: screen
status: planned
priority: high
created: 2026-09-30
revalidated: 2026-09-30
requires: []
changes: []
creates: []
decisions: []
refs:
  - "[code://src/control.ts#L1795-L1862](../../../../src/control.ts#L1795-L1862) - `changes.run`, which invokes the chosen verb with no arguments and keeps only the host's message"
  - "[code://src/ahp/connection.ts#L365](../../../../src/ahp/connection.ts#L365) - `HostConnection.invoke`, which takes no `_meta` and answers `{ message }` only"
  - "[code://src/ahp/live.ts#L1250-L1256](../../../../src/ahp/live.ts#L1250-L1256) - `decodeInvoked`, which drops `followUp`"
  - "[code://src/ahp/live.ts#L1258-L1287](../../../../src/ahp/live.ts#L1258-L1287) - `changeset()`, which reads no `_meta.staged` or `_meta.unstaged` on a file"
  - "[code://src/ahp/live.ts#L3035-L3041](../../../../src/ahp/live.ts#L3035-L3041) - the `invokeChangesetOperation` request"
  - "[code://src/ahp/operate.ts](../../../../src/ahp/operate.ts) - `operate()`, the refusal and grant retry both front ends share"
  - "[code://src/ahp/fake.ts#L2027-L2063](../../../../src/ahp/fake.ts#L2027-L2063) - the fake host's `invoke`, which the screen tests run against"
  - "[code://src/ahp/types.ts#L290-L360](../../../../src/ahp/types.ts#L290-L360) - `FileEdit`, `Changeset` and `ChangesetOperation`"
  - "[code://src/screens.tsx#L1206](../../../../src/screens.tsx#L1206) - `ChangesScreen`, the list and the verbs it draws"
  - "[code://src/cli/main.ts#L664-L720](../../../../src/cli/main.ts#L664-L720) - `ahpc changes --run`, the shell's half"
  - "[code://src/flags.ts#L43-L65](../../../../src/flags.ts#L43-L65) - `SWITCHES`, where a flag that takes no value must be listed"
  - "[code://test/changes.test.tsx](../../../../test/changes.test.tsx) - the changes screen's tests against the fake host"
  - file:///github/ahpapp/src/changeset-ops.ts - `operationForm` and `commitMeta`, the reference client's reading of the two verbs that take arguments
  - file:///github/ahpapp/src/changeset-followup.ts - `decodeDataUri`, `pullRequestDraft`, `externalFollowUp` and `createPrMeta`
  - file:///github/ahpapp/src/components/ChangesView.tsx - `openPullRequest`, `start`, `submitCommit` and `drawFollowUp`, the flow this plan mirrors
  - file:///github/ahpapp/src/components/CommitForm.tsx - the staged count and the host's confirmation drawn inside the commit form
  - file:///github/ahpd/packages/sdk/src/changes.ts - the reference host: `ahp.commit.message`, `vscode.pullRequest` with `expectedContext`, and the prepared draft as a `data:application/json` follow-up
  - npm://@textui/widgets - `prompt`, `Form`, `TextArea` and `Switch` for the two asks
  - npm://@textui/core - `writeClipboard`, and the `link` prop that draws an OSC 8 hyperlink
---

## Goal

Committing from the changes screen asks for the message first, says how many staged files the commit takes, and shows the host's warning in the same place.
Creating a pull request first asks the host to prepare it, then opens a form on the title, description and branches the host suggested, and creates it with what the person kept or changed.
When the host answers with a link, such as the pull request it opened, the status row shows it as a link and it is on the clipboard.
The shell does the same through flags.
This is what ahpapp already does, in the terminal.

## Reconnaissance

The files read and the patterns to reuse are the `refs` above, each with its note.

### Searches performed

- `rg -n "invoke" src/ahp/connection.ts src/ahp/live.ts src/ahp/fake.ts` - one `invoke(changeset, operationId, target)` everywhere; nothing sends `_meta`, nothing reads `followUp`.
- `rg -n "staged" src/` - nothing; a file row does not know whether it is staged.
- `rg -n "ahp.commit|vscode.pullRequest|expectedContext" /github/ahpd/packages/sdk/src/changes.ts` - the keys the reference host reads, and the refusal when the tree moved since the form was prepared.
- `rg -n "export function prompt|writeClipboard|link\\?:" /github/textui/packages` - a text prompt, the clipboard and OSC 8 links are already in textui.

### Runtime path

```
x -> app.ask(changes.run) -> palette: the verbs offered
  -> changes.run(operation)
     commit     -> prompt(message; staged count; host confirmation) -> invoke(commit, _meta ahp.commit)
     create-pr  -> invoke(prepare-pull-request) -> followUp data:application/json -> form
                -> invoke(create-pr, _meta vscode.pullRequest + expectedContext)
     other      -> confirm when the host asks -> invoke
  -> followUp external -> status row link + clipboard · message -> status row
```

### Gaps

- The `checkout` verb takes its branch in `_meta` too, and is not in this plan; it gets the same path once task 01 exists.
- A `range` scope still cannot be chosen on this screen.

## Decisions locked in

| # | Decision | Rationale / source |
| --- | --- | --- |

| What | Source | Task |
| --- | --- | --- |
| An operation carries `_meta` and its answer keeps `followUp` | ahpapp `useChangesetOperation`; the reference host reads both | 01 |
| A file row knows whether it is staged, from the file's `_meta` | ahpapp `src/changes.ts`; the commit's count needs it | 02 |
| `commit` asks for its message in a prompt, filled with the session title, counting staged files and carrying the host's confirmation, and is not confirmed twice | ahpapp `CommitForm` and `ChangesView.invoke` | 03 |
| The pull request is one modal form: title, description text area, draft switch, branches read-only, filled from the prepared draft | Softov, 2026-09-30, asked "How should ahpc ask for a pull request's details before creating it?", answered "One modal form" | 04 |
| `expectedContext` goes back exactly as it arrived | the reference host refuses a tree that moved; ahpapp `createPrMeta` | 04 |
| `prepare-pull-request` is not offered when `create-pr` is, and runs as its first step; with no prepare, the form opens empty | ahpapp `ChangesView` | 04 |
| A link the host sends back is shown on the status row as a link and put on the clipboard | Softov, 2026-09-30, asked "When the host answers with a link, what should ahpc do with it?", answered "Status row link, and copy" | 05 |
| The shell gets `--message`, `--title`, `--body` and `--draft`, and prints the link | Softov, 2026-09-30, asked "Should the shell get the same arguments in this plan?", answered "Yes, in this plan" | 06 |

## Proposed architecture

- **Data flow** - `invoke(changeset, operationId, target, meta)` answers `{ message?, followUp? }`; `src/ahp/followup.ts` reads a follow-up into a draft or an external link, with no textui in it, so the screen and the shell share it.
- **Event flow** - `changes.run` looks at the operation id: `commit` and `create-pr` ask first, everything else runs as today.
- **State flow** - a new store key holds the last link, beside `HOST_ERROR`, and the status row draws it; `forgetChanges` clears it with the rest of the changes state.
- **Layer responsibilities** - `src/ahp/`: the wire, the decode, the fake host · `src/control.ts`: the asks · `src/screens.tsx` and `src/app.tsx`: the form, the row mark, the status row · `src/cli/main.ts`: the flags.
- **Source-of-truth files** - [`code://src/ahp/operate.ts`](../../../../src/ahp/operate.ts), [`code://src/control.ts`](../../../../src/control.ts)

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - an operation carries its arguments and brings back its answer](task-01-an-operation-carries-its-arguments.md) | todo | - |
| [02 - a file says whether it is staged](task-02-a-file-says-whether-it-is-staged.md) | todo | - |
| [03 - a commit asks for its message](task-03-a-commit-asks-for-its-message.md) | todo | 01, 02 |
| [04 - a pull request is prepared, then read in a form](task-04-a-pull-request-is-prepared-in-a-form.md) | todo | 01 |
| [05 - the link the host sends back is shown and copied](task-05-the-link-is-shown-and-copied.md) | todo | 01 |
| [06 - the shell takes the same arguments](task-06-the-shell-takes-the-same-arguments.md) | todo | 01, 04 |

## Risks and tradeoffs

- The screen names two host verbs, `commit` and `create-pr`, which the rest of the screen never does; a host with other ids for them gets today's behaviour, no worse.
- ahpc and ahpd share no package, so the follow-up decode is written again here rather than imported from ahpapp or ahpd.
- A terminal without OSC 8 shows the link as text; the clipboard write is what still makes it usable there.

## Resume state

- **Done so far:** nothing.
- **Next action:** [task-01-an-operation-carries-its-arguments.md](task-01-an-operation-carries-its-arguments.md).
- **Open questions:** none.
- **Watch out for:** `x` now goes through `app.ask`, so `changes.run` is reached with an `operation` argument from the palette; any new store key on the changes screen must be reset in `forgetChanges`.

## Final verification checklist

- [ ] `npm run typecheck` clean.
- [ ] `npx vitest run` passes, with the new cases in `test/changes.test.tsx` and the shell's tests.
- [ ] Commit, prepare and create checked by hand against a host with a GitHub remote.
- [ ] `plans/index.md` updated.
