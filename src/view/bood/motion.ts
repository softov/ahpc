import type { Facing, Mood, Motion, Pose } from './types.js';

/**
 * The moving part, in numbers.
 *
 * No JSX and no TextUI import, on purpose. Everything here is arithmetic over
 * a plain object, which means it can be stepped ten thousand times in a test
 * with nothing drawn - and three of the bugs this shipped with were only ever
 * going to be found that way. A creature that walks into the right-hand wall
 * and falls asleep there looks fine for the first four seconds somebody
 * watches it.
 *
 * The layering is one direction and does not bend: mood decides intent, intent
 * and the world decide the physics, and the pose is a pure read of the physics
 * afterwards. Nothing downstream reaches back.
 */

/** Cells and seconds, everywhere. The terminal's cell is the unit of length. */
export interface World {
  gravity: number;
  /** How fast a grounded creature reaches the speed it wants. */
  grip: number;
  /** What the air takes off horizontal speed once the ground is gone. */
  air: number;
  /** The row the feet rest on. */
  floor: number;
  left: number;
  right: number;
}

export const WORLD: World = { gravity: 90, grip: 8, air: 0.4, floor: 0, left: 0, right: 0 };

const WALK_BASE = 7;       /** cells a second at 1x */
const HOP_IMPULSE = 26;    /** cells a second, upward */
const TAKEOFF = 17;
const STRIDE = 2.2;        /** cells per walk frame */
const HARD_LANDING = 26;
const FACE_FRONT_AFTER = 1.9;
const FLY_FAR = 14;        /** far enough that flying is worth the take-off */
const WALKING = 0.6;       /** below this it is standing, whatever vx says */

/**
 * A mood is not a behaviour. It is a set of dials on one behaviour loop.
 *
 * `bias` is a weight and not a command, which is the correction worth writing
 * down: "when thinking, walk to the right" coded as `dir = bias` sends the
 * creature to the right-hand wall, where the next target clamps onto its own
 * position, it arrives instantly, rests, and stops moving for good. Almost all
 * of `thinking` was spent asleep against a wall.
 *
 * `sleep` is per mood for the same class of reason: one threshold meant `sad`,
 * which dwells for six seconds at a time and barely travels, was asleep two
 * thirds of the time and its drawing almost never showed.
 */
export interface Gait {
  /** Odds a decision is a trip rather than a rest. */
  wander: number;
  speed: number;
  dwell: [number, number];
  /** Odds a second of walking turns into a jump. */
  jump: number;
  sit: number;
  /** How far a trip goes, as a fraction of the field. */
  reach: number;
  bias: -1 | 0 | 1;
  biasWeight: number;
  /** Odds a flier takes off for a trip it could have walked. */
  fly: number;
  /** Seconds of stillness before it sleeps. Infinity never does. */
  sleep: number;
  /** Wall to wall, rather than a wander. */
  patrol?: boolean;
  /** Violent and going nowhere: it shakes on the spot instead of resting. */
  jitter?: boolean;
  /** Rooted. Wander is zero, so intent never leaves rest. */
  freeze?: boolean;
}

export const GAITS: Record<Mood, Gait> = {
  happy: { wander: 0.5, speed: 0.75, dwell: [1.2, 3], jump: 0.15, sit: 0.35, reach: 0.3, bias: 0, biasWeight: 0.75, fly: 0.35, sleep: 30 },
  thinking: { wander: 0.8, speed: 0.45, dwell: [0.9, 1.8], jump: 0.02, sit: 0.1, reach: 0.22, bias: 1, biasWeight: 0.75, fly: 0.25, sleep: 45 },
  executing: { wander: 1, speed: 1.4, dwell: [0.2, 0.6], jump: 0.28, sit: 0, reach: 0.9, bias: 0, biasWeight: 0.75, fly: 0.55, sleep: Infinity, patrol: true },
  sad: { wander: 0.06, speed: 0.3, dwell: [3, 6], jump: 0, sit: 0.9, reach: 0.1, bias: 0, biasWeight: 0.75, fly: 0, sleep: 90 },
  error: { wander: 0, speed: 0, dwell: [2, 4], jump: 0, sit: 0, reach: 0, bias: 0, biasWeight: 0.75, fly: 0, sleep: Infinity, freeze: true },
};

