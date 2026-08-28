/**
 * The drawing tag.
 *
 * A tagged template reading `strings.raw`, because this is drawing. A figure
 * whose every backslash has to be doubled to survive the parser is one
 * somebody will eventually get wrong, and the mistake does not look like a
 * mistake - it looks like a slightly worse cat.
 *
 *     art`
 *  /\_/\
 * ( ^.^ )
 * `
 *
 * The leading and trailing blank lines are the ones the backticks sit on, and
 * they are dropped. Nothing else is: art starts at column zero in the file,
 * because leading spaces are part of the animal and a dedent would eat them.
 */
export function art(strings: TemplateStringsArray): string[] {
  const rows = strings.raw.join('').split('\n');
  if (rows[0]?.trim() === '') rows.shift();
  if (rows[rows.length - 1]?.trim() === '') rows.pop();
  return rows;
}

/** One cell's frames, however the file wrote them. One frame, or several. */
export function framesOf(cell: string[] | string[][]): string[][] {
  return Array.isArray(cell[0]) ? cell as string[][] : [cell as string[]];
}

/**
 * Square a form off: one width, one height, across every mood and every frame.
 *
 * Padded once, here, rather than by the compositor - because the compositor
 * pads to the widest row *it* was given, and a centred figure with one short
 * row leans. And because a frame one row taller than the next does not read as
 * animation, it reads as the line underneath it jumping.
 */
export function square(cells: string[][][]): { width: number; height: number } {
  const width = Math.max(0, ...cells.flatMap((frames) => frames.flatMap((rows) => rows.map((row) => row.length))));
  const height = Math.max(0, ...cells.flatMap((frames) => frames.map((rows) => rows.length)));

  for (const frames of cells) {
    for (let at = 0; at < frames.length; at += 1) {
      const rows = (frames[at] as string[]).map((row) => row.padEnd(width));
      while (rows.length < height) rows.push(' '.repeat(width));
      frames[at] = rows;
    }
  }
  return { width, height };
}

/**
 * A long open and a short shut.
 *
 * Two frames alternating at the ticker's rate is not a blink, it is a strobe.
 * The hold lives in the data rather than in the component, because how long a
 * cat's eyes stay open is a fact about the cat.
 */
export const blink = (open: string[], shut: string[]): string[][] => [open, open, open, shut];

/** Two frames, each held for two - a slow alternation inside a fast ticker. */
export const alternate = (a: string[], b: string[]): string[][] => [a, a, b, b];
