---
title: A commit asks for its message, a pull request is prepared in a form, and what the host sends back is shown - implemented
date: 2026-10-11
refs:
  - git://4e965fe
  - "[code://src/ahp/followup.ts](../../../../src/ahp/followup.ts)"
  - "[code://src/control.ts](../../../../src/control.ts)"
  - "[code://src/screens.tsx](../../../../src/screens.tsx)"
  - "[code://src/cli/main.ts](../../../../src/cli/main.ts)"
---

The two changeset verbs that take arguments now get them, on the screen and in the shell.
`commit` asks for its message in a prompt that opens on the session title.
The prompt says how many staged files the commit takes, and shows the host's confirmation.
`create-pr` asks the host to prepare the pull request, then opens a form on the host's draft, and sends the draft's `context` back unchanged.
A link that the host answers with goes on the status row as an OSC 8 link and on the clipboard.
The changes list marks staged files.

## What was built

- [`code://src/ahp/types.ts`](../../../../src/ahp/types.ts) - `FollowUp`, `Invoked`, and `FileEdit.staged` and `FileEdit.unstaged`.
- [`code://src/ahp/connection.ts`](../../../../src/ahp/connection.ts) - `invoke` takes `meta` and answers `Invoked`.
- [`code://src/ahp/live.ts`](../../../../src/ahp/live.ts) - the request sends `_meta`, `decodeInvoked` keeps `followUp`, and `changeset()` reads the staging flags.
- [`code://src/ahp/operate.ts`](../../../../src/ahp/operate.ts) - `meta` goes on the first try and on the retry after the grant.
- [`code://src/ahp/followup.ts`](../../../../src/ahp/followup.ts) - the data URI decode, `pullRequestDraft`, `externalLink`, `commitMeta`, `createPrMeta` and `chosenOperations`, with no textui.
- [`code://src/ahp/fake.ts`](../../../../src/ahp/fake.ts) - `prepare-pull-request` and `create-pr` on the working tree, staging flags on its files, and `meta` in `invoked()`.
- [`code://src/view/changes.tsx`](../../../../src/view/changes.tsx) - the staged mark, in a one-cell column that only a host that reports staging gets.
- [`code://src/control.ts`](../../../../src/control.ts) - the commit prompt, the pull request flow, `askWrite`, `askPullRequest` and the `answered` handler.
- [`code://src/screens.tsx`](../../../../src/screens.tsx) - `PullRequestForm`, and the verb row without `prepare-pull-request` when the host offers `create-pr`.
- [`code://src/state.ts`](../../../../src/state.ts) - `PULL_REQUEST`, `PULL_REQUEST_LAYER` and `HOST_LINK`; `forgetChanges` resets the keys and closes the layer.
- [`code://src/app.tsx`](../../../../src/app.tsx) - the status row draws the link and "copied", after a refusal and before the update notice.
- [`code://src/cli/main.ts`](../../../../src/cli/main.ts) - `--message`, `--title`, `--body` and `--draft` on `changes --run`, the prepare step, the printed link and the usage lines.
- [`code://src/flags.ts`](../../../../src/flags.ts) - `--draft` in `SWITCHES`.
- The i18n catalogue has the new strings in en, pt-BR and es.

## Verified

- `npm run typecheck` is clean.
- `npx vitest run`: 37 files, 716 tests, 715 passed and 1 failed.
- The failure is `test/smoke.test.tsx` "puts where the session runs on a row of its own". It fails because the worktree is not named `ahpc`, and it failed at baseline too (687 of 688 passed).
- `test/followup.test.ts` has 6 cases, `test/changes.test.tsx` has 35, `test/cli.test.ts` has 33 and `test/fake.test.ts` has 20.
- `lint-prose.mjs` passes on the plan folder.
- The 60 and 100 column layouts of the list and the form were read from test renders. The hand checks against a real host and in real terminals are open.

## Departures from the plan

- Tasks 03 and 06 - the commit message goes under `ahpd.commit`, not `ahp.commit`. The reference host reads only `ahpd.commit`, and ahpapp sends that key.
- Task 02 - the client reads `ahpd.staged` and `ahpd.unstaged` first and the bare names second. The reference host sends the `ahpd.` names.
- Task 02 - the mark is in `src/view/changes.tsx`, where `ChangesList` draws each row, and not in `src/screens.tsx`. It is a new one-cell column beside the kind icon, because the icon already says new, deleted or edited.
- Task 04 - the form draws its own buttons and not `FormActions`, because `FormActions` cannot disable submit for an empty title.
- Task 05 - a draft that reaches the shared handler shows only the host's message. The form reads the draft where it asks for one.
- Plan files - the sentences that `lint-prose.mjs` flagged at baseline were split or rewritten, with the same content.

## Left for later

- The hand check of commit, prepare and create against a host with a GitHub remote.
- The hand check of the OSC 8 link in a terminal with OSC 8 and in one without.
- The `checkout` verb and the `range` scope, which the plan names as gaps.
