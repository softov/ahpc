---
title: Each release is a docs page, from 0.10 on - implemented
date: 2026-11-04
refs:
  - git://2306729 - the commit this was built on
  - "[code://docs/.vitepress/releases.ts](../../../../docs/.vitepress/releases.ts) - `releases()`, which lists the release pages newest first"
  - "[code://docs/updates/v0_10.md](../../../../docs/updates/v0_10.md) - the first release page"
---

The docs site has release notes as ahpd has them.
*Updates* in the nav opens the newest release, a page under `/updates/` has its own sidebar, and the archive lists every release by year.

## What was built

- [`code://docs/.vitepress/releases.ts`](../../../../docs/.vitepress/releases.ts) - copied from ahpd's.
- [`code://docs/updates/releases.data.ts`](../../../../docs/updates/releases.data.ts) - copied from ahpd's.
- [`code://docs/updates/archive.md`](../../../../docs/updates/archive.md) - ahpd's archive, with a line that names the git tags as the record before 0.10.
- [`code://docs/.vitepress/config.mts`](../../../../docs/.vitepress/config.mts) - the `/updates/` sidebar of the newest 10 releases, the *Updates* nav entry, the sidebars keyed by path, and the check that reads both sidebars.
- [`code://docs/updates/v0_10.md`](../../../../docs/updates/v0_10.md) - the 0.10 page, with *The good stuff* and `## 0.10.0 - unreleased`.
- [`code://docs/README.md`](../../../../docs/README.md) - an *Updates* group with the archive and the 0.10 page.
- [`code://DEVELOPER.md`](../../../../DEVELOPER.md) - the publishing step that dates the release's section.

## Verified

- `npm run docs:build` passes.
- A page `docs/updates/v0_99.md` with no `date` fails the build with its name.
- The nav's *Updates* opens the 0.10 page, and its sidebar links the archive.
- The archive lists ahpc 0.10, and the four anchors in *The good stuff* resolve.
- `npm run typecheck` passes, and `npx vitest run` passes 896 tests in 44 files.
- Softov read the page on 2026-11-04.

## Departures from the plan

- `docs/README.md` lists the 0.10 page too, as ahpd's lists each page.
- `cli/04` and `cli/05` are not on the page, because they shipped in 0.9.0.
- A line with `<RESOURCE>` outside a code span failed the build, because Vue reads it as a tag. It is in a code span.
