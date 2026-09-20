# Developing ahpc

`ahpc` is one npm package, [`@softov/ahpc`](https://www.npmjs.com/package/@softov/ahpc): a terminal client for the Agent Host Protocol.
Node 22 or later.
This repository uses npm and `package-lock.json`; it is not a workspace, and `deno.lock` pins the same versions for a `deno run` of `dist/`.

The interface comes from [TextUI](https://github.com/softov/textui): `@textui/core` for components and state, `@textui/widgets` for the catalog, `@textui/terminal` for rendering and key decoding, and `@textui/testing` for the harness the tests run in.
`ahpc` began as an example inside it.

## Getting set up

```sh
git clone https://github.com/softov/ahpc
cd ahpc
npm install
```

| Command | What it does |
| --- | --- |
| `npm test` | The vitest suite, against a scripted host, so nothing else has to be running. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run build` | `tsc -p tsconfig.build.json`, into `dist/src`, which is what the package ships. |
| `npm run dev` | Build, then run `dist/src/main.js`. |
| `npm run dev:bun` | Run `src/main.tsx` under Bun, without building first. |
| `npm run schema` | Regenerate `tools/ahp.strict.schema.json` from the protocol package's own declarations. |
| `npm run wire -- <capture>` | Check a recording against that schema. |
| `npm run bench` | The transcript benchmark. |

## Layout

| Path | What it is |
| --- | --- |
| [`src/ahp/`](src/ahp) | The wire: the protocol types, the live connection, and the fake host that the tests and a bare `ahpc` run against. |
| [`src/control.ts`](src/control.ts) | The commands and keybindings, and what each place on screen offers. |
| [`src/state.ts`](src/state.ts) | The store keys, and what folding a host event into them means. |
| [`src/screens.tsx`](src/screens.tsx) | The screens, composed from `@textui/chat` and the widgets. |
| [`src/cli/`](src/cli) | The non-interactive commands. |
| [`src/mcp/`](src/mcp) | The tool server: the MCP server and the plain JSON API. |
| [`test/`](test) | Vitest, driven through `@textui/testing`. |

## Reading and writing the wire

`ahpc --wire <file>` (or `AHPC_RECORD=<file>`) appends every frame sent and received as one JSON line, `{ at, from, peer, frame }` - the same shape `ahpd --wire` writes, so a capture from either end reads the same.
`ahpc wire <file>` watches one as it is written.

`npm run wire -- <capture>` checks a recording against the strict schema, and [`test/conformance.test.ts`](test/conformance.test.ts) runs the same check against frames the test run itself produced, so it cannot pass on a stale recording.

`test/fixtures/resource-write.json` is shared with [`ahpd`](https://github.com/softov/ahpd) and has to stay identical: `resourceWrite` is symmetrical, and each repository's CI compares its copy against the other's `main`.
Change it in both.

## Depending on TextUI

Every screen, widget and key comes from the published `@textui/*` packages.
A change that needs a slot or a widget those packages do not have yet is a change to [textui](https://github.com/softov/textui) first: add it there, release it, then bump the range here and use it.
A queued row that names the model a message will run on is the worked example of a task waiting on exactly that.

## Publishing

One package, one tag.

1. Bump `version` in [`package.json`](package.json).
2. Commit.
3. Tag it and push the tag:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
```

[`.github/workflows/release.yml`](.github/workflows/release.yml) runs on any `v*` tag:

- It refuses the release unless the tag equals `package.json`'s version, and does that before building anything.
- It runs `npm run typecheck`, the suite, and `npm run build`.
- It runs `npm stage publish --provenance --access public`.

Staging is deliberate: nothing is installable until the version is approved on the npm package page.
A tag can be pushed by accident; an npm version cannot be unpublished.

Authentication is [trusted publishing](https://docs.npmjs.com/trusted-publishers): the workflow's GitHub OIDC token is the credential (`id-token: write`), so there is no `NPM_TOKEN` secret to rotate.
The job installs npm 12 because `npm stage` and trusted publishing need it; the npm bundled with Node 22 does not have them.

To rehearse without publishing, run the workflow from the Actions tab (`workflow_dispatch`).
`dry_run` defaults to true, and a rehearsal whose version is already on npm is refused by npm, which the workflow recognises and reports as expected.

`prepack` runs the build, so `npm pack` and `npm publish` always pack `dist/src` rather than a stale copy.
`npm pack --dry-run` prints exactly which files would ship.
