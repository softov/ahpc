---
title: The client speaks English, Portuguese or Spanish - deferred
date: 2026-09-30
---

Four things stay English, each for a reason that is not this plan's, and none of them is work waiting on a decision here.

| What | Why it waits | Where it goes |
| --- | --- | --- |
| Form validator messages in textui | The caller passes the message, so a component cannot translate it without taking the caller's words away. | unplanned; textui's own concern |
| Shell and layout names in textui | They are identifiers, not text a person reads. | nowhere; renaming them would break the API |
| `ChatSessionHead`'s dates | They go through `toLocaleString`, so they follow the machine's locale rather than `app.i18n.locale`. | unplanned; the two differ only when a person overrides `--lang` |
| Whatever the host sends | Titles, model and harness names, config titles and values, and activity lines are the host's own words. | nowhere; this client cannot translate text it did not write |

Non-interactive CLI output, `--json` and errors are not here: the plan decided they stay English, which is a locked-in choice rather than something set aside.
