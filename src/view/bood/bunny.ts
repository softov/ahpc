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
    happy: blink(art`U^.^U`, art`U-.-U`),
    sad: art`UT.TU`,
    thinking: art`U-.oU`,
    executing: [art`Uo.oU`, art`Uo.-U`, art`U-.oU`],
    error: art`U>.<U`,
  },
});
