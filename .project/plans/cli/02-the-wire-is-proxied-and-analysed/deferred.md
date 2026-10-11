---
title: The wire is proxied, checked, counted, followed by channel and compared, from ahpc - deferred
date: 2026-10-11
---

The whole plan waits, because these tools debug ahpd and no user needs them as a tester yet.
The decision is [ahpd's capture scripts stay in ahpd](../../../decisions/ahpds-capture-scripts-stay-in-ahpd.md).

| What | Why it waits | Where it goes |
| --- | --- | --- |
| Task 01, one reader for every capture shape | Only the tasks below need it; ahpc's viewer reads the shape ahpc's `--wire` writes. | unplanned; this plan |
| Task 02, `wire proxy` | ahpd's `scripts/tee.mjs` records a client for debugging ahpd, and stays there. | unplanned; this plan |
| Task 03, `wire check` | ahpd's `tools/validate.mjs` checks a capture for debugging ahpd, and stays there. | unplanned; this plan |
| Tasks 04 to 06, `wire stats`, `wire channel` and `wire diff` | They are capture analysis for debugging a host, not work a client does. | unplanned; this plan |
| Task 07, the docs | Nothing to document until a task above is built. | unplanned; this plan |
| ahpd removes `tee.mjs` and its capture check | The tools stay in ahpd. | ahpd `documentation/02`, dropped |