/** What the brain wants. The only thing it is allowed to set. */
export interface Intent {
  kind: 'rest' | 'goto';
  x: number;
  until: number;
}

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  grounded: boolean;
  held: boolean;
  sitting: boolean;
  /** Gravity is suspended this tick. Only ever true for a flier with a trip on. */
  flying: boolean;
  /** Decided once per trip, at intent time - never per tick, or it flickers. */
  wantsFlight: boolean;
  intent: Intent;
  /** Seconds left of the landing squash. */
  landFor: number;
  /** Seconds it has been standing still, which is what sleep reads. */
  stillFor: number;
  /** Cells travelled, which is what the walk cycle reads. */
  dist: number;
  hopCool: number;
  /**
   * Airborne because it took a stride, rather than because it is falling.
   *
   * Only a flier reads this, and only to tell its two ways of being off the
   * ground apart: a bird that hops along the floor is walking, and drawing it
   * with its wings spread reads as an owl that has fallen off something.
   */
  hopping: boolean;
  frontIn: number;
  /** Seconds since the body was made, so nothing here needs a wall clock. */
  now: number;
}

export function createBody(x = 0, y = 0): Body {
  return {
    x, y, vx: 0, vy: 0, facing: 'front',
    grounded: true, held: false, sitting: false, flying: false, wantsFlight: false,
    intent: { kind: 'rest', x, until: 0 },
    landFor: 0, stillFor: 0, dist: 0, hopCool: 0, hopping: false, frontIn: 0, now: 0,
  };
}

/** What just happened to it, for a caller that wants to say so. */
export type Event = 'landed' | 'bounced' | 'hard' | 'wall' | 'took off';

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const sign = (v: number): number => (v < 0 ? -1 : v > 0 ? 1 : 0);

/**
 * Pick something to do. The brain's whole vocabulary is rest and goto.
 *
 * A target that clamps to within a stride of where the creature already is is
 * not a trip - it turns round rather than arriving instantly, because the
 * arrival is what resets the dwell and starts the walk to sleep.
 */
export function decide(body: Body, motion: Motion, mood: Mood, world: World, random = Math.random): void {
  const gait = GAITS[mood];
  const span = world.right - world.left;

  if (gait.freeze) {
    body.intent = { kind: 'rest', x: body.x, until: body.now + 1.5 };
    body.sitting = false;
    return;
  }

  const rest = (): void => {
    body.intent = { kind: 'rest', x: body.x, until: body.now + gait.dwell[0] + random() * (gait.dwell[1] - gait.dwell[0]) };
    body.sitting = motion.sits && random() < gait.sit;
  };

  if (random() > gait.wander) { rest(); return; }

  let target: number;
  if (gait.patrol) {
    target = body.x < (world.left + world.right) / 2 ? world.right : world.left;
  } else {
    const dir = gait.bias ? (random() < gait.biasWeight ? gait.bias : -gait.bias) : (random() < 0.5 ? -1 : 1);
    target = clamp(body.x + dir * (4 + random() * gait.reach * span), world.left, world.right);
    if (Math.abs(target - body.x) < 2.5) target = clamp(body.x - dir * (6 + random() * 12), world.left, world.right);
  }
  if (Math.abs(target - body.x) < 2.5) { rest(); return; }

  body.wantsFlight = motion.flies && (random() < gait.fly || (Math.abs(target - body.x) > FLY_FAR && random() < 0.7));
  body.intent = { kind: 'goto', x: target, until: body.now + gait.dwell[0] + random() * (gait.dwell[1] - gait.dwell[0]) + 3.5 };
  body.sitting = false;
  body.stillFor = 0;
}

/**
 * One tick. Fixed `dt`, because a physics step that takes whatever the render
 * loop gave it is a physics step that behaves differently on a busy machine.
 */
