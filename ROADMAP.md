# What is left

Open scopes only. A row comes out when the work lands, and git keeps what was here before.

## Worth doing

| | |
| --- | --- |
| one lockfile | Three are tracked and two are stale. `package-lock.json` is the one that installs and is what CI uses; `pnpm-lock.yaml` still says textui 0.4.0 against a manifest asking for 0.5.0, so `pnpm install --frozen-lockfile` refuses; `deno.lock` is 605 bytes from before any of this and no script reads it. Two of them should go, and which two is a decision about how this is published rather than a tidy-up |

## The tool server

`src/mcp` serves twelve tools by default - enough for an agent elsewhere to drive a session to completion - and eighteen more behind `--mcp-tools resources,terminals,automations,changes`, off unless asked for. What is still not there: prompts, resources, sampling and roots, none of which a tools-only server is obliged to answer, and `Mcp-Session-Id`, which the transport says a server MAY use and this one does not need.

What it still does not do is stream the reply. A `progressToken` gets a `notifications/progress` line per tool the agent reaches for, and on HTTP that is what opens an SSE stream, but MCP defines no way to send partial *result* content - so the text itself arrives whole at the end however long the turn took.

## Telling somebody the version is old

`https://registry.npmjs.org/-/package/@softov/ahpc/dist-tags` answers `{"latest":"0.2.0"}` in 18 bytes, and that is the whole check. The alternatives are worth naming so nobody reaches for one later: `/latest` is 2,252 bytes, the abbreviated packument 1,826 and the full one 20,226, and every one of them answers more than was asked.

Read the answer out of a file and refresh in the background, six hours apart. A notice that arrives one run late is still a notice, and a start that waits on a registry is a start that hangs on a network nobody can see. This process is long-lived anyway, so it can afford a request in flight; `--version` and the other verbs that print and leave must not make one, because `fetch` holds the event loop open and they would sit there after they had printed.

The notice is a line the app draws, never one written to stdout. Anything written before the alternate screen opens is erased by it and anything written after corrupts the frame, so the only place it can go is the status area. `config.ts` has `configPath(tool)` and wants a sibling for files written by the tool rather than by a person: `update.json` under `~/.config/ahpc/` is machine-written and does not belong in `config.json`.

Every failure is the same answer. Offline, a proxy that blackholes and a registry that is simply down are all nothing to report rather than a word on somebody's screen. The comparison is written rather than acquired, because this repository has no `semver` and this does not earn one: a prerelease loses to its own release, and a local build ahead of npm reports nothing at all. This one runs ahead of the registry most days, and a tool that says so every start is a tool people switch off.

Off with `--no-update-check`, `NO_UPDATE_NOTIFIER`, `CI`, no terminal, or `updateCheck: false` in the configuration. `npm_config_registry` is read before npmjs.org is assumed, so somebody behind a mirror is not quietly reaching past it.

`ahpd` gets the same against `@ahpd/server`, which makes these the second instance of the duplication below.

## Deliberate duplication

`resourceWrite` is symmetrical: a host asks a client for one exactly as a client asks a host. So `publish.ts` implements the whole of it, and so does `ahpd` in its `resources.ts` - the same flags, the same order of preconditions, the same append and insert arithmetic. This client does not depend on `@ahpd/sdk` and is not going to. Both copies carry a comment naming the other.

What now checks that they still agree is `test/fixtures/resource-write.json`, checked into both repositories byte for byte, with a runner in each - `test/resource-write.test.ts` on both sides - so twenty-one cases run against both implementations and a divergence fails a build rather than waiting for somebody to read the two files side by side. What running it here cannot catch is a case added on one side and never copied to the other, because there is no shared package to hold the file; each repository's CI reads the other's copy over HTTP and diffs it, which is what closes that.
