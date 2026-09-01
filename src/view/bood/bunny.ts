import { alternate, art, blink } from './art.js';
import { defineCreature } from './types.js';

/**
 * A bunny. The ears are the tell.
 *
 * Up and open when things are well, folded flat when they are not. At block
 * and inline size there are no ears to fold, so the face does all of it -
 * which is what those two sizes are for.
 */
export const bunny = defineCreature({
  name: 'bunny',
  label: 'Bunny',
  about: 'Quiet, and faster than it looks',

  draw: {
    happy: blink(art`
  (\_/)
  ( ^.^)
 c(")_(")
`, art`
  (\_/)
  ( -.-)
 c(")_(")
`),
    // Ears down. The face alone would read as a bunny squinting.
    sad: art`
  (,_,)
  ( T.T)
 c(")_(")
`,
    thinking: alternate(art`
  (\_/)  o
  ( o.-)
 c(")_(")
`, art`
  (\_/)  .
  ( o.-)
 c(")_(")
`),
    executing: [art`
  (\_/)
  ( o.o)
 c(")_(")
`, art`
  (\_/)
  ( o.-)
 c(")_(")
`, art`
  (\_/)
  ( -.o)
 c(")_(")
`],
    error: art`
  (\_/)
  ( >.<)
 c(")_(")
`,
  },

  block: {
    happy: blink(art`
(\_/)
(^.^)
("_")
`, art`
(\_/)
(-.-)
("_")
`),
    sad: art`
(,_,)
(T.T)
("_")
`,
    thinking: art`
(\_/)
(-.o)
("_")
`,
    executing: [art`
(\_/)
(o.o)
("_")
`, art`
(\_/)
(o.-)
("_")
`, art`
(\_/)
(-.o)
("_")
`],
    error: art`
(\_/)
(>.<)
("_")
`,
  },

  inline: {
    happy: blink(art`(\^.^/)`, art`(\-.-/)`),
    sad: art`(,T.T,)`,
    thinking: art`(\-.o/)`,
    executing: [art`(\o.o/)`, art`(\o.-/)`, art`(\-.o/)`],
    error: art`(x>.<x)`,
  },

  /**
   * Moving, and the ears keep doing the work.
   *
   * The forepaw is what says which way it is pointed - planted at the front
   * when it is facing right, trailed behind when it is facing left - and it is
   * a `c` on both sides here. The reference sheet mirrors it properly, as `c`
   * and an open o, and that second glyph is U+0254: not ASCII, and East Asian
   * Ambiguous, which means two cells wide under a CJK font setting. A rabbit
   * one cell wider on somebody else's terminal does not look wide, it looks
   * broken. So the paw curves the wrong way going left, which nobody reads at
   * one cell, and the drawing is the same width everywhere.
   *
   * There is no walk cycle, because a bunny cannot travel without leaving the
   * ground: `walk` is the crouch it launches from and is over in two frames.
   */
  motion: {
    gait: 'hop',
    flies: false,
    sits: true,
    bounce: 0.25,
    fallSpeed: 1.15,
    hop: 1,
    blink: '-.-',
    faces: { happy: '^.^', sad: 'T.T', thinking: '-.o', executing: 'o.o', error: '>.<' },
    tells: { happy: '(\\_/)', sad: '(,_,)', thinking: '(\\_/)', executing: '(\\_/)', error: '(x_x)' },
    poses: {
      // Front is what it returns to: after a couple of seconds it looks at you,
      // and shifts its weight from one paw to the other while it waits.
      'idle.front': [art`
  #####
  (%%%)
c((_ _))
`, art`
  #####
  (%%%)
 ((_ _))D
`],
      'idle.right': [art`
 #####
 ( %%%)
c(")_(")
`],
      'idle.left': [art`
  #####
  (%%% )
 (")_(")D
`],
      'sit.front': art`
  #####
  (%%%)
 ((_ _))
`,
      'sit.right': art`
 #####
 ( %%%)
 C(")(")
`,
      'sit.left': art`
 #####
 (%%% )
 (")(")D
`,
      'walk.right': art`
 #####
 ( %%%)
.(")_(")
`,
      'walk.left': art`
  #####
  (%%% )
 (")_(")D
`,
      'jump.right': art`
  #####
  ( %%%)
C((")(")
(") (")
`,
      'jump.left': art`
 #####
 (%%% )
 (")("))D
  (") (")
`,
      'fall.right': art`
 #####
 ( %%%)
C(")_(")
  '   '
`,
      'fall.left': art`
 #####
 (%%% )
 (")_(")D
  '   '
`,
      // A squash is wider and shorter. Bottom-aligned, so it settles onto the
      // floor rather than sinking through it.
      land: art`
  #####
  (%%%)
(")___(")
`,
      held: art`
  #####
  (%%%)
  ("|")
 (")U(")
`,
      // Pins its own face over the mood, and the mood comes straight back when
      // anything wakes it.
      sleep: art`
  (,_,)
  (-.-)
 ((_ _))
`,
      alarm: art`
  #####
  (%%%)
C((_ _))
  ^   ^
`,
    },
  },
});
