import { describe, expect, it } from 'vitest';
import { renderApp } from '@textui/testing';
import type { RenderOptions } from '@textui/testing';
import {
  BOOD, BOUNDS, FORMS, GRIP, MOODS, Creature, WORLD, art, blit, carry, createBody,
  creatureFrames, creatureMotion, creatureSize, drawCreature, fill, getCreature, grab,
  livelyNames, metric, poseFrames, poseOf, registerCreature, release, slipped, stepBody,
} from '../src/view/bood/index.js';
import type {
  CreatureProps, CreatureSpec, Form, Mood, Motion, World,
} from '../src/view/bood/index.js';

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

/**
 * The half that moves, checked without drawing anything.
 *
 * All of this is arithmetic over a plain object, which is the point of keeping
 * `motion.ts` free of JSX: a body can be stepped for ten simulated minutes in
 * a millisecond, and every bug this shipped with was one that looks fine for
 * the first four seconds somebody watches it. A creature that walks into the
 * right-hand wall and falls asleep against it passes every screenshot.
 */

/** Seeded, so a failure is a failure rather than a bad afternoon. */
function dice(seed: number): () => number {
  let at = seed >>> 0;
  return () => {
    at = (at * 1664525 + 1013904223) >>> 0;
    return at / 0x100000000;
  };
}

const FIELD: World = { ...WORLD, floor: 9, left: 0, right: 60 };
const LIVELY = ['bunny', 'cat', 'owl'] as const;

/** One creature, one mood, run for `seconds` and told what it spent them doing. */
function live(name: string, mood: Mood, seconds: number, seed = 7) {
  const motion = creatureMotion(name);
  if (!motion) throw new Error(`${name} has no motion`);
  const body = createBody(30, FIELD.floor);
  const random = dice(seed);
  const poses: Record<string, number> = {};
  const facings: Record<string, number> = {};
  let left = 0;
  let right = 0;

  const ticks = Math.round(seconds * 12);
  for (let tick = 0; tick < ticks; tick += 1) {
    stepBody(body, motion, mood, FIELD, 1 / 12, random);
    const pose = poseOf(body, motion, mood);
    poses[pose] = (poses[pose] ?? 0) + 1;
    facings[body.facing] = (facings[body.facing] ?? 0) + 1;
    if (body.vx < -0.6) left += 1;
    if (body.vx > 0.6) right += 1;
  }
  return { body, poses, facings, left, right, ticks, share: (pose: string) => (poses[pose] ?? 0) / ticks };
}

