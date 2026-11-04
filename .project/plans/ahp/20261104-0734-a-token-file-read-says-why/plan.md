---
title: A token file that cannot be read says why, and its path is read the same from any folder
domain: ahp
status: active
priority: medium
created: 2026-11-04
revalidated: 2026-11-04
refs:
  - git://7551c40 - the commit the facts were checked at, and the last commit that holds the brief `briefs/a-token-file-read-says-why-it-failed.md`
  - "[code://src/config.ts#L169-L182](../../../../src/config.ts#L169-L182) - `readTokenFile`, one `catch` for every failure"
  - "[code://src/config.ts#L109](../../../../src/config.ts#L109) - `loadConfig`, which knows the config file's path"
  - "[code://src/config.ts#L147-L158](../../../../src/config.ts#L147-L158) - `connectionToken`, the only caller"
---

## Goal

Each failure to read a connection token file names its real reason.
A path in the config file means the same file whatever folder ahpc starts in.

## Reconnaissance

The files read are the `refs` in the frontmatter, each with its note.

### Searches performed

- `readTokenFile` in `src/` - only `connectionToken` calls it, for the flag and for the config file.
- `loadConfig` - it knows the path of the config file it read.

### Runtime path

```
connectionToken -> readTokenFile -> readFileSync
```

## Answers

| What | Source | Task |
| --- | --- | --- |
| A missing file keeps the sentence that names the host's flag | Softov, 2026-11-04: "Reasons and paths" | 01 |
| A permission failure and a folder each say so, and any other failure says the system's reason | Softov, 2026-11-04: "Reasons and paths" | 01 |
| A leading `~` in the config file's `connectionTokenFile` is the home folder | Softov, 2026-11-04: "Reasons and paths" | 01 |
| A relative `connectionTokenFile` is read from the config file's folder | Softov, 2026-11-04: "Reasons and paths" | 01 |
| A path given as `--connection-token-file` stays as the shell gave it | (defaulted: the shell already expands `~` and a relative path follows the working folder) | 01 |

## Tasks

| Task | Status | Depends on |
| --- | --- | --- |
| [01 - Reasons and paths](task-01-reasons-and-paths.md) | implemented | - |

## Risks and tradeoffs

- A config file with a relative path that worked from one working folder now reads another file. It is rare, and the new rule is the usual one.

## Resume state

- **Done so far:** task 01 - reasons and paths.
- **Next action:** nothing to build; the task is implemented and awaits review.
- **Open questions:** none.

## Final verification checklist

- [ ] `npm run typecheck`, `npm run build` and `npx vitest run` pass.
