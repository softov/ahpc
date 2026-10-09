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
| [09 - A commit asks for its message, a pull request is prepared in a form, and what the host sends back is shown](screen/09-git-changes-take-their-arguments/plan.md) | high | planned 2026-09-30 | - | - |

Next free number in `screen`: `10`.

## ahp

Reference: [00-ahp.md](ahp/00-ahp.md)

| Plan | Priority | Status | Requires | Blocks |
| --- | --- | --- | --- | --- |
| [01 - Sign in when a host refuses, and run the refused act once more](ahp/01-sign-in-when-a-host-refuses/plan.md) | high | built 2026-09-24 ([implemented.md](ahp/01-sign-in-when-a-host-refuses/implemented.md)) | - | - |
| [02 - Push a token before the host refuses, and look for one before asking](ahp/02-a-token-before-the-host-refuses/plan.md) | high | built 2026-09-26 ([implemented.md](ahp/02-a-token-before-the-host-refuses/implemented.md)) | ahp/01 for the prompt and the retry it hangs off | - |
| [03 - Read the connection token from the file the host keeps it in](ahp/03-a-connection-token-from-a-file/plan.md) | medium | built 2026-09-24 ([implemented.md](ahp/03-a-connection-token-from-a-file/implemented.md)) | - | - |
| [04 - Keep resource tokens out of recordings, and keep a dismissed sign-in prompt dismissed](ahp/04-no-token-on-disk-and-no-prompt-from-a-tick/plan.md) | high | built 2026-09-26 ([implemented.md](ahp/04-no-token-on-disk-and-no-prompt-from-a-tick/implemented.md)) | - | - |
| [05 - ahpc speaks protocol 1.0.0](ahp/05-protocol-1-0-0/plan.md) | high | built 2026-10-07 ([implemented.md](ahp/05-protocol-1-0-0/implemented.md)) | - | - |
| [06 - Trusted folders are sent to the host on every connection](ahp/06-trusted-folders-are-sent-on-every-connection/plan.md) | high | active 2026-10-07; tasks 01-02 implemented, reviewed, awaiting a run against ahpd ([implemented.md](ahp/06-trusted-folders-are-sent-on-every-connection/implemented.md)) | - | - |
| [07 - A session's model is read as ahpd.model too](ahp/07-a-sessions-model-is-read-as-ahpd-model-too/plan.md) | high | built 2026-10-09 ([implemented.md](ahp/07-a-sessions-model-is-read-as-ahpd-model-too/implemented.md)); a13ec65 | - | ahpd `host/43 p4` task 03 |
| [08 - A VS Code 1.141 host is reached at 0.10.0](ahp/08-a-vs-code-1-141-host-is-reached-at-0-10-0/plan.md) | high | planned 2026-10-09 | - | - |

Next free number in `ahp`: `09`.

## cli

Reference: [00-cli.md](cli/00-cli.md)

| Plan | Priority | Status | Requires | Blocks |
| --- | --- | --- | --- | --- |
| [01 - A chat is read like a session, and a refusal is printed as a sentence](cli/01-a-chat-is-read-like-a-session/plan.md) | high | built 2026-10-07 ([implemented.md](cli/01-a-chat-is-read-like-a-session/implemented.md)) | - | - |
| [02 - The wire is proxied, checked, counted, followed by channel and compared, from ahpc](cli/02-the-wire-is-proxied-and-analysed/plan.md) | high | planned 2026-10-04; tasks 01-07 todo | - | ahpd documentation/02 |
| [03 - A failed turn says why](cli/03-a-failed-turn-says-why/plan.md) | high | built 2026-10-07 ([implemented.md](cli/03-a-failed-turn-says-why/implemented.md)) | - | - |

Next free number in `cli`: `04`.

## Later domains (no plans yet)

`mcp` (`src/mcp`) · `documentation`.
Ideas: [the tool server](../ideas/the-tool-server.md), [deliberate duplication](../ideas/deliberate-duplication.md), [artifacts and references on screen](../ideas/artifacts-and-references.md), [subagent rows](../ideas/subagent-rows.md), [finding a host without being told](../ideas/finding-a-host-without-being-told.md), [what protocol 1.0.0 adds](../ideas/what-protocol-1-0-0-adds.md).
