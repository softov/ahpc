---
title: The sign-in prompt writes a failure under the wrong ask, submits twice, and leaves waiters unsettled on dispose
status: open
date: 2026-09-26
severity: minor
refs:
  - "[code://src/control.ts#L744-L747](../../src/control.ts#L744-L747) - `signIn`, which writes the host's words onto whatever `AUTH_ASK` holds now"
  - "[code://src/view/auth.tsx#L70-L87](../../src/view/auth.tsx#L70-L87) - the form, whose submit is reachable while a push is in flight"
  - "[code://src/control.ts](../../src/control.ts) - `createController`'s disposal, which does not settle the waiter list"
  - "[review/2026-09-26-before-launch.md](../review/2026-09-26-before-launch.md) - finding 7"
---

## Symptom

Three edges around one prompt.

A credential the host refuses has its words written onto the current `AUTH_ASK`.
When a second refusal for another resource arrived while the push was in flight, the first host's sentence is drawn under the second resource's name.

Enter while `authenticate` is in flight submits again, so one typed token can be pushed twice.

Disposing the controller closes the layer but does not settle the waiter list, so an act still waiting on a credential is left with a promise nobody will resolve.

## Cause

`signIn` reads `AUTH_ASK` again after awaiting rather than remembering which ask it was answering.
The form has no in-flight guard.
Disposal drops the controller without a final `settle(null)`.

## Impact

The first two are wrong words and a duplicate request, both rare and neither dangerous.
The third can leave a promise pending for the life of the process, which on a screen being torn down is invisible and on a shell would be a command that never exits.

## Workaround

none

## Fix

Have `signIn` carry the resource it is answering and write the failure only if that ask is still the one on screen; guard the form while a push is in flight; settle the waiter list on dispose.
