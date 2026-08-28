/**
 * What a creature is, before anyone draws one.
 *
 * A creature file writes art and nothing else - no measuring, no padding, no
 * component. The registry does the arithmetic once, at registration, so that
 * a drawing is checked the moment it joins the bood rather than the first
 * time somebody renders it on a narrow terminal.
 */

/** What the figure is doing. The one thing worth reading from across the room. */
export const MOODS = ['happy', 'sad', 'thinking', 'executing', 'error'] as const;
export type Mood = typeof MOODS[number];

/**
 * How much room the figure gets.
 *
 * Three sizes rather than one scaled one, because art does not scale: a cat
 * shrunk to five cells is a smudge, and a cat *redrawn* at five cells is a
 * cat. Each form is drawn by hand and each one is allowed to look different.
 */
export const FORMS = ['draw', 'block', 'inline'] as const;
export type Form = typeof FORMS[number];

/**
 * The ceiling each form is held to.
 *
 * `block` and `inline` exist to be placed next to something else - a header, a
 * status row, a list item - and a caller who has budgeted five cells cannot
 * have that budget decided by whichever creature came up. So the bound is the
 * contract, and `registerCreature` refuses art that breaks it.
 *
 * `draw` has no width bound on purpose. The figures run from seven cells wide
 * to seventeen and the outline *is* the animal; a creature that fits a
 * template is a template wearing a hat.
 */
export const BOUNDS: Record<Form, { rows: number; cols: number }> = {
  draw: { rows: 8, cols: Infinity },
  block: { rows: 3, cols: 5 },
  inline: { rows: 1, cols: 5 },
};

/**
 * One still, as rows. `art` produces these.
 *
 * A cell is one of them, or several to cycle through. Frame zero is the
 * still: it is what shows with animation off, on a terminal that has said no,
 * and in a snapshot test - so it is the frame worth getting right.
 */
export type Cell = string[] | string[][];

/** What a creature file exports: art, in three sizes, in five moods. */
export interface CreatureSpec {
  /** The registry key. Lowercase, one word. */
  name: string;
  /** For a picker, or a roster. */
  label: string;
  /** One line about what it is, where a picker has room for one. */
  about?: string;
  draw: Record<Mood, Cell>;
  block: Record<Mood, Cell>;
  inline: Record<Mood, Cell>;
}

/** What the registry hands back: the same art, measured and squared off. */
export interface Creature {
  name: string;
  label: string;
  about: string;
  /** form to mood to frames to rows. Every row of a form is one width. */
  art: Record<Form, Record<Mood, string[][]>>;
  /** What a form costs, whatever mood it is in. Settled at registration. */
  size: Record<Form, { width: number; height: number }>;
}

/** Identity, for the type inference. A creature file is data, and stays data. */
export const defineCreature = (spec: CreatureSpec): CreatureSpec => spec;
