/*
 * What a host actually sent, against what the protocol actually declares.
 *
 * A grep over construction sites cannot answer this. A conditional spread -
 * `...(x ? { model } : {})` - defeats TypeScript's excess-property check, so a
 * codebase can be typed against the package and still put an undeclared field
 * on the wire; and a check that compares a key against every name declared
 * *anywhere* passes any name that is legal somewhere, which is most of them.
 * Both failures are invisible to the source and obvious in a capture.
 *
 * So: the strict schema from `schema.mjs`, ajv, and a recording. It reports
 * undeclared keys and missing required ones together, which are the two ways
 * an implementation drifts from its own specification.
 *
 *   node tools/validate.mjs <capture.jsonl> [--limit N] [--verbose]
 *
 * The capture is JSON lines. Each line is either a protocol frame or an object
 * with the frame under `frame`, as a string or an object - which is what the
 * recorders on both sides of this protocol happen to write.
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const Ajv = require('ajv/dist/2020.js').default ?? require('ajv/dist/2020.js');
const addFormats = require('ajv-formats').default ?? require('ajv-formats');

const [file] = process.argv.slice(2).filter((one) => !one.startsWith('--'));
if (!file) {
  process.stderr.write('usage: node tools/validate.mjs <capture.jsonl> [--limit N] [--verbose]\n');
  process.exit(2);
}
const verbose = process.argv.includes('--verbose');
const limit = process.argv.includes('--limit')
  ? Number(process.argv[process.argv.indexOf('--limit') + 1])
  : Infinity;

const schema = JSON.parse(readFileSync(new URL('./ahp.strict.schema.json', import.meta.url), 'utf8'));
// `discriminator` is why the generator tags its unions: ajv then reports the
// branch the sender meant instead of every branch it did not.
const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true, discriminator: true });
addFormats(ajv);
ajv.addSchema(schema, 'ahp');

/**
 * Which declaration a channel's state is.
 *
 * By URI scheme, because that is what the protocol routes on. A chat is the
 * awkward one: hosts spell it `ahp-chat:/<session>` and
 * `ahp-chat://default/<base64>`, and both are the same channel kind.
 */
function stateFor(resource) {
  if (typeof resource !== 'string') return undefined;
  if (resource.startsWith('ahp-root:')) return 'RootState';
  if (resource.startsWith('ahp-chat:')) return 'ChatState';
  if (resource.startsWith('ahp-automations:')) return 'AutomationState';
  if (resource.startsWith('ahp-automation-run:')) return 'AutomationRunState';
  // A terminal's scheme is the host's own - `agenthost-terminal:` from one,
  // `ahp-terminal:` from another - so it is matched on the part that is the
  // channel kind rather than on a whole scheme somebody chose.
  if (/^[a-z-]*terminal:/.test(resource)) return 'TerminalState';
  if (resource.includes('/annotations')) return 'AnnotationsState';
  if (resource.includes('/changeset')) return 'ChangesetState';
  if (resource.startsWith('ahp-resource-watch:')) return 'ResourceWatchState';
  /*
   * Everything else addressed by a provider scheme is a session: the scheme is
   * the provider's own - `claude:/…`, `ahp-session:/…` - so it cannot be
   * matched by name and has to be the default.
   *
   * Which makes the default greedy, and it has to be fenced. `ahp-otlp://logs`
   * is a stateless signal channel with no state declaration at all, and it
   * fell through to here and reported a session missing every field it has.
   * A finding that is the router's fault is worse than no finding: it is the
   * one thing that would get this tool switched off. Any other `ahp-` scheme
   * is something this does not know about and says so rather than guessing.
   */
  if (resource.startsWith('ahp-session:')) return 'SessionState';
  if (/^ahp-[a-z-]+:/.test(resource)) return undefined;
  if (!/^[a-z][a-z0-9+.-]*:\/[^/]/.test(resource)) return undefined;
  return 'SessionState';
}

const validators = new Map();
function check(def, value) {
  if (def === undefined || !schema.$defs[def]) return { missing: true, errors: [] };
  if (!validators.has(def)) validators.set(def, ajv.compile({ $ref: `ahp#/$defs/${def}` }));
  const validate = validators.get(def);
  return { missing: false, ok: validate(value), errors: narrow(validate.errors ?? []) };
}

/**
 * The branch that was meant, out of a union that failed.
 *
 * A discriminated union fails every branch but one, and ajv reports all of
 * them - so one undeclared key on a customization arrives as a wall of `type
 * const must be equal to constant` from the seventeen kinds it is not. The
 * branch whose discriminant *matched* is the one the sender intended, and its
 * errors are the only real ones; the rest are the union working correctly.
 *
 * Where no branch matches its discriminant the value belongs to none of them,
 * which is a genuine finding, and the umbrella error is kept.
 */
