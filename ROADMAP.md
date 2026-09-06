# What is left

Open scopes only. A row comes out when the work lands, and git keeps what was here before.

## Worth doing

| | |
| --- | --- |
| a scenario runner | The seams already allow this client and a real host to run against each other over an in-memory transport, with no model and no socket. Built as a harness that can pause a handshake, drop a connection and reattach, it would cover the interleavings that unit tests do not. It is what found the late-reader bug, written once by hand |
| decide whether to cache the transcript projection | Measured on 6 September 2026 by `npm run bench`, which is `test/transcript.bench.ts`. The reducer is flat in history - about a microsecond whatever the chat holds - and the rebuild after it is linear: one streamed token costs 0.05ms into 10 turns, 0.15ms into 100, 0.62ms into 500 and 2.5ms into 2000. So the projection is the cost and `transcript` walking finished turns is where it is. Nothing to do at ordinary lengths; a long session at a fast token rate is a different answer. Caching completed turns is the fix if one is wanted, and it needs invalidating on history loads, truncation and reconnect snapshots |

## Deliberate duplication

`resourceWrite` is symmetrical: a host asks a client for one exactly as a client asks a host. So `publish.ts` implements the whole of it, and so does `ahpd` in its `resources.ts` - the same flags, the same order of preconditions, the same append and insert arithmetic. This client does not depend on `@ahpd/sdk` and is not going to. Both copies carry a comment naming the other. A defect in one is a defect in both, and fixing only one is the failure mode to watch for.

One place where they have already drifted, pinned by a test in `publish.test.ts`: writing to a path whose final component is a symbolic link. `where` here resolves the whole path, so a link whose destination is still published is written *through*. `ahpd` resolves only the parent, so `O_NOFOLLOW` refuses the same write. Reading follows links at both ends and that is not in question - only which of the two the write half should be.
