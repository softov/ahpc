# ahpc

A terminal client for the [Agent Host
Protocol](https://microsoft.github.io/agent-host-protocol/): a catalogue of
sessions on a host, a conversation that streams, and the block that appears
when the agent stops and waits for a person.

```bash
npm install && npm run build

node dist/src/main.js                        # the scripted host - needs nothing
node dist/src/main.js --host ws://127.0.0.1:9187   # a real host, e.g. ahpd
node dist/src/main.js --claude               # Claude Code in this process
node dist/src/main.js --help                 # every flag
```

It began as an example inside TextUI, which is why the sections below still
read as an argument about which components a chat application needs. That
argument is still the reason the code is shaped the way it is, so it stays.

**On `--claude`.** Claude reached in-process, through the Agent SDK, with no
host at all. It was the prototype that `ahpd` was built from and it is kept for
now because it means this client runs with nothing else installed. The two are
meant to be indistinguishable from up here - `--claude` and `--host` rendering
the same screens is what the seam is for, and where they differ, one of them is
wrong.

The shell and the theme are a starting point rather than a fixture: `ctrl+t`
changes the theme while it runs and the palette has both, previewing each as
the highlight moves. Nothing in `view/` names a border style or a glyph - they
come from the theme, which is what lets the same graph render under an ascii
console and an airy borderless page.

It exists to answer one question: **which components does a chat application
need that the catalog does not have?** The answer is at the bottom, and it is
shorter than it looks - two components are genuinely missing, one is missing
and needed by everything, and the rest is composition.

## What it talks to

[AHP](https://microsoft.github.io/agent-host-protocol/), the Agent Host
Protocol, as Advisor speaks it. An agent host is a *sessions server*: several
clients watch and drive the same sessions and none of them owns the process
running the agent. That shape is why this is not "a chat UI with a backend" -
every send is a fire-and-forget dispatch, the turn appears when the host has
reduced it, and somebody else may be answering the same question in an editor
on another machine while you look at it.

`src/ahp/` is the protocol as a client reads it, and `HostConnection` is the
seam. There are three implementations of it, and nothing above any of them can
tell which is answering:

```bash
npm run dev                          # the scripted host
npm run dev -- --host ws://…         # a real one, over the wire
npm run dev -- --claude              # Claude Code, in this process
```

`dev` builds and runs on Node, which is what this ships on. `dev:bun` is
`bun src/main.tsx` - the source as it is, no build - and it is the only way to
skip the build here: Node strips types but does not understand JSX, and every
screen is written in it.

A session is a *container*: it holds chats, and a host whose agent advertises
`multipleChats` can hold several. `ctrl+p` has **New chat here**, **Chat** and
**Close this chat** where that is true, and nothing where it is not - a host
that does not advertise it is one where `createChat` must not be called at
all, so the commands are absent rather than present and refused.

[`fake.ts`](src/ahp/fake.ts) is a **script**, and it is not a lesser version of
the other one - it is the only way to arrive at a *particular* state on
purpose. Five seeded sessions, one of them blocked on a confirmation, one
mid-turn, one failed, one archived; an agent that answers four different ways
depending on what was said. Time in it is a `pump`, not a timer: the
application drives it from an interval and a test calls it in a loop, so the
streaming path is what gets exercised rather than a fixture that arrived all at
once. Two rules keep it honest - **the status is derived, never assigned**, so
a session cannot claim to be waiting on you with nothing waiting; and the
sessions and the replies differ, because one canned answer only ever proves the
client can render that answer.

[`live.ts`](src/ahp/live.ts) is a **socket**. It loads
`@microsoft/agent-host-protocol` at runtime - an optional dependency, so the
example still runs and is checked with nothing installed:

```
pnpm --filter @textui/example-chat add @microsoft/agent-host-protocol
```

The reducers are the protocol's own. Eighty typed mutations across six channels
is not a thing to reimplement in an example, and a hand-written second path
from action to screen would be a second answer to "what is the state now". So
the package owns the transport, the subscriptions and the state, and this file
is translation in both directions: its shapes into the flattened ones in
`types.ts`, and back out as the seven client-dispatchable actions that drive
and answer a turn. Every action rebuilds the view and re-emits it as a
snapshot, which the transcript already renders from - that is what it does when
you open one.

It is written from the protocol package's own `src/types/` and from Advisor's client, and negotiates `1.0.0` - the version a VS Code 1.135 host speaks - falling back through `0.8.0` and `0.7.0` for older ones.
Driven against a real host it found one thing immediately, and it is the rule
this file is now built on: **a host that says no is answering.**

A live catalogue lists sessions whose agent has exited, and the host replies
`-32001 No agent for session` to anything that tries to watch one. Every call
that asks is started by an effect or a keypress - the detail pane asks about
whatever row is highlighted - so nothing was waiting to catch the rejection,
and an unhandled rejection ends the Node process. From a terminal in its
alternate screen, with the cursor hidden and raw mode on. So:

- a refusal is recorded, reported and *remembered*, so an arrow key does not
  re-ask a hundred times; a refresh forgets them, which is how you retry;
- it is not a lost connection. The two want opposite things from a person -
  forget this session, or go and sign in on the host - so the host's own words
  and code are carried through to the status bar rather than replaced with
  "offline";
- nothing dispatches into a bare promise any more, and `main.tsx` stops the
  application before anything exits, because the alternative is a shell nobody
  can type into.

### What else is on the session channel

Three things came off it after the first pass, and each one settles a question
about where a client's boundaries are.

**The changeset carries pointers, not files.** `FileEdit` has a `before` and an
`after`, and each is a URI plus a `ContentRef` - the content itself lives
outside the state tree, behind `resourceRead` on the root channel. That is the
protocol declining to send four megabytes so a client can draw a list of two
hundred filenames, and the client's half of the bargain is not to ask for it
until a row is opened. The `changes` screen is a list until then; opening a row
fetches both sides at once and diffs them locally, because the host sends two
whole files and a count, never the diff itself. `diff.ts` is that: the
textbook LCS with a common head and tail taken off first, and a ceiling, since
two files of ten thousand lines is a hundred million cells and a terminal that
stops answering.

**Skills and MCP servers are the same thing.** `SessionState.customizations` is
one tree of eight `CustomizationType`s: a plugin or a directory is a *container*
whose children are the skills, prompts, rules, hooks, agents and MCP servers it
brought, and an MCP server can also arrive at the top level, contributed by the
host itself. It is flattened on the way in - a reader wants a list - keeping
`from` so a panel can still say where a skill came from.

Two things a client gets wrong about it, both of which cost a screen that lies:

- `enabled` is **derived, not copied**. A child's own flag is independent of its
  container's and the effective answer is both, so a panel showing the child's
  flag alone lists a skill as on inside a plugin that is off. Turning a
  container off takes its children with it, which is also why the containers
  are kept in the list: a plugin is one switch for the six skills it brought.
- `authRequired` is **not an error**. It is the host saying a server is
  reachable and nobody has signed in - something a person can go and fix.
  Drawn as a failure it reads as broken, and the thing to do about it never
  gets done.

**There is no "invoke this skill".** A host contributes skills as
customizations; a person invokes one by sending its name as the message,
exactly as they would have typed it. So the slash menu carries two kinds and
they go different places - a `client` command runs here, and a `session`
command completes the draft to `/name ` and leaves the trailing space, because
most of them take an argument. A skill marked `disableUserInvocation` is the
agent's alone and is left out of the menu entirely: a menu is a list of what
can be done, and a row that cannot be chosen is a row somebody has to read to
find that out.

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

Eight, and each is a different question.

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

`@textui/terminal` now decodes all three, so the footer names `ctrl+enter`
unconditionally rather than checking a capability that only ever described one
of them. `alt+enter` stays for a terminal that sends plain CR for both, which
nothing can recover.

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
