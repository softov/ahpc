---
title: Sign in when a host refuses, and run the refused act once more - deferred
date: 2026-09-24
---

Three things this plan named and deliberately did not do, all waiting on a reason that is not this plan's.

| What | Why it waits | Where it goes |
| --- | --- | --- |
| A refusal in `src/mcp/` is answered to a model, not a person | The tool server has no prompt of its own; a credential is not something a model can be asked for mid-tool-call. The socket lives for the server's lifetime, so the retry-once discipline does not fit either. | unplanned; the ahp domain's Known gaps in [`00-ahp.md`](../00-ahp.md) |
| A refused fire-and-forget dispatch is not retried | ahpc sends a dispatch without keeping a handle to match the host's echo, so there is nothing to attach a refusal to. Re-sending a chat message or terminal keystroke on its own is a second act nobody agreed to. | unplanned; decision [one-accepted-credential-runs-the-act-again](../../../decisions/one-accepted-credential-runs-the-act-again.md) |
| The reference's `resourceToAsk` order and its live-state fallback | ahpc reads the host's `resource_name` off the refusal itself, so the declared preference buys nothing here, and the MCP `authRequired` and tool-call auth states are drawn inertly by design. | unplanned; decision [a-refusal-with-no-resource-is-drawn](../../../decisions/a-refusal-with-no-resource-is-drawn.md) |