describe('a creature with somewhere to be', () => {

  /**
   * A hand that never let go.
   *
   * A terminal reports a button going down and coming back up, and it reports
   * neither once the pointer has left the window - so letting go outside the
   * terminal is a release nothing downstream is ever told about. The runtime
   * gives the next press to the hit test rather than to whoever was holding
   * the pointer, so the handler that would put the creature down is never
   * called again: it hangs in the corner it was dragged to for the rest of
   * the session, and clicking elsewhere does not reach it. The grip times out
   * instead, and it wriggles free.
   */
  it('lets go when the release never arrives', () => {
    const motion = creatureMotion('cat') as Motion;
    const body = createBody(30, FIELD.floor);
    const grip = grab(body, 32, FIELD.floor);
    expect(body.held).toBe(true);

    carry(body, grip, 4, 1, FIELD, 40);
    expect(body.x).toBe(2);      // carried by the corner it was taken by
    expect(body.y).toBe(1);
    expect(slipped(body, grip)).toBe(false);

    // And then nothing at all, which is what the wire says about a release
    // that happened somewhere else.
    for (let tick = 0; tick < Math.ceil((GRIP + 0.5) * 12); tick += 1) {
      stepBody(body, motion, 'sad', FIELD, 1 / 12, dice(3));
      expect(body.held).toBe(true);   // the physics does not free it; the view does
    }
    expect(slipped(body, grip)).toBe(true);

    // Dropped rather than thrown: the samples are from a gesture that ended
    // seconds ago, so reading them would fling it along a stale swipe.
    release(body);
    expect(body.held).toBe(false);
    expect(body.vx).toBe(0);
    for (let tick = 0; tick < 24; tick += 1) stepBody(body, motion, 'sad', FIELD, 1 / 12, dice(3));
    expect(body.y).toBe(FIELD.floor);
  });

  /** Let go by hand, it keeps the hand's speed. */
  it('throws what was moving when it was released', () => {
    const body = createBody(30, FIELD.floor);
    const grip = grab(body, 30, FIELD.floor);
    carry(body, grip, 34, FIELD.floor, FIELD, 0);
    carry(body, grip, 42, FIELD.floor, FIELD, 200);
    release(body, grip);
    expect(body.vx).toBeGreaterThan(20);
    expect(body.held).toBe(false);
  });

  /**
   * Both ways, and this is the regression rather than a nicety.
   *
   * "When thinking, walk to the right" written as `dir = bias` sends it to the
   * right-hand wall, where the next target clamps onto its own position, it
   * arrives instantly, rests - and never moves again. It slept against that
   * wall for almost all of `thinking`, and the only symptom from the outside
   * was a mascot that had stopped.
   */
  it('goes both ways, in every mood that goes anywhere', () => {
    for (const name of LIVELY) {
      for (const mood of ['happy', 'thinking', 'executing'] as const) {
        const run = live(name, mood, 240);
        expect(run.left).toBeGreaterThan(0);
        expect(run.right).toBeGreaterThan(0);
      }
    }
  });

  /** A bias is a lean, not a command: it still goes left, just less often. */
  it('leans right while it is thinking, without only going right', () => {
    const run = live('cat', 'thinking', 480);
    expect(run.right).toBeGreaterThan(run.left);
    expect(run.left / run.right).toBeGreaterThan(0.1);
  });

  /**
   * Awake, mostly.
   *
   * One sleep threshold for every mood had `sad` - which dwells six seconds at
   * a time and barely travels - asleep two thirds of the time, so the drawing
   * that carries the mood almost never showed. The threshold is per mood now.
   */
  it('is not asleep in the moods that are meant to be doing something', () => {
    for (const name of LIVELY) {
      for (const mood of MOODS) {
        const run = live(name, mood, 240);
        expect(run.share('sleep')).toBeLessThan(0.35);
      }
    }
  });

  /** Rooted, and pinned to the one drawing that says so. */
  it('freezes when something has gone wrong, and faces you while it does', () => {
    for (const name of LIVELY) {
      const run = live(name, 'error', 60);
      expect(run.share('alarm')).toBe(1);
      expect(run.body.facing).toBe('front');
    }
  });

  /** At rest it turns and looks at you, which is most of what reads as alive. */
  it('comes back to front when it has been standing still', () => {
    const run = live('cat', 'sad', 240);
    expect((run.facings.front ?? 0) / run.ticks).toBeGreaterThan(0.5);
  });

  /**
   * The owl decides, and decides both ways.
   *
   * Flight used to be derived from already being airborne, so a grounded owl
   * could never start and a flying one could never stop: it flew for
   * ninety-nine ticks in a hundred and never once walked.
   */
  it('lets the owl choose between walking and flying, and it does both', () => {
    const run = live('owl', 'happy', 480);
    expect(run.share('fly')).toBeGreaterThan(0.05);
    expect(run.share('walk')).toBeGreaterThan(0.02);
  });

  /** A bunny cannot travel without leaving the ground, so it mostly is not on it. */
  it('makes the bunny hop rather than walk', () => {
    const run = live('bunny', 'executing', 120);
    expect(run.share('jump') + run.share('fall')).toBeGreaterThan(0.5);
    expect(run.share('walk')).toBeLessThan(0.2);
  });

  /**
   * Latched, because a hopping bunny is airborne for almost all of the time it
   * is travelling - so the instant velocity is a fact about a body in flight
   * rather than about which way the animal is pointed.
   */
  it('keeps a facing through the whole of a hop', () => {
    const motion = creatureMotion('bunny');
    const body = createBody(10, FIELD.floor);
    body.intent = { kind: 'goto', x: 50, until: 999 };
    const random = dice(3);

    let airborneWithFacing = 0;
    for (let tick = 0; tick < 200; tick += 1) {
      stepBody(body, motion as never, 'happy', FIELD, 1 / 12, random);
      if (!body.grounded && body.facing === 'right') airborneWithFacing += 1;
    }
    expect(airborneWithFacing).toBeGreaterThan(20);
  });

  /** Held beats airborne beats landing beats walking, and the order is the code. */
  it('reads the pose off the physics, in that order', () => {
    const motion = creatureMotion('cat');
    const body = createBody(10, 9);
    expect(poseOf(body, motion as never, 'happy')).toBe('idle');

    body.sitting = true;
    expect(poseOf(body, motion as never, 'happy')).toBe('sit');

    body.vx = 4;
    expect(poseOf(body, motion as never, 'happy')).toBe('walk');

    body.landFor = 0.1;
    expect(poseOf(body, motion as never, 'happy')).toBe('land');

    body.grounded = false;
    body.vy = -3;
    expect(poseOf(body, motion as never, 'happy')).toBe('jump');

    body.held = true;
    expect(poseOf(body, motion as never, 'happy')).toBe('held');
  });
});

