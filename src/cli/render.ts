/** How the CLI puts things on stdout. */

import { decodeStatus } from '../ahp/status.js';
import type { SessionSummary } from '../ahp/types.js';

/**
 * Structured output, when it is asked for.
 *
 * Two spaces, because the reader of `--json` is as often a person scrolling as
 * a program piping - and a program does not mind the whitespace.
 */
export const json = (data: unknown): void => {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
};

export const line = (text = ''): void => { process.stdout.write(`${text}\n`); };

/**
 * How long ago, in the units a person would say it in.
 *
 * A timestamp answers "when"; a list is read for "how long since", and the
 * two are not the same question.
 */
export const ago = (iso: string): string => {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
};

/**
 * The glyph each activity keeps when there is no colour.
 *
 * `decodeStatus` names the shape rather than the character, because the TUI
 * draws it from a theme. A pipe has no theme, so the characters are here.
 */
const GLYPH: Record<string, string> = {
  bulletFilled: '●',
  bulletHalf: '◐',
  bulletHollow: '○',
  cross: '✗',
};

/**
 * The status bitset, as the word and the shape that carry it.
 *
 * Both, deliberately: the glyph is what a list is scanned by and the word is
 * what survives being read aloud, grepped, or piped somewhere colourless.
 */
export const mark = (status: number): string => {
  const state = decodeStatus(status);
  return `${GLYPH[state.glyph] ?? '·'} ${state.label.toLowerCase()}`;
};

/**
 * What a host says about a project, or what its path implies.
 *
 * The same fallback the catalogue draws, so a row here and a row there name
 * the same session the same way.
 */
export const project = (session: SessionSummary): string => session.project?.displayName
  || (session.workingDirectories[0] ?? '').replace(/^file:\/\//, '').split('/').filter(Boolean).pop()
  || '';

/** The branch a host reports under `_meta.git`, if it reports one. */
export const branch = (session: SessionSummary): string => {
  const git = session._meta?.git;
  if (typeof git !== 'object' || git === null) return '';
  const found = (git as { branch?: unknown }).branch;
  return typeof found === 'string' ? found : '';
};

/**
 * Rows as columns, sized to what is actually in them.
 *
 * Padding to a fixed width is what turns a list of long paths into a list of
 * ragged ones; the widest cell in a column is the only honest width for it.
 * The last column is never padded, since nothing follows it to line up with.
 */
export const table = (rows: string[][]): void => {
  if (rows.length === 0) return;
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  for (const row of rows) {
    line(row.map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0))).join('  ').trimEnd());
  }
};

/** Whether a session was put away, which a listing hides unless asked. */
export const archived = (status: number): boolean => decodeStatus(status).archived;
