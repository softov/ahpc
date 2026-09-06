# What this client implements, and where it differs

A record of the surface, taken from the protocol's own declarations and from
captures of both hosts rather than from memory. Kept so the next person does
not have to re-derive it, and so a gap is a decision somebody made rather than
one nobody noticed.

Checked against `@microsoft/agent-host-protocol` 0.9.0 (the published package),
the 1.0.0 vendored in VS Code, and the specification repository, which is ahead
of both.

## How this was established

`npm run schema` generates a strict JSON Schema from the package's own
declarations - closing every object, which the shipped `state.schema.json`
never does - and `npm run wire -- <capture>` checks a recording against it.
`AHPC_RECORD=<file>` makes this client record its own frames, both directions.

`test/conformance.test.ts` is the same checker in the suite, over the frames a
run just produced, in memory. Not a committed fixture: a recording on disk is
for reading by hand, and one that a test reads back can go green against
yesterday's behaviour. This one cannot, because its input is an output. It
found a third defect on its first run - `listAutomationTriggerDefinitions` sent
to the automations channel, where the declaration says the root one.

Twenty commands declare `channel` as a string literal rather than a URI a
client chooses, and the same test checks every request site in `live.ts`
against those declarations - read out of the source rather than driven, because
the runtime check only sees a command something calls and a site no test
reaches is exactly where a wrong constant survives. Hosts are getting stricter
here: ahpd answered any channel on that command until this was reported, and
now refuses a wrong one with `-32602`.

That is the only method here that has found defects in every implementation it
was pointed at, this one included. Reading the source does not substitute for
it: a conditional spread (`...(x ? { k } : {})`) is not excess-property-checked
by TypeScript, so a codebase typed against the package can still put an
undeclared field on the wire, and a grep over construction sites cannot catch
it because a property name that is legal *somewhere* passes.

---

# Requests

All 30 of `CommandMap` are reachable. `initialize`, `subscribe`, `reconnect`
and `ping` are sent by the protocol client on this client's behalf; the other
26 are sent directly.

# Actions

21 of the 45 client-dispatchable actions are dispatched. The 24 that are not
fall into three groups.

**Served by the host, not by a client here.** `chat/toolCallApproved`,
`chat/toolCallDenied`, `chat/toolCallResultConfirmed`,
`chat/toolCallComplete`, `chat/toolCallContentChanged`,
`chat/inputAnswerChanged`, `session/activeClientRemoved`. A tool call is
answered here with `chat/toolCallConfirmed`, which is the action the host
reduces; the rest are a host describing its own progress, and the removal is
host-managed on unsubscribe.

**No screen wants them yet.** `annotations/*` (five actions - this client draws
no annotations at all), `chat/workingDirectorySet` and `Removed`,
`session/workingDirectorySet`, `Removed` and `Replaced`,
`session/mcpServerStartRequested` and `StopRequested`, `session/titleChanged`,
`chat/truncated`, `chat/turnResume`, `chat/queuedMessagesReordered`,
`automation/runCancelRequested`. Each is a feature this client does not have
rather than a protocol gap: the working-directory family needs a directory
editor, the MCP pair needs a server panel, and the annotations channel needs a
reason to exist here first.

**Deliberately not sent.** `root/configChanged` - host-wide configuration is
every client's, and this one changing it silently changes it for the VS Code
window beside it. The reference client does send it; that is a decision about
what an editor may do that a terminal client should not inherit.

---

# Divergences

Four, each with a reason and none by accident.

**`1.0.0` is offered first, and this builds against `0.9.0`.** The registry
says the first offered version MUST be the one the code speaks.
`isCompatibleProtocolVersion` requires matching majors, so a host on `1.0.0`
rejects every `0.x` outright - offering it is the only way to reach VS Code's
host at all. The two were compared declaration by declaration across 54 file
pairs: the same 96 action types, the same 41 methods, identical fields on
`ChatState`, `Turn`, `SessionState` and `RootState`. The whole delta is one
renamed field on the automations catalogue, normalised at the edge. Recheck
with `npm view @microsoft/agent-host-protocol time` - while `time.modified`
reads `2026-08-28T21:40:46Z`, nothing has published since.