describe('the art that moves', () => {
  /**
   * A slot is exactly as wide as what fills it.
   *
   * A `%` run one cell wider than the face draws a rabbit with a column of its
   * own head missing - and only in the moods whose token is short, so looking
   * at the happy one proves nothing. `registerCreature` settles it, and this
   * is the shipped art actually complying.
   */
  it('writes every slot at the width of the token that fills it', () => {
    for (const name of LIVELY) {
      const motion = creatureMotion(name);
      const faces = new Set(MOODS.map((mood) => (motion as never as Motion).faces[mood].length));
      const tells = new Set(MOODS.map((mood) => (motion as never as Motion).tells[mood].length));
      expect(faces.size).toBe(1);
      expect(tells.size).toBe(1);

      for (const frames of Object.values((motion as never as { poses: Record<string, string[][]> }).poses)) {
        for (const rows of frames) {
          for (const row of rows) {
            for (const run of row.match(/%+/g) ?? []) expect(run.length).toBe([...faces][0]);
            for (const run of row.match(/#+/g) ?? []) expect(run.length).toBe([...tells][0]);
            expect(row).toMatch(/^[\x20-\x7e]*$/);
          }
        }
      }
    }
  });

  it('refuses a slot the mood cannot fill, and says which pose', () => {
    const spec = specFor('slotty');
    spec.motion = {
      ...(creatureMotion('cat') as never as Motion),
      poses: { 'idle.front': art`(%%%%)` },
      overrides: {},
    };
    expect(() => registerCreature(spec)).toThrow(/creature "slotty" motion\/idle.front: a 4-cell face slot/);
  });

  /**
   * The chain, not the first hit.
   *
   * A pose a species has no side view of falls through to its front one. The
   * owl's glide is deliberately front-only, because a bird planing is not
   * pointed anywhere in particular.
   */
  it('falls through to the front view rather than drawing nothing', () => {
    const front = poseFrames('owl', 'fall', 'front', 'happy');
    expect(poseFrames('owl', 'fall', 'left', 'happy')).toBe(front);
    expect(poseFrames('owl', 'fall', 'right', 'happy')).toBe(front);
    expect(poseFrames('owl', 'fly', 'left', 'happy')).not.toBe(front);
  });

  /** A mood may change the outline, which no face token can do. */
  it('lets a mood override a whole pose, and only that mood', () => {
    const working = poseFrames('cat', 'idle', 'right', 'executing') as string[][];
    const resting = poseFrames('cat', 'idle', 'right', 'happy') as string[][];
    expect(working).not.toEqual(resting);
    expect((working[0] as string[]).join('\n')).toContain('@');
    expect(poseFrames('bunny', 'idle', 'right', 'executing')).toEqual(poseFrames('bunny', 'idle', 'right', 'happy'));
  });

  /** Nobody drew the crab a walk cycle, and the crab is not broken. */
  it('leaves a creature that was never drawn moving without motion', () => {
    expect(livelyNames()).toEqual(['cat', 'bunny', 'owl']);
    expect(creatureMotion('crab')).toBeUndefined();
    expect(poseFrames('crab', 'walk', 'right', 'happy')).toBeUndefined();
  });

  /**
   * The feet own the y, and the face owns the x.
   *
   * Bottom-aligned because the landing squash is a row shorter than the stand,
   * and padding underneath sinks the creature through the floor at exactly the
   * moment it hits it. Anchored on the face because a cat turning side-on is
   * twice as wide with its head at the far end.
   */
  it('places a figure by its feet and its face, not by its corner', () => {
    const field = ['.....', '.....', '.....'];
    expect(blit(field, ['ab', 'cd'], 2, 2, 0)).toEqual(['.....', '..ab.', '..cd.']);
    // One row shorter, same y: it settles onto the floor rather than lifting.
    expect(blit(field, ['ab'], 2, 2, 0)).toEqual(['.....', '.....', '..ab.']);
    // Anchored one in: the same x puts the second column where the first was.
    expect(blit(field, ['ab'], 2, 2, 1)).toEqual(['.....', '.....', '.ab..']);
    // Off the edge is dropped, not wrapped onto the far side.
    expect(blit(field, ['abcd'], 4, 2, 0)).toEqual(['.....', '.....', '....a']);
  });

  it('fills a slot without moving a column', () => {
    expect(fill(['( %%% )', '(#)'], '^.^', '~')).toEqual(['( ^.^ )', '(~)']);
    expect(metric(['  %%%  ', 'aaaaaaa']).anchor).toBe(3);
    expect(metric(['aaaa']).anchor).toBe(2);
  });
});

describe('the figure that moves on screen', () => {
  async function live(props: Partial<CreatureProps>) {
    const t = await renderApp({
      width: 100,
      height: 30,
      shell: 'plain',
      onBoot: (app) => {
        app.components.register({ component: 'Creature', renderer: { kind: 'function', render: Creature } });
        app.screens.register({ id: 'home', component: { component: 'Creature', lively: true, ...props } });
        app.screens.reset('home');
      },
    });
    await t.settle();
    return t;
  }

  /** Which column the figure is standing in, whatever it is standing in it as. */
  function at(lines: string[]): number {
    const drawn = lines.map((row) => row.search(/\S/)).filter((col) => col >= 0);
    return drawn.length ? Math.min(...drawn) : -1;
  }

  it('gives the creature a field, and it does not stay where it was put', async () => {
    const t = await live({ name: 'cat', mood: 'executing', fieldWidth: 60, fieldHeight: 10 });
    const start = at(t.lines());
    expect(start).toBeGreaterThanOrEqual(0);

    const seen = new Set<number>();
    for (let sample = 0; sample < 40; sample += 1) {
      t.advance(120);
      await t.settle();
      seen.add(at(t.lines()));
    }
    expect(seen.size).toBeGreaterThan(1);
    await t.unmount();
  });

  /** Which row the figure is drawn on, and which column it starts at. */
  function where(lines: string[]): { row: number; col: number } {
    for (let row = 0; row < lines.length; row += 1) {
      const col = (lines[row] as string).search(/\S/);
      if (col >= 0) return { row, col };
    }
    return { row: -1, col: -1 };
  }

  /**
   * Called, not moved.
   *
   * A press on the field is somewhere to go rather than somewhere to be: the
   * brain is told and the body walks there in its own gait, which is the whole
   * difference between a creature and a cursor.
   */
  it('walks to where the field was clicked', async () => {
    // A mood that barely wanders, so what is measured is the call and not a
    // cat that had somewhere else to be.
    const t = await live({ name: 'cat', mood: 'sad', fieldWidth: 60, fieldHeight: 10 });
    const start = where(t.lines());
    expect(start.col).toBeGreaterThanOrEqual(0);

    // Well to the right of wherever it is standing, on a row it occupies.
    // Judged by whether the gap closed rather than by where it ended up: the
    // creature has a will of its own and the assertion is that being called
    // moves it, not that it is obedient for ever.
    const target = Math.min(52, start.col + 24);
    t.click(target, start.row);

    // Judged by which way it turns to go, not by a column: a walking cat is
    // side-on and twice as wide, so its leftmost cell moves for reasons that
    // have nothing to do with where it is.
    let facedRight = false;
    for (let sample = 0; sample < 20 && !facedRight; sample += 1) {
      t.advance(120);
      await t.settle();
      facedRight = t.hasText('( =T.T)');
    }
    expect(facedRight).toBe(true);
    await t.unmount();
  });

  /**
   * Picked up, carried, and put down somewhere else.
   *
   * The press claims the gesture, so the rest of it arrives here wherever the
   * pointer goes - which is what lets the figure be dragged off its own box
   * rather than being dropped the moment it leaves.
   */
  it('can be picked up and carried', async () => {
    const t = await live({ name: 'cat', mood: 'sad', fieldWidth: 60, fieldHeight: 10 });
    const start = where(t.lines());

    const grab: [number, number] = [start.col + 3, start.row + 1];
    t.drag(grab, [grab[0] + 10, grab[1]], [grab[0] + 20, grab[1] - 2], [grab[0] + 24, grab[1] - 3]);
    await t.settle();

    const carried = where(t.lines());
    expect(carried.col).toBeGreaterThan(start.col + 12);
    expect(carried.row).toBeLessThan(start.row);
    await t.unmount();
  });

  /**
   * The same gesture, missing its ending, through the real decoder.
   *
   * `t.drag` always releases, so the case that broke - a press, a carry, and
   * then silence - has to be fed as bytes: `CSI < 0 ; x ; y M` is the button
   * going down, `CSI < 32 ; x ; y M` is the pointer carrying it, and nothing
   * follows, because the button came up outside the terminal.
   */
  it('lets go of a drag that was never released', async () => {
    const t = await live({ name: 'cat', mood: 'sad', fieldWidth: 60, fieldHeight: 10 });
    const start = where(t.lines());

    t.feed(`\u001b[<0;${start.col + 4};${start.row + 2}M`);
    t.feed('\u001b[<32;6;1M');
    await t.settle();
    expect(where(t.lines()).row).toBe(0);

    for (let sample = 0; sample < 50; sample += 1) {
      t.advance(120);
      await t.settle();
    }
    // Back on the ground it was carried off, rather than pinned to the corner.
    expect(where(t.lines()).row).toBeGreaterThan(2);
    await t.unmount();
  });

  /**
   * A creature nobody drew moving keeps the still it always had.
   *
   * Worse than not moving would be a figure jittering in place in a ten-row
   * box, so `lively` on a creature with no motion is simply the old drawing.
   */
  it('draws the still for a creature that was never drawn moving', async () => {
    const t = await live({ name: 'crab', mood: 'happy' });
    for (const row of drawCreature('crab', 'happy')) expect(t.hasText(row.trim())).toBe(true);
    await t.unmount();
  });

  /** The runtime's own switch still wins, the same way it does for the still. */
  it('stands still when the runtime has said no to animation', async () => {
    const t = await renderApp({
      width: 100, height: 30, shell: 'plain', animations: false,
      onBoot: (app) => {
        app.components.register({ component: 'Creature', renderer: { kind: 'function', render: Creature } });
        app.screens.register({ id: 'home', component: { component: 'Creature', name: 'bunny', lively: true } });
        app.screens.reset('home');
      },
    });
    await t.settle();
    const before = t.text();
    t.advance(5000);
    await t.settle();
    expect(t.text()).toBe(before);
    await t.unmount();
  });
});
