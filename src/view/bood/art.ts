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

/**
 * Fill a pose's slots: a run of `%` takes the face, a run of `#` the tell.
 *
 * The run is written exactly as wide as the token that fills it, so a filled
 * row is the same length as the row it came from and nothing downstream has to
 * re-measure. `registerCreature` checks that at registration; the padding here
 * is what happens when somebody registers their own creature at runtime and
 * got it wrong, and a short token is better than a row that shifts.
 */
export function fill(rows: string[], face: string, tell: string): string[] {
  return rows.map((row) => row
    .replace(/%+/g, (run) => pad(face, run.length))
    .replace(/#+/g, (run) => pad(tell, run.length)));
}

function pad(token: string, width: number): string {
  if (token.length === width) return token;
  return token.length > width ? token.slice(0, width) : token.padEnd(width);
}

/**
 * What one frame is, and where the animal is inside it.
 *
 * The anchor is the middle of the face slot - the creature's identity point -
 * and a figure is placed by it rather than by its left edge. That is what lets
 * a cat turn side-on: the walking drawing is twice as wide as the front one
 * with the head at the far end, and anchored on the face the body swings round
 * a head that stays where it was. Anchored on the corner it would jump ten
 * cells every time the cat turned round.
 *
 * A pose that pins its own face has no slot to read, so it falls back to the
 * middle, which is where a symmetrical drawing's identity is anyway.
 */
export function metric(rows: string[]): { width: number; height: number; anchor: number } {
  let width = 0;
  let anchor = -1;
  for (const row of rows) {
    if (row.length > width) width = row.length;
    const slot = /%+/.exec(row);
    if (slot && anchor < 0) anchor = slot.index + Math.floor(slot[0].length / 2);
  }
  return { width, height: rows.length, anchor: anchor < 0 ? Math.floor(width / 2) : anchor };
}

/**
 * The anchor a whole pose is placed by: frame zero's, shared by every frame.
 *
 * Per-frame anchors would hold the face still and slide everything else, which
 * is the wrong half of the motion to believe. The cat at the keyboard bobs its
 * head one cell between frames; taking the anchor from frame zero keeps the
 * desk still and moves the head, which is what the drawing means.
 */
export function anchorOf(frames: string[][]): number {
  return metric(frames[0] as string[]).anchor;
}

/**
 * Write a figure into a field of rows, bottom-aligned and anchored.
 *
 * Bottom-aligned because the feet own the y: the landing squash is a row
 * shorter than the stand, and padding underneath would sink the creature
 * through the floor at exactly the moment it hits it.
 *
 * Anything off the field is dropped rather than wrapped, so a creature halfway
 * out of a narrow box is half a creature instead of a smear down the far side.
 */
export function blit(field: string[], rows: string[], x: number, y: number, anchor: number): string[] {
  const out = [...field];
  const left = Math.round(x) - anchor;
  const top = Math.round(y) - rows.length + 1;

  for (let at = 0; at < rows.length; at += 1) {
    const line = top + at;
    if (line < 0 || line >= out.length) continue;
    const into = out[line] as string;
    const art = rows[at] as string;
    let built = '';
    for (let col = 0; col < art.length; col += 1) {
      const cell = left + col;
      if (cell < 0 || cell >= into.length) continue;
      if (built === '') built = into;
      const glyph = art[col] as string;
      if (glyph === ' ') continue;
      built = built.slice(0, cell) + glyph + built.slice(cell + 1);
    }
    if (built !== '') out[line] = built;
  }
  return out;
}
