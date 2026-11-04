---
title: The checkout operation takes its branch
created: 2026-11-04
refs:
  - "[code://src/control.ts#L2096](../../src/control.ts#L2096) - `changes.run`, which sends `_meta` for a commit and a pull request only"
  - "[code://.project/plans/screen/09-git-changes-take-their-arguments/deferred.md](../plans/screen/09-git-changes-take-their-arguments/deferred.md) - where this waited"
  - file:///github/ahpd/packages/sdk/src/sessions/changes.ts - at ahpd `586d4e5a`, `checkout` takes the branch as `_meta.treeish` and a dirty tree's choice as `_meta.preCheckoutAction`
---

ahpd offers `checkout` on the changeset of a session that has done nothing yet, so a person picks the branch the session starts on.
The branch goes in `_meta.treeish`, and a dirty tree needs `_meta.preCheckoutAction`, `stash` or `commit`.
ahpc sends no `_meta` for `checkout`, so a checkout from the changes screen or the shell names no branch.
The idea: ask for the branch, and for stash or commit when the host refuses with `dirtyWorkingTree`, through the path that the commit message uses.
