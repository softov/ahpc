---
title: A session list filters a page after it arrives
status: accepted
date: 2026-10-13
refs:
  - "[code://src/cli/main.ts#L938-L952](../../src/cli/main.ts#L938-L952) - `session list`, which drops archived sessions on the client"
---

## Context

The protocol's `listSessions` has no filters. ahpc drops archived sessions on the client unless `--archived` is given. With [a cursor page](session-list-pages-by-the-host-cursor.md), the filter runs on one page.

## Decision

The archived filter runs on the page the host sent. A page of `--limit 10` can show fewer than ten rows, and the `nextCursor` still says whether there is more.

Source: (defaulted: the simplest shape that keeps the host's cursor valid.)

## Consequences

A row count below the limit does not mean the list is complete. Only a missing `nextCursor` means that, and the output says it.

## Options

- Fetch more pages until `limit` rows pass the filter. The rows after the limit in the last page cannot be reached again with an opaque cursor, so they are lost.
