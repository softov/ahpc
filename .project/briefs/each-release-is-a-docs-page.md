---
title: Each release is a docs page, from 0.10 on
created: 2026-11-03
refs:
  - git://fd341f0 - the commit of this repository the facts were checked at
  - git://97b0ca4f - the ahpd commit read for its release pages
  - "[code://docs/.vitepress/config.mts#L21-L70](../../docs/.vitepress/config.mts#L21-L70) - the sidebar, one list of groups"
  - "[code://docs/.vitepress/config.mts#L82-L88](../../docs/.vitepress/config.mts#L82-L88) - the build fails on a page that the sidebar does not list"
  - "[code://docs/.vitepress/config.mts#L140-L146](../../docs/.vitepress/config.mts#L140-L146) - the nav and the one sidebar"
  - "[code://DEVELOPER.md#L57-L85](../../DEVELOPER.md#L57-L85) - the publishing steps, which gain the release page"
  - "[code://.github/workflows/deploy-docs.yml](../../.github/workflows/deploy-docs.yml) - deploys the site on a push to `main` that touches `docs/**`"
  - file:///github/ahpd/.project/plans/documentation/20261030-0312-each-release-is-a-docs-page/plan.md - the ahpd plan this change copies
  - file:///github/ahpd/docs/.vitepress/releases.ts - `releases()`, which reads `v<major>_<minor>.md` and its `date`, newest first
  - file:///github/ahpd/docs/updates/archive.md - the archive page, grouped by year
  - file:///github/ahpd/docs/updates/releases.data.ts - the data loader that hands `releases()` to the archive
  - https://code.visualstudio.com/updates/v1_142 - the page Softov named as the model for ahpd
---

# Each release is a docs page, from 0.10 on

The ahpc docs site gets release notes as ahpd has them: one page per minor release, with its own sidebar and an archive.
Softov, 2026-11-03: "in ahpc onto docs, like ahpd, I want a docs for the changelogs".
The pages start at 0.10, and 0.10.0 waits for them.
Softov, 2026-11-03: "From 0.10 on" and "Wait for the pages".

## What others do

- ahpd, at `97b0ca4f`, has `docs/updates/v0_NN.md`, one page per minor release.
- An ahpd page has `title` and `date` in its front matter, and starts with a *The good stuff* quote that links to the best changes.
- Each patch release is one `## 0.NN.P - <date>` section, newest first.
- `docs/.vitepress/releases.ts` in ahpd lists the pages newest first, and fails the build on a page with no `date`.
- ahpd's `config.mts` builds a second sidebar for `/updates/` from the newest 10 releases and *View all releases*, and keys the sidebars by path.
- ahpd's nav has *Updates*, which opens the newest release.
- ahpd's check for unlisted pages reads both sidebars.
- ahpd's `docs/updates/archive.md` lists every release by year, from `releases.data.ts`.
- ahpd's `CHANGELOG.md` is one line that links to the pages.
- ahpd's `DEVELOPER.md` names the release page as a publishing step.
- VS Code has one page per release at `code.visualstudio.com/updates/v1_NNN`, which ahpd took as its model.

## What ahpc has today

- There is no `CHANGELOG.md`, no GitHub release and no release page.
- The tags `v0.3.0` to `v0.9.0` are the only record of a release. `v0.9.0` is dated 2026-10-16.
- Since `v0.9.0`, `main` has 16 code commits and 3 plan commits.
- The site has one sidebar, and [`code://docs/.vitepress/config.mts#L82-L88`](../../docs/.vitepress/config.mts#L82-L88) fails the build on a page outside it.
- [`code://DEVELOPER.md#L57-L85`](../../DEVELOPER.md#L57-L85) has three publishing steps: bump the version, commit, and push the tag.

## Who writes

- No pull request is open, no branch is unmerged, and there is one worktree, on `main`.
- [`code://.github/workflows/deploy-docs.yml`](../../.github/workflows/deploy-docs.yml) publishes the pages when they reach `main`; it needs no change.
- `.github/workflows/release.yml` reads no docs page.
- The links pull request of the move changes `config.mts` too, in `GITHUB`. The two changes touch different lines.

## The change

- `docs/updates/v0_10.md` is the first page, with `title`, `date` and *The good stuff*. It holds 0.10.0 and its patch releases.
- `docs/.vitepress/releases.ts`, `docs/updates/releases.data.ts` and `docs/updates/archive.md` copy ahpd's.
- The archive says that releases before 0.10 are in the git tags.
- `config.mts` gets the releases sidebar, keyed by `/updates/`, and the check reads both sidebars.
- The nav gets *Updates*, which opens the newest release.
- `docs/README.md` gets a row for the updates.
- The publishing steps in `DEVELOPER.md` gain "write or date the release's section in `docs/updates/v0_NN.md`".
- The date of a release that is not out yet is `unreleased`, as ahpd writes it.

## Open points

- ahpd has a one-line `CHANGELOG.md` that links to the pages. ahpc has none, and Softov said never to edit `CHANGELOG.md`. Whether ahpc gets that one line is Softov's choice.
- ahpd names the quote *The good stuff*. This brief copies the name, unless Softov wants another.
- The `date` of `v0_10.md` is the release day, which is not known yet. The build needs a date, so the page has the day it is written until the release.
