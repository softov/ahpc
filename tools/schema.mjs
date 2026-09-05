/*
 * A strict JSON Schema for the protocol, generated from its own declarations.
 *
 * The package ships types and a `state.schema.json` that is not strict:
 * `additionalProperties: false` appears nowhere in it, so an invented key
 * validates clean and a private extension can reach the wire unnoticed. That
 * is how one host came to send `SessionState.model`, which no version of the
 * protocol declares.
 *
 * Types are read through the checker rather than the syntax tree, so `extends`
 * and intersections resolve to a flat property list without this having to
 * implement inheritance. What cannot be expressed is emitted as `true` - the
 * schema that accepts anything - and counted, so the report says how much of
 * the surface is actually being checked rather than implying all of it.
 *
 *   node tools/schema.mjs [--out schema.json]
 */

import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Resolved through the package's own entry rather than by subpath: `exports`
// publishes neither the declaration nor a `require` condition, so this asks
// the way the package expects to be asked and reads the declaration beside
// the module it answers with.
const entry = fileURLToPath(import.meta.resolve('@microsoft/agent-host-protocol'))
  .replace(/\.js$/, '.d.ts');

const program = ts.createProgram([entry], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
});
const checker = program.getTypeChecker();

/** Named object types already emitted or in progress, so recursion becomes a `$ref`. */
const defs = new Map();
/** What could not be expressed, by type name, so coverage is reported rather than assumed. */
const opaque = new Map();

const F = ts.TypeFlags;
const OF = ts.ObjectFlags;

function note(name, why) {
  opaque.set(name, (opaque.get(name) ?? 0) + 1);
  return why === undefined ? true : true;
}

/** A type's declared name, where it has one worth referencing. */
function nameOf(type) {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (!symbol) return undefined;
  const name = symbol.getName();
  if (!name || name === '__type' || name === '__object') return undefined;
  return name;
}

function isRecord(type) {
  // `Record<string, X>` and any index signature: an object whose keys are not
  // knowable, which is the one place `additionalProperties: false` is wrong.
  return checker.getIndexInfoOfType(type, ts.IndexKind.String) !== undefined;
}

function literal(type) {
  if (type.flags & F.StringLiteral) return { const: type.value };
  if (type.flags & F.NumberLiteral) return { const: type.value };
  if (type.flags & F.BooleanLiteral) {
    return { const: checker.typeToString(type) === 'true' };
  }
  return undefined;
}

/**
 * @param asDefinition True at the site that is *building* a named definition,
 *   where returning a `$ref` to the name being defined would define it as
 *   itself. Everywhere else a named object becomes that reference.
 */
function schemaOf(type, seen, asDefinition = false) {
  if (type.flags & (F.Any | F.Unknown)) return true;
  if (type.flags & F.Never) return false;
  if (type.flags & F.String) return { type: 'string' };
  if (type.flags & F.Number) return { type: 'number' };
  if (type.flags & F.Boolean) return { type: 'boolean' };
  if (type.flags & F.Null) return { type: 'null' };
  if (type.flags & (F.Void | F.Undefined)) return { type: 'null' };
  if (type.flags & F.EnumLike) {
    const one = literal(type);
    if (one) return one;
  }
  const lit = literal(type);
  if (lit) return lit;

  if (type.isUnion()) {
    const parts = type.types.filter((one) => !(one.flags & (F.Undefined | F.Void)));
    if (parts.length === 0) return true;
    if (parts.length === 1) return schemaOf(parts[0], seen);
    // Booleans arrive as `true | false`; collapse rather than emit two consts.
    if (parts.length === 2 && parts.every((one) => one.flags & F.BooleanLiteral)) {
      return { type: 'boolean' };
    }
    // A union of literals is an enum, and saying so keeps a validator from
    // reporting every value it is not.
    const consts = parts.map((one) => literal(one));
    if (consts.every((one) => one !== undefined)) {
      return { enum: consts.map((one) => one.const) };
    }
    const drawn = parts.map((one) => schemaOf(one, seen));
    /*
     * A discriminated union says which branch it is, so the schema should say
     * so too.
     *
     * Without it a validator reports every branch failing - seventeen kinds of
     * customization complaining that `type` is not theirs - and the one real
     * error is somewhere in the middle of that. There is no recovering the
     * intended branch afterwards either: a `$ref`'d branch reports its errors
     * relative to itself, so nothing in the output says which one they came
     * from. Naming the tag here is the only place the information exists.
     */
    const tag = discriminatorOf(parts);
    if (tag) {
      /*
       * One tag, one branch - and where a protocol reuses a tag for two
       * shapes, those two become one branch that carries the tag and offers
       * both underneath. `chat/toolCallConfirmed` is both the approval and
       * the denial, and a validator told there is one branch per tag would
       * refuse to compile against it.
       */
      const byTag = new Map();
      parts.forEach((one, index) => {
        const value = tagValue(one, tag);
        byTag.set(value, [...(byTag.get(value) ?? []), drawn[index]]);
      });
      const oneOf = [...byTag].map(([value, branches]) => (branches.length === 1
        ? branches[0]
        : {
          type: 'object',
          properties: { [tag]: { const: value } },
          required: [tag],
          anyOf: branches,
        }));
      return { discriminator: { propertyName: tag }, oneOf };
    }
    return { anyOf: drawn };
  }

  if (checker.isArrayType(type)) {
    const [item] = checker.getTypeArguments(type);
    return { type: 'array', items: item ? schemaOf(item, seen) : true };
  }
  if (checker.isTupleType(type)) {
    return {
      type: 'array',
      prefixItems: checker.getTypeArguments(type).map((one) => schemaOf(one, seen)),
    };
  }

  if (type.flags & F.Object) {
    const objectFlags = type.objectFlags ?? 0;
    // A function or a class instance is not wire data; nothing sends one.
    if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) {
      return note(nameOf(type) ?? '(callable)');
    }
    if (isRecord(type)) {
      const info = checker.getIndexInfoOfType(type, ts.IndexKind.String);
      return { type: 'object', additionalProperties: schemaOf(info.type, seen) };
    }

    const name = nameOf(type);
    // Anonymous object types are inlined; named ones become a `$ref` so a
    // recursive shape terminates and the output stays readable.
    if (!asDefinition && name && !(objectFlags & OF.Anonymous && !type.aliasSymbol)) {
      if (!defs.has(name)) {
        defs.set(name, true);
        defs.set(name, object(type, new Set(seen).add(name)));
      }
      return { $ref: `#/$defs/${name}` };
    }
    return object(type, seen);
  }

  return note(nameOf(type) ?? checker.typeToString(type));
}

