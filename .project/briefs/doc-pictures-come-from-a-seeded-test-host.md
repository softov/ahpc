---
title: The docs pictures come from a seeded test host
created: 2026-11-04
refs:
  - git://b46ed16 - the commit of this repository the facts were checked at
  - git://685733f0 - the ahpd commit read for its example host, its plugins and its agent contract
  - "[code://src/tui.tsx#L273-L345](../../src/tui.tsx#L273-L345) - `still`, which draws one frame of any screen, against the scripted host or a live one"
  - "[code://src/control.ts#L352](../../src/control.ts#L352) - the provider is `claude` until the host says otherwise"
  - "[code://src/ahp/fake.ts](../../src/ahp/fake.ts) - the scripted host, whose sessions name Softov's work projects"
  - "[code://docs/img/sessions.svg](../../docs/img/sessions.svg) - the still of the session list, which shows `brb_framework` and `service_advisor`"
  - "[code://docs/use/SCREEN.md#L20-L53](../../docs/use/SCREEN.md#L20-L53) - the three stills the site shows today"
  - "[code://.project/plans/documentation/20261103-1238-each-subject-shows-its-screen/plan.md](../plans/documentation/20261103-1238-each-subject-shows-its-screen/plan.md) - the planned placeholders, one for each subject page"
  - "[code://.project/decisions/ahpc-and-ahpd-share-no-package.md](../decisions/ahpc-and-ahpd-share-no-package.md) - ahpc does not depend on `@ahpd/sdk`"
  - file:///github/ahpd/examples/notes/main.ts - a host of about thirty lines: the `notes` agent, files, terminals, git branches and git changes
  - file:///github/ahpd/examples/notes/README.md - the `notes` agent: one tool that runs, one that asks first, and a question that is not about a tool
  - file:///github/ahpd/packages/sdk/src/types/host.ts - `createHost` takes `automations`, and the SDK exports `memoryAutomations`
  - file:///github/ahpd/packages/sdk/src/types/agent.ts - `Agent.probe` answers the models, commands and customizations a backend offers
  - file:///github/ahpd/packages/agent-claude/src/probe.ts - Claude's models come from probing the CLI, and its customizations from `~/.claude`
---

# The docs pictures come from a seeded test host

Each subject page in the docs shows a picture of its screen.
The pictures are drawn from a test host that holds demo data: sessions in each state, automations, changed files and a terminal.
Softov, 2026-11-04: "create a XDG server test with some automations and some sessions? some running, etc? change files. those things."
The pictures replace the placeholders that [documentation/20261103-1238-each-subject-shows-its-screen](../plans/documentation/20261103-1238-each-subject-shows-its-screen/plan.md) plans.
The three stills the site shows today are drawn again from the same host, so no picture names Softov's work projects.

## What others do

- ahpd's [`examples/notes`](file:///github/ahpd/examples/notes/main.ts) is a whole host in about thirty lines, built on `createHost`: an agent with no model behind it, `fileResources`, `shellTerminals`, `gitBranches` and `gitChanges`.
- Its `notes` agent reads a note with a tool that never asks, and writes one with a tool that asks first.
- It asks which note when the name is left out. So a session waits on a person without any model.
- ahpd's docs say how a client connects to it: `pnpm notes -- --port 9201`, then `ahpc --host ws://127.0.0.1:9201`.

## What ahpc has today

