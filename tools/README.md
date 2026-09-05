# Checking what a host actually sent

Two scripts. `schema.mjs` generates a strict JSON Schema from the protocol
package's own declarations; `validate.mjs` runs a capture through it.

```bash
npm run schema                       # regenerate after a package bump
npm run wire -- <capture.jsonl>      # check a recording
npm run wire -- <capture.jsonl> --verbose
```

## Why not read the source

Three ways of checking this by reading have each failed on a real defect.

**The shipped schema is not strict.** The package's own `state.schema.json`
contains no `additionalProperties: false` anywhere - 66 occurrences of
`additionalProperties`, not one of them `false` - so an invented key validates
clean. This is why the generated one exists: closing every object is the whole
point, and it is the one thing the published artifact does not do.

**The type system can be walked around.** A conditional spread -
`...(x ? { model } : {})` - is not excess-property-checked by TypeScript, so a
codebase typed against the package can still put an undeclared field on the
wire. That is how `SessionState.model` got there.

**A grep over construction sites has a blind spot that hides exactly that.**
Comparing a spread's key against every property name declared anywhere passes
any name that is legal *somewhere*, and `model` is legal on `UsageInfo`, on
`ModelSelection` and on a customization. The check cannot see the one field it
was written to find. Tightening it needs the target type at each site, which
grep does not have and the checker does - which is the other reason this is
generated rather than grepped.

## What it reports

Undeclared keys and missing required fields together, collapsed to one line per
defect with a count, array indices folded to `N`. Both directions matter: an
extra key is one implementation inventing something, a missing required one is
an implementation not keeping its own promise, and the same capture shows both.

Run on a capture from ahpd today it finds an undeclared `model`, `resource`,
`changes` and `modifiedAt` on `SessionState`, an `argumentHint` on skills, an
`enabled` on customizations, a `$comment` inside a tool's `inputSchema`, models
missing their required `provider`, and envelopes missing their required
`origin`.

## Notes on the generator

Types are read through the checker rather than the syntax tree, so `extends`
and intersections arrive as a flat property list and nothing here implements
inheritance.

`Record<string, unknown>` stays open, which is deliberate and is the one place
the check is blind: `_meta` is where the protocol says an extension belongs, so
closing it would fail every legitimate one.

Unions carry a `discriminator` where their branches are told apart by a
required string literal. Without it a validator reports every branch failing -
seventeen kinds of customization each complaining that `type` is not theirs -
and there is no recovering the intended branch afterwards, because a `$ref`'d
branch reports its errors relative to itself. Where a protocol reuses one tag
for two shapes, as `chat/toolCallConfirmed` does for the approval and the
denial, those two become one branch carrying the tag with both underneath.

What cannot be expressed is emitted as `true` and counted, so the run says how
much of the surface is being checked rather than implying all of it. Today that
is the generic JSON-RPC envelopes and nothing else.

## Notes on the router

A capture says which channel a snapshot is for and the schema does not, so
`validate.mjs` maps one to the other by URI. That mapping is the part most
likely to be wrong, and a finding that is the router's fault is worse than no
finding - it is the thing that would get this switched off. So an `ahp-` scheme
it does not recognise is reported as unrouted rather than guessed at, and
`--verbose` lists what was skipped. A terminal is matched on the channel kind
rather than a whole scheme, because hosts spell it `ahp-terminal:` and
`agenthost-terminal:`.
