/**
 * A line diff, small enough to read.
 *
 * The host sends two whole files and a count of what changed between them; it
 * does not send the diff itself, so somebody has to work out which lines those
 * were. This is that, and it is deliberately the textbook algorithm rather
 * than anything clever: the longest common subsequence of the two line arrays,
 * with everything not in it marked as removed on the left or added on the
 * right.
 *
 * The cost is quadratic in the number of lines, which is why `diffLines` takes
 * a ceiling. Two files of ten thousand lines each is a hundred million cells
 * and a terminal that stops answering, and the honest answer at that size is
 * to say the files are too big rather than to spend a minute proving it.
 */

export type DiffKind = 'same' | 'added' | 'removed';

export interface DiffRow {
  kind: DiffKind;
  /** 1-based, on the side this row exists on. Absent on the side it does not. */
  before?: number;
  after?: number;
  text: string;
}

export interface DiffResult {
  rows: DiffRow[];
  added: number;
  removed: number;
  /** Set instead of a diff when the pair was over `limit`. */
  tooLarge?: { lines: number; limit: number };
}

/** Lines of a file, with the trailing newline not counted as an empty last line. */
export function toLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * The two sides, lined up.
 *
 * A creation has no `before` and a deletion no `after`; both are passed as an
 * empty string rather than as a special case, because "every line is an
 * addition" is exactly the right diff for a new file and needs no branch of
 * its own.
 */
export function diffLines(before: string, after: string, limit = 4000): DiffResult {
  const a = toLines(before);
  const b = toLines(after);

  if (a.length + b.length > limit) {
    return { rows: [], added: 0, removed: 0, tooLarge: { lines: a.length + b.length, limit } };
  }

  // The common head and tail first. Two files that differ in one line share
  // everything either side of it, and taking those off shrinks the table the
  // quadratic part has to fill to the part that actually differs.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head
    && tail < b.length - head
    && a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) tail++;

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const table = lcs(midA, midB);

  const rows: DiffRow[] = [];
  let added = 0;
  let removed = 0;
  const push = (kind: DiffKind, text: string, ai: number, bi: number): void => {
    rows.push({
      kind,
      ...(kind !== 'added' ? { before: ai + 1 } : {}),
      ...(kind !== 'removed' ? { after: bi + 1 } : {}),
      text,
    });
    if (kind === 'added') added++;
    if (kind === 'removed') removed++;
  };

  for (let i = 0; i < head; i++) push('same', a[i] as string, i, i);

  // Walking the table forwards, so the rows come out in file order.
  let i = 0;
  let j = 0;
  while (i < midA.length || j < midB.length) {
    if (i < midA.length && j < midB.length && midA[i] === midB[j]) {
      push('same', midA[i] as string, head + i, head + j);
      i++; j++;
    // A tie goes to the removal, so a replaced line reads `-old` then `+new`
    // the way every other diff on the machine prints it. With `>=` here the
    // pair comes out the other way round, which is not wrong so much as
    // unreadable next to `git diff`.
    } else if (j < midB.length && (i === midA.length || (table[i]?.[j + 1] ?? 0) > (table[i + 1]?.[j] ?? 0))) {
      push('added', midB[j] as string, head + i, head + j);
      j++;
    } else {
      push('removed', midA[i] as string, head + i, head + j);
      i++;
    }
  }

  for (let k = 0; k < tail; k++) {
    push('same', a[a.length - tail + k] as string, a.length - tail + k, b.length - tail + k);
  }

  return { rows, added, removed };
}

/**
 * `table[i][j]` is the length of the longest common subsequence of `a[i..]`
 * and `b[j..]`, filled from the end so the walk above can go forwards.
 */
function lcs(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      (table[i] as number[])[j] = a[i] === b[j]
        ? (table[i + 1]?.[j + 1] ?? 0) + 1
        : Math.max(table[i + 1]?.[j] ?? 0, table[i]?.[j + 1] ?? 0);
    }
  }
  return table;
}
