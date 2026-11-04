---
title: The changes screen's hint row fits 60 columns
created: 2026-11-04
refs:
  - "[code://src/app.tsx#L381-L410](../../src/app.tsx#L381-L410) - the hint row on the changes screen"
  - "[code://.project/plans/screen/11-a-file-is-staged-discarded-or-committed-from-its-row/deferred.md](../plans/screen/11-a-file-is-staged-discarded-or-committed-from-its-row/deferred.md) - where this waited"
---

At 60 columns the hint row on the changes screen cuts its labels short, and the verb keys make the row longer.
The idea: drop the hints of lower value first on a narrow terminal, so that each hint left is whole.
