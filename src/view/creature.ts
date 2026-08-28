/**
 * A small drawn thing, above the invitation to say something.
 *
 * An empty screen is the one place a client can afford a figure, and a
 * different one each time is the difference between an application that has a
 * mascot and one that has a habit.
 *
 * The drawings moved to [`bood/`](./bood/index.ts) - one creature per file,
 * registered by name, in three sizes and five moods. This file is the door
 * they were already behind, and it stays: `<Creature mood="happy" />` on the
 * empty screen means what it always meant.
 *
 * Two rules, and both of them came from watching art break in a terminal.
 *
 * Plain ASCII, every character. Not one glyph is one whose width the terminal
 * gets to decide - box drawing and the half-block set are the ones that get
 * eaten by a CJK font setting, and art that is one cell wider on somebody
 * else's machine does not look narrow, it looks broken. `registerCreature`
 * checks this rather than trusting it.
 *
 * No shared frame, no shared face window, no shared size at full size. The
 * figures run from seven cells wide to seventeen and the outline *is* the
 * animal. A creature that fits a template is a template wearing a hat - which
 * is exactly what `block` and `inline` are, and why they are drawn separately
 * instead of being the big one shrunk.
 */

import { BOOD, boodHeight } from './bood/index.js';

export { Creature, MOODS, FORMS, drawCreature, creatureFrames, creatureSize } from './bood/index.js';
export type { CreatureProps, Form, Mood } from './bood/index.js';

/** The names, in roster order. */
export const CREATURES: readonly string[] = BOOD.map((creature) => creature.name);

/** How tall the tallest of them is, for anyone deciding whether there is room. */
export const CREATURE_HEIGHT = boodHeight('draw');
