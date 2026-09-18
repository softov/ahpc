---
title: The update check reads npm's dist-tags endpoint and nothing larger
status: accepted
date: 2026-09-18
refs:
  - git://aa7b91e - ROADMAP.md "Telling somebody the version is old" as written on 2026-09-06, with the byte counts; the prose left the roadmap for this plan
  - https://registry.npmjs.org/-/package/@softov/ahpc/dist-tags - the endpoint, answering `{"latest":"0.4.0"}`
---

## Context

A tool that wants to know whether it is behind has to ask the registry something.
The registry offers four answers to the same question, at 18, 1826, 2252 and 20226 bytes.

## Decision

The screen asks `<registry>/-/package/<name>/dist-tags` and reads `latest` out of the reply.
`<registry>` is `npm_config_registry` when set, with a trailing slash removed, and `https://registry.npmjs.org` otherwise.
Nothing else in the reply is read, and no other endpoint is ever asked.

Source: Softov, ROADMAP.md, 2026-09-06.

## Consequences

The request is one small GET with no authentication, so a proxy or a mirror sees nothing unusual.
A registry that does not serve `/-/package/<name>/dist-tags` answers with an error, which is silence here (see [update-check-fails-silently](update-check-fails-silently.md)).

## Options

`/<name>/latest` is the abbreviated manifest of one version, 2252 bytes, and answers more than was asked.
The abbreviated packument (1826 bytes) and the full one (20226 bytes) carry every version and every tarball URL, for a question whose answer is one string.
