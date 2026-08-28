import { beetle } from './beetle.js';
import { bunny } from './bunny.js';
import { cat } from './cat.js';
import { crab } from './crab.js';
import { owl } from './owl.js';
import { registerCreature } from './registry.js';
import { sprout } from './sprout.js';

/**
 * The bood: one creature per file, and this is where they are registered.
 *
 * Named imports rather than side-effecting ones, so registration is a
 * statement somebody can read and reorder rather than a consequence of import
 * order. The list is the roster, and its order is the order a picker shows.
 *
 * Nothing outside this file is on a different footing: a consumer with their
 * own drawing calls `registerCreature` with it and it is one of these.
 */
export const BOOD = [cat, bunny, crab, owl, beetle, sprout].map(registerCreature);

export { beetle, bunny, cat, crab, owl, sprout };
export { alternate, art, blink } from './art.js';
export {
  boodHeight,
  creatureFrames,
  creatureNames,
  creatureSize,
  drawCreature,
  getCreature,
  listCreatures,
  registerCreature,
} from './registry.js';
export type { DrawOptions } from './registry.js';
export { BOUNDS, FORMS, MOODS, defineCreature } from './types.js';
export type { Cell, Creature as RegisteredCreature, CreatureSpec, Form, Mood } from './types.js';
export { Creature } from './render.js';
export type { CreatureProps } from './render.js';
