---
title: Each release is a docs page, from 0.10 on
domain: documentation
status: active
priority: high
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://163a205 - the commit the facts were checked at, and the last commit that holds the brief `briefs/each-release-is-a-docs-page.md`
  - git://16bf971c - the ahpd commit read for its release pages
  - "[code://docs/.vitepress/config.mts#L20-L70](../../../../docs/.vitepress/config.mts#L20-L70) - the sidebar, one list of groups"
  - "[code://docs/.vitepress/config.mts#L81-L88](../../../../docs/.vitepress/config.mts#L81-L88) - the build fails on a page that the sidebar does not list"
  - "[code://docs/.vitepress/config.mts#L140-L146](../../../../docs/.vitepress/config.mts#L140-L146) - the nav and the one sidebar"
  - "[code://docs/README.md](../../../../docs/README.md) - the index of all documents, one table for each group"
  - "[code://DEVELOPER.md#L57-L75](../../../../DEVELOPER.md#L57-L75) - the publishing steps, which gain the release page"
  - "[code://.github/workflows/deploy-docs.yml](../../../../.github/workflows/deploy-docs.yml) - deploys the site on a push to `main` that touches `docs/**`, and needs no change"
  - file:///github/ahpd/docs/.vitepress/releases.ts - `releases()`, which reads `v<major>_<minor>.md` and its `date`, newest first, and fails on a page with no `date`
  - file:///github/ahpd/docs/updates/releases.data.ts - the data loader that hands `releases()` to the archive
  - file:///github/ahpd/docs/updates/archive.md - the archive page, grouped by year
  - file:///github/ahpd/docs/.vitepress/config.mts - the `/updates/` sidebar of the newest 10 releases, the *Updates* nav entry, and the check that reads both sidebars
  - file:///github/ahpd/docs/updates/v0_14.md - a release page: `title`, `date`, *The good stuff*, then one section for each patch release
  - https://code.visualstudio.com/updates/v1_142 - the page Softov named as the model for ahpd
---

## Goal

The ahpc docs site gets release notes as ahpd has them: one page for each minor release, with its own sidebar and an archive.
The pages start at 0.10, and 0.10.0 waits for them.

## Reconnaissance

The files read and the patterns to reuse are the `refs` in the frontmatter, each with its note.

### Searches performed

- `ls CHANGELOG.md docs/updates` in ahpc - neither exists.
- `git log --oneline v0.9.0..main --no-merges` - 66 commits since `v0.9.0`, which is dated 2026-10-16.
- `git diff fd341f0..163a205 -- docs/.vitepress DEVELOPER.md .github/workflows docs/README.md` - nothing changed since the brief.
- `rg "updates|releases" docs/.vitepress/config.mts` in ahpd - the sidebar, the nav and the check, as the refs say.

### Runtime path

```
docs/updates/v0_10.md -> releases() -> the /updates/ sidebar, the Updates nav entry, the archive -> the site
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| The site gets release pages as ahpd has them | Softov, 2026-11-03: "in ahpc onto docs, like ahpd, I want a docs for the changelogs" | 01 |
| `releases.ts`, `releases.data.ts` and `archive.md` copy ahpd's, with ahpc for ahpd | (defaulted: a second instance copies the first) | 01 |
| The `/updates/` sidebar shows the newest 10 releases and *View all releases*; the nav gets *Updates* | (defaulted: as ahpd's `config.mts`) | 01 |
| The check for unlisted pages reads both sidebars | (defaulted: as ahpd's `config.mts`) | 01 |
| The archive says that releases before 0.10 are in the git tags | (defaulted: the tags `v0.3.0` to `v0.9.0` are the only record of them) | 01 |
| `docs/README.md` gets an *Updates* group, and `DEVELOPER.md` gets the release page as a publishing step | (defaulted: as ahpd's `DEVELOPER.md`) | 01 |
| The pages start at 0.10 | Softov, 2026-11-03: "From 0.10 on" | 02 |
| 0.10.0 waits for the pages | Softov, 2026-11-03: "Wait for the pages" | 02 |
| ahpc gets no `CHANGELOG.md` | Softov, 2026-11-04: "No CHANGELOG.md" | - |
| The quote at the top of a page is *The good stuff* | Softov, 2026-11-04: "The good stuff, as ahpd" | 02 |
| A page's `date` is the day its `.0` came out; until then, the day it was written | (defaulted: `releases()` reads a date, and ahpd's pages carry the `.0` day) | 02 |
| A section of a release not out yet is headed `## 0.10.0 - unreleased` | (defaulted: as ahpd's `v0_14.md`) | 02 |

## Proposed architecture

- **Data flow** - `releases()` reads `docs/updates/` at build time, and the config and the archive both take their list from it.
- **Layer responsibilities** - `docs/.vitepress/`: the list and the sidebars · `docs/updates/`: the pages and the archive · `DEVELOPER.md`: the step.
- **Source-of-truth files** - `docs/.vitepress/releases.ts`, once task 01 creates it.

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - The site lists the release pages](task-01-the-site-lists-the-release-pages.md) | implemented | - |
| [02 - The 0.10 page holds its changes](task-02-the-0-10-page-holds-its-changes.md) | implemented | 01 |

## Risks and tradeoffs

- The links pull request of the move changes `GITHUB` in `config.mts` too. The two changes touch different lines.
- The 0.10 page names what is merged when it is written. A change merged later goes into the page before the tag.

## Resume state

- **Done so far:** tasks 01 and 02 implemented 2026-11-04, as [implemented.md](implemented.md) says. Softov read the page on 2026-11-04.
- **Next action:** Softov reviews the pull request.
- **Open questions:** none.
- **Watch out for:** the build fails on a page that no sidebar lists, so the archive must be in the `/updates/` sidebar.

## Final verification checklist

- [ ] `npm run docs:build` passes.
- [ ] A release page with no `date` fails the build.
- [ ] The nav's *Updates* opens the 0.10 page, and *View all releases* opens the archive.
- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
