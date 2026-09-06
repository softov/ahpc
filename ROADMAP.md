# What is left

Kept here because the review that found most of it is not part of this repository.

## Found by review, worth doing

A review on 6 September 2026 found four defects in this client: published paths followed links out of the publication, a subscription released before it opened never sent its unsubscribe, a second reader of an open channel got an empty conversation, and reverse `resourceWrite` ignored the write modes and preconditions it was given. All four are fixed and each has a test.

| | |
| --- | --- |
| make the locale test independent of the shell | `test` sets `LANG` and asserts it wins, which is only true when the invoking shell has no `LC_ALL`. This environment has one, so the suite fails for a reason that has nothing to do with the code. Set the whole precedence in the test rather than half of it |
| a scenario runner | The seams already allow this client and a real host to run against each other over an in-memory transport, with no model and no socket. Built as a harness that can pause a handshake, drop a connection and reattach, it would cover the interleavings that unit tests do not. It is what found the late-reader bug, written once by hand |
| measure the transcript before optimising it | A live subscription rebuilds the user-facing view after every reduced action. That may be costly with a long history and fine-grained streaming, or it may be nothing. Nobody has measured it, so there is no defect here yet and no optimisation worth writing |

## Deliberate duplication

`resourceWrite` is symmetrical: a host asks a client for one exactly as a client asks a host. So `publish.ts` implements the whole of it, and so does `ahpd` in its `resources.ts` - the same flags, the same order of preconditions, the same append and insert arithmetic. This client does not depend on `@ahpd/sdk` and is not going to. Both copies carry a comment naming the other. A defect in one is a defect in both, and fixing only one is the failure mode to watch for.
