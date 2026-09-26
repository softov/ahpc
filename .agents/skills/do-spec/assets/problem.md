---
title: <What is wrong, as a statement>
status: open
found: <YYYY-MM-DD>
severity: <blocker | major | minor>
domain: <agent | cli | tools | commands | ...>
blocks:
  - plans/<domain>/<NN>-<slug>/task-<NN>-<slug>.md
fixed-by: plans/<domain>/<NN>-<slug>/task-<NN>-<slug>.md
refs:
  - "[code://<path>#L<n>](../../<path>#L<n>) - <the code where it shows>"
  - git://<sha> - <the change that introduced it>
  - https://<issue or document> - <what it says>
---

## Symptom

<What is observed, and how to see it again: the command, the input, the output.>

## Cause

<What is known about why, and what is still guessed. Write "unknown" rather than a guess dressed as a finding.>

## Impact

<What it blocks or degrades, and for whom. Which task stops here, if one does.>

## Workaround

<What is done meanwhile, or "none". It holds only while this problem is open or mitigated, and it binds nothing once the status is fixed.>

## Fix

<What would resolve it, as a candidate and not a commitment. Name the task or plan that owns it when one exists. A choice between two workable fixes is a decision: write that in `.project/decisions/` and link it here.>
