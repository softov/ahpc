# What is left

Open scopes only. A row comes out when the work lands, and git keeps what was here before.

## Worth doing

| | |
| --- | --- |
| decide whether to cache the transcript projection | Measured on 6 September 2026 by `npm run bench`, which is `test/transcript.bench.ts`. The reducer is flat in history - about a microsecond whatever the chat holds - and the rebuild after it is linear: one streamed token costs 0.05ms into 10 turns, 0.15ms into 100, 0.62ms into 500 and 2.5ms into 2000. So the projection is the cost and `transcript` walking finished turns is where it is. Nothing to do at ordinary lengths; a long session at a fast token rate is a different answer. Caching completed turns is the fix if one is wanted, and it needs invalidating on history loads, truncation and reconnect snapshots |

## The tool server

`src/mcp` serves twelve tools - enough for an agent elsewhere to drive a session to completion. Files, terminals, automations and changesets are not among them: a tool table is read by a model alongside everything else it has been given, and forty tools is a worse server than twelve. If anybody asks for them, the shape is opt-*in* groups behind `--mcp-tools resources,terminals` - named that way so it does not read as an AHP thing - rather than all of them on by default.

What it still does not do is stream the reply. A `progressToken` gets a `notifications/progress` line per tool the agent reaches for, and on HTTP that is what opens an SSE stream, but MCP defines no way to send partial *result* content - so the text itself arrives whole at the end however long the turn took.

## Deliberate duplication

`resourceWrite` is symmetrical: a host asks a client for one exactly as a client asks a host. So `publish.ts` implements the whole of it, and so does `ahpd` in its `resources.ts` - the same flags, the same order of preconditions, the same append and insert arithmetic. This client does not depend on `@ahpd/sdk` and is not going to. Both copies carry a comment naming the other. A defect in one is a defect in both, and fixing only one is the failure mode to watch for.
