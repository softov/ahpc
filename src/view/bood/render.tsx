import type { BoxProps, MouseEvent, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useFrame, useMeasure, useMemo, useRef, useState } from '@textui/core';
import { Column } from '@textui/widgets';

import { anchorOf, blit, fill, metric } from './art.js';
import { createBody, faceOf, frameOf, poseOf, stepBody, WORLD } from './motion.js';
import { creatureFrames, creatureMotion, creatureNames, poseFrames } from './registry.js';
import type { Form, Mood } from './types.js';

/**
 * A mood per tone, rather than a colour per creature.
 *
 * Which creature you got says nothing; what it is doing is the thing worth
 * reading from across the room. Semantic names, so a theme decides the colour
 * and the figure is legible on paper as well as on a dark terminal.
 *
 * The two that also appear in the session list borrow that list's tones on
 * purpose: `executing` is accent because that is what a running session is,
 * and `error` is danger because that is what a failed one is. A mascot that
 * disagreed with the status column about what red means would be worse than
 * no mascot.
 */
const TONE: Record<Mood, SemanticVariant> = {
  happy: 'success',
  sad: 'muted',
  thinking: 'info',
  executing: 'accent',
  error: 'danger',
};

/**
 * How fast the cycle turns.
 *
 * One rate for every form and every mood, with the holds written into the art
 * instead - `blink` and `alternate` in `art.ts`. A component that chose its own
 * rate per mood would put the timing in two places, and the drawing would lose.
 */
const FPS = 2;

/**
 * The second clock, for the half that moves.
 *
 * Twelve rather than two, because a body under gravity at two frames a second
 * is a body teleporting; and twelve rather than thirty, because every tick is
 * a repaint of the whole subtree and a mascot is not what the frame budget is
 * for. Position is a float and rendering rounds, so what twelve costs is the
 * top speed - past about a cell a tick the figure starts to skip.
 */
const MOTION_FPS = 12;

/** How much of a stall it will catch up on, rather than leaping across the box. */
const MAX_CATCHUP = 4;

const clamp = (value: number, low: number, high: number): number =>
  (value < low ? low : value > high ? high : value);

export interface CreatureProps extends BoxProps {
  /** Which one. Left out, one is picked at random and kept for this mount. */
  name?: string;
  mood?: Mood;
  /** How much room it gets: the whole figure, a 3x5 portrait, or one line of 5. */
  form?: Form;
  /**
   * Off pins frame zero - the still.
   *
   * Also pinned when the runtime has animation off, without asking: `useFrame`
   * returns zero there, which is the whole reason frame zero is the still.
   */
  animated?: boolean;
  /** Override the mood's own tone. */
  tone?: SemanticVariant;
  /**
   * Gravity, and a will of its own.
   *
   * Opt-in, and it needs a creature that has been drawn moving - three of the
   * six have been. Anything else keeps the still it always had rather than
   * jittering in place, because a creature with no walk cycle standing in a
   * ten-row box is worse than a creature in one row.
   */
  lively?: boolean;
  /** The field it lives in, in cells. Only read when `lively`. */
  fieldWidth?: number;
  fieldHeight?: number;
}

