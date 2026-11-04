---
title: The docs site shows the logo
status: todo
depends: []
layer: "docs"
refs:
  - "[code://docs/.vitepress/config.mts#L157](../../../../docs/.vitepress/config.mts#L157) - `themeConfig`"
  - "[code://docs/index.md](../../../../docs/index.md) - the home page hero"
  - https://github.com/softov/ahpd/blob/main/docs/public/logo.svg - the file to copy
---

## Objective

The nav and the home page of ahpc's docs site show ahpd's four-dot logo, as ahpd's site does.

## Files

- `CREATE: docs/public/logo.svg` - ahpd's `docs/public/logo.svg`, byte for byte.
- `UPDATE: docs/.vitepress/config.mts:157` - `logo: '/logo.svg'` in `themeConfig`.
- `UPDATE: docs/index.md` - the hero `image`, as ahpd's home page has it.

## Steps

1. Copy ahpd's `docs/public/logo.svg` to `docs/public/logo.svg`.
2. Add `logo: '/logo.svg'` to `themeConfig`.
3. Add the hero `image` with `src: /logo.svg` and `alt: ahpc`.

## Validation

- Run `npm run docs:build`, and check that it passes.
- Open the built home page, and check the logo in the nav and the hero.

## Resume
