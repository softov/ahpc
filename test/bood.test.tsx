import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { RenderOptions } from '@textui/testing';
import {
  BOOD, BOUNDS, FORMS, MOODS, Creature, art, creatureFrames, creatureSize,
  drawCreature, getCreature, registerCreature,
} from '../src/view/bood/index.js';
import type { CreatureProps, CreatureSpec, Form } from '../src/view/bood/index.js';

/**
 * The bood, checked rather than eyeballed.
 *
 * Everything here is invisible until it is on somebody else's terminal: a row
 * one cell short leans, a frame one row taller than the next makes the line
 * under it jump, and a `block` six cells wide has quietly broken whatever was
 * laid out beside it. None of that shows up in a screenshot of the machine it
 * was drawn on.
 */

const SIZES = [
  { width: 100, height: 30 },
  { width: 76, height: 20 },
];

/** A minimal spec, so a test can bend one field and leave the rest legal. */
function specFor(name: string, bend: Partial<CreatureSpec> = {}): CreatureSpec {
  const five = <T,>(one: T) => ({ happy: one, sad: one, thinking: one, executing: one, error: one });
  return {
    name,
    label: name,
    draw: five(art`(o.o)`),
    block: five(art`(o.o)`),
    inline: five(art`(o.o)`),
    ...bend,
  };
}

describe('the bood', () => {
  it('registers one creature per file, and the roster is the order', () => {
    expect(BOOD.map((creature) => creature.name))
      .toEqual(['cat', 'bunny', 'crab', 'owl', 'beetle', 'sprout']);
    for (const creature of BOOD) expect(getCreature(creature.name)).toBe(creature);
  });

  /**
   * Rectangular, every mood, every frame, every form.
   *
   * The compositor pads to the widest row it was given and a short row is
   * padded on one side only, so a centred figure with one short row leans.
   * And a mood or a frame that changes the height moves everything beneath it.
   */
  it('squares every form off, so nothing under a figure moves', () => {
    for (const creature of BOOD) {
      for (const form of FORMS) {
        const { width, height } = creature.size[form];
        for (const mood of MOODS) {
          for (const frame of creatureFrames(creature.name, mood, form)) {
            expect(frame).toHaveLength(height);
            expect(new Set(frame.map((row) => row.length))).toEqual(new Set([width]));
          }
        }
      }
    }
  });

  /**
   * A caller who budgeted five cells gets five cells.
   *
   * `block` and `inline` exist to sit beside something else, and a budget that
   * depends on which creature came up is not a budget. `draw` is the one with
   * no width bound - there the outline is the animal.
   */
  it('holds block and inline to the size they promised', () => {
    for (const creature of BOOD) {
      expect(creature.size.block.width).toBeLessThanOrEqual(BOUNDS.block.cols);
      expect(creature.size.block.height).toBeLessThanOrEqual(BOUNDS.block.rows);
      expect(creature.size.inline.width).toBeLessThanOrEqual(BOUNDS.inline.cols);
      expect(creature.size.inline.height).toBe(1);
    }
  });

  it('refuses a drawing that will not fit, and says which one', () => {
    expect(() => registerBad('inline', art`(o.o)(o.o)`))
      .toThrow(/creature "toolong" inline\/happy: a row 10 cells wide/);
    expect(() => registerBad('block', art`
(o.o)
(o.o)
(o.o)
(o.o)
`)).toThrow(/creature "toolong" block\/happy: 4 rows/);
  });

  function registerBad(form: Form, bad: string[]): void {
    const spec = specFor('toolong');
    spec[form] = { ...spec[form], happy: bad };
    registerCreature(spec);
  }

  /**
   * Plain ASCII, and it is checked rather than claimed.
   *
   * A glyph whose width the terminal decides is what eats art on a CJK font
   * setting - and art that is one cell wider on somebody else's machine does
   * not look narrow, it looks broken.
   */
  it('uses nothing whose width a terminal gets to decide', () => {
    for (const creature of BOOD) {
      for (const form of FORMS) {
        for (const mood of MOODS) {
          for (const frame of creatureFrames(creature.name, mood, form)) {
            for (const row of frame) expect(row).toMatch(/^[\x20-\x7e]*$/);
          }
        }
      }
    }
  });

  it('rejects a glyph a terminal would have an opinion about', () => {
    expect(() => registerCreature(specFor('wide', { inline: {
      happy: art`(◕.◕)`, sad: art`(o.o)`, thinking: art`(o.o)`, executing: art`(o.o)`, error: art`(o.o)`,
    } }))).toThrow(/width a terminal gets to decide/);
  });

  /**
   * Five moods that are five different pictures.
   *
   * Inline is where this is hardest and where it matters most - five cells,
   * one row, and the tone is the only other thing carrying the meaning. A
   * mood that draws the same as another mood is a mood that only exists in
   * colour, which a 16-colour session and a piped log both lose.
   */
  it('draws each mood differently, at every size', () => {
    for (const creature of BOOD) {
      for (const form of FORMS) {
        const stills = MOODS.map((mood) => drawCreature(creature.name, mood, { form }).join('\n'));
        expect(new Set(stills).size).toBe(MOODS.length);
      }
    }
  });

  /** Every creature is its own animal, at every size. */
  it('draws each creature differently, at every size', () => {
    for (const form of FORMS) {
      const stills = BOOD.map((creature) => drawCreature(creature.name, 'happy', { form }).join('\n'));
      expect(new Set(stills).size).toBe(BOOD.length);
    }
  });
});

