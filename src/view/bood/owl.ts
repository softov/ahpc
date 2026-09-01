import { alternate, art, blink } from './art.js';
import { defineCreature } from './types.js';

/**
 * An owl. A comma for a beak, which is the only reason the face fits in three
 * cells at every size.
 *
 * Angry is the one figure here that changes shape rather than expression - it
 * opens its wings - and it is worth the extra rows, because an owl that is
 * only scowling reads as an owl that is concentrating.
 */
export const owl = defineCreature({
  name: 'owl',
  label: 'Owl',
  about: 'Has read the logs already',

  draw: {
    happy: [art`
 ,___,
 (^,^)
 /)_)
  " "
`, art`
  ,___,
  (-,-)
  /)_)
   " "
`, art`
  ,___,
  (^,^)
   (_(\
   " "
`, art`
 ,___,
 (-,-)
  (_(\
  " "
`],
    sad: art`
 ,___,
 (T,T)
 /)_)
  " "
`,
    thinking: alternate(art`
 ,___,  o
 (o,o)
 /)_)
  " "
`, art`
 ,___,  .
 (o,o)
 /)_)
  " "
`),
    executing: [art`
 ,___,
 (o,o)
 /)_)
  " "
`, art`
 ,___,
 (o,-)
 /)_)
  " "
`, art`
 ,___,
 (-,o)
 /)_)
  " "
`],
    error: art`
  ,___,
  (>,<)
 /(___)\
   v v
`,
  },

  block: {
    happy: blink(art`
,___,
(^,^)
 )_)
`, art`
,___,
(-,-)
 )_)
`),
    sad: art`
,___,
(T,T)
 )_)
`,
    thinking: art`
,___,
(-,o)
 )_)
`,
    executing: [art`
,___,
(o,o)
 )_)
`, art`
,___,
(o,-)
 )_)
`, art`
,___,
(-,o)
 )_)
`],
    error: art`
,___,
(>,<)
/(_)\
`,
  },

  inline: {
    happy: blink(art`,(^,^),`, art`,(-,-),`),
    sad: art`v(T,T)v`,
    thinking: art`,(-,o),`,
    executing: [art`,(o,o),`, art`,(o,-),`, art`,(-,o),`],
    error: art`\(>,<)/`,
  },

  /**
   * Moving, and it is the one that gets to choose.
   *
   * Flight is not a pose here, it is a suspended gravity term - and something
   * the creature decides once per trip, at intent time, never per tick. A roll
   * against the mood's `fly` dial, plus a lean toward flying when the
   * destination is far enough to be worth the take-off. Decided per tick it
   * would flicker between walking and flying inside one journey.
   *
   * The flap is three frames on a clock rather than two derived from `vy`,
   * because a hover controller keeps `vy` near zero and would pin a circling
   * owl to one wing position. The glide has no left or right view on purpose:
   * a bird planing is not pointed anywhere in particular, and the lookup chain
   * falls through to the front one.
   */
  motion: {
    gait: 'hop',
    flies: true,
    sits: true,
    bounce: 0,
    fallSpeed: 0.25,
    hop: 0.45,
    blink: '-,-',
    faces: { happy: '^,^', sad: 'T,T', thinking: '-,o', executing: 'o,o', error: '>,<' },
    tells: { happy: ',___,', sad: 'v___v', thinking: ',___,', executing: ',___,', error: '/___\\' },
    poses: {
      'idle.front': art`
  #####
  (%%%)
  /)_)
   " "
`,
      'idle.right': art`
  #####
  (%%%)
  /)_)
   " "
`,
      'idle.left': art`
  #####
  (%%%)
  (_(\
   " "
`,
      'sit.front': art`
  #####
  (%%%)
  /)_)
   " "
`,
      'walk.right': art`
  #####
  (%%%)
  /)_)
   ^ ^
`,
      'walk.left': art`
  #####
  (%%%)
  (_(\
   ^ ^
`,
      'fly.front': [art`
   #####
  \(%%%)/
   (   )
    " "
`, art`
   #####
 __(%%%)__
   (   )
    " "
`, art`
   #####
   (%%%)
  /(   )\
    " "
`],
      'fly.left': [art`
   #####
  \%%% )///
   (   ---
    " "
`, art`
   #####
  _%%% )___
   (    --
    " "
`, art`
   #####
   %%% )_
  /(   \\\
    " "
`],
      'fly.right': [art`
   #####
\\\( %%%/
 \--   )
    " "
`, art`
   #####
 __( %%%_
 --    )
    " "
`, art`
   #####
  _( %%%
 ///   )\
    " "
`],
      jump: art`
  #####
 \(%%%)/
   )_(
`,
      // The glide, which is also what a dropped owl does instead of falling.
      fall: art`
  #####
 -(%%%)-
   )_(
`,
      land: art`
  #####
  (%%%)
  /)_)
`,
      held: art`
  #####
  (%%%)
  /) (\
   " "
`,
      sleep: art`
  ,___,
  (-,-)
  /)_)
   " "
`,
      // The one figure that changes shape rather than expression: an owl that
      // is only scowling reads as an owl that is concentrating.
      alarm: art`
  #####
 \(%%%)/
 /(___)\
   v v
`,
    },
  },
});
