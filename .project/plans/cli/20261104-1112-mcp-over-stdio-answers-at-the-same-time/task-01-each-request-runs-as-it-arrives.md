---
title: Each request runs as it arrives
status: todo
depends: []
layer: "mcp"
refs:
  - "[code://src/mcp/stdio.ts#L20-L68](../../../../src/mcp/stdio.ts#L20-L68) - the chain this task removes"
  - "[code://src/mcp/serve.ts#L175-L233](../../../../src/mcp/serve.ts#L175-L233) - `answer`, which each request still goes through"
---

## Objective

`stdio` starts each request as its line arrives, and writes each response when that request is done.
A `ping` is answered while a `send_turn` waits.

## Files

- `UPDATE: src/mcp/stdio.ts:20-68` - remove the chain on `running`; keep a set of requests in flight; take the streams as arguments.
- `UPDATE: src/mcp/stdio.ts:13-19` - replace the comment on sequential order with the reason for the new order.
- `CREATE: test/stdio.test.ts` - the cases in *Validation*.

## Steps

1. Add `input` and `output` to the options of `stdio`, with `process.stdin` and `process.stdout` as defaults.
2. In `take`, parse the line at once, in the order the lines arrive.
3. Start `answer` for the message without a wait on any message before it.
4. Add the promise to a set of requests in flight, and remove it when it settles.
5. Write each response with one `write` call of one whole line.
6. On the end of the input, wait for every promise in the set, then resolve.
7. Write the cases in *Validation* against the scripted host, with a `PassThrough` for each stream.

## Validation

- `test/stdio.test.ts`: `send_turn` then `ping` on one stream; the `ping` response comes first, and `send_turn` answers later.
- `test/stdio.test.ts`: `send_turn` waits on a confirmation; `confirm_tool_call` on the same stream answers it, and `send_turn` then answers.
- `test/stdio.test.ts`: the input ends while `send_turn` runs; its response still comes before `stdio` resolves.
- `test/stdio.test.ts`: a line that is not JSON goes to `onProblem`, and the next line is still answered.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume
