import { framesOf, square } from './art.js';
import type { Creature, CreatureSpec, Form, Mood } from './types.js';
import { BOUNDS, FORMS, MOODS } from './types.js';

/**
 * The bood.
 *
 * Late-binding, by name, the way every other registry in this runtime works:
 * a creature is looked up when it is drawn, not linked when it is imported.
 * Which means a consumer can `registerCreature` their own and it is on the
 * same footing as the six that ship - there is no built-in list to be on.
 */
const BOOD = new Map<string, Creature>();

/** What went wrong, and which drawing it was. */
class BadDrawing extends Error {
  constructor(name: string, form: Form, mood: Mood, said: string) {
    super(`creature "${name}" ${form}/${mood}: ${said}`);
    this.name = 'BadDrawing';
  }
}

/**
 * Plain ASCII, every character, and it is checked rather than claimed.
 *
 * Not one glyph in a creature is one whose width the terminal gets to decide.
 * Box drawing and the half-block set are the ones that get eaten by a CJK font
 * setting, and art that is one cell wider on somebody else's machine does not
 * look narrow, it looks broken. A `block` that renders six cells wide has also
 * quietly broken whatever was laid out beside it.
 */
const PRINTABLE = /^[\x20-\x7e]*$/;

export function registerCreature(spec: CreatureSpec): Creature {
  const art = {} as Record<Form, Record<Mood, string[][]>>;
  const size = {} as Record<Form, { width: number; height: number }>;

  for (const form of FORMS) {
    const bound = BOUNDS[form];
    const byMood = {} as Record<Mood, string[][]>;

    for (const mood of MOODS) {
      const frames = framesOf(spec[form][mood]).map((rows) => [...rows]);
      if (frames.length === 0) throw new BadDrawing(spec.name, form, mood, 'no frames');

      for (const rows of frames) {
        if (rows.length === 0) throw new BadDrawing(spec.name, form, mood, 'an empty frame');
        if (rows.length > bound.rows) {
          throw new BadDrawing(spec.name, form, mood, `${rows.length} rows, and ${form} allows ${bound.rows}`);
        }
        for (const row of rows) {
          if (row.length > bound.cols) {
            throw new BadDrawing(spec.name, form, mood, `a row ${row.length} cells wide, and ${form} allows ${bound.cols}`);
          }
          if (!PRINTABLE.test(row)) {
            throw new BadDrawing(spec.name, form, mood, `"${row}" uses a glyph whose width a terminal gets to decide`);
          }
        }
      }
      byMood[mood] = frames;
    }

    // Squared per form, not per creature: `draw` being sixteen cells wide is
    // no reason for `inline` to be, and a mood change must not move what is
    // under the figure.
    art[form] = byMood;
    size[form] = square(MOODS.map((mood) => byMood[mood]));
  }

  const creature: Creature = { name: spec.name, label: spec.label, about: spec.about ?? '', art, size };
  BOOD.set(creature.name, creature);
  return creature;
}

export function getCreature(name: string): Creature | undefined {
  return BOOD.get(name);
}

/** Every one registered, in registration order. */
export function listCreatures(): readonly Creature[] {
  return [...BOOD.values()];
}

export function creatureNames(): readonly string[] {
  return [...BOOD.keys()];
}

/**
 * A miss is drawn, not thrown.
 *
 * A name that is not registered is a runtime miss - the same thing a missing
 * component registration is - and the answer is the first creature registered
 * rather than a blank space, because a blank space in the middle of an empty
 * screen looks like the screen is broken.
 */
function resolve(name: string | undefined): Creature | undefined {
  return (name === undefined ? undefined : BOOD.get(name)) ?? BOOD.values().next().value;
}

export interface DrawOptions {
  form?: Form;
  /** Which frame of the cycle. Wraps, so a frame counter can be handed straight in. */
  frame?: number;
}

/** The rows of one creature, in one mood, at one size. */
export function drawCreature(name: string, mood: Mood = 'happy', options: DrawOptions = {}): string[] {
  const frames = creatureFrames(name, mood, options.form);
  const at = ((options.frame ?? 0) % frames.length + frames.length) % frames.length;
  return frames[at] as string[];
}

/** Every frame of one cell. One long, where the drawing does not move. */
export function creatureFrames(name: string, mood: Mood = 'happy', form: Form = 'draw'): string[][] {
  const creature = resolve(name);
  if (!creature) return [[]];
  return creature.art[form][mood];
}

/** What a form costs for one creature, whatever mood it is in. */
export function creatureSize(name: string, form: Form = 'draw'): { width: number; height: number } {
  return resolve(name)?.size[form] ?? { width: 0, height: 0 };
}

/** The tallest anyone in the bood is, for a caller deciding whether there is room. */
export function boodHeight(form: Form = 'draw'): number {
  return Math.max(0, ...listCreatures().map((creature) => creature.size[form].height));
}
