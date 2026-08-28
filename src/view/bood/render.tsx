import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useFrame, useMemo } from '@textui/core';
import { Column } from '@textui/widgets';

import { creatureFrames, creatureNames } from './registry.js';
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
}

export const Creature: (props: CreatureProps) => RenderOutput =
  defineComponent<CreatureProps>('Creature', (props) => {
    const { name, mood = 'happy', form = 'draw', animated = true, tone, ...rest } = props;

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