- `ahpc --static --svg <file> --screen <name> --session <uri> --width <n> --height <n>` draws one frame of a screen to SVG ([`code://src/tui.tsx#L273-L345`](../../src/tui.tsx#L273-L345)). With `--host`, it draws against a live host.
- The screens are `sessions`, `chat`, `new`, `changes`, `files`, `automations`, `skills`, `mcp`, `terminal`, `settings`, `hosts` and `usage`.
- The three stills on the site come from the scripted host. [`code://docs/img/sessions.svg`](../../docs/img/sessions.svg) shows `brb_framework`, `service_advisor` and "Advisor case 412 triage".
- Nine subject pages have a *Screen* section: AGENTS, AUTOMATIONS, CHANGES, CHATS, CUSTOMIZATIONS, RESOURCES, SESSIONS, TERMINALS and TURNS. Only SESSIONS has a still.

### A still against a live host, tried on 2026-11-04

The `notes` host ran on a scratch port, over a scratch git folder with one file edited, one deleted and one new.
A session was made with `session new`, and `prompt "read"` left it waiting on the question.

- The session list still showed the session as "waiting on you", with `notes`, the folder and the branch.
- The changes still said "Nothing changed", and the files still said "Nothing here".
- `ahpc changes <uri>` listed the three files at the same moment. So a still draws before the host's answers arrive.
- Every still showed `Read settings: No provider called claude (-32002)` in red. The provider is `claude` until the host says otherwise ([`code://src/control.ts#L352`](../../src/control.ts#L352)), and this host has no `claude`.

## Who writes

- ahpc `main` is clean at `b46ed16`, with no open pull request.
- ahpd has other sessions at work on `main`, on plugins and the host. The `notes` example has not changed since `05c4c003`.
- The planned placeholders write `docs/img/<subject>.svg`. A picture from this change writes over the same file, with no change to the page.

## The change

- A demo host serves the pictures: `createHost` with a demo agent, files, terminals, git changes and `memoryAutomations`.
- The demo agent is `notes` or built like it. Its `probe` offers two or three models, commands and customizations with neutral names, so the Agents and Customizations pictures need no Claude.
- A seed script makes the demo data through ahpc's own commands.
- The sessions are running, waiting on a permission, waiting on a question, idle and in error, and one session has two chats.
- The automations run on a schedule and on a finished session, and one has a run.
- A terminal holds some output.
- The demo folder is a git repository with an edited, a deleted, a new and a staged file, and folders a few levels deep.
- A still against a live host waits for the host's answers before it draws.
- A host with no `claude` agent draws no `No provider called claude` error.
- One script starts the host, seeds it, draws every picture into `docs/img/`, and stops the host. The pictures are drawn again by running it.
- All names in the demo data are neutral: no project, host or person of Softov's.

| Picture | Screen | What the host holds |
| --- | --- | --- |
| `sessions.svg` | `sessions` | four to six sessions in each state, in two folders |
| `transcript.svg` | `chat` | a finished turn with tool calls |
| `compose.svg` | `new` | the questions the host asks first |
| `turns.svg` | `chat` | a turn waiting on a permission |
| `chats.svg` | `chat` | a session with two chats |
| `agents.svg` | `new` | two agents, one with models |
| `changes.svg` | `changes` | the demo folder's changes, with a staged file |
| `resources.svg` | `files` | the demo folder |
| `terminals.svg` | `terminal` | a shell with output |
| `automations.svg` | `automations` | two automations, one with a run |
| `customizations.svg` | `skills` | the demo agent's customizations |

## Softov's answers

| Point | Answer, 2026-11-04 |
| --- | --- |
| Where the demo host lives | "It can live next to ahpd notes": a new `examples/demo` in ahpd that imports the `notes` agent, with a `probe` of neutral models and customizations, and `memoryAutomations` |
| States the demo agent shows | It adds `slow`, which streams a line every second for a minute, and `fail`, which ends its turn with an error |
| How a still waits | On the requests in flight, with a cap |
| The `claude` default | Fixed in this change: the provider starts empty and is the first agent the host lists |
| Where the picture script lives | In ahpc, as `npm run docs:pictures`, which finds the ahpd checkout through `AHPD_DIR` |
| How the data is seeded | Through ahpc's own commands, run by the picture script |

## Open points

- Times on the screen come from the clock, so each run draws them a little differently.
- The ahpd part is built first, because the picture script starts `examples/demo`.
