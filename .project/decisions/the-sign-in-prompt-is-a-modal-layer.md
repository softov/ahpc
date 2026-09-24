---
title: The sign-in prompt is a modal layer, opened wherever the refusal happened
status: accepted
date: 2026-09-23
refs:
  - code://src/app.tsx#L497-L543 - the component registration list and the one layer opened over every screen
  - code://src/control.ts#L1122-L1141 - the palette's modal, the pattern a second modal copies
  - code://src/ahp/live.ts#L105-L114 - `onAuthRequired`, the callback that has nowhere to go today
  - code://src/connect.ts#L73-L86 - where the refusal is printed instead
  - code://src/screens.tsx#L873-L912 - the find box, the in-screen text input that is not a modal
  - code://src/screens.tsx#L1420-L1524 - the automation form, the `Form` and `TextInput` and `FormActions` pattern
  - npm://@textui/core@^0.6.1 - `LayerEntry`, whose planes are base, floating, modal, notification and debug
---

## Context

A `-32007` reaches this client on the connection and `onAuthRequired` reads it there, and the only thing done with it is a sentence on stderr or in the footer.
The refusal can be earned on any screen: a catalogue read, a session opening, a file listing, a turn dispatch.
A terminal client has no sheet, so the person is told what to do and left to do it, and the screen they were on is usually not where a credential could be typed.

The interface already has the mechanism a sheet needs.
`@textui/core` gives five layer planes, `app.layers.open` already puts the command palette on `modal` with a scrim, a focus trap and escape-to-dismiss, and `@textui/widgets` already has the text field, the form and its submit and cancel row.

## Decision

The prompt is a `modal` layer with a scrim, a focus trap and escape-to-dismiss, opened at the moment the refusal or the notification arrives, wherever the person happens to be.
Its component is registered in `app.tsx` beside the others and is not a screen.
It is drawn over the act that was refused rather than replacing it, so declining leaves the person exactly where they were.

## Consequences

A credential can be supplied from any screen without navigating, and dismissing it is one key rather than walking a stack back.
The refused act's promise is held while the layer is open, which is what lets the same act run again when the layer says the host accepted the token.
One prompt is open at a time, so a second refusal while one is up is reported rather than stacked, and the layer id is what makes that true.
Nothing in `src/screens.tsx` changes, and no screen learns what `-32007` is.

## Options

- **A screen pushed on the stack.** Rejected: the refusal may have come from the catalogue or a file listing, and a pushed screen both navigates away from that and makes escape mean "pop" rather than "decline".
- **A row above the composer, the way the find box is.** Rejected: a find box is one term on a line that is already there, and a secret plus a submit plus the host's refusal is not a row, and the composer it would sit above is the field a person is typing messages into.
- **The composer itself, with a mode.** Rejected: the composer sends to the host, so a secret typed into it is one keystroke away from being a chat message.
- **A command a person runs rather than a prompt that opens.** Rejected: that is what exists, and the refusal is the host asking for something now, not a task for later.
