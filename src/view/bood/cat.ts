import { alternate, art, blink } from './art.js';
import { defineCreature } from './types.js';

/**
 * A cat, in three sizes.
 *
 * The tail is what carries the mood at full size after the face does: up and
 * curled when things are well, flat when they are not, swishing while there is
 * work going on. Which is a second carrier of the same meaning, and that is the
 * point - a 16-colour session and a piped log both keep the tail.
 */
export const cat = defineCreature({
  name: 'cat',
  label: 'Cat',
  about: 'Sits on whatever you were reading',

  draw: {
    happy: blink(art`
 /\_/\
( ^.^ )
 > ^ <
(_____)~
`, art`
 /\_/\
( -.- )
 > ^ <
(_____)~
`),
    sad: art`
 /\_/\
( T.T )
 > _ <
(_____)_
`,
    // The bubble arrives rather than sitting there, which is the difference
    // between a cat that is thinking and a cat with a mole.
    thinking: alternate(art`
 /\_/\  o
( -.o )
 > - <
(_____)~
`, art`
 /\_/\  .
( -.o )
 > - <
(_____)~
`),
    executing: [art`
 /\_/\
( o.o )
 > - <
(_____)~
`, art`
 /\_/\
( o.- )
 > - <
(_____)~
`, art`
 /\_/\
( -.o )
 > - <
(_____)/
`],
    error: art`
 /\_/\
( >.< )
 >WWW<
(_____)/
`,
  },

  block: {
    happy: blink(art`
/\_/\
(^.^)
(___)
`, art`
/\_/\
(-.-)
(___)
`),
    sad: art`
/\_/\
(T.T)
(___)
`,
    thinking: art`
/\_/\
(-.o)
(___)
`,
    executing: [art`
/\_/\
(o.o)
(___)
`, art`
/\_/\
(o.-)
(___)
`, art`
/\_/\
(-.o)
(___)
`],
    error: art`
/\_/\
(>.<)
(/W\)
`,
  },

  inline: {
    happy: blink(art`(=^.^=)`, art`(=-.-=)`),
    sad: art`(_T.T_)`,
    thinking: art`(=-.o=)`,
    executing: [art`(=o.o=)`, art`(=o.-=)`, art`(=-.o=)`],
    error: art`(/>.<\)`,
  },

  /**
   * Moving, and it is the only one whose silhouette changes size.
   *
   * A cat seen from the side really is twice as long as a cat seen from the
   * front, so the walk is nineteen cells where the stand is eight, with the
   * head at whichever end it is going. That only works because a figure is
   * placed by the middle of its face slot rather than by its left edge: the
   * body swings round a head that stays put, which is what turning round looks
   * like. Anchored on the corner it would jump ten cells every time it turned.
   *
   * The ears in the working drawing are `/\_/\` here and an ellipsis in the
   * reference sheet. U+2026 is East Asian Ambiguous, so that cat is two cells
   * wider under a CJK font and the paws stop lining up under the head.
   */
  motion: {
    gait: 'walk',
    flies: false,
    sits: true,
    bounce: 0,
    fallSpeed: 1,
    hop: 0,
    blink: '-.-',
    faces: { happy: '^.^', sad: 'T.T', thinking: '-.o', executing: 'o.o', error: '>.<' },
    tells: { happy: '~', sad: '_', thinking: '~', executing: '~', error: '/' },
    poses: {
      // The tail changes sides while it waits, which is the whole idle.
      'idle.front': [art`
  /\_/\
 ( %%% )
  > ^ <
#(,, ,,)
`, art`
  /\_/\
 ( %%% )
  > ^ <
 (,, ,,)#
`],
      'sit.front': art`
  /\_/\
 (=%%%=)
 (,, ,,)#
`,
      'idle.right': art`
   /\_/\
  (  %%%)
   ) >^<
  /  || \
#(,(,)(,))
`,
      'idle.left': art`
  /\_/\
 (%%%  )
  >^< (
 / ||  \
((,)(,),)#
`,
      'sit.right': art`
   /\_/\
  (  %%%)
   ) >^<
  /  || \
#(,(,)(,))
`,
      'sit.left': art`
  /\_/\
 (%%%  )
  >^< (
 / ||  \
((,)(,),)#
`,
      'walk.right': [art`
   n
  //       /\_/\
 ((_______( =%%%)
 |  _        >^<
  \ |-----| |-(
  |,),)   (,)(,)
`, art`
  n
 ||        /\_/\
 ((_______( =%%%)
  \          >^<
  | |-----/ /-\
  (,),)  (,) (,)
`, art`
 n
 \\        /\_/\
 |(_______( =%%%)
 \           >^<
 | ) -----\ \-/
 (,),)     (,))
`],
      'walk.left': [art`
                n
  /\_/\        //
 (%%%= )______/ |
  >^<       _   /
   \-/ /---- /\ \
   {{,}     {,}{,}
`, art`
              n
  /\_/\       \\
 (%%%= ) ______))
  >^<       _   |
   /-\ \- --/ / \
  {,} {,}  {,} {,}
`],
      jump: art`
  /\_/\
 ( %%% )
  > ^ <
  (___)#
   ) (
`,
      fall: art`
  /\_/\
 ( %%% )
  > ^ <
 (,, ,,)#
  /   \
`,
      land: art`
  /\_/\
 ( %%% )
 (,,_,,)#
`,
      held: art`
  /\_/\
 ( %%% )
  > ^ <
  (___)#
   ) (
   " "
`,
      sleep: art`
  /\_/\
 ( -.- )
 (,,_,,)#
`,
      alarm: art`
  /\_/\
 ( %%% )
  >WWW<
 (/___\)#
`,
    },

    /**
     * The escape hatch the face slot cannot cover.
     *
     * A working cat is at a keyboard, which is a different outline rather than
     * a different expression - no substitution into the standing drawing gets
     * there. It bobs its head one cell between the two frames, which is why
     * the anchor is taken from frame zero and shared: per-frame it would hold
     * the head still and slide the desk instead.
     */
    overrides: {
      executing: {
        'idle.front': [art`
  n      /\_/\
 //_____(=%%%=)
((/  )_    >^<
\_(__,,)_(_c@c_)
`, art`
n         /\_/\
\\  _____(=%%%=)
||/  )_    >u<
\_(____)_(_c@c_)
`],
        'idle.right': [art`
  n      /\_/\
 //_____(=%%%=)
((/  )_    >^<
\_(__,,)_(_c@c_)
`, art`
n         /\_/\
\\  _____(=%%%=)
||/  )_    >u<
\_(____)_(_c@c_)
`],
        'idle.left': [art`
    /\_/\       n
   (=%%%=)_____ \\
     >^<   __(  \))
   (_c@c_)_(____)_/
`, art`
    /\_/\       n
   (=%%%=)_____ \\
     >u<   __(  \))
   (_c@c_)_(____)_/
`],
        'sit.front': art`
  n      /\_/\
 //_____(=%%%=)
((/  )_    >^<
\_(__,,)_(_c@c_)
`,
        'sit.right': art`
  n      /\_/\
 //_____(=%%%=)
((/  )_    >^<
\_(__,,)_(_c@c_)
`,
        'sit.left': art`
    /\_/\       n
   (=%%%=)_____ \\
     >^<   __(  \))
   (_c@c_)_(____)_/
`,
      },
    },
  },
});
