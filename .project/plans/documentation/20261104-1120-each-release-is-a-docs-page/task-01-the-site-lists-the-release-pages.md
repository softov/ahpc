---
title: The site lists the release pages
status: todo
depends: []
layer: "docs"
refs:
  - "[code://docs/.vitepress/config.mts#L20-L88](../../../../docs/.vitepress/config.mts#L20-L88) - the sidebar and the check this task extends"
  - file:///github/ahpd/docs/.vitepress/config.mts - the pattern to copy
---

## Objective

The site has an *Updates* nav entry, a `/updates/` sidebar of the newest releases, and an archive of every release.
They read the release pages from `docs/updates/`, so a new page needs no config change.

## Files

- `CREATE: docs/.vitepress/releases.ts` - `releases()`, copied from ahpd's.
- `CREATE: docs/updates/releases.data.ts` - the data loader, copied from ahpd's.
- `CREATE: docs/updates/archive.md` - every ahpc release by year, and a line that releases before 0.10 are in the git tags.
- `UPDATE: docs/.vitepress/config.mts:20-88` - the `/updates/` sidebar, and the check that reads both sidebars.
- `UPDATE: docs/.vitepress/config.mts:140-146` - the *Updates* nav entry, and the sidebars keyed by path.
- `UPDATE: docs/README.md` - an *Updates* group with the archive.
- `UPDATE: DEVELOPER.md:57-75` - the release page as a publishing step.

## Steps

1. Copy `releases.ts` from ahpd to `docs/.vitepress/releases.ts`.
2. Copy `releases.data.ts` from ahpd to `docs/updates/releases.data.ts`.
3. Write `docs/updates/archive.md` from ahpd's, with "ahpc" for "ahpd".
4. Add to the archive one line that names the git tags `v0.3.0` to `v0.9.0` as the record before 0.10.
5. Add the `updates` sidebar to `config.mts`: the newest 10 releases, then *View all releases*.
6. Key the sidebars by path: `/updates/` to `updates`, `/` to `sidebar`.
7. Make the check for unlisted pages read both sidebars.
8. Add *Updates* to the nav, linked to the newest release, or to the archive when there is none.
9. Add an *Updates* group to `docs/README.md`, with a row for the archive.
10. Add a publishing step to `DEVELOPER.md`: date the release's section in `docs/updates/vX_Y.md`.
11. Say in that step that a new minor release gets a new page.

## Validation

- `npm run docs:build` passes.
- A page `docs/updates/v0_99.md` with no `date` fails the build with its name; remove it after.
- `npm run typecheck`, `npm run build` and `npx vitest run` pass.

## Resume
