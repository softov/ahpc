import { anchorOf, framesOf, metric, square } from './art.js';
import type {
  Creature, CreatureSpec, Facing, Form, Mood, Motion, Pose, PoseKey, RegisteredMotion,
} from './types.js';
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

/** What went wrong in the moving half, and which pose it was. */
class BadMotion extends Error {
  constructor(name: string, key: string, said: string) {
    super(`creature "${name}" motion/${key}: ${said}`);
    this.name = 'BadMotion';
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

  const creature: Creature = {
    name: spec.name, label: spec.label, about: spec.about ?? '', art, size,
    motion: spec.motion ? registerMotion(spec.name, spec.motion) : undefined,
  };
  BOOD.set(creature.name, creature);
  return creature;
}

/**
 * The moving half, framed and slot-checked.
 *
 * The check that matters is the slot width. A `%` run one cell wider than the
 * face that fills it does not fail, it draws a rabbit with a column of its own
 * head missing - and only in the moods whose token is short. That is a bug
 * nobody finds by looking at the happy one, so it is settled here, once, for
 * every mood against every pose.
 */
function registerMotion(name: string, motion: Motion): RegisteredMotion {
  const faces = MOODS.map((mood) => motion.faces[mood]);
  const tells = MOODS.map((mood) => motion.tells[mood]);
  const oneWidth = (tokens: string[], what: string): number => {
    const widths = new Set(tokens.map((token) => token.length));
    if (widths.size !== 1) throw new BadMotion(name, what, `${widths.size} different widths, and a slot has one`);
    return [...widths][0] as number;
  };
  const faceWidth = oneWidth([...faces, motion.blink], 'faces');
  const tellWidth = oneWidth(tells, 'tells');

  const frame = (key: string, cell: NonNullable<Motion['poses'][PoseKey]>): string[][] => {
    const frames = framesOf(cell).map((rows) => [...rows]);
    if (frames.length === 0) throw new BadMotion(name, key, 'no frames');
    for (const rows of frames) {
      if (rows.length === 0) throw new BadMotion(name, key, 'an empty frame');
      if (rows.length > BOUNDS.draw.rows) {
        throw new BadMotion(name, key, `${rows.length} rows, and a figure allows ${BOUNDS.draw.rows}`);
      }
      for (const row of rows) {
        if (!PRINTABLE.test(row)) {
          throw new BadMotion(name, key, `"${row}" uses a glyph whose width a terminal gets to decide`);
        }
        for (const run of row.match(/%+/g) ?? []) {
          if (run.length !== faceWidth) throw new BadMotion(name, key, `a ${run.length}-cell face slot, and the faces are ${faceWidth}`);
        }
        for (const run of row.match(/#+/g) ?? []) {
          if (run.length !== tellWidth) throw new BadMotion(name, key, `a ${run.length}-cell tell slot, and the tells are ${tellWidth}`);
        }
      }
    }
    return frames;
  };

  const poses: RegisteredMotion['poses'] = {};
  for (const [key, cell] of Object.entries(motion.poses)) poses[key as PoseKey] = frame(key, cell);
  if (!poses['idle.front'] && !poses.idle) throw new BadMotion(name, 'idle', 'no idle to fall back to');

  const overrides: RegisteredMotion['overrides'] = {};
  for (const [mood, byPose] of Object.entries(motion.overrides ?? {})) {
    const framed: Partial<Record<PoseKey, string[][]>> = {};
    for (const [key, cell] of Object.entries(byPose)) framed[key as PoseKey] = frame(`${mood}/${key}`, cell);
    overrides[mood as Mood] = framed;
  }

  const every = [...Object.values(poses), ...Object.values(overrides).flatMap((byPose) => Object.values(byPose))];
  const reach = { left: 0, right: 0 };
  for (const frames of every) {
    const anchor = anchorOf(frames as string[][]);
    const { width } = metric((frames as string[][])[0] as string[]);
    reach.left = Math.max(reach.left, anchor);
    reach.right = Math.max(reach.right, width - 1 - anchor);
  }

  return { ...motion, poses, overrides, reach };
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

/**
 * The chain, and the chain is the design rather than the first hit.
 *
 * A species that has no left view of a pose falls through to its front one and
 * still reads right; the owl's glide is deliberately front-only, because a
 * bird planing is not pointed anywhere in particular. Overrides come first at
 * every step, so a mood that changes the outline rather than the expression -
 * the cat at a keyboard while a turn is running - wins before a facing does.
 */
export function poseFrames(name: string, pose: Pose, facing: Facing, mood: Mood): string[][] | undefined {
  const motion = resolve(name)?.motion;
  if (!motion) return undefined;

  const chain: PoseKey[] = [
    `${pose}.${facing}`, `${pose}.front`, `${pose}.right`, pose,
    `idle.${facing}`, 'idle.front', 'idle',
  ];
  const override = motion.overrides[mood];
  for (const key of chain) {
    const hit = override?.[key] ?? motion.poses[key];
    if (hit) return hit;
  }
  return undefined;
}

/** The moving half of one creature, or nothing if it was never drawn moving. */
export function creatureMotion(name: string): Creature['motion'] {
  return resolve(name)?.motion;
}

/** Which of the bood have been drawn moving, for a picker that offers it. */
export function livelyNames(): readonly string[] {
  return listCreatures().filter((creature) => creature.motion).map((creature) => creature.name);
}
