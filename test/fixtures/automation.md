---
title: Tidy the notes
enabled: true
message:
  origin:
    kind: automation
session:
  provider: demo
  model:
    id: demo-fast
  workingDirectories:
    - file:///srv/demo
triggers:
  - id: t1
    kind: schedule
    schedule:
      expression: 0 9 * * 1-5
      timeZone: UTC
    misfirePolicy: runOnce
---
Read every note in the folder.

Sort them by name, and say which ones are empty.
