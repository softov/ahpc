import type { MouseEvent, RenderOutput } from '@textui/core';
import { defineComponent, useFrame, useRef, useSize, useState } from '@textui/core';
import { Column } from '@textui/widgets';

import { anchorOf, fill } from './art.js';
import type { Grip } from './motion.js';
import {
  carry, createBody, faceOf, frameOf, grab, poseOf, release, slipped, stepBody, WORLD,
} from './motion.js';
import { creatureMotion, poseFrames } from './registry.js';
import type { Mood } from './types.js';

/**
 * The creature, on the whole application rather than on one screen of it.
 *
 * It lives on the `floating` layer, which is a plane over every screen: it is
 * not remounted by navigating, so pressing escape moves the screen out from
 * under it and leaves the creature where it was standing. A figure that only
 * exists on the screen that drew it is a decoration; one that is still there
 * when the screen changes is an inhabitant, and that is the whole difference.
 *
 * Nothing here draws a field. The wrapper is a box that states no background,
 * and a box that states nothing paints nothing - so the only cells this writes
 * are the ones the animal's own rows occupy. That is the constraint the whole
 * design turns on: a terminal has no per-cell transparency, so a rectangle of
 * padding would erase a rectangle of the application. A creature-shaped hole
 * is the most a sprite can cost, and it is what this costs.
 */

const MOTION_FPS = 12;
const MAX_CATCHUP = 4;

const clamp = (value: number, low: number, high: number): number =>
  (value < low ? low : value > high ? high : value);

export interface BoodSpriteProps {
  /** Which creature. One is chosen per run and kept in the store. */
  name?: string;
  mood?: Mood;
  /**
   * The row to stand on, when something on the screen has said which.
   *
   * The composer says so, and so does the block that appears when a tool asks
   * for permission. Left out - a screen with nothing at the bottom - the floor
   * is the bottom of the terminal less `inset`.
   */
  floor?: number;
  /** Rows kept clear at the bottom of the terminal when nothing has said. */
  inset?: number;
}

export const BoodSprite: (props: BoodSpriteProps) => RenderOutput =
  defineComponent<BoodSpriteProps>('BoodSprite', (props) => {
    const { name, mood = 'happy', floor, inset = 3 } = props;
    const size = useSize();
    const motion = name ? creatureMotion(name) : undefined;

    const body = useRef(createBody());
    const placed = useRef(false);
    const seen = useRef(0);
    const drag = useRef<Grip | null>(null);
    // The body is a ref, so moving it by hand changes nothing the runtime can
    // see. The ticker covers the walking; the pointer has to say so itself.
    const [, moved] = useState(0);

    const beat = useFrame(MOTION_FPS, { enabled: motion !== undefined });
    if (!motion || !name) return null;

    const world = {
      ...WORLD,
      floor: Math.max(1, Math.min(floor ?? Infinity, size.height - inset - 1)),
      left: motion.reach.left,
      right: Math.max(motion.reach.left, size.width - 1 - motion.reach.right),
    };

    if (!placed.current) {
      placed.current = true;
      body.current.y = world.floor;
      body.current.x = clamp(Math.floor(size.width / 3), world.left, world.right);
    }
    // The floor is not the same height on every screen - a composer keeps a
    // lot more of the bottom than a status bar - so moving between them moves
    // the ground. Above it, the creature falls to the new one rather than
    // standing on the height the last screen had.
    body.current.y = Math.min(body.current.y, world.floor);
    if (body.current.y < world.floor && body.current.grounded) body.current.grounded = false;

    const ticks = beat < seen.current ? 0 : Math.min(beat - seen.current, MAX_CATCHUP);
    seen.current = beat;
    for (let tick = 0; tick < ticks; tick += 1) stepBody(body.current, motion, mood, world, 1 / MOTION_FPS);

    // The clock runs while it is held, so a grip nothing has touched for a
    // while is a gesture that ended somewhere this handler could not see.
    if (drag.current && slipped(body.current, drag.current)) {
      release(body.current);
      drag.current = null;
    }

    const pose = poseOf(body.current, motion, mood);
    const frames = poseFrames(name, pose, body.current.facing, mood);
    if (!frames) return null;
    const raw = frames[frameOf(pose, body.current, frames.length)] as string[];
    const anchor = anchorOf(frames);
    const rows = fill(raw, faceOf(pose, body.current, motion, mood), motion.tells[mood]);

    const left = Math.max(0, Math.round(body.current.x) - anchor);
    const top = Math.max(0, Math.round(body.current.y) - rows.length + 1);

    /**
     * Only what is actually on the animal.
     *
     * There is no full-screen catcher: the node is the creature's own box, so
     * the runtime's hit test has already decided this press was on the figure
     * and every other press in the application never reaches here. An overlay
     * that covered the terminal to listen would be one that broke every
     * control it happened to be standing over.
     */
    const onMouse = (event: MouseEvent): boolean | void => {
      const held = body.current;

      if (event.action === 'down' && event.button === 'left') {
        drag.current = grab(held, event.x, event.y);
        moved((count) => count + 1);
        return true;
      }

      if (!drag.current) return false;

      // Only a press takes hold. A drag reaches this handler either because
      // the press did - the runtime gives the rest of a gesture to whoever
      // claimed it - or because the pointer happened to pass over the figure
      // during somebody else's unclaimed drag, and the second must not snatch
      // the creature into a hand that was doing something else entirely.
      if (event.action === 'drag') {
        carry(held, drag.current, event.x, event.y, world, event.at);
        moved((count) => count + 1);
        return true;
      }

      // A pointer moving with no button down is a pointer that was released
      // while this handler was not being told: the terminal reports the
      // motion but never reported the release.
      if (event.action === 'move') {
        release(held);
        drag.current = null;
        moved((count) => count + 1);
        return false;
      }

      if (event.action === 'up') {
        release(held, drag.current);
        drag.current = null;
        moved((count) => count + 1);
        return true;
      }
      return false;
    };

    // The layer is pinned at the top-left of the terminal and states no
    // background, so the margin is the position and the only cells written are
    // the ones the animal's own rows occupy.
    return (
      <Column margin={[top, 0, 0, left]} onMouse={onMouse}>
        {rows.map((row, at) => (
          <text key={`bood-${at}`} content={row} fg={TONE[mood]} />
        ))}
      </Column>
    );
  });

/** The same tones the still figure uses, so the two never disagree. */
const TONE = {
  happy: 'success', sad: 'muted', thinking: 'info', executing: 'accent', error: 'danger',
} as const;