describe('frames', () => {
  /**
   * Frame zero is the still.
   *
   * It is what shows with animation off, on a runtime that has said no, and in
   * a snapshot - so a cell whose zeroth frame is the odd one out is a creature
   * that looks wrong everywhere it is not moving.
   */
  it('answers frame zero when nobody asked for a frame', () => {
    for (const creature of BOOD) {
      for (const mood of MOODS) {
        const frames = creatureFrames(creature.name, mood);
        expect(drawCreature(creature.name, mood)).toEqual(frames[0]);
        expect(drawCreature(creature.name, mood, { frame: 0 })).toEqual(frames[0]);
      }
    }
  });

  /** A frame counter can be handed straight in: it wraps, both ways. */
  it('wraps a frame number rather than falling off the end', () => {
    const frames = creatureFrames('cat', 'executing');
    expect(frames.length).toBeGreaterThan(1);
    expect(drawCreature('cat', 'executing', { frame: frames.length })).toEqual(frames[0]);
    expect(drawCreature('cat', 'executing', { frame: -1 })).toEqual(frames[frames.length - 1]);
  });

  it('has something moving in the moods that mean work is happening', () => {
    for (const creature of BOOD) {
      for (const form of FORMS) {
        const frames = creatureFrames(creature.name, 'executing', form);
        expect(new Set(frames.map((rows) => rows.join('\n'))).size).toBeGreaterThan(1);
      }
    }
  });

  /**
   * A miss is drawn, not thrown.
   *
   * An unregistered name is a runtime miss, the same thing a missing component
   * registration is - and a blank space in the middle of an empty screen looks
   * like the screen is broken, so the answer is a creature.
   */
  it('draws something for a name nobody registered', () => {
    expect(drawCreature('wolpertinger')).toEqual(drawCreature('cat'));
    expect(creatureSize('wolpertinger')).toEqual(creatureSize('cat'));
  });
});

describe('the figure on screen', () => {
  async function mount(props: Partial<CreatureProps>, options: RenderOptions = {}) {
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'plain',
      ...options,
      onBoot: (app) => {
        app.components.register({ component: 'Creature', renderer: { kind: 'function', render: Creature } });
        app.screens.register({ id: 'home', component: { component: 'Creature', ...props } });
        app.screens.reset('home');
      },
    });
    await t.settle();
    return t;
  }

  it('renders every form, at either size, as the still it promised', async () => {
    for (const size of SIZES) {
      for (const form of FORMS) {
        const t = await mount({ name: 'cat', mood: 'executing', form, animated: false }, size);
        // Animation off, so what is on screen is frame zero.
        for (const row of drawCreature('cat', 'executing', { form })) {
          expect(t.hasText(row.trim())).toBe(true);
        }
        await t.unmount();
      }
    }
  });

  /**
   * That it moves, not which frame it landed on.
   *
   * `advance` is not the only clock: the app's animation driver also runs a
   * real 30fps interval, so a test that pinned an exact frame index would be
   * racing whatever else the machine was doing. What is worth asserting is
   * the thing that can actually break - a ticker that fires and paints
   * nothing, which no screenshot would catch.
   */
  it('moves through the cycle while the clock runs', async () => {
    const frames = creatureFrames('cat', 'executing', 'block');
    const faces = frames.map((rows) => rows[1] as string);
    const t = await mount({ name: 'cat', mood: 'executing', form: 'block' });

    const seen = new Set(faces.filter((face) => t.hasText(face)));
    for (let sample = 0; sample < frames.length * 2; sample += 1) {
      t.advance(250);
      await t.settle();
      for (const face of faces) if (t.hasText(face)) seen.add(face);
    }

    expect(seen).toEqual(new Set(faces));
    await t.unmount();
  });

  /**
   * A reader who asked for stillness gets frame zero, and keeps it.
   *
   * Twice over: the prop, and the runtime's own switch. The second is the one
   * worth having - `animations: false` is a session-wide answer, and a
   * component that only honoured its own prop would ignore it.
   */
  it('stays on the still when nothing is allowed to move', async () => {
    const asked: { animated: boolean; options: RenderOptions }[] = [
      { animated: false, options: {} },
      { animated: true, options: { animations: false } },
    ];
    for (const { animated, options } of asked) {
      const t = await mount({ name: 'cat', mood: 'executing', form: 'block', animated }, options);
      const still = (creatureFrames('cat', 'executing', 'block')[0] as string[])[1] as string;

      t.advance(5000);
      await t.settle();
      expect(t.hasText(still)).toBe(true);
      await t.unmount();
    }
  });
});
