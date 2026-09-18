---
title: Versions are compared by a function written here, not by a semver package
status: accepted
date: 2026-09-18
refs:
  - git://aa7b91e - ROADMAP.md "Telling somebody the version is old" as written on 2026-09-06; the prose left the roadmap for this plan
  - code://src/version.ts#L24 - `version()`, which answers `unknown` where there is no manifest
---

## Context

Neither repository depends on `semver`, and one comparison does not earn a dependency.
Both repositories run ahead of the registry most days, because they are developed from a checkout.
A tool that says "you are behind" every start to the person developing it is a tool people switch off.

## Decision

`newer(latest, current)` parses `X.Y.Z` with an optional `-prerelease` and answers true only when `latest` is ahead.
The three numbers compare numerically, in order.
When the numbers are equal, `latest` is newer only if `current` carries a prerelease tag and `latest` does not: a prerelease loses to its own release.
A local build ahead of the registry is not newer, and neither side being parseable, including `version()` answering `unknown`, is not newer.

Source: Softov, ROADMAP.md, 2026-09-06.

## Consequences

Two prereleases of the same version never compare, which is right for a check whose only job is to say a release is out.
The function is small enough to carry in both repositories (see [ahpc-and-ahpd-share-no-package](ahpc-and-ahpd-share-no-package.md)) and is tested by a table.

## Options

`semver` would answer the same question in one call and add a dependency to a client that has five.
Comparing the strings would call `0.10.0` older than `0.9.0`.
