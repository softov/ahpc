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

import { BOOD, boodHeight, livelyNames } from './bood/index.js';
import type { Mood } from './bood/index.js';
import type { Activity } from '../ahp/status.js';
import { useApp, useEffect } from '@textui/core';
import { boodFloorFor } from '../state.js';

export {
  BoodSprite, Creature, MOODS, FORMS, creatureFrames, creatureMotion, creatureSize,
  drawCreature, livelyNames,
} from './bood/index.js';
export type { CreatureProps, Form, Mood } from './bood/index.js';

/**
 * What the figure is doing, from what the session is doing.
 *
 * The moods were always meant to be read off real state rather than chosen, and
 * this is the only place the two vocabularies meet: five drawn moods, four
 * activities the protocol actually reports. `sad` has no source and is drawn
 * anyway, because a mood with nothing to trigger it is a drawing waiting for a
 * state rather than a bug - and inventing a session state to justify it would
 * be the tail wagging the dog.
 *
 * `input` is thinking rather than happy: a session waiting on a person has
 * stopped, and the figure standing still and looking at you is the reading
 * that matches the status row above it.
 */
export function moodOf(activity: Activity): Mood {
  return activity === 'running' ? 'executing'
    : activity === 'error' ? 'error'
      : activity === 'input' ? 'thinking'
        : 'happy';
}

/**
 * Say which row this component starts at, so nothing stands on top of it.
 *
 * Its top row rather than its height: the row is where the thing actually is,
 * and a height has to be added to a guess about everything below it to mean
 * anything. Published rather than assumed because it moves - the composer
 * grows a slash menu upward and grows again with a wrapped draft, and the
 * block that asks about a tool is only there while something is waiting.
 * Cleared on the way out, or a screen that had one would keep making room for
 * it after it had gone.
 */
export function useFloorTop(key: string, row: number): void {
  const app = useApp();
  useEffect(() => {
    app.store.set(boodFloorFor(key), row);
    return () => app.store.set(boodFloorFor(key), 0);
  }, [key, row]);
}

/**
 * One animal per run, rather than one per component that draws one.
 *
 * Picked from the ones drawn moving, because the catalogue's is going to walk
 * and the header's is the same creature seen at seven cells. Two screens
 * showing two different animals would read as two mascots.
 */
export function pickBood(): string {
  const names = livelyNames();
  return names[Math.floor(Math.random() * names.length)] as string;
}

/** The names, in roster order. */
export const CREATURES: readonly string[] = BOOD.map((creature) => creature.name);

/** How tall the tallest of them is, for anyone deciding whether there is room. */
export const CREATURE_HEIGHT = boodHeight('draw');