function narrow(errors) {
  // Branches are `$ref`s, so ajv's `schemaPath` names the definition each
  // error came from rather than a branch index - which is the handle here.
  const defOf = (error) => (error.schemaPath.match(/\$defs\/([^/]+)/) ?? [])[1] ?? '';
  const discriminant = /\/(type|kind|status|state)$/;

  const dropped = new Set();
  // Deepest first, so a union inside a union is resolved from the inside out.
  const unions = errors.filter((one) => one.keyword === 'anyOf')
    .sort((a, b) => b.instancePath.length - a.instancePath.length);

  for (const union of unions) {
    const at = union.instancePath;
    const under = errors.filter((one) => one !== union && !dropped.has(one)
      && one.instancePath.startsWith(at));
    const branches = new Map();
    for (const one of under) {
      const name = defOf(one);
      branches.set(name, [...(branches.get(name) ?? []), one]);
    }
    const intended = [...branches].filter(([, kept]) => !kept.some(
      (one) => one.keyword === 'const' && discriminant.test(one.instancePath),
    ));
    // Every branch ruled itself out by its discriminant: the value is none of
    // them, which is a real finding, so the union failure stands whole.
    if (intended.length === 0 || intended.length === branches.size) continue;
    for (const [name, kept] of branches) {
      if (intended.some(([one]) => one === name)) continue;
      for (const one of kept) dropped.add(one);
    }
    dropped.add(union);
  }
  return errors.filter((one) => !dropped.has(one));
}

/** Findings by kind, collapsed: one line per defect, not one per occurrence. */
const found = new Map();
function record(def, error, sample) {
  // Array indices collapse, or one bad conversation prints hundreds of lines
  // that are all the same defect.
  const at = (error.instancePath || '/').replace(/\/\d+/g, '/N');
  const what = error.keyword === 'additionalProperties'
    ? `undeclared key \`${error.params.additionalProperty}\``
    : error.keyword === 'required'
      ? `missing required \`${error.params.missingProperty}\``
      : `${error.keyword} ${error.message}`;
  const key = `${def} ${at} ${what}`;
  const entry = found.get(key) ?? { count: 0, sample };
  entry.count += 1;
  found.set(key, entry);
}

let frames = 0;
let checked = 0;
const unroutable = new Map();

for (const line of readFileSync(file, 'utf8').split('\n')) {
  if (!line.trim() || frames >= limit) continue;
  let record_;
  try { record_ = JSON.parse(line); } catch { continue; }
  let frame = record_?.frame ?? record_;
  if (typeof frame === 'string') {
    try { frame = JSON.parse(frame); } catch { continue; }
  }
  if (typeof frame !== 'object' || frame === null) continue;
  frames += 1;

  // A subscribe answer: the snapshot names its own channel.
  const snapshot = frame.result?.snapshot;
  if (snapshot?.state !== undefined) {
    const def = stateFor(snapshot.resource);
    const result = check(def, snapshot.state);
    if (result.missing) unroutable.set(def ?? snapshot.resource, (unroutable.get(def ?? snapshot.resource) ?? 0) + 1);
    else { checked += 1; for (const error of result.errors) record(def, error, snapshot.resource); }
  }
  // A reconnect answer carries several at once.
  for (const one of frame.result?.snapshots ?? []) {
    if (one?.state === undefined) continue;
    const def = stateFor(one.resource);
    const result = check(def, one.state);
    if (result.missing) unroutable.set(def ?? one.resource, (unroutable.get(def ?? one.resource) ?? 0) + 1);
    else { checked += 1; for (const error of result.errors) record(def, error, one.resource); }
  }
  // A resolved config schema. Answered by `resolveSessionConfig` rather than
  // carried on a channel, and a schema is a payload like any other - the
  // isolation and worktree questions live in one and nothing was checking it.
  if (frame.result?.schema !== undefined && snapshot === undefined) {
    // The whole result, not the schema alone: `ResolveSessionConfigResult`
    // declares both halves, and the echoed values are as much a payload as
    // the questions they answer. Picking the schema out and guessing its type
    // reported `sessionMutable` as undeclared - it is declared, on the
    // *session* config schema, which is not the generic one.
    const result = check('ResolveSessionConfigResult', frame.result);
    if (result.missing) unroutable.set('ResolveSessionConfigResult', (unroutable.get('ResolveSessionConfigResult') ?? 0) + 1);
    else {
      checked += 1;
      for (const error of result.errors) record('ResolveSessionConfigResult', error, 'resolveSessionConfig');
    }
  }
  // An action, envelope and payload both. The payload's declaration is named
  // after its action type, which the package spells in PascalCase with the
  // channel prefix - `chat/delta` is `ChatDeltaAction`.
  if (frame.method === 'action' && frame.params) {
    const envelope = check('ActionEnvelope', frame.params);
    if (!envelope.missing) {
      checked += 1;
      for (const error of envelope.errors) record('ActionEnvelope', error, frame.params.channel);
    }
    const type = frame.params.action?.type;
    if (typeof type === 'string') {
      const def = `${type.split('/').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}Action`;
      const result = check(def, frame.params.action);
      if (result.missing) unroutable.set(def, (unroutable.get(def) ?? 0) + 1);
      else { checked += 1; for (const error of result.errors) record(def, error, type); }
    }
  }
}

process.stdout.write(`${file}: ${frames} frames, ${checked} payloads checked against ${Object.keys(schema.$defs).length} declarations\n`);
if (found.size === 0) process.stdout.write('nothing undeclared, nothing missing\n');
for (const [key, entry] of [...found].sort(([, a], [, b]) => b.count - a.count)) {
  process.stdout.write(`  x${entry.count}  ${key}${verbose ? `   (${entry.sample})` : ''}\n`);
}
if (unroutable.size > 0 && verbose) {
  process.stdout.write(`no declaration for: ${[...unroutable.keys()].sort().join(', ')}\n`);
}
process.exit(found.size > 0 ? 1 : 0);
