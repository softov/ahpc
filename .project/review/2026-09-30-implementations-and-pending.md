---
title: What is implemented on disk, and what is still only planned
status: active
date: 2026-09-30
refs:
  - git://6612e1b - HEAD when this was read, and a clean working tree
  - code://.project/plans/index.md - the row per plan this pass walks
  - code://.project/review/2026-09-26-before-launch.md - the pass that filed the open problems read here
  - code://test - the 34 files whose 652 cases were run
---

# Implemented, and pending

Two questions: does the code hold what the `implemented.md` files claim, and what is left to build.
Every built plan has its `implemented.md`; the two active plans had their code but no record; one plan has only its paper.
The two active plans were closed on 2026-09-30, after this pass: see [screen/03](../plans/screen/03-model-continuity/implemented.md) and [screen/08](../plans/screen/08-english-portuguese-or-spanish/implemented.md).

## What was checked

- `npm run typecheck` (`tsc -p tsconfig.json --noEmit`) is clean at `6612e1b`.
- `npx vitest run` is green: 34 files, 652 tests, 43 seconds.
- Under this sandbox the run needs `TMPDIR` inside the workspace, because vitest otherwise makes its optimizer cache under `/home/softov/.local/cache/tmp`, which the file policy denies and reports as `ENOENT`.
- The working tree is clean, so every claim below is at `6612e1b` and not in a local edit.

## Implemented and closed

Nine plans are `built`, each with an `implemented.md` whose "Verified" section names the cases it added.

| Plan | Delivered | Open edges it records |
| --- | --- | --- |
| [screen/01 update check](../plans/screen/01-update-check/implemented.md) | `src/update.ts`, the status row notice, `ahpc status`, README | none |
| [screen/02 turn details](../plans/screen/02-turn-details/implemented.md) | the round-ended part, per-turn edit counts, the `auth-required` notice | none |
| [screen/04 pull-request ownership](../plans/screen/04-pull-request-ownership/implemented.md) | the ownership filter in `pullRequest()` | the artifacts prong and the host half, both in other repositories |
| [screen/05 usage](../plans/screen/05-usage/implemented.md) | `TurnUsage`, the usage screen, `u` and its command | the manual pass against a live host |
| [screen/06 automations read before run](../plans/screen/06-automations-read-before-run/implemented.md) | the automation pane and form, the changes screen reset, ctrl+c twice | the review's not-taken list |
| [screen/07 moving between terminals](../plans/screen/07-moving-between-terminals/implemented.md) | the terminal keys and the list mode | alt+arrows left to the command field |
| [ahp/01 sign in on refusal](../plans/ahp/01-sign-in-when-a-host-refuses/implemented.md) | the modal prompt, one retry, the shell sentence | `deferred.md`: `src/mcp/`, a refused dispatch, `resourceToAsk` |
| [ahp/02 token before refusal](../plans/ahp/02-a-token-before-the-host-refuses/implemented.md) | `src/ahp/tokens.ts`, the push on connect, the silent look | the shell's refusal sentence, which is a filed problem |
| [ahp/03 connection token file](../plans/ahp/03-a-connection-token-from-a-file/implemented.md) | `--connection-token-file`, `connectionTokenFile`, `readTokenFile` | three filed problems, all still open |
| [ahp/04 no token on disk](../plans/ahp/04-no-token-on-disk-and-no-prompt-from-a-tick/implemented.md) | the redaction in `tee`, the unguarded background reads | none |

The older `implemented.md` counts (534 to 636 tests) are lower than today's 652 because later plans added cases; that is drift in the note, not a gap in the code.

## Implemented, then closed after this pass

Two plans are `active` with every task `done`. Their code is on disk and green, and neither has an `implemented.md`.

