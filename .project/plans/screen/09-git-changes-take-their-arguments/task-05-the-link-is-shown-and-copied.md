---
title: The link the host sends back is shown and copied
status: todo
depends: [task-01-an-operation-carries-its-arguments.md]
layer: "screen"
refs:
  - "[code://src/control.ts#L1859](../../../../src/control.ts#L1859) - where the host's message is put on the status row today"
  - "[code://src/app.tsx#L445](../../../../src/app.tsx#L445) - the status row reading `HOST_ERROR`"
  - "[code://src/state.ts#L181](../../../../src/state.ts#L181) - `HOST_ERROR`, beside which the link's key goes"
  - file:///github/ahpapp/src/components/ChangesView.tsx - `drawFollowUp`
  - npm://@textui/core - `writeClipboard` and the `link` prop
---

## Objective

An external follow-up is drawn on the status row as an OSC 8 link, with a line saying it was copied, and is written to the clipboard.
A follow-up this client cannot read is reported as "the host sent something back", not dropped.
Leaving the session clears it.

## Files

- `UPDATE: src/state.ts` - a key for the last link.
- `UPDATE: src/control.ts` - one handler for an operation's answer, used by every verb; `forgetChanges` clears the key.
- `UPDATE: src/app.tsx:445` - the status row draws the link when there is one.
- `UPDATE: src/i18n/en/commands.ts`, `src/i18n/pt-BR/commands.ts`, `src/i18n/es/commands.ts` - "copied" and "the host sent something back".

## Steps

1. Route every `operate` answer through the handler: link, then draft, then message, then the unreadable case.
2. Keep the host's refusal on `HOST_ERROR` as it is.

## Validation

- `test/changes.test.tsx` - after `create-pr` on the fake host the status row shows the link and the clipboard holds it; opening another session clears it.
- Checked by hand in a terminal with OSC 8 and one without.

## Resume

