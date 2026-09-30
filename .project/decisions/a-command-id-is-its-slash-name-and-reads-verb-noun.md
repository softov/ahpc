---
title: A command id is its slash name, and it reads verb.noun
status: accepted
date: 2026-09-30
refs:
  - "[code://src/screens.tsx#L688-L710](../../src/screens.tsx#L688-L710) - `slashCommands`, which offers a client command under its id"
  - "[code://src/control.ts](../../src/control.ts) - every client command and its id"
  - "[code://src/config.ts#L38](../../src/config.ts#L38) - `keys`, where a person's config names command ids"
---

## Context

The slash menu offers the client's own commands under their ids, so an id is what a person types after `/`.
The ids were named for the code (`go.automations`, `go.sessions`), and `go.` tells a person nothing about what the command does.
The titles are being translated, so what is typed and what is read can no longer be the same string.

## Decision

A command id is its slash name, and it is written verb.noun in English: `show.automations`, `new.session`, `delete.automation`.
It is the same in every language; the title beside it in the menu is the translated part.
An id that changes keeps its old id working in a person's `keys` config.

Source: Softov, 2026-09-30, asked "What should people type after / for the client's own commands?", chose "Verb.noun ids" over short English nouns and translated names.

## Consequences

Typed names are longer than a bare noun, and they are stable across languages, docs and muscle memory.
Every command id is renamed once, and the old ids have to be read as aliases for as long as configs may carry them.

## Options

- Short English nouns (`/automations`, `/theme`) as a slash name separate from the id: shorter, but a second name per command to keep in step.
- Translated slash names (`/automacoes`): friendliest to read, but what is typed changes with the language.
