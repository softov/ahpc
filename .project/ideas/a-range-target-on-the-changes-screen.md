---
title: A changeset operation can be pointed at a range of lines
created: 2026-11-04
refs:
  - "[code://src/ahp/types.ts#L369-L402](../../src/ahp/types.ts#L369-L402) - an operation's `scopes` can say `range`, and a target can carry `side` and `range`"
  - "[code://src/control.ts#L1481](../../src/control.ts#L1481) - `askTarget` offers This file or All files, and no range"
  - "[code://src/cli/main.ts#L868-L879](../../src/cli/main.ts#L868-L879) - `changes --run --file` sends a `resource` target, never a `range`"
  - "[code://.project/plans/screen/09-git-changes-take-their-arguments/deferred.md](../plans/screen/09-git-changes-take-their-arguments/deferred.md) - where this waited"
---

A host can offer an operation on a range of lines, such as staging one hunk.
ahpc reads the `range` scope, but neither the changes screen nor `ahpc changes --run` can send a `range` target, or choose the `before` or `after` side.
The idea: pick lines in the file diff on the changes screen, and a `--lines` flag in the shell.
