---
title: A refusal in a non-interactive run is a sentence, not a stack
status: todo
depends: [task-01-the-refusal-is-read-once.md]
layer: cli
refs:
  - code://src/cli/main.ts#L360-L372 - `cli`, one host built for the whole command
  - code://src/cli/main.ts#L762-L768 - the `finally` a `catch` goes in front of
  - code://src/cli/main.ts#L1255-L1300 - `signIn` and `tokenVariable`, the credential sources a shell has
  - code://src/cli/main.ts#L225-L239 - `where`, where `--token` is the connection token
  - code://src/main.tsx#L40-L66 - a `Fault` is a sentence and anything else is a stack
  - code://src/connect.ts#L73-L86 - the sentence the connection prints before the command fails
  - code://src/ahp/auth.ts - `authRequiredOf` and `failureWords`, the reader this uses
  - code://test/cli.test.ts#L1-L20 - the file's own note on what it covers
---

## Objective

A command run with no screen that is refused with `-32007` prints one sentence naming the resource and the environment variable that would satisfy it, exits 1, and never prompts or retries; a refusal that names no resource prints the host's words.

## Files

- `UPDATE: src/cli/main.ts:762-768` - a `catch` before the `finally` that converts an auth refusal into a `Fault`.
- `UPDATE: src/cli/main.ts:1255-1300` - one helper that builds the sentence from an `AuthAsk` and `tokenVariable`, used by `signIn`'s own missing-token message and by the new catch.
- `CREATE: test/auth.test.ts` - the sentence as a pure function, in the file task 01 creates.
- `UPDATE: test/auth.test.ts` - the cases below.

## Steps

1. In `src/cli/main.ts`, a `catch (error)` between the dispatch and the existing `finally`: read it with `authRequiredOf`, and when it is a refusal throw a `Fault` whose message names the resource and `tokenVariable(resource)`.
2. The sentence for a refusal that named no resource is the host's own words, which is what `failureWords` already answers.
3. The `finally` still flushes and closes, so the connection is hung up on both paths.
4. Reuse the same sentence builder from `signIn`'s "No token" message so the two cannot drift.
5. No prompt and no retry: nothing here calls `attempt`, and the asker installed by a screen is not installed in a shell run.

## Validation

- `test/auth.test.ts` - the builder names the resource and its variable for a refusal that named one, and answers the host's words for a refusal that named none.
- By hand: `ahpc session list --host <a host that refuses>` prints one sentence and exits 1, with no stack trace and no prompt.
- `test/cli.test.ts` unchanged and green.
- `npm test` and `npm run typecheck` green.

## Resume

Not started.
One thing to confirm: whether the connection's own printed sentence and the `Fault` are one line or two when both fire.
Proposed: keep both only if they read as one thought, otherwise have the catch be the single sentence.
