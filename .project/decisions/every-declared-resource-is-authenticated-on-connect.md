---
title: Every declared resource is authenticated on connect, silently
status: accepted
date: 2026-09-24
refs:
  - "[code://src/connect.ts#L82-L104](../../src/connect.ts#L82-L104) - `connect`, the one place a connection is made and the only place this can run"
  - "[code://src/ahp/live.ts#L1688-L1700](../../src/ahp/live.ts#L1688-L1700) - `advertised`, which already reads `protectedResources` off every agent the root channel named"
  - "[code://src/ahp/connection.ts#L259-L280](../../src/ahp/connection.ts#L259-L280) - `authenticate` and `protectedResources` on the seam"
  - file:///home/softov/projects/ahpx/src/session/connect-helper.ts#L118-L128 - `authenticateUpfront`, run after connect and before anything else, with the reason in its comment
  - file:///home/softov/projects/ahpx/src/auth/handler.ts#L95-L120 - `authenticateResources`, which deduplicates and treats every failure as non-fatal
  - npm://@microsoft/agent-host-protocol@^0.9.0 - `AgentInfo.protectedResources`, the static half of what a host wants a token for
---

## Context

This client authenticates only when it has been refused.
That is the whole of its design: a `-32007` arrives, the prompt opens where the person is, and the act runs once more.

ahpx does not wait to be refused.
It resolves a token for every resource the agents declare and pushes it straight after connect, and its comment says why: AHP 0.5.0 agents such as `copilotcli` declare a required protected resource, and the host rejects every turn that was not authenticated with "Session was not created with authentication info or custom provider".

That failure does not arrive as a `-32007` on a request this client awaited.
It arrives per turn, inside a session that was created without complaint, which means the prompt this client just built would never open for it.
Waiting to be refused only works when the refusal is a refusal.

## Decision

After the connection is up and before anything is asked of it, a token is resolved for every resource the host's agents declare and pushed with `authenticate`.
It is silent: nothing is asked of the person here, and a resource with no token available is left alone.
Every failure is non-fatal, including a token the host turns down, and the connection carries on as though nothing had been tried.
The prompt remains the answer for everything this does not cover, which is every resource nobody has a token for yet and every live challenge that arrives later.

Source: Softov, 2026-09-24, asked "When should ahpc push a token without having been refused first?" and answered "On connect, all declared, silent".

## Consequences

An agent that requires a token works on a machine that has one, without a refusal having to happen first and without the person seeing anything.
The client now sends `authenticate` to hosts that would never have refused it, which is more traffic and one more thing a `--wire` capture records.
A token that has gone stale is now pushed and rejected at connect rather than at the moment it was needed, which is the earlier and the better place to find out.
Silence is load-bearing: a prompt at startup for a resource nobody asked about would be this client interrupting before the person has done anything, which is what the refusal-driven design exists to avoid.

## Options

- **Only `required: true` resources, before `createSession`.** Rejected: narrower and it targets the known `copilotcli` failure exactly, but it leaves every other declared resource to be discovered by a refusal, and the host is entitled to want a token for any of them.
- **Stay purely reactive and route turn failures into the prompt.** Rejected: it depends on the host wording a turn failure in something this client can read as a refusal, and the sibling host's own dispatch refusals carry no code at all.
- **Prompt at startup for anything unresolved.** Rejected: it turns every connection into a questionnaire and asks for tokens the person may never need in that run.
