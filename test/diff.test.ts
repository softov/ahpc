import { describe, expect, it } from 'vitest';
import { diffLines, toLines } from '../src/diff.js';

describe('the line diff', () => {
  it('counts a trailing newline as the end of the last line, not another one', () => {
    // `'a\n'.split('\n')` is `['a', '']`, and a file that ends the way every
    // text file ends would otherwise gain a blank line nobody wrote.
    expect(toLines('a\nb\n')).toEqual(['a', 'b']);
    expect(toLines('a\nb')).toEqual(['a', 'b']);
    expect(toLines('')).toEqual([]);
  });

  it('marks nothing when the two sides are the same', () => {
    const out = diffLines('one\ntwo\n', 'one\ntwo\n');
    expect(out.added).toBe(0);
    expect(out.removed).toBe(0);
    expect(out.rows.every((row) => row.kind === 'same')).toBe(true);
  });

  it('marks every line of a creation as added', () => {
    // The case a viewer that assumes two sides gets wrong: a new file has no
    // `before` at all, and passing the empty string is what makes "all added"
    // fall out of the ordinary path rather than needing a branch.
    const out = diffLines('', 'one\ntwo\n');
    expect(out.added).toBe(2);
    expect(out.removed).toBe(0);
    expect(out.rows.map((row) => row.kind)).toEqual(['added', 'added']);
  });

  it('marks every line of a deletion as removed', () => {
    const out = diffLines('one\ntwo\n', '');
    expect(out.removed).toBe(2);
    expect(out.rows.map((row) => row.kind)).toEqual(['removed', 'removed']);
  });

  it('keeps the lines either side of a change', () => {
    const out = diffLines('a\nb\nc\n', 'a\nB\nc\n');
    expect(out.rows.map((row) => `${row.kind}:${row.text}`)).toEqual([
      'same:a', 'removed:b', 'added:B', 'same:c',
    ]);
    expect(out.added).toBe(1);
    expect(out.removed).toBe(1);
  });

  it('numbers each row on the side it exists on', () => {
    const out = diffLines('a\nb\n', 'a\nB\nc\n');
    const removed = out.rows.find((row) => row.kind === 'removed');
    const added = out.rows.find((row) => row.kind === 'added');
    // A removed line has a line number on the left and none on the right,
    // which is what stops a gutter claiming it is at a line it is not at.
    expect(removed?.before).toBe(2);
    expect(removed?.after).toBeUndefined();
    expect(added?.after).toBe(2);
    expect(added?.before).toBeUndefined();
  });

  it('finds the one changed line in a long shared file', () => {
    const lines = (n: number, at: number): string =>
      Array.from({ length: n }, (_, i) => (i === at ? 'changed' : `line ${i}`)).join('\n');
    const out = diffLines(lines(400, -1), lines(400, 200));
    expect(out.added).toBe(1);
    expect(out.removed).toBe(1);
    expect(out.rows).toHaveLength(401);
  });

  it('says the pair is too big rather than spending a minute on it', () => {
    // Quadratic in the number of lines: two files of ten thousand lines is a
    // hundred million cells and a terminal that stops answering. A viewer has
    // to be able to say so.
    const big = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n');
    const out = diffLines(big, `${big}\nmore`, 4000);
    expect(out.tooLarge).toEqual({ lines: 6001, limit: 4000 });
    expect(out.rows).toEqual([]);
  });
});