/**
 * The property that tells a union's branches apart, if one does.
 *
 * Every branch must carry it as a required string literal and no two may
 * agree, which is what makes it a tag rather than a coincidence.
 */
function tagValue(type, name) {
  if (!(type.flags & F.Object)) return undefined;
  const property = type.getProperty(name);
  if (!property || (property.flags & ts.SymbolFlags.Optional)) return undefined;
  const at = property.valueDeclaration ?? property.declarations?.[0];
  const of = at ? checker.getTypeOfSymbolAtLocation(property, at) : undefined;
  // An action's `type` is an enum member - `ActionType.ChatDelta` - which is a
  // string literal wearing an extra flag. Reading `value` rather than testing
  // the flags exactly is what lets those unions be tagged at all.
  return of !== undefined && typeof of.value === 'string' ? of.value : undefined;
}

function discriminatorOf(parts) {
  for (const name of ['type', 'kind', 'status', 'state']) {
    const values = parts.map((one) => tagValue(one, name));
    if (values.some((one) => one === undefined)) continue;
    return name;
  }
  return undefined;
}

function object(type, seen) {
  const properties = {};
  const required = [];
  for (const symbol of type.getProperties()) {
    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    const at = declaration ?? type.getSymbol()?.declarations?.[0];
    const property = at
      ? checker.getTypeOfSymbolAtLocation(symbol, at)
      : checker.getTypeOfSymbol(symbol);
    properties[symbol.getName()] = schemaOf(property, seen);
    // `?` and `| undefined` are the same answer to "must this be here".
    const optional = (symbol.flags & ts.SymbolFlags.Optional) !== 0;
    if (!optional) required.push(symbol.getName());
  }
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    // The whole point of generating this rather than using the shipped one.
    additionalProperties: false,
  };
}

const exported = checker.getExportsOfModule(
  checker.getSymbolAtLocation(program.getSourceFile(entry)),
);

let emitted = 0;
for (const symbol of exported) {
  const flags = symbol.getFlags();
  if (!(flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Enum))) continue;
  const declared = checker.getDeclaredTypeOfSymbol(symbol);
  const name = symbol.getName();
  if (defs.has(name)) { emitted += 1; continue; }
  defs.set(name, true);
  defs.set(name, schemaOf(declared, new Set([name]), true));
  emitted += 1;
}

// A `$ref` to a name nothing defined would make ajv throw at compile time
// rather than report a finding, which is a worse failure than a gap.
for (const [name, schema] of defs) {
  if (schema === true) defs.set(name, { });
  void name;
}

const out = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'ahp-strict',
  $defs: Object.fromEntries([...defs].sort(([a], [b]) => a.localeCompare(b))),
};

const where = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : path.join('tools', 'ahp.strict.schema.json');
writeFileSync(where, `${JSON.stringify(out, null, 1)}\n`);

const strict = JSON.stringify(out).split('"additionalProperties":false').length - 1;
process.stdout.write(
  `${where}: ${Object.keys(out.$defs).length} definitions from ${emitted} exported types, `
  + `${strict} closed objects\n`,
);
if (opaque.size > 0) {
  const worst = [...opaque].sort(([, a], [, b]) => b - a).slice(0, 10);
  process.stdout.write(`unexpressed (accepted as anything): ${worst.map(([n, c]) => `${n} x${c}`).join(', ')}\n`);
}