| Plan | Code confirmed | The `requires` it was waiting on |
| --- | --- | --- |
| [screen/03 model continuity](../plans/screen/03-model-continuity/plan.md) | `QueuedMessage.model` at [`code://src/ahp/types.ts#L275-L280`](../../src/ahp/types.ts#L275-L280), `detail.modelConfig` at [`code://src/ahp/types.ts#L112`](../../src/ahp/types.ts#L112), the seed at [`code://src/control.ts#L852`](../../src/control.ts#L852) | a `@textui/chat` release with the queued model slot |
| [screen/08 english portuguese spanish](../plans/screen/08-english-portuguese-or-spanish/plan.md) | `src/i18n/{en,es,pt-BR}` and `locale.ts`, ids such as `automations.show` at [`code://src/control.ts#L1499`](../../src/control.ts#L1499) | a `@textui/*` release with `t(key, values, fallback)` and the chrome keys |

**Finding: the blocker on both is gone.** `package.json` already asks for `@textui/* ^0.7.0`, and the installed 0.7.0 carries what both plans named: `blocks.d.ts` has the queued block's optional `model` ("what the host will run it on, when the host said"), `core/dist/core/i18n.d.ts` has `t(key, values?, fallback?)`, and `widgets/dist/overlay/command-palette.js` reads its chrome through `i18n.t`. Both were closed on 2026-09-30 with an `implemented.md` each, `status: built` and the index rows; screen/08 also has a `deferred.md` for the four things that stay English.

## Planned and not started

One plan is `planned` with six `todo` tasks, in dependency order.

| Task | Depends on |
| --- | --- |
| [01 - an operation carries its arguments](../plans/screen/09-git-changes-take-their-arguments/task-01-an-operation-carries-its-arguments.md) | - |
| [02 - a file says whether it is staged](../plans/screen/09-git-changes-take-their-arguments/task-02-a-file-says-whether-it-is-staged.md) | - |
| [03 - a commit asks for its message](../plans/screen/09-git-changes-take-their-arguments/task-03-a-commit-asks-for-its-message.md) | 01, 02 |
| [04 - a pull request is prepared in a form](../plans/screen/09-git-changes-take-their-arguments/task-04-a-pull-request-is-prepared-in-a-form.md) | 01 |
| [05 - the link is shown and copied](../plans/screen/09-git-changes-take-their-arguments/task-05-the-link-is-shown-and-copied.md) | 01 |
| [06 - the shell takes the same arguments](../plans/screen/09-git-changes-take-their-arguments/task-06-the-shell-takes-the-same-arguments.md) | 01, 04 |

[The plan](../plans/screen/09-git-changes-take-their-arguments/plan.md) is the only unstarted work with a full reconnaissance, a decision table and a test surface (`test/changes.test.tsx`) already named.

## Open problems, all from the launch pass

Seven problem files are `open`, and none of them has been turned into a plan. Two are major.

| Severity | Problem | The fix it names |
| --- | --- | --- |
| major | [a bad token file prints a stack in the screen](../problems/a-bad-token-file-prints-a-stack-in-the-screen.md) | give the screen the shell's one-sentence surface, and read the token only when there is a host |
| major | [`--token` means two things in `ahpc auth`](../problems/token-means-two-things-in-ahpc-auth.md) | give the resource token its own flag |
| minor | [the shell's refusal advice names two things that do not work](../problems/the-shells-refusal-advice-names-things-that-do-not-work.md) | two sentences, and only the variable in a refused command's |
| minor | [a refused connection token reads like an unreachable host](../problems/a-refused-connection-token-reads-like-an-unreachable-host.md) | say which of the two it was, or name both |
| minor | [every token file read failure is called a missing file](../problems/every-token-file-read-failure-is-called-a-missing-file.md) | report the reason, and expand `~` against the config's directory |
| minor | [the sign-in prompt leaves edges unsettled](../problems/the-sign-in-prompt-leaves-edges-unsettled.md) | carry the resource in `signIn`, guard the form in flight, settle on dispose |
| minor | [two comments disagree about what is retried](../problems/two-comments-disagree-about-what-is-retried.md) | decide which calls may run twice and write it down |

The two major ones and the retry question share a root: the connection and resource credentials are still read from one flag, one sentence and one comment.

## Not planned at all

- Five ideas: [the tool server](../ideas/the-tool-server.md), [deliberate duplication](../ideas/deliberate-duplication.md), [artifacts and references on screen](../ideas/artifacts-and-references.md), [subagent rows](../ideas/subagent-rows.md), [finding a host without being told](../ideas/finding-a-host-without-being-told.md).
- The [before launch](../review/2026-09-26-before-launch.md) list of what ahpapp has and this client does not: a live changeset, older automation runs, `New` gated on `automations.create`, renaming a session, totals on the changes screen, automation templates, unread and waiting filters.
- Three deferrals from [ahp/01](../plans/ahp/01-sign-in-when-a-host-refuses/deferred.md): a refusal in `src/mcp/`, a refused fire-and-forget dispatch, and the reference's `resourceToAsk` order.
- The missing tests the review named: the retry of a non-idempotent call, `cli()` turning `-32007` into an exit 1, the conflicting flags, and the screen's token-file error.

## Recommendation, in order

1. Done: screen/03 and screen/08 were reviewed and closed, since their blocker landed.
2. Start screen/09 task 01, which everything else in that plan depends on.
3. Plan the two major token problems together, because they both move `--token` and the refusal sentence.
