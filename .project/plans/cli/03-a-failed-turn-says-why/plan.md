---
title: A failed turn says why
domain: cli
status: planned
priority: high
created: 2026-10-07
revalidated: 2026-10-07
requires: []
changes: []
creates: []
decisions: []
refs:
  - "[code://src/wait.ts#L64-L67](../../../../src/wait.ts#L64-L67) - `spoken`, which keeps only markdown parts and drops the error part"
  - "[code://src/ahp/live.ts#L693-L701](../../../../src/ahp/live.ts#L693-L701) - the `error` part, read with the host's message"
  - "[code://src/ahp/types.ts#L187](../../../../src/ahp/types.ts#L187) - the error part's type"
  - "[code://src/cli/main.ts#L1484-L1502](../../../../src/cli/main.ts#L1484-L1502) - `prompt` and `exec`, which return 1 for a turn that is not complete and print nothing more"
  - "[code://src/cli/main.ts#L918-L933](../../../../src/cli/main.ts#L918-L933) - `session show`, which prints the status and no reason"
  - "[code://src/mcp/tools.ts#L90-L96](../../../../src/mcp/tools.ts#L90-L96) - `said`, whose `text` comes from `spoken`"
---

## Goal

When a turn fails, ahpc shows the sentence the host sent.
`prompt` and `exec` print it on stderr and exit 1, an MCP caller gets it as `error`, and `session show` prints it under the status.

## Reconnaissance

### Searches performed

- `rg "chat/error|turnFailed" src` - nothing; the part is read in `live.ts` as `kind: 'error'` and never printed.
- Found on 2026-10-07 on dev86 with ahpd 0.10.0. A cofold session with no model answered a prompt with a `chat/error` part. `ahpc prompt` printed nothing and exited 1, and the sentence was visible only with `--wire`.

### Runtime path

```
host chat/error -> live.ts error part -> Turn.parts -> spoken() drops it -> prompt prints nothing, exits 1
```

## Decisions locked in

| Decision | Task |
| --- | --- |
| - none | - |

| What | Source | Task |
| --- | --- | --- |
| `prompt` and `exec` print each error part's message on stderr, one line each, and keep exit code 1 | Softov, 2026-10-07, "ahpc can be checked by the deepseek one?"; (defaulted: the first fix the problem named) | 01 |
| The MCP tools' `said()` adds `error`, the last error part's message | (defaulted: an MCP caller reads `said` and has no stderr) | 01 |
| `session show` prints an `Error` row with the last turn's error message when the status is error | (defaulted: the one place a person looks after a failed run) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - A failed turn prints its error](task-01-a-failed-turn-prints-its-error.md) | todo | - |

## Risks and tradeoffs

- A turn can carry text and then an error. stdout keeps the text, and stderr gets the error. A pipe still reads only the answer.

## Resume state

- **Done so far:** nothing.
- **Next action:** [task-01-a-failed-turn-prints-its-error.md](task-01-a-failed-turn-prints-its-error.md).
- **Open questions:** none.
- **Watch out for:** the fake host in `src/ahp/fake.ts` must answer a turn with an error part. Without it, the test cannot show the bug.

## Final verification checklist

- [ ] A test: `prompt` against the fake host, whose turn ends in an error part, writes the message to stderr and returns 1.
- [ ] A test: `said()` carries `error` for that turn.
- [ ] A test: `session show` prints the `Error` row.
- [ ] The repo's typecheck and test commands pass.
- [ ] `plans/index.md` updated.