**`expiresIn` is sent on `authenticate` and the published package does not
declare it.** The specification repository does, and `authentication.md` has
four MUSTs about it. The spec is the authority and the package is behind it.
This is the one finding a capture of this client's own frames still reports.

**Two spellings are read for two fields.** `_meta.git.branchName` and `branch`;
`_meta.model` and `SessionState.model`. Neither is declared anywhere - `_meta`
is an open map and `git` is convention - and the hosts disagree about the
names. Reading both costs one `??` and reading one broke against a real host
for the life of this client.

**No `ClientCapabilities` is declared.** Checked and conformant: the field is a
set of presence flags and absence means unsupported, which is true here.
`mcpApps` is the only flag defined and a terminal cannot host a View sandbox.

---

# Findings that belong to the protocol

Neither is this client's to fix, and neither should be read as a fault in a
host.

**`ActionEnvelope.origin` is declared required and every host omits it.** The
declaration is `origin: ActionOrigin | undefined` - required, satisfied only by
sending the key with an undefined value, which no JSON does. Both ahpd and VS
Code's host omit it.

**A tool's `inputSchema` is a closed declaration a real JSON Schema
overflows.** Both hosts put `$comment` in one, which is a legal keyword the
type does not allow.

## And one the checker itself was wrong about

`ActionEnvelope.origin` reads as required from the symbol flag alone, so the
generator marked it required and every capture reported nine "missing required
`origin`" that were the generator's fault. A property whose *type* includes
`undefined` is now treated as optional too. Worth remembering as the shape of
the mistake: a finding a checker is wrong about is the one that gets the
checker switched off.

---

# Private extensions in the wild

Recorded so nobody reads them as protocol. All were found by validating
captures, and none is declared in 0.9.0 or 1.0.0.

| Field | Sent by | Read here |
|---|---|---|
| `SessionState.model` | ahpd (now `_meta.model`) | yes, both spellings |
| `_meta.git.*` | both, with different keys | `branchName`/`branch` and the drift counts |
| skill `argumentHint` | ahpd (now `_meta.argumentHint`) | no |
| customization `enabled` on a container | ahpd | no |
| customization `nonce`, `childEnablement` | VS Code | no |
| config property `scope` | ahpd | no |
| `SessionState.resource`, `changes`, `modifiedAt` | ahpd | no |
| root config property `sessionMutable` | VS Code | no |
| completion attachment `_meta.command` / `_meta.uri` | required by VS Code | n/a - see below |

VS Code's host reads that last one rather than sending it, and reads it
strictly: `_toChatInputCompletionItem` discards any completion whose attachment
`_meta` carries neither `command` nor `uri`, with no error on either side. A
host answering 54 conformant items can have all 54 disappear into an empty
menu. It costs this client nothing today - completions are consumed here, not
served - but a completions *provider* added later inherits the convention as a
contract, and nothing declares it.

---

# What is not implemented, and why

**A published resource is addressed `virtual://<clientId>/…`.** The authority
is this connection's own `clientId`, because that is how a host routes one: it
reads the authority and matches it against the connection that sent it. A fixed
authority - `virtual://ahpc/` - is addressed to a client that is not there.

**Publishing content to a host is opt-in and empty by default.** The handler
layer for all ten server-initiated methods exists and answers; without
`--publish <dir>` every URI is refused with `-32009`, which is the receiver
enforcing access exactly as the specification describes. Serving by default
would hand this machine's disk to whatever host it connected to.

**`createResourceWatch` is not served over a published directory.** Nine of the
ten reverse methods answer; a host asking this client to watch one of its
published files gets `-32601`, which is the true answer rather than a stub.

**Traces and metrics are not subscribed to.** `telemetry-channel.md` says
clients SHOULD subscribe only to signals they can process. Logs are rendered;
a terminal client has nothing to do with a span or a histogram.

**Optimistic application is not done.** Checked and conformant: write-ahead is
what a client MAY do. This one waits for the host's echo for everything, so
there is no prediction to revert - and `rejectionReason` is read and shown,
which is the part that was actually missing.

**The annotations channel is unimplemented.** Nothing here draws inline
annotations, and the five actions are the feature rather than the gap.
