---
title: The price prints as the host sends it
status: accepted
date: 2026-11-04
refs:
  - "[code://src/cli/main.ts#L390](../../src/cli/main.ts#L390) - `session history` prints the price's amount and currency as they arrived"
  - "[code://src/screens.tsx#L2521-L2563](../../src/screens.tsx#L2521-L2563) - the usage screen prints the session's and each turn's cost as they arrived"
---

## Context

On 2026-11-03, a check by hand saw `session history` print a price as `0.1066192 USD`.
The host sends the amount with every decimal place it has.

## Decision

ahpc prints a price with the amount and the currency that the host sends, with no rounding.

Source: Softov, 2026-11-04: "for now its ok. could be a config latter... add as decisions for transparency".

## Consequences

The number on the screen and in the shell is the host's number, so it adds up the same as the host's own totals.
A long amount takes more room on a row.

## Options

Rounding to a fixed number of places, such as two, lost for now. It can come back as a setting, with the places as its value.
