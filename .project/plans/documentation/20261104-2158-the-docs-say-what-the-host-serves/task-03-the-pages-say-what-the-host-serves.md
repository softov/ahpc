---
title: The pages say what the host serves
status: done
depends: [task-02-the-pictures-show-fields-and-slash.md]
layer: "docs"
refs:
  - "[code://docs/use/NEW-SESSION.md](../../../../docs/use/NEW-SESSION.md) - the fields and the agents"
  - "[code://docs/use/SESSION.md](../../../../docs/use/SESSION.md) - approving a tool call"
  - "[code://docs/subjects/CUSTOMIZATIONS.md](../../../../docs/subjects/CUSTOMIZATIONS.md) - the panel and the menu"
---

## Objective

*New session* explains each field, and says the host serves the fields and the agents.
*Customizations* shows the panel and the `/` menu, and *Session* shows an approval.

## Files

- `UPDATE: docs/use/NEW-SESSION.md` - the agents the host serves, a table of the usual fields, and `/` linked to *Customizations*.
- `UPDATE: docs/subjects/CUSTOMIZATIONS.md` - `slash.svg`, and that the host sends what the panel and the menu list.
- `UPDATE: docs/use/SESSION.md` - `turns.svg` beside the approval keys.
- `UPDATE: docs/subjects/AGENTS.md` - the alt text of a picture that changed, if any.

## Steps

1. Write in *New session* that the host serves the agents, and that each agent and host sends its own fields.
2. Add a table of the usual fields: agent, model, mode, permissions, folder, isolation and branch.
3. Say that a host may send fewer fields or others, and each one gets a chip.
4. Link `/` in *New session* to *Customizations*.
5. Add `slash.svg` to *Customizations*, and say that the host sends what it lists.
6. Add `turns.svg` to *Session*, beside the keys that approve and deny.

## Validation

- Run `npm run docs:build`, and check that it passes.
- Open *New session*, *Session* and *Customizations* in the built site, and check each picture and its text.

## Resume
