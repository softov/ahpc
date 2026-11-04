---
title: Documentation - what exists today
domain: documentation
revalidated: 2026-11-03
---

The documentation is `docs/`, in folders by kind of reader, built as a VitePress site at `https://ahpio.github.io/ahpc/`.
`docs/start/` installs and connects, and `docs/use/` shows each way to run ahpc.
`docs/subjects/` has one page per subject of the protocol, and `docs/reference/` lists every flag, tool and setting.
`docs/README.md` is the index of all documents.
There is no test: a page is correct when it describes the code as it is.

## Glossary

| Term | Meaning |
| --- | --- |
| subject page | One file in `docs/subjects/`, such as `AUTOMATIONS.md`, with the sections *Screen*, *Commands*, *MCP tools* and *Host support* |
| still | One frame of the screen, written as SVG by `ahpc --static --svg <file>` |
| picture | An image on a page, from `docs/img/` |

## Packages

- There is none. The pages are the deliverable.

## Contracts

- [`code://docs/README.md`](../../../docs/README.md) - the index: one table per folder, one line per page, and the *All documents* page of the site.
- [`code://docs/index.md`](../../../docs/index.md) - the home page of the site.
- [`code://docs/.vitepress/config.mts`](../../../docs/.vitepress/config.mts) - the site: the sidebar, the check that every page is in it, the nav, and the rewrite of a link that leaves `docs/`.
- [`code://docs/img/`](../../../docs/img/) - the pictures; `sessions.svg`, `transcript.svg` and `compose.svg` are stills.
- [`code://.github/workflows/deploy-docs.yml`](../../../.github/workflows/deploy-docs.yml) - builds the site and deploys it to GitHub Pages.

## Runtime path

```
docs/**/*.md -> vitepress build docs -> config.mts sidebar and check -> deploy-docs.yml -> GitHub Pages
```

## Tests

- `npm run docs:build` fails on a page the sidebar does not list, on a dead link and on a missing picture.

## Known gaps

- A subject page has no picture of its screen.
- There are no release notes: no `CHANGELOG.md`, no GitHub releases and no release pages.
