---
title: A refusal that names no resource is drawn, never guessed at
status: accepted
date: 2026-09-23
refs:
  - code://src/ahp/live.ts#L1512-L1535 - `reason`, which reads `data.resources` and calls the callback only when there is one
  - code://src/ahp/live.ts#L1424-L1434 - the `auth/required` notification, which is dropped when it names no resource
  - code://src/ahp/live.ts#L1676-L1700 - `advertised`, what the host says it protects
  - code://src/ahp/live.ts#L1956-L1968 - `authenticate`, which refuses a resource the host never named before sending anything
  - file:///github/ahpapp/src/auth-required.ts#L213-L237 - `resourceToAsk`, the reference's order
  - file:///github/ahpapp/src/auth-gate.tsx#L22-L24 - "a refusal that names no door is drawn, not guessed at"
---

## Context

The protocol allows `AuthRequiredErrorData` to be absent, so a `-32007` may name no resource at all.
`authentication.md` also says an `authenticate` resource MUST match one the host advertised, and this client enforces that before sending.
So a guessed resource is a request the host is obliged to refuse, and a prompt opened to ask for a credential the host will not take is worse than a sentence.

## Decision

A `-32007` whose `data` names no resource opens nothing and is drawn as the host's sentence.
Only the first resource a refusal names is asked for, because the host named it and a second one is a different act's problem.
The `auth/required` notification always names one, because the connection drops a notification that does not, so a prompt opened from a notification always has a resource to show.

Source: (defaulted: `authentication.md` requires the resource to match one the host advertised and `authenticate` refuses a guessed one before sending, `src/ahp/live.ts:1966-1968`; the reference states the rule at `/github/ahpapp/src/auth-gate.tsx:22-24`.)

## Consequences

There is never an empty prompt, and no screen or helper has to invent an identifier.
A person refused by a host that names nothing sees the sentence and can still run `ahpc auth <resource>` if they know which resource they want.
The live-state fallback the reference uses for exactly this case is not ported, so an MCP server whose state is `authRequired` does not become the resource for a refusal that named none.
The reference's `resourceToAsk` also prefers a resource the client already declared, so its sheet can draw the host's friendly name; that ordering is not ported either, because the host's `resource_name` travels on the refusal itself and is carried as the ask's name.

## Options

- **Pick the first entry of `protectedResources()`.** Rejected: a refusal that named nothing may be about a resource the host discovered dynamically and never listed, and a wrong resource is refused anyway, so the guess adds a round trip and a false prompt.
- **Open the prompt with a free-text resource field.** Rejected: it asks a person to type an identifier the host has to match exactly, which is asking them to know the host's configuration.
- **Use the live state the reference keeps.** Rejected for this change, not in principle: ahpc already draws an MCP server's `authRequired` state and a tool call's auth status inertly, and turning either into the fallback is a change to those paths rather than to this one.
