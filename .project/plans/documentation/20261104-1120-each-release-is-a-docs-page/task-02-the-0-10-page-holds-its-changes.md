---
title: The 0.10 page holds its changes
status: done
depends: [task-01-the-site-lists-the-release-pages.md]
layer: "docs"
refs:
  - file:///github/ahpd/docs/updates/v0_14.md - the shape of a page
  - git://v0.9.0 - the last release before this page
---

## Objective

`docs/updates/v0_10.md` says what changed since 0.9.0, for a person who uses ahpc.
It opens with *The good stuff*, and holds the section `## 0.10.0 - unreleased`.

## Files

- `CREATE: docs/updates/v0_10.md` - the 0.10 page.

## Steps

1. Read `git log v0.9.0..main --no-merges`, and the `implemented.md` of each plan built since 2026-10-16.
2. Write the front matter: `title: ahpc 0.10`, and today as the `date`.
3. Write *The good stuff*: one sentence, then up to five links to the best changes.
4. Write `## 0.10.0 - unreleased`, with one `###` group for each subject.
5. Use subjects such as the screen, the shell, the tool server and the connection.
6. Write each change as one sentence a user understands, with a link to its docs page where one exists.
7. Leave out changes to tests, plans and the build only.

## Validation

- `npm run docs:build` passes.
- The nav's *Updates* opens the page, and the archive lists ahpc 0.10.
- Softov reads the page before anyone commits it.

## Resume
