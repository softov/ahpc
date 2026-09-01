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
 * status row, a list item - and a caller who has budgeted seven cells cannot
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
  inline: { rows: 1, cols: 7 },
};

/**
 * One still, as rows. `art` produces these.
 *
 * A cell is one of them, or several to cycle through. Frame zero is the
 * still: it is what shows with animation off, on a terminal that has said no,
 * and in a snapshot test - so it is the frame worth getting right.
 */
export type Cell = string[] | string[][];

/**
 * What the body is doing, as distinct from what the mood is.
 *
 * Nothing sets one of these. A pose is derived from the physics every tick -
 * `poseOf` in `motion.ts` - because a body that is told what it is doing and a
 * body that is falling are two authorities on one fact, and the visible half
 * of that disagreement is a figure walking through the air.
 */
export const POSES = [
  'idle', 'sit', 'walk', 'jump', 'fall', 'fly', 'land', 'held', 'sleep', 'alarm',
] as const;
export type Pose = typeof POSES[number];

/**
 * Which way it is pointed, which is latched rather than read.
 *
 * `front` is the one a creature returns to: after a couple of seconds standing
 * still it turns and looks at you. It is also the fallback, so a species that
 * has no left view of a pose falls through to its front one and still reads
 * right rather than drawing nothing.
 */
export const FACINGS = ['front', 'right', 'left'] as const;
export type Facing = typeof FACINGS[number];

/** How motion art is keyed: a pose, or a pose at one facing. */
export type PoseKey = Pose | `${Pose}.${Facing}`;

/**
 * The moving half of a creature, which is optional.
 *
 * A creature without this is drawn exactly as it always was; `lively` simply
 * has nothing to run. That is the whole reason it is a separate block rather
 * than more fields on the spec - three of the six here have side views drawn
 * for them and three do not, and the three that do not are not broken.
 *
 * The art here is keyed on `pose`, never on mood, because mood arrives through
 * the slots instead: a run of `%` is the face and a run of `#` is the tell -
 * ears, tail, crest. The run is exactly as wide as the token that fills it, so
 * substitution cannot move a column, and `registerCreature` checks that rather
 * than trusting it. Without that seam the matrix is poses x facings x moods
 * and nobody draws five hundred pictures of a rabbit.
 */
export interface Motion {
  /** `hop` cannot travel without leaving the ground. `walk` can. */
  gait: 'walk' | 'hop';
  /** Whether gravity can be suspended for this one while it has somewhere to be. */
  flies: boolean;
  sits: boolean;
  /** How much of an impact comes back up. Zero for a cat, which does not bounce. */
  bounce: number;
  /** Gravity multiplier. Below one is a creature the air holds up. */
  fallSpeed: number;
  /** One gait hop, as a fraction of the standard impulse. Ignored by a walker. */
  hop: number;
  /** What a restful pose blinks with, whatever mood it is in. */
  blink: string;
  /** The mood token, three cells, dropped into every `%` run. */
  faces: Record<Mood, string>;
  /** The second carrier of the same meaning, dropped into every `#` run. */
  tells: Record<Mood, string>;
  poses: Partial<Record<PoseKey, Cell>>;
  /**
   * A mood that changes the shape rather than the expression.
   *
   * The escape hatch the face slot cannot cover: a cat that is working sits at
   * a keyboard, which is a different animal outline and not a different face.
   */
  overrides?: Partial<Record<Mood, Partial<Record<PoseKey, Cell>>>>;
}

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
  /** Present on the creatures that have been drawn moving. */
  motion?: Motion;
}

/** Motion as the registry keeps it: the same art, framed and slot-checked. */
export interface RegisteredMotion extends Omit<Motion, 'poses' | 'overrides'> {
  poses: Partial<Record<PoseKey, string[][]>>;
  overrides: Partial<Record<Mood, Partial<Record<PoseKey, string[][]>>>>;
  /**
   * How far the widest drawing reaches either side of the anchor.
   *
   * The walls are set from this rather than from whichever frame is up, so
   * they do not move. A bound taken from the current pose shrinks the moment
   * a cat turns side-on and doubles in width, and the creature - already
   * standing legally where it was - is shoved several cells inward on the
   * next tick. Constant walls cost it half a body length at each end and
   * nothing else.
   */
  reach: { left: number; right: number };
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
  /** Undefined on a creature nobody has drawn a walk cycle for. */
  motion?: RegisteredMotion;
}

/** Identity, for the type inference. A creature file is data, and stays data. */
export const defineCreature = (spec: CreatureSpec): CreatureSpec => spec;