export function stepBody(
  body: Body, motion: Motion, mood: Mood, world: World, dt: number, random = Math.random,
): Event | undefined {
  const gait = GAITS[mood];
  let happened: Event | undefined;

  body.now += dt;
  if (body.landFor > 0) body.landFor -= dt;
  if (body.hopCool > 0) body.hopCool -= dt;

  if (body.now > body.intent.until) decide(body, motion, mood, world, random);
  if (body.intent.kind === 'goto' && Math.abs(body.intent.x - body.x) < 1.4) {
    body.intent = { kind: 'rest', x: body.x, until: body.now + gait.dwell[0] };
    body.sitting = motion.sits && random() < gait.sit;
    body.wantsFlight = false;
  }

  if (body.held) {
    body.grounded = false;
    body.flying = false;
    body.hopping = false;
    body.stillFor = 0;
    return undefined;
  }

  let want = 0;
  if (body.intent.kind === 'goto') want = sign(body.intent.x - body.x) * WALK_BASE * gait.speed;
  if (gait.jitter && body.intent.kind === 'rest') want = Math.sin(body.now * 14) * 2.5;

  // The only place a species decides to leave the ground for something other
  // than a stride. Flight is not a pose, it is a suspended gravity term.
  if (motion.flies && body.wantsFlight && body.intent.kind === 'goto' && body.grounded) {
    body.vy = -TAKEOFF;
    body.grounded = false;
    body.hopping = false;
    happened = 'took off';
  }
  body.flying = motion.flies && body.wantsFlight && !body.grounded && body.intent.kind === 'goto' && !gait.freeze;

  if (body.flying) {
    const hover = world.floor - 5;
    body.vy += (hover - body.y) * 7 * dt;
    body.vy -= body.vy * 5 * dt;
    body.vx += (want - body.vx) * 4 * dt;
  } else if (!body.grounded) {
    body.vy += world.gravity * motion.fallSpeed * dt;
    if (motion.flies && body.vy > 5) body.vy = 5;      // wings out, gliding
    body.vx -= body.vx * world.air * dt;
  } else if (motion.gait === 'hop' && Math.abs(want) > 0.5) {
    if (body.hopCool <= 0) {
      body.vy = -HOP_IMPULSE * motion.hop * (0.6 + 0.4 * gait.speed);
      body.vx = want;
      body.grounded = false;
      body.hopping = true;
      body.hopCool = 0.12;
    }
  } else {
    body.vx += (want - body.vx) * world.grip * dt;
    if (Math.abs(want) < 0.1) body.vx -= body.vx * world.grip * dt;
    if (random() < gait.jump * dt) { body.vy = -HOP_IMPULSE * 0.7; body.grounded = false; }
  }

  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.dist += Math.abs(body.vx) * dt;

  // Latched, not read off vx. A bunny is airborne for almost all of the time
  // it is travelling, so the instant velocity is a fact about a body in flight
  // rather than about which way the animal is pointed.
  if (body.vx > 0.8) { body.facing = 'right'; body.frontIn = FACE_FRONT_AFTER; }
  else if (body.vx < -0.8) { body.facing = 'left'; body.frontIn = FACE_FRONT_AFTER; }
  else if (body.grounded) { body.frontIn -= dt; if (body.frontIn <= 0) body.facing = 'front'; }

  if (body.x < world.left) { body.x = world.left; body.vx = Math.abs(body.vx) * 0.4; decide(body, motion, mood, world, random); happened ??= 'wall'; }
  if (body.x > world.right) { body.x = world.right; body.vx = -Math.abs(body.vx) * 0.4; decide(body, motion, mood, world, random); happened ??= 'wall'; }
  if (body.y < 0) { body.y = 0; body.vy = Math.max(0, body.vy); }

  if (body.y >= world.floor) {
    const impact = body.vy;
    body.y = world.floor;
    if (!body.grounded) {
      body.landFor = 0.18;
      happened = 'landed';
      if (impact > HARD_LANDING) {
        happened = 'hard';
        if (motion.bounce > 0) { body.vy = -impact * motion.bounce; body.grounded = false; return 'bounced'; }
      }
    }
    body.grounded = true;
    body.hopping = false;
    body.vy = 0;
  } else if (body.grounded && body.vy !== 0) body.grounded = false;

  if (Math.abs(body.vx) < 0.4 && body.grounded) body.stillFor += dt; else body.stillFor = 0;
  return happened;
}

/**
 * A pure read of the physics, and the order is a priority order.
 *
 * Held beats airborne beats having just landed beats wanting to walk. Every
 * one of those is a question somebody would otherwise answer with a boolean
 * kept somewhere else, and get wrong the first time two of them were true.
 */
export function poseOf(body: Body, motion: Motion, mood: Mood): Pose {
  if (body.held) return 'held';
  if (!body.grounded) {
    if (body.flying) return 'fly';
    if (motion.flies) return body.hopping ? 'walk' : 'fall';   // hop, or the glide
    return body.vy < 0 ? 'jump' : 'fall';
  }
  if (body.landFor > 0) return 'land';
  if (Math.abs(body.vx) > WALKING) return 'walk';
  if (body.stillFor > GAITS[mood].sleep) return 'sleep';
  if (mood === 'error') return 'alarm';
  if (body.sitting) return 'sit';
  return 'idle';
}

/**
 * Which frame of the cycle, which is not one clock but three.
 *
 * Feet advance with distance, because a walk cycle on a timer moonwalks the
 * moment the creature slows down. A flap is on the clock, because deriving it
 * from `vy` pins a hovering owl to one wing position. Everything else idles.
 */
export function frameOf(pose: Pose, body: Body, count: number): number {
  if (count <= 1) return 0;
  if (pose === 'walk') return Math.floor(body.dist / STRIDE) % count;
  if (pose === 'fly') return Math.floor(body.now * 6) % count;
  return Math.floor(body.now * 2.2) % count;
}

/** A restful pose blinks, whatever mood it is in. */
export function faceOf(pose: Pose, body: Body, motion: Motion, mood: Mood): string {
  const restful = pose === 'idle' || pose === 'sit';
  if (restful && Math.floor(body.now * 2.5) % 5 === 4) return motion.blink;
  return motion.faces[mood];
}
