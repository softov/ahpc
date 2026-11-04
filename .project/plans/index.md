---
title: Plans index
---

# Plans index

One row per plan; a plan is a folder with `plan.md` and one file per task.
Status: `draft` · `planned` · `active` · `built` · `dropped` (a task: `todo` · `doing` · `done` · `blocked` · `dropped`).
Format and rules: the `do-spec` skill in `.agents/skills/do-spec/`.
What is not planned yet is one file each under [`ideas/`](../ideas/), and a plan starts from one of them.

## screen

Reference: [00-screen.md](screen/00-screen.md)

| Plan | Priority | Status | Requires | Blocks |
| --- | --- | --- | --- | --- |
| [01 - Telling somebody the version is old](screen/01-update-check/plan.md) | medium | built 2026-09-18 ([implemented.md](screen/01-update-check/implemented.md)) | ahpd daemon/01 for the shared comparison table | - |
| [02 - Three corrections to what a chat turn draws](screen/02-turn-details/plan.md) | high | built 2026-09-20 ([implemented.md](screen/02-turn-details/implemented.md)) | - | - |
| [03 - The model a queued or reopened turn runs on](screen/03-model-continuity/plan.md) | medium | built 2026-09-30 ([implemented.md](screen/03-model-continuity/implemented.md)) | - | - |
| [04 - A session's own pull requests are told from the ones it inherited](screen/04-pull-request-ownership/plan.md) | medium | built 2026-09-20 ([implemented.md](screen/04-pull-request-ownership/implemented.md)) | ahpd `.project/plans/host/03-pull-request-baseline/plan.md` for the `initialPullRequestUrls` and `associatedPullRequestUrls` keys | - |
| [05 - A usage screen says what a session has spent](screen/05-usage/plan.md) | medium | built 2026-09-20 ([implemented.md](screen/05-usage/implemented.md)) | - | - |
| [06 - An automation is read before it is run, and the changes screen follows the session](screen/06-automations-read-before-run/plan.md) | high | built 2026-09-26 ([implemented.md](screen/06-automations-read-before-run/implemented.md)) | - | - |
| [07 - Moving between terminals from the keyboard](screen/07-moving-between-terminals/plan.md) | medium | built 2026-09-26 ([implemented.md](screen/07-moving-between-terminals/implemented.md)) | - | - |
| [08 - The client speaks English, Portuguese or Spanish, and its commands are typed noun.verb](screen/08-english-portuguese-or-spanish/plan.md) | medium | built 2026-09-30 ([implemented.md](screen/08-english-portuguese-or-spanish/implemented.md)) | - | - |
| [09 - A commit asks for its message, a pull request is prepared in a form, and what the host sends back is shown](screen/09-git-changes-take-their-arguments/plan.md) | high | built 2026-11-03; checked by hand ([implemented.md](screen/09-git-changes-take-their-arguments/implemented.md)) | - | - |
| [10 - The scopes and actions on the changes screen are clicked or reached with Tab](screen/10-the-changes-rows-are-clickable/plan.md) | high | built 2026-11-03; checked by hand ([implemented.md](screen/10-the-changes-rows-are-clickable/implemented.md)) | - | - |
| [11 - A file is staged, unstaged, discarded or committed from its row, or with every file](screen/11-a-file-is-staged-discarded-or-committed-from-its-row/plan.md) | high | built 2026-11-03; checked by hand ([implemented.md](screen/11-a-file-is-staged-discarded-or-committed-from-its-row/implemented.md)) | ahpd host/82 | - |
| [20261103-1256 - An error on the screen names its action and its session, and stays on that session](screen/20261103-1256-an-error-names-its-action-and-session/plan.md) | high | built 2026-11-04; checked by hand ([implemented.md](screen/20261103-1256-an-error-names-its-action-and-session/implemented.md)) | - | - |
| [20261103-1443 - The changes list follows the host while the screen is open](screen/20261103-1443-the-changes-list-follows-the-host/plan.md) | high | built 2026-11-04 ([implemented.md](screen/20261103-1443-the-changes-list-follows-the-host/implemented.md)) | - | - |
| [20261103-1529 - The commit prompt keeps its keys while the changeset changes](screen/20261103-1529-the-commit-prompt-keeps-its-keys/plan.md) | high | built 2026-11-04 ([implemented.md](screen/20261103-1529-the-commit-prompt-keeps-its-keys/implemented.md)) | - | - |
| [20261103-1600 - The header says ahpc, and the new session screen shows the logo](screen/20261103-1600-the-name-is-ahpc-with-its-logo/plan.md) | medium | built 2026-11-04 ([implemented.md](screen/20261103-1600-the-name-is-ahpc-with-its-logo/implemented.md)) | - | - |
| [20261103-1619 - The host's answer to a changeset verb is not drawn as a refusal](screen/20261103-1619-a-host-success-is-not-red/plan.md) | high | built 2026-11-04 ([implemented.md](screen/20261103-1619-a-host-success-is-not-red/implemented.md)) | - | - |
| [20261104-0437 - The status row does not end with the screen's name](screen/20261104-0437-the-status-row-drops-the-screen-name/plan.md) | medium | built 2026-11-04 ([implemented.md](screen/20261104-0437-the-status-row-drops-the-screen-name/implemented.md)) | - | - |
| [20261104-0549 - The waiting question folds to one line while you read](screen/20261104-0549-the-question-folds-while-you-read/plan.md) | medium | built 2026-11-04 ([implemented.md](screen/20261104-0549-the-question-folds-while-you-read/implemented.md)) | - | - |
| [20261104-0644 - The smoke test reads the checkout's folder name](screen/20261104-0644-the-smoke-test-reads-its-folder/plan.md) | medium | built 2026-11-04 ([implemented.md](screen/20261104-0644-the-smoke-test-reads-its-folder/implemented.md)) | - | - |
| [20261104-1621 - A still waits for the host to answer before it draws](screen/20261104-1621-a-still-waits-for-the-host/plan.md) | medium | built 2026-11-04 ([implemented.md](screen/20261104-1621-a-still-waits-for-the-host/implemented.md)) | - | documentation/20261104-1621-the-docs-pictures-come-from-a-demo-host |
| [20261104-1621 - The provider is the host's first agent, not claude](screen/20261104-1621-the-provider-is-the-hosts-first-agent/plan.md) | high | built 2026-11-04 ([implemented.md](screen/20261104-1621-the-provider-is-the-hosts-first-agent/implemented.md)) | - | documentation/20261104-1621-the-docs-pictures-come-from-a-demo-host |

Next free number in `screen`: `12`.

## ahp

Reference: [00-ahp.md](ahp/00-ahp.md)

| Plan | Priority | Status | Requires | Blocks |
| --- | --- | --- | --- | --- |
| [01 - Sign in when a host refuses, and run the refused act once more](ahp/01-sign-in-when-a-host-refuses/plan.md) | high | built 2026-09-24 ([implemented.md](ahp/01-sign-in-when-a-host-refuses/implemented.md)) | - | - |
| [02 - Push a token before the host refuses, and look for one before asking](ahp/02-a-token-before-the-host-refuses/plan.md) | high | built 2026-09-26 ([implemented.md](ahp/02-a-token-before-the-host-refuses/implemented.md)) | ahp/01 for the prompt and the retry it hangs off | - |
| [03 - Read the connection token from the file the host keeps it in](ahp/03-a-connection-token-from-a-file/plan.md) | medium | built 2026-09-24 ([implemented.md](ahp/03-a-connection-token-from-a-file/implemented.md)) | - | - |
| [04 - Keep resource tokens out of recordings, and keep a dismissed sign-in prompt dismissed](ahp/04-no-token-on-disk-and-no-prompt-from-a-tick/plan.md) | high | built 2026-09-26 ([implemented.md](ahp/04-no-token-on-disk-and-no-prompt-from-a-tick/implemented.md)) | - | - |
| [05 - ahpc speaks protocol 1.0.0](ahp/05-protocol-1-0-0/plan.md) | high | built 2026-10-07 ([implemented.md](ahp/05-protocol-1-0-0/implemented.md)) | - | - |
| [06 - Trusted folders are sent to the host on every connection](ahp/06-trusted-folders-are-sent-on-every-connection/plan.md) | high | built 2026-10-11 ([implemented.md](ahp/06-trusted-folders-are-sent-on-every-connection/implemented.md)) | - | - |
| [07 - A session's model is read as ahpd.model too](ahp/07-a-sessions-model-is-read-as-ahpd-model-too/plan.md) | high | built 2026-10-09 ([implemented.md](ahp/07-a-sessions-model-is-read-as-ahpd-model-too/implemented.md)); a13ec65 | - | ahpd `host/43 p4` task 03 |
| [08 - A VS Code 1.141 host is reached at 0.10.0](ahp/08-a-vs-code-1-141-host-is-reached-at-0-10-0/plan.md) | high | built 2026-10-09 ([implemented.md](ahp/08-a-vs-code-1-141-host-is-reached-at-0-10-0/implemented.md)); 356852c | - | - |
| [20261104-0734 - A token file that cannot be read says why, and its path is read the same from any folder](ahp/20261104-0734-a-token-file-read-says-why/plan.md) | medium | built 2026-11-04 ([implemented.md](ahp/20261104-0734-a-token-file-read-says-why/implemented.md)) | - | - |
| [20261104-0734 - A missing connection token file is one sentence on the screen](ahp/20261104-0734-a-missing-token-file-is-one-sentence/plan.md) | medium | built 2026-11-04 ([implemented.md](ahp/20261104-0734-a-missing-token-file-is-one-sentence/implemented.md)) | ahp/20261104-0734-a-token-file-read-says-why | - |
| [20261104-0734 - A refused connection token is told apart from a host that is down](ahp/20261104-0734-a-refused-token-is-told-from-a-down-host/plan.md) | medium | built 2026-11-04 ([implemented.md](ahp/20261104-0734-a-refused-token-is-told-from-a-down-host/implemented.md)) | - | - |
| [20261104-0734 - The resource token has its own flag, and --token always means the connection](ahp/20261104-0734-the-resource-token-has-its-own-flag/plan.md) | medium | built 2026-11-04 ([implemented.md](ahp/20261104-0734-the-resource-token-has-its-own-flag/implemented.md)) | - | - |
| [20261104-0734 - A command a host refuses names the variable that would let it through](ahp/20261104-0734-a-refused-command-names-the-variable/plan.md) | medium | built 2026-11-04 ([implemented.md](ahp/20261104-0734-a-refused-command-names-the-variable/implemented.md)) | ahp/20261104-0734-the-resource-token-has-its-own-flag | - |
| [20261104-0734 - The comments on a refused act agree with the spec, and a retry is tested](ahp/20261104-0734-the-retry-comments-agree-with-the-spec/plan.md) | medium | built 2026-11-04 ([implemented.md](ahp/20261104-0734-the-retry-comments-agree-with-the-spec/implemented.md)) | ahp/20261104-0734-a-refused-command-names-the-variable | - |
| [20261104-0734 - The sign-in prompt answers the ask it was opened for, sends once, and settles on close](ahp/20261104-0734-the-sign-in-prompt-settles-its-edges/plan.md) | medium | built 2026-11-04 ([implemented.md](ahp/20261104-0734-the-sign-in-prompt-settles-its-edges/implemented.md)) | ahp/20261104-0734-the-retry-comments-agree-with-the-spec | - |

Next free number in `ahp`: `09`.

## cli

Reference: [00-cli.md](cli/00-cli.md)

| Plan | Priority | Status | Requires | Blocks |
| --- | --- | --- | --- | --- |
| [01 - A chat is read like a session, and a refusal is printed as a sentence](cli/01-a-chat-is-read-like-a-session/plan.md) | high | built 2026-10-07 ([implemented.md](cli/01-a-chat-is-read-like-a-session/implemented.md)) | - | - |
| [02 - The wire is proxied, checked, counted, followed by channel and compared, from ahpc](cli/02-the-wire-is-proxied-and-analysed/plan.md) | high | dropped 2026-10-11 ([deferred.md](cli/02-the-wire-is-proxied-and-analysed/deferred.md)) | - | - |
| [03 - A failed turn says why](cli/03-a-failed-turn-says-why/plan.md) | high | built 2026-10-07 ([implemented.md](cli/03-a-failed-turn-says-why/implemented.md)) | - | - |
| [04 - A session list is read a page at a time](cli/04-a-session-list-is-read-a-page-at-a-time/plan.md) | medium | built 2026-11-03; shipped in 0.9.0 ([implemented.md](cli/04-a-session-list-is-read-a-page-at-a-time/implemented.md)) | - | - |
| [05 - `prompt` on a busy session refuses, queues or steers, and says when it stops waiting](cli/05-prompt-on-a-busy-session/plan.md) | high | built 2026-11-04 ([implemented.md](cli/05-prompt-on-a-busy-session/implemented.md)) | - | - |
| [06 - The automation list is served by default, the other groups are named, and all turns on every group](cli/06-mcp-tool-groups-are-found-and-all-is-one-word/plan.md) | medium | built 2026-11-04 ([implemented.md](cli/06-mcp-tool-groups-are-found-and-all-is-one-word/implemented.md)) | - | - |
| [20261104-1112 - MCP over stdio answers each call when it is done](cli/20261104-1112-mcp-over-stdio-answers-at-the-same-time/plan.md) | high | active 2026-11-04; tasks 01-02 implemented, awaiting review | - | - |
| [20261104-1621 - Automations are made, changed, copied and moved from the shell](cli/20261104-1621-automations-are-made-from-the-shell/plan.md) | medium | planned 2026-11-04 | - | documentation/20261104-1621-the-docs-pictures-come-from-a-demo-host |

Next free number in `cli`: `07`.

## documentation

Reference: [00-documentation.md](documentation/00-documentation.md)

| Plan | Priority | Status | Requires | Blocks |
| --- | --- | --- | --- | --- |
| [20261103-1238 - Each subject page shows a picture of its screen](documentation/20261103-1238-each-subject-shows-its-screen/plan.md) | medium | dropped 2026-11-04; replaced by documentation/20261104-1621-the-docs-pictures-come-from-a-demo-host | - | - |
| [20261104-1120 - Each release is a docs page, from 0.10 on](documentation/20261104-1120-each-release-is-a-docs-page/plan.md) | high | built 2026-11-04 ([implemented.md](documentation/20261104-1120-each-release-is-a-docs-page/implemented.md)) | - | - |
| [20261104-1621 - The docs pictures are drawn from a demo host](documentation/20261104-1621-the-docs-pictures-come-from-a-demo-host/plan.md) | medium | planned 2026-11-04 | screen/20261104-1621-a-still-waits-for-the-host, screen/20261104-1621-the-provider-is-the-hosts-first-agent, cli/20261104-1621-automations-are-made-from-the-shell, ahpd host/20261104-1619-a-demo-host-shows-every-subject | - |

## Later domains (no plans yet)

`mcp` (`src/mcp`).
Ideas: [the tool server](../ideas/the-tool-server.md), [deliberate duplication](../ideas/deliberate-duplication.md), [artifacts and references on screen](../ideas/artifacts-and-references.md), [subagent rows](../ideas/subagent-rows.md), [finding a host without being told](../ideas/finding-a-host-without-being-told.md), [a chat is read and archived](../ideas/a-chat-is-read-and-archived.md), [a chat moves to another session](../ideas/a-chat-moves-to-another-session.md), [a chat lists its background work](../ideas/a-chat-lists-its-background-work.md), [an MCP server start can be backgrounded](../ideas/an-mcp-server-start-can-be-backgrounded.md), [a changeset says it is recomputing](../ideas/a-changeset-says-it-is-recomputing.md), [an answered question shows its answers](../ideas/an-answered-question-shows-its-answers.md), [steering in the chat screen](../ideas/steering-in-the-chat-screen.md), [a range target on the changes screen](../ideas/a-range-target-on-the-changes-screen.md), [checkout takes its branch](../ideas/checkout-takes-its-branch.md), [the changes hint row fits 60 columns](../ideas/the-changes-hint-row-fits-60-columns.md).
