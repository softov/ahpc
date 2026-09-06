# Why this client is shaped the way it is

`ahpc` began as an example inside [TextUI](https://github.com/softov/textui), and these sections are the argument that came out of building it: which components a chat application actually needs, what a terminal does with a transcript that a browser does not, and what the widget catalog was missing.

It is kept because it is still the reason the code looks like this. For what the client does, read the [README](../README.md).

## Layout

```
src/
  ahp/          the protocol: types, the status bitset, the connection, a scripted host
  blocks.ts     a conversation → the entries a feed scrolls. No rendering
  diff.ts       two files → the rows a diff draws. No rendering either
  state.ts      the store paths, and the fold from host action to store write
  control.ts    the controller, the commands, the keybindings
  view/         the components, and nothing else
  screens.tsx   which component goes where
  app.tsx       registration: components, screens, surfaces
  cli/          the other front end: one command, an answer, and exit
  mcp/          the third: the same sessions as tools, over stdio and HTTP
  wait.ts       block until a turn finishes. Shared by the CLI and the tools
  main.tsx      the terminal, the quit key, and the clock
```

The split that matters is `control.ts` against `view/`. They change for
different reasons: a new screen is a rendering change, and answering a new kind
of request is a change in control. Written as one file, a small protocol change
touches every component that draws a bubble.

`blocks.ts` and `diff.ts` are pure for the same reason - they are where a bug is
a wrong *value* rather than a wrong picture, and a test for either needs no
terminal.

## The screens

Twelve, and each is a different question.

| | Screen | Is | Reached by |
|---|---|---|---|
| 1 | `new` | A composer with nothing above it. The first message is what creates the session | opens here, `n`, `ctrl+n` |
| 2 | `sessions` | The catalogue: what is running, what is waiting on you, what errored | `esc`, `left` off the front of the field |
| 3 | `chat` | One conversation: transcript, the block that waits, the composer | `enter` on a row |
| 4 | `changes` | What the session changed on disk, from the changeset channel - and one file out of it | `c` |
| 5 | `settings` | The session's own config schema, and what may be changed while it runs | `s` |
| 6 | `hosts` | Which host, whether it is answering, what it advertises | palette |
| 7 | `skills` | What plugins and directories handed this session, and a switch on each | `k` |
| 8 | `mcp` | Which MCP servers it has, and whether they answered | `p` |
| 9 | `files` | The host's filesystem, one directory at a time, and one file out of it | palette |
| 10 | `terminal` | A shell on the host's machine | palette |
| 11 | `automations` | What the host runs on its own: the schedule, when it next fires, and how the last few went | palette |
| 12 | `automation.new` | Writing one down: a name, the first thing it says, and a schedule - or none, to run it by hand | `n` on the automations list |

Everything else that came up is **not** a screen:

- the **command palette** and a **confirm** are layers - over a screen, belonging to none;
- a **tool call's output** expands in place, because it is part of the row it belongs to;
- the **block that waits** is inside the chat screen, between the transcript and the composer, where it cannot scroll away and cannot be typed past.

Only `chat` is `keepAlive`. Coming back from the changes list to a conversation
that had scrolled itself to the top is losing your place in a document that is
still being written.

**It opens on the composer, not on the catalogue.** Talking to an agent is what
this is for, and a first screen that lists what already exists makes that a
two-step errand. There is no Start button either: nothing is created until
there is something to say, and the message is what says it. That costs nothing
on a real host - the provider is lazy, does not attach until there is a turn to
run, and `session/ready` arrives *after* the first dispatch rather than before
it.

Under the field is one line of what this message will be sent as - the harness,
the model, how much it may do before it asks, and where it works:

```
╭───────────────────────────────────────────────────────────────────────╮
│ ▏Ask the agent anything…                                              │
│ ───────────────────────────────────────────────────────────────────── │
│  ● Claude Code ▾   ○ Opus 5 ▾   ☑ Ask each time ▾   › textui ▾  send ▸ │
╰───────────────────────────────────────────────────────────────────────╯
```

Every chip is one **command with an argument**, and pressing enter on it opens
the command palette anchored above it. Not a second overlay: the same one, with
`openAt` drilling straight into the question. An argument with `choices` is
picked from, one without is typed into - which is why the workspace chip takes
a path today and becomes a list of workspaces the day the command grows a
`choices` function, with no change to anything that draws it.

The same row sits under the composer in a conversation, describing *that*
session: its harness and workspace are shown rather than asked, because they
are the process it is running in, while the model and the permission mode are
decisions about the next message and stay open. Changing the permission mode
there dispatches `session/configChanged` - one key, merged.

## The keys

Two tiers, and the split is not cosmetic.

**Modified keys are global** because nothing types them. **Single letters are
scoped to a screen**, because on the conversation screen `d` is a letter in a
word and on the catalogue it disposes a session.

The runtime already offers a key to the focused node before any keybinding, so
a letter typed into the composer is a letter - that is the mechanism, and it is
why there is no `q` for quit anywhere. A quit key that works only where nothing
happens to be reading it is not a quit key.

| Everywhere | |
|---|---|
| `ctrl+p` | commands |
| `ctrl+c` | stop the turn you are watching - or quit, when there is none |
| `ctrl+n` | new session |
| `ctrl+r` | refresh the catalogue |
| `ctrl+q` | quit |
| `ctrl+t` | theme |
| `esc` | out of the composer first, then back a screen |

| On the composer | |
|---|---|
| `enter` | send - or, with nothing open, create the session and send |
| `ctrl+enter` | a newline |
| `alt+enter`, `ctrl+j` | a newline, for a terminal that will not say the above. Not `shift+enter`: no terminal can tell it from `enter` |
| `tab` | into the control row: harness, model, permissions, workspace, send |
| `enter` on a chip | the panel of what it offers, above the chip |
| `←` at the front of the field | out of the composer - the catalogue, or the transcript |
| `↑` at the top | the last thing you sent |
| `/` at the start | commands |

| On the catalogue | |
|---|---|
| `↑ ↓` | move · `enter` open |
| `n` `r` | new · refresh |
| `a` `x` | archive / unarchive · show archived |
| `u` | mark read / unread — opening a session marks it read on its own |
| `d`, `del` | dismiss the session (asks first). Both, because `del` is the key somebody reaches for and `d` is the one the footer has room to name |
| `/` | into the filter |
| `tab` | into the detail pane: `↑ ↓` walks it, `enter` copies the row |

| In a conversation | |
|---|---|
| `i` | write - into the composer |
| `esc` | back out of the composer, into the transcript |
| `↑ ↓` `j` `k` | move the cursor between blocks |
| `enter` `space` | expand what the cursor is on |
| `pgup` `pgdn` | scroll · `g` top · `G` follow the tail |
| `f` | stop following / follow again |
| `c` `s` | changes · settings |
| `k` `p` | skills and commands · MCP servers |
| `t` | stop the turn |

| On the changes list | |
|---|---|
| `↑ ↓` | move · `enter` opens the file |
| `esc` | close the file, then the screen |

| On the skills or MCP panel | |
|---|---|
| `↑ ↓` | move · `enter` turns one on or off |
| `esc` | back |

| On the automations list | |
|---|---|
| `↑ ↓` | move · `enter` runs one now |
| `n` | write a new one |
| `e` `d` | switch it off or on · forget it, after asking |
| `esc` | back |

| While the agent is waiting | |
|---|---|
| `a` `d` | approve · deny — *a confirmation only* |
| `1`-`9` | a named option, by number: option ids are opaque and a live host sends whole sentences as ids |
| `tab` `space` | move between questions · choose — *a question only* |
| `enter` | send the answers, from the Send button |
| `esc` | give the keyboard back without answering |

A question is not a confirmation, and the hint row says so: offering "a
approve" over an elicitation is the same mistake as rendering one as the other,
made in the row that exists to explain it.

### `ctrl+enter`, and the three ways a terminal says it

Enter sends and `ctrl+enter` makes a newline. There are **three** encodings for
that key, and no terminal sends more than one of them:

| | |
|---|---|
| `CSI 13;5u` | the [kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/), asked for with `CSI > 1 u` at startup |
| `CSI 27;5;13~` | xterm's `modifyOtherKeys` |
| `0x0a` | a bare LF, and the most common of the three |

The last one is why this section used to say something false. It claimed enter
and `ctrl+enter` were both `0x0d` and that only the kitty protocol could
separate them. `0x0d` is CR and `0x0a` is LF, and in raw mode those are not the
same key: the kernel's CR-to-NL translation is off, so Return sends CR and an
LF arriving at an application is `ctrl+Return`. The decoder named both `enter`
with no modifier, so the newline was unreachable in every terminal that does
not speak the kitty protocol - which, with `enableKittyKeyboardProtocol` off,
includes VS Code.

`@textui/terminal` now decodes all three, so the footer no longer checks a
capability that only ever described one of them.

It names `alt+enter` and nothing else, while the field goes on taking both.
None of the three ctrl encodings is universal: a terminal that sends plain CR
for ctrl+enter is sending the enter key, and nothing downstream can recover the
difference. VS Code's terminal is one of those, so naming `ctrl+enter` offers a
key that does not exist there. `alt+enter` is `ESC CR`, which every terminal
can express.

Both were named for a while. One is better: the hint row elides every entry on
a narrow terminal, and the row's job is to name a key that works rather than to
enumerate the keys that might.

`shift+enter` is in none of the three and is offered nowhere: there is no
encoding in which it differs from enter.

## What this needed that the catalog does not have

Writing it turned up three things that were missing, and they are **now in
`@textui/core`** - this example imports them like anything else.

| In core | Why it was not a composition |
|---|---|
| [`Feed`](../../packages/widgets/src/data/feed.ts) | `List` is fixed-height rows with a selection; `ScrollView` is a viewport that knows nothing about its contents. A conversation needs both at once: entries whose height is whatever the text wrapped to, a cursor that moves between them, and a tail it follows until the reader scrolls away. Heights are **measured and reported upward**, because what a paragraph wraps to is the layout's decision. Nothing about it is chat - a transcript, an activity stream, results with snippets and a diff whose files expand are the same component. |
| [`TextArea`](../../packages/widgets/src/control/text-area.ts) | `TextInput` is one line. A message is a paragraph with a path in it: it has to grow, take a newline that is not a send, walk a history, and hand back the keys it does not want. |
| [`MarkdownView`](../../packages/widgets/src/data/markdown-view.ts) + [`layoutMarkdown`](../../packages/core/src/util/markdown.ts) | Everything a host writes for a person is markdown. There was already a renderer inside `@textui/documents`, and it threw the emphasis away - correct for a README viewer, wrong for prose where **bold** is meaning. The layout is now one pure function in core with styled runs; `MarkdownView` paints it, and `MarkdownViewer` in `documents` windows the same rows and gained emphasis, inline code and links by doing so. |

`TextInput` and `TextArea` also take a `focusId` now, which is what lets `/`
mean "focus the filter": without one, a control's id comes from its instance
and a command has nothing to name.

**Still in this example, and probably application-shaped:** `ChatBubble`,
`StreamingText`, `ReasoningBlock`, `ToolCallRow`, `ChatComposer`, `ChatHitl`
and its `ConfirmRequest`/`QuestionForm`, `ChatTranscript`, `SessionList`,
`ChangesList`, `ConnectionBadge`, `Gutter`. Every one is a composition of what
the catalog ships - `ChatTranscript` is a `Feed` and a switch on the block
kind, and the composer is a `TextArea` and a row of ghost buttons. The useful
finding is that they *are* compositions, and that the vocabulary they share is
a gutter, a status glyph and a tone.

**Used unchanged, and enough:** `List` for the catalogue - rows are one line
and the height does not depend on the content, which is exactly what a
transcript is not - plus `Panel`, `Row`/`Column`, `RadioGroup`, `Checkbox`,
`TextInput`, `Select`, `SearchBox`, `KeyValue`, `Badge`, `EmptyState`,
`KeyHints`, `CommandPalette`, `confirm()`, and `Button` - including
`variant="ghost"`, which is what the composer's action row is made of.

Two more, still here rather than in core:
[`SessionDetails`](src/view/details.tsx) - a property list you can walk and
copy a value out of. `KeyValue` draws the same pairs and is static, so nothing
selects a row: a URI cannot be read in full and cannot be pasted anywhere. The
selected row is the one that gets the room - every other row truncates to one
line, the selected one wraps - which costs nothing when the value is short and
is the whole answer when it is a URI in a 40-column pane.

And [`ComposerBar`](src/view/controls.tsx) with its chips, which is a row of
*current values* rather than a row of buttons: a button is a verb and these are
nouns. What it needed from the catalog it got - `CommandPalette` already knew
how to ask about one argument - so the only new part is a focusable label that
opens it, and `LayerPosition` already had the anchoring.

**Still missing, and known:**

- the composer's action row truncates below ~80 cells rather than dropping labels for glyphs. It needs `breakpoints`, which the primitives have and this does not use yet.
- `1`-`9` does not answer a *question*, only a confirmation, because the same keys are letters in its freeform field. Numbering a question's options needs the field to say when it does not want a digit.
- a tool call with four hundred lines of output expands to four hundred rows. `CodeViewer` is the right thing inside the row, and the row has to stop being as tall as its content for that to work.

## Findings worth keeping

**A picker is a palette that was opened at a question.** Four chips, four
different kinds of answer - a list of harnesses, a list of models that depends
on the harness, a list of permission modes that comes from the host's own
schema, and a path that is typed - and none of them needed an overlay written
for it. `openAt` drills into a command's argument, `choices` may be a list, a
function or a promise, an argument without choices is answered by typing, and
`LayerPosition` anchors the panel above the control that asked. The one thing
that was wrong: escape on a palette opened *at* a command backed out to a list
of one, so the key that should close it appeared to do nothing. It closes now.

**A fixture that lies reads as a bug in the client.** The scripted host used to
assign each seeded session a status by hand, and one of them claimed
`InputNeeded` while holding no pending input. Opening the row that said
"waiting on you" showed a conversation with nothing to answer - which is
indistinguishable from a client that drops the request when you leave the
screen, and was debugged as one. The status is now *derived* from what the host
is actually holding, so it cannot disagree with it.

**One canned reply proves only that the client can render that reply.** Every
session opening on the same transcript and every message getting the same
answer hides everything that only goes wrong on prose of another shape. The
scripted agent now has four: a short answer with no tool calls, a command that
asks before it runs, a question, and a failure - chosen from what was said, so
a person driving the example can pick one.

**A trap is not the same as focus.** The block that waits on a person took the
focus *and trapped it*, on the reasoning that answering is the only thing to
do. But you approve a command on the strength of what is written above it, so
the transcript has to stay readable - and the trap also swallowed the escape
the block itself advertises, which is why a blocked session could not be left
without answering it. It autofocuses and does not trap; the keys that answer it
are global, so they still work from wherever the reader has gone.

**A running turn is not in the history.** `ChatState.turns` is the completed
turns; the one in flight is `activeTurn`. A client that renders only `turns`
shows an empty conversation for exactly as long as somebody is watching one
happen.

**Prose and tool calls are one ordered stream.** Splitting them apart puts
every sentence at the top and every command at the bottom, and the sentence
explaining a command ends up fifteen rows above it.

**Status is two things in one number.** `InputNeeded` is 24 and carries
`InProgress`, so it has to be tested first - otherwise the one session that
wants a person reads as merely running.

**A question carries no tool call.** Its prose is the request's message, and
what is being asked is its questions. Read as a confirmation, the choices
vanish and what is left on screen is a heading and an Approve button.

**Accepting with no answers resumes the agent on the answers it already had**,
which for a question it has just asked is none. So a required question that is
unanswered is not sendable.

## What to look at first

[`src/view/hitl.tsx`](src/view/hitl.tsx), for the two kinds of waiting and why
they are not one; then [`src/control.ts`](src/control.ts), which is every
action the application has in one list; then
[`src/view/transcript.tsx`](src/view/transcript.tsx), which is now short enough
to read in a sitting because the viewport underneath it moved into the catalog.

The measure-report-scroll loop itself is in
[`Feed`](../../packages/widgets/src/data/feed.ts) - that is where to look for "how
tall did that turn out to be", which is the question anything with entries of
mixed height has to answer.