export const Creature: (props: CreatureProps) => RenderOutput =
  defineComponent<CreatureProps>('Creature', (props) => {
    const {
      name, mood = 'happy', form = 'draw', animated = true, tone,
      lively = false, fieldWidth = 48, fieldHeight = 10, ...rest
    } = props;

    // Picked once and kept: a figure that changed on every keystroke would be
    // a flicker rather than a mascot. `useMemo` with no deps is the mount.
    const names = creatureNames();
    const chosen = useMemo(
      () => name ?? names[Math.floor(Math.random() * names.length)] as string,
      [name],
    );

    // Unconditional, because it is a hook. What `animated` decides is whether
    // the number is used, not whether the ticker exists - and a ticker that
    // appeared and vanished with a prop would be a hook order bug the first
    // time a mood turned animation off.
    const frame = useFrame(FPS);

    // Also unconditional, and also gated: a ticker is a standing invalidation,
    // so the one that runs at twelve a second has to be off for every figure
    // that is not moving rather than merely ignored.
    const motion = creatureMotion(chosen);
    const running = lively && motion !== undefined && animated;
    const beat = useFrame(MOTION_FPS, { enabled: running });
    const body = useRef(createBody());
    const seen = useRef(0);
    const placed = useRef(false);
    // Where the field is on the terminal, so an absolute pointer can be asked
    // which cell of the field it is over.
    const rect = useMeasure();
    const drag = useRef<{ dx: number; dy: number; samples: { at: number; x: number; y: number }[] } | null>(null);
    /**
     * What tells the runtime the body moved.
     *
     * The body lives in a ref, because physics wants somewhere to accumulate
     * that is not a render. The cost is that mutating it is invisible: a
     * pointer that carries the creature across the screen changes nothing the
     * runtime can see, so the component is never marked dirty and the frame on
     * screen is the one from before the gesture. The ticker hides this for the
     * walking, which arrives on its own state change - it is only the pointer,
     * which moves the body between ticks, that has to say so.
     */
    const [, moved] = useState(0);
    const repaint = (): void => moved((count) => count + 1);

    if (running && motion) {
      // Walls from the creature's widest drawing, settled at registration, so
      // they hold still while the pose changes underneath them.
      const world = {
        ...WORLD,
        floor: fieldHeight - 1,
        left: motion.reach.left,
        right: Math.max(motion.reach.left, fieldWidth - 1 - motion.reach.right),
      };

      // Once, and a flag rather than `now === 0`, which is only false after the
      // first tick: until then every render put the body back where it started,
      // so a pointer that carried it somewhere was undone by its own repaint.
      if (!placed.current) {
        placed.current = true;
        body.current.y = world.floor;
        body.current.x = Math.max(world.left, Math.min(world.right, Math.floor(fieldWidth / 3)));
      }
      // `useFrame` answers zero while animation is off, so a beat that went
      // backwards is the runtime saying stop rather than a dropped frame.
      const ticks = beat < seen.current ? 0 : Math.min(beat - seen.current, MAX_CATCHUP);
      seen.current = beat;
      for (let tick = 0; tick < ticks; tick += 1) stepBody(body.current, motion, mood, world, 1 / MOTION_FPS);

      const pose = poseOf(body.current, motion, mood);
      const at = poseFrames(chosen, pose, body.current.facing, mood);
      const shape = at ? metric(at[0] as string[]) : { width: 1, height: 1, anchor: 0 };
      const anchor = at ? anchorOf(at) : 0;

      /**
       * The pointer, which is the one input this has that a terminal figure
       * has never had.
       *
       * Returning `true` on the way down claims the gesture: every `drag` and
       * the `up` that ends it come back here wherever the pointer has got to,
       * which is what lets a creature be carried off the field and dropped
       * somewhere else rather than being lost the moment it leaves its own box.
       *
       * Picking it up is not the same as calling it. A press on the figure
       * carries it; a press anywhere else in the field is somewhere to go, and
       * the brain is told rather than the body moved - so it walks over, in
       * its own gait, and a bunny hops there.
       */
      const onMouse = (event: MouseEvent): boolean | void => {
        const held = body.current;
        const x = event.x - rect.x;
        const y = event.y - rect.y;

        if (event.action === 'down' && event.button === 'left') {
          const over = x >= held.x - anchor - 1 && x <= held.x - anchor + shape.width
            && y >= held.y - shape.height + 1 && y <= held.y + 1;
          if (over) {
            drag.current = { dx: x - held.x, dy: y - held.y, samples: [] };
            held.held = true;
            held.vx = 0;
            held.vy = 0;
            held.stillFor = 0;
            held.wantsFlight = false;
            repaint();
          return true;
          }
          held.intent = { kind: 'goto', x: clamp(x, world.left, world.right), until: held.now + 10 };
          held.sitting = false;
          held.stillFor = 0;
          // The same question the brain asks itself, asked of where the finger
          // landed: far enough away, or up in the air, is worth taking off for.
          held.wantsFlight = motion.flies
            && (Math.abs(held.intent.x - held.x) > 14 || y < world.floor - 4);
          repaint();
          return true;
        }

        if (!drag.current) return undefined;

        if (event.action === 'drag') {
          held.x = clamp(x - drag.current.dx, world.left, world.right);
          held.y = clamp(y - drag.current.dy, 0, world.floor);
          if (event.at !== undefined) drag.current.samples.push({ at: event.at, x: held.x, y: held.y });
          while (drag.current.samples.length > 5) drag.current.samples.shift();
          repaint();
          return true;
        }

        if (event.action === 'up') {
          // It inherits the hand's speed, so letting go while moving is a
          // throw and letting go still is a drop. A terminal that does not
          // stamp its mouse events cannot tell the two apart, so it drops.
          const samples = drag.current.samples;
          const first = samples[0];
          const last = samples[samples.length - 1];
          if (first && last && last.at > first.at) {
            const seconds = (last.at - first.at) / 1000;
            held.vx = clamp((last.x - first.x) / seconds, -45, 45);
            held.vy = clamp((last.y - first.y) / seconds, -45, 45);
          }
          held.held = false;
          held.grounded = false;
          drag.current = null;
          repaint();
          return true;
        }
        return undefined;
      };

      const field = Array.from({ length: fieldHeight }, () => ' '.repeat(fieldWidth));
      const painted = at
        ? blit(
          field,
          fill(
            at[frameOf(pose, body.current, at.length)] as string[],
            faceOf(pose, body.current, motion, mood),
            motion.tells[mood],
          ),
          body.current.x,
          body.current.y,
          anchor,
        )
        : field;

      return (
        <Column align="start" onMouse={onMouse} {...rest}>
          {painted.map((row, at2) => (
            <text key={`${chosen}-live-${at2}`} content={row} fg={tone ?? TONE[mood]} />
          ))}
        </Column>
      );
    }

    const frames = creatureFrames(chosen, mood, form);
    const rows = frames[(animated ? frame : 0) % frames.length] as string[];

    // No `unicode` check, which is the point of the alphabet: there is no
    // ASCII fallback to swap in because there is nothing here to fall back
    // from. The figure that renders on a terminal that can draw anything is
    // the same figure that renders on one that can draw nothing.
    return (
      <Column align="center" {...rest}>
        {rows.map((row, at) => (
          <text key={`${chosen}-${at}`} content={row} fg={tone ?? TONE[mood]} />
        ))}
      </Column>
    );
  });
