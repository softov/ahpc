#!/usr/bin/env node
// Prints the plans of a project from each `plan.md` frontmatter.
//
// Usage: node plans.mjs [--all] [<project-dir>]
// The project directory defaults to the current one and holds `.project/plans/`.
// Without `--all`, `built` and `dropped` plans are left out.
//
// Each domain is printed as a heading, then one line per plan:
// status, priority, path, title. A plan's `requires`, and the plans that require
// it, follow on their own lines.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Statuses of a plan that no longer waits on work. */
const CLOSED = new Set(['built', 'dropped']);
/** Priorities in the order they are printed. */
const PRIORITY = ['high', 'medium', 'low'];

/** The frontmatter of a file as scalars and string lists. Enough for plan fields, not full YAML. */
const frontmatterOf = (file) => {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const fields = {};
  if (lines[0] !== '---') return fields;
  let key = null;
  for (const line of lines.slice(1)) {
    if (line === '---') break;
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      fields[key] = [...(Array.isArray(fields[key]) ? fields[key] : []), unquote(item[1])];
      continue;
    }
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (!pair) continue;
    key = pair[1];
    fields[key] = pair[2] === '' || pair[2] === '[]' ? [] : unquote(pair[2]);
  }
  return fields;
};

const unquote = (value) => value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

/** `plans/<domain>/<folder>/plan.md` as `<domain>/<folder>`. */
const idOf = (path) => path.replace(/^plans\//, '').replace(/\/plan\.md$/, '');

const plansIn = (root) => {
  const plans = [];
  for (const domain of readdirSync(root, { withFileTypes: true })) {
    if (!domain.isDirectory()) continue;
    for (const folder of readdirSync(join(root, domain.name), { withFileTypes: true })) {
      const file = join(root, domain.name, folder.name, 'plan.md');
      if (!folder.isDirectory() || !existsSync(file)) continue;
      const fields = frontmatterOf(file);
      plans.push({
        id: `${domain.name}/${folder.name}`,
        domain: domain.name,
        folder: folder.name,
        title: typeof fields.title === 'string' ? fields.title : '',
        status: typeof fields.status === 'string' ? fields.status : '?',
        priority: typeof fields.priority === 'string' ? fields.priority : '?',
        requires: (Array.isArray(fields.requires) ? fields.requires : []).map(idOf),
      });
    }
  }
  return plans;
};

const rank = (priority) => {
  const at = PRIORITY.indexOf(priority);
  return at === -1 ? PRIORITY.length : at;
};

const args = process.argv.slice(2);
const all = args.includes('--all');
const dir = args.find((arg) => arg !== '--all') ?? '.';
const root = join(dir, '.project', 'plans');
if (!existsSync(root)) {
  console.error(`No plans: ${root} does not exist.`);
  process.exit(1);
}

const plans = plansIn(root);
const blocks = new Map();
for (const plan of plans) {
  for (const required of plan.requires) blocks.set(required, [...(blocks.get(required) ?? []), plan.id]);
}

const domains = [...new Set(plans.map((plan) => plan.domain))].sort();
for (const domain of domains) {
  const own = plans.filter((plan) => plan.domain === domain);
  const shown = own
    .filter((plan) => all || !CLOSED.has(plan.status))
    .sort((a, b) => rank(a.priority) - rank(b.priority) || a.folder.localeCompare(b.folder, 'en', { numeric: true }));
  console.log(`## ${domain}`);
  for (const plan of shown) {
    console.log(`${plan.status.padEnd(8)} ${plan.priority.padEnd(7)} ${plan.id}  ${plan.title}`);
    if (plan.requires.length > 0) console.log(`${' '.repeat(17)}requires ${plan.requires.join(', ')}`);
    const blocked = blocks.get(plan.id) ?? [];
    if (blocked.length > 0) console.log(`${' '.repeat(17)}blocks ${blocked.join(', ')}`);
  }
  console.log('');
}
