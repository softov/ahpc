---
version: 1
id: "tidy-the-notes"
name: "Tidy the notes"
schedule:
  kind: cron
  expression: "0 9 * * 1-5"
  timeZone: local
---

Read every note in the folder.

Sort them by name, and say which ones are empty.
