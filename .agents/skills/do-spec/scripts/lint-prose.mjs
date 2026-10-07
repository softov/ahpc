#!/usr/bin/env node
// Checks the prose of `.project/` files against the do-spec writing rules.
//
// Usage: node lint-prose.mjs <file-or-directory>...
// A directory is searched for `.md` files. Exit code 1 when anything is found.
//
// Checked:
// - long: a sentence over 20 words in a procedural section, or over 25 elsewhere.
// - passive: a passive verb in a procedural section.
// - em-dash: the character anywhere outside code.
//
// Not prose, so not checked: frontmatter, fenced code, tables, headings, and
// the lines under a task's `## Files`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Sections whose sentences are instructions: shorter limit, active voice. */
const PROCEDURAL = new Set(['steps', 'validation']);
/** Sections that hold no prose. */
const SKIPPED = new Set(['files']);
const LIMIT_PROCEDURAL = 20;
const LIMIT_DESCRIPTIVE = 25;

/** Irregular past participles that a regular `-ed` test misses. */
const IRREGULAR = [
  'built', 'brought', 'chosen', 'done', 'drawn', 'found', 'given', 'held', 'kept', 'known', 'left', 'made',
  'meant', 'put', 'read', 'run', 'seen', 'sent', 'set', 'shown', 'taken', 'told', 'thrown', 'won', 'written',
];
const PASSIVE = new RegExp(
  `\\b(?:is|are|was|were|be|been|being)\\s+(?:\\w+ly\\s+)?(?:\\w+ed|${IRREGULAR.join('|')})\\b`,
  'i',
);

/** A line with code spans and link targets taken out, so each counts as one word. */
const plain = (line) => line
  .replace(/`[^`]*`/g, 'CODE')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/https?:\/\/\S+/g, 'URL');

/** The sentences on one line. A sentence ends at `.`, `?` or `!` followed by a space. */
const sentencesOf = (line) => plain(line)
  .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
  .split(/(?<=[.?!])\s+(?=[A-Z0-9`"(])/)
  .map((one) => one.trim())
  .filter((one) => one !== '');

const wordsIn = (sentence) => sentence.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

const lint = (file) => {
  const found = [];
  const lines = readFileSync(file, 'utf8').split('\n');
  let inFront = lines[0] === '---';
  let inFence = false;
  let section = '';
  lines.forEach((line, index) => {
    const at = `${file}:${index + 1}`;
    if (inFront) {
      if (index > 0 && line === '---') inFront = false;
      return;
    }
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    if (line.includes('—')) found.push(`${at}: em-dash`);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) { section = heading[1].trim().toLowerCase(); return; }
    if (SKIPPED.has(section) || /^\s*\|/.test(line) || line.trim() === '') return;
    const procedural = PROCEDURAL.has(section);
    const limit = procedural ? LIMIT_PROCEDURAL : LIMIT_DESCRIPTIVE;
    for (const sentence of sentencesOf(line)) {
      const words = wordsIn(sentence);
      const head = sentence.length > 60 ? `${sentence.slice(0, 60)}...` : sentence;
      if (words > limit) found.push(`${at}: long (${words} > ${limit}): ${head}`);
      if (procedural && PASSIVE.test(sentence)) found.push(`${at}: passive: ${head}`);
    }
  });
  return found;
};

const filesUnder = (path) => {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
};

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('usage: lint-prose.mjs <file-or-directory>...');
  process.exit(2);
}
const found = paths.flatMap(filesUnder).flatMap(lint);
for (const one of found) console.log(one);
process.exit(found.length === 0 ? 0 : 1);
