---
title: Check that a refusal names its session, in a real terminal
plans:
  - plans/screen/20261103-1256-an-error-names-its-action-and-session/plan.md
---

# Check that a refusal names its session, in a real terminal

The plan is built, and its cases pass in `test/smoke.test.tsx`.
This run repeats what Softov saw on 2026-11-03, against the host that has a session with no agent.

## Set up

1. In the ahpc checkout, on `main` after the task 03 pull request merges, run `npm install` and `npm run build`.
2. Start the screen against the host that lists the session with no agent, as on 2026-11-03.

## The session that cannot open, at 100 columns

1. Set the terminal to 100 columns.
2. Open the session with no agent.
3. Check that the status row reads `Open session, <title>: No agent for session <uri> (-32001)`, with the code once.
4. Press `ctrl+n`, and check that the new session page shows no refusal.
5. Wait 15 seconds, and check that the new session page still shows no refusal.

## The session that cannot open, at 60 columns

1. Set the terminal to 60 columns.
2. Repeat the steps of the 100 column check.
3. Check that the action and the session title start the status row.

## The session list

1. Highlight the session with no agent in the session list.
2. Check that the pane shows the refusal under *Lifecycle*, with the code once.
3. Check that the status row stays empty.
4. Hold the down arrow over several rows, and check that the pane fills only for the row where the highlight stops.

## Reply

Say "error checks pass", or name the step that failed and what the screen showed.
