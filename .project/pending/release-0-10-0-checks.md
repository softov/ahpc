---
title: Release 0.10.0 from ahpio/ahpc
plans:
  - plans/cli/05-prompt-on-a-busy-session/plan.md
  - plans/cli/06-mcp-tool-groups-are-found-and-all-is-one-word/plan.md
  - plans/cli/20261030-0802-a-dispatch-waits-for-the-hosts-answer/plan.md
  - plans/cli/20261030-0802-ahpd-usage-and-tasks-are-shown/plan.md
  - plans/ahp/20261030-0802-a-new-session-is-an-ahp-session-uri/plan.md
---

# Release 0.10.0 from ahpio/ahpc

0.10.0 is the first release from `ahpio/ahpc`.
It waits for two things: the move of the repository, and the release pages in [documentation/20261104-1120-each-release-is-a-docs-page](../plans/documentation/20261104-1120-each-release-is-a-docs-page/plan.md).
The steps that change GitHub or npm are yours.
After each one, write "done" in the chat.

## Things the move will change

The npm name stays `@softov/ahpc`.
The 16 links to ahpc move to `ahpio`, in one pull request after the transfer.

| File | Links | What changes |
| --- | --- | --- |
| `README.md` | 10 | The CI badge, the repository and 8 links to the docs site |
| `package.json` | 3 | `repository.url`, `homepage` and `bugs` |
| `DEVELOPER.md` | 1 | The repository link |
| `docs/.vitepress/config.mts` | 1 | `GITHUB`, which also makes the "Edit this page" links |
| `.github/workflows/deploy-docs.yml` | 1 | A comment with the docs site |

- The docs site moves from `https://softov.github.io/ahpc/` to `https://ahpio.github.io/ahpc/`. The base stays `/ahpc/`.
- Provenance on npm names `ahpio/ahpc` from 0.10.0 on. 0.9.0 and older keep `softov/ahpc`.

The 8 links to ahpd keep `softov`, because `ahpio/ahpd` does not exist yet.
They move when ahpd moves.

| File | Links |
| --- | --- |
| `README.md` | 1 |
| `DEVELOPER.md` | 1 |
| `docs/start/CONNECT.md` | 2, to the ahpd docs site |
| `docs/start/GET-STARTED.md` | 1 |
| `.github/workflows/ci.yml` | 1, the ahpd fixture URL |
| `.project/decisions/ahpc-and-ahpd-share-no-package.md` | 1 |
| `.project/plans/ahp/06-trusted-folders-are-sent-on-every-connection/plan.md` | 1 |

The ahpd fixture URL in `ci.yml` is broken today.
`test/fixtures/resource-write.json` gives 404 on ahpd `main`, and `packages/sdk/test/fixtures/resource-write.json` gives 200.
The links pull request corrects the path.

## Your steps

1. Transfer `softov/ahpc` to the `ahpio` organization: *Settings*, *Danger Zone*, *Transfer ownership*.
2. In `ahpio/ahpc`, check that *Settings*, *Pages* shows the source *GitHub Actions*.
3. Merge the links pull request when CI is green.
4. Check that the *Deploy docs* run on `main` passes, and that `https://ahpio.github.io/ahpc/` opens.
5. Set the repository's *About*, *Website* to `https://ahpio.github.io/ahpc/`.
6. On npmjs.com, open `@softov/ahpc`, *Settings*, *Trusted publishing*, and set the GitHub Actions publisher in *npm trusted publisher*.
7. Create `softov/softov.github.io` with the `404.html` in *Redirect for the old docs URL*, and turn on Pages from `main`.
8. Read the 0.10 release page and the version bump, and say when the tag can be pushed.
9. After the tag is pushed, approve the staged version at `https://www.npmjs.com/package/@softov/ahpc`.

## npm trusted publisher

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `ahpio` |
| Repository | `ahpc` |
| Workflow filename | `release.yml` |
| Environment | empty |

## Redirect for the old docs URL

GitHub does not redirect a Pages site after a transfer.
A user site at `softov.github.io` serves every path that no project site of `softov` serves, so its `404.html` catches `/ahpc/`.

```html
<!doctype html>
<meta charset="utf-8">
<title>Moved</title>
<script>
  const path = location.pathname;
  if (path.startsWith('/ahpc/')) location.replace('https://ahpio.github.io' + path + location.search + location.hash);
</script>
<p>This page moved to <a href="https://ahpio.github.io/ahpc/">ahpio.github.io/ahpc</a>.</p>
```

When ahpd moves, the same file gets a line for `/ahpd/`.

## My steps

1. After step 1, open the links pull request with the changes in *Things the move will change*.
2. After the release pages are merged, bump `package.json` to `0.10.0` and write `docs/updates/v0_10.md`.
3. Show you the page and the bump, and commit only after you approve them.
4. Push the tag `v0.10.0` only after step 8.
5. Watch the release run, and stop and show you the error if it fails.

## Checks after the release

1. Run `npm view @softov/ahpc version`, and check that it prints `0.10.0`.
2. On the npm page, check that the provenance names `ahpio/ahpc` and `release.yml`.
3. Run `npx @softov/ahpc@0.10.0 --version`, and check that it prints `0.10.0`.
4. Open `https://softov.github.io/ahpc/use/SCREEN`, and check that it lands on the same page under `ahpio.github.io`.

## Reply

- Write "done" after each of your steps, or what went wrong.
