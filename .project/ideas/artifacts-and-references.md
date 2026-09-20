---
title: Artifacts and references on screen
created: 2026-09-19
---

A host reports what an agent recorded as `_meta['agentHost/sessionArtifacts']` on the session and on its row, and the reference window draws them as pills beside the input, with a close button that sends `vscode/removeSessionArtifact`.
An entry is `{ id, type, label, isArtifact, link?, uri? }`, its id is stable per entry whatever `isArtifact` says, and `isArtifact` is presentation only: it decides whether the entry is a pill or a reference the input keeps behind it.
This client reads none of it today, and nothing on the wire requires it to, because the map is open and a client that ignores the key is correct.

What it would take here: a list of the entries on the chat screen, drawn from the session summary `src/state.ts` already holds, and a keystroke to open one whose `link` or `uri` is set.
Removal would need `vscode/removeSessionArtifact`, which is a VS Code extension method rather than an AHP request, so a terminal that does not serve it can only refuse it; the reference host's own tools remove entries by id instead.
Worth doing when somebody wants a session's recorded artifacts on screen, not before, which is why the pass at `.project/review/2026-09-19-upstream-pass-4.md` records it as not taken.
