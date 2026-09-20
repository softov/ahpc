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
| [02 - Three corrections to what a chat turn draws](screen/02-turn-details/plan.md) | high | planned 2026-09-19 | - | - |
| [03 - The model a queued or reopened turn runs on](screen/03-model-continuity/plan.md) | medium | planned 2026-09-19 | a `@textui/chat` release with a model slot on the queued block, if task-01 keeps that shape | - |
| [04 - A session's own pull requests are told from the ones it inherited](screen/04-pull-request-ownership/plan.md) | medium | planned 2026-09-19 | ahpd `.project/plans/host/03-pull-request-baseline/plan.md` for the `initialPullRequestUrls` and `associatedPullRequestUrls` keys | - |
| [05 - A usage screen says what a session has spent](screen/05-usage/plan.md) | medium | planned 2026-09-19 | - | - |

Next free number in `screen`: `06`.

## Later domains (no plans yet)

`cli` (`src/cli`) · `mcp` (`src/mcp`) · `ahp` (`src/ahp`) · `documentation`.
Ideas: [the tool server](../ideas/the-tool-server.md), [deliberate duplication](../ideas/deliberate-duplication.md), [artifacts and references on screen](../ideas/artifacts-and-references.md), [subagent rows](../ideas/subagent-rows.md).
