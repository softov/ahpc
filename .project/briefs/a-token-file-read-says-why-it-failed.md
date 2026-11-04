---
title: A token file that cannot be read says why, and its path is read the same from any folder
created: 2026-11-04
replaces:
  - problems/every-token-file-read-failure-is-called-a-missing-file.md
refs:
  - git://3bcf162 - the commit of this repository the facts were checked at, and the last commit that holds the problem
  - "[code://src/config.ts#L169-L182](../../src/config.ts#L169-L182) - `readTokenFile`, one `catch` for every failure"
  - "[code://src/config.ts#L109](../../src/config.ts#L109) - `loadConfig`, which knows where the config file is"
---

# A token file that cannot be read says why, and its path is read the same from any folder

Each failure to read a connection token file names its real reason.
A path in the config file means the same file whatever folder ahpc starts in.
Softov, 2026-11-04: "Reasons and paths".

## What others do

- A shell expands a leading `~` on the command line, and leaves a relative path relative to the folder it runs in.
- A path written in a config file is usually read from the config file's folder, so the file works from anywhere.

## What ahpc has today

- `readTokenFile` catches every read failure and says `No connection token at <path>. The host writes one there when it is given --connection-token-file.` ([`code://src/config.ts#L169-L182`](../../src/config.ts#L169-L182)).
- A file that exists but cannot be read, and a path that is a folder, get that sentence too.
- A `~` in the config file's `connectionTokenFile` is not expanded, so the path never works.
- A relative path in the config file is read from the folder ahpc started in.

## Who writes

- `/github/ahpc` is on `main` at `3bcf162`, and no pull request is open.
- [a-missing-token-file-is-one-sentence.md](a-missing-token-file-is-one-sentence.md) changes how the screen reports the throw, not `readTokenFile`.

## The change

- A missing file keeps the sentence that names the host's flag.
- A file that cannot be read for permissions says so, and so does a path that is a folder.
- Any other failure says the system's reason, with the path.
- A leading `~` in the config file's `connectionTokenFile` is the home folder.
- A relative `connectionTokenFile` is read from the config file's folder.
- A path given as `--connection-token-file` stays relative to the folder ahpc runs in.
- A test covers each reason and each path rule.
