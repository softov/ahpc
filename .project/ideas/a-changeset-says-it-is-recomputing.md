---
title: The changes screen says a changeset is recomputing
created: 2026-11-04
refs:
  - npm://@microsoft/agent-host-protocol@^1.0.0 - `ChangesetStatus.recomputing`, while the host computes the files again
  - file:///github/ahpd/.project/plans/host/47-p6-a-changeset-says-it-is-recomputing/plan.md - ahpd serves it, built
---

While the host computes a changeset again, its status is `recomputing` and its files can be out of date.
ahpc does not read the status, so the changes screen shows the old files as current.
The idea: mark the list as updating while the status is `recomputing`.
