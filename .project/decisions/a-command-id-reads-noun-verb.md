---
title: A command id is its slash name, and it reads noun.verb
status: accepted
date: 2026-09-30
supersedes: decisions/a-command-id-is-its-slash-name-and-reads-verb-noun.md
refs:
  - "[code://src/screens.tsx#L688-L710](../../src/screens.tsx#L688-L710) - `slashCommands`, which offers a client command under its id"
  - "[code://src/control.ts](../../src/control.ts) - every client command and its id"
  - "[code://src/config.ts#L38](../../src/config.ts#L38) - `keys`, where a person's config names command ids"
---

## Context

The slash menu offers the client's own commands under their ids, so an id is what a person types after `/`.
The `go.` ids named a mechanism, not a thing, and the titles are being translated, so the typed name has to stand on its own in English.
Verb first was proposed and turned down before any id was renamed.

## Decision

A command id is its slash name, written noun.verb in English and the same in every language.
The noun is plural when the command shows a list (`automations.show`, `sessions.show`) and singular when it acts on one (`automation.new`, `session.dispose`).
An id that changes keeps its old id working in a person's `keys` config.

Source: Softov, 2026-09-30, shown a verb.noun table and answered "session.new, automations.show, automations.new etc. better"; then asked "Singular or plural noun in noun.verb ids?", chose "Plural to show, singular to act".

## Consequences

Typing a noun lists what can be done to it, so `/automation` offers new, edit, run and delete together.
A noun can have two groups in the menu, `automations.` for the list and `automation.` for one, which is the price of reading as English does.
Most ids were already noun.verb, so fewer change than a verb-first scheme would have renamed.

## Options

- verb.noun (`show.automations`): groups by what is done rather than what it is done to; turned down.
- One noun form everywhere, singular or plural: one group per noun, but `automation.show` for a list reads wrong.
