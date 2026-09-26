---
title: Two comments disagree about whether a refused act is run again
status: open
date: 2026-09-26
severity: minor
refs:
  - "[code://src/cli/main.ts#L446-L448](../../src/cli/main.ts#L446-L448) - the shell's comment, which says nothing is retried because the act may already have done something"
  - "[code://src/control.ts](../../src/control.ts) - `guard`, which retries `createSession`, `createChat` and three automation calls"
  - "[decisions/one-accepted-credential-runs-the-act-again.md](../decisions/one-accepted-credential-runs-the-act-again.md) - the rule both are describing"
  - "[review/2026-09-26-before-launch.md](../review/2026-09-26-before-launch.md) - finding 8"
---

## Symptom

`src/cli/main.ts:446-448` says a refusal is not retried because the act may already have done something before it was refused.
The screen retries `createSession`, `createChat`, `runAutomation`, `setAutomationEnabled` and `removeAutomation` through `guard`, which are exactly the calls that may have done something.

One of the two is wrong about this client, and a reader cannot tell which from the code.

## Cause

The shell's reasoning was written for the shell, where there is nobody to ask and so nothing to retry, and reads as a statement about the whole client.
Whether the screen *should* retry a non-idempotent call is the question underneath, and no decision answers it: `one-accepted-credential-runs-the-act-again` fixes the count at one and does not say which acts are eligible.

## Impact

A reader takes the comment for the rule and either removes a retry that is wanted or adds one that is not.
The behaviour itself may also be wrong, and that has never been decided.

## Workaround

none

## Fix

Decide which calls may run a second time, write it down, and make both comments say the same thing.
The review notes that a test for the retry of a non-idempotent call is missing, which is how this stayed invisible.
