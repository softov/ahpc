import { alternate, art, blink } from './art.js';
import { defineCreature } from './types.js';

/**
 * A crab. The widest of them at full size, and the claws are half of it.
 *
 * The legs flip between frames while it is working rather than the face
 * changing, because a crab that is busy is a crab that is moving sideways.
 */
export const crab = defineCreature({
  name: 'crab',
  label: 'Crab',
  about: 'Gets there sideways, but gets there',

  draw: {
    happy: blink(art`
 (\)_       _(/)
   \\_______//
   (  ^   ^  )
    \_|_|_|_/
   /\       /\
`, art`
 (\)_       _(/)
   \\_______//
   (  -   -  )
    \_|_|_|_/
   /\       /\
`),
    sad: art`
 (\)_       _(/)
   \\_______//
   (  T   T  )
    \_|_|_|_/
   //       \\
`,
    thinking: alternate(art`
 (\)_       _(/)
   \\_______//  o
   (  o   -  )
    \_|_|_|_/
   /\       /\
`, art`
 (\)_       _(/)
   \\_______//  .
   (  o   -  )
    \_|_|_|_/
   /\       /\
`),
    // Scuttling. Same face, legs the other way round.
    executing: [art`
 (\)_       _(/)
   \\_______//
   (  o   o  )
    \_|_|_|_/
   /\       /\
`, art`
 (\)_       _(/)
   \\_______//
   (  o   -  )
    \_|_|_|_/
   \/       \/
`, art`
 (\)_       _(/)
   \\_______//
   (  -   o  )
    \_|_|_|_/
   /\       /\
`],
    error: art`
 (\/)       (\/)
  \\_________//
   (  >   <  )
    \_|_|_|_/
   /\       /\
`,
  },

  block: {
    happy: blink(art`
V_ _V
(^.^)
 ^ ^
`, art`
V_ _V
(-.-)
 ^ ^
`),
    sad: art`
\_ _/
(T.T)
 ^ ^
`,
    thinking: art`
V_ _V
(-.o)
 ^ ^
`,
    executing: [art`
V_ _V
(o.o)
 ^ ^
`, art`
V_ _V
(o.-)
 v v
`, art`
V_ _V
(-.o)
 ^ ^
`],
    error: art`
V_ _V
(>.<)
 ^ ^
`,
  },

  inline: {
    happy: blink(art`V^.^V`, art`V-.-V`),
    sad: art`\T.T/`,
    thinking: art`V-.oV`,
    executing: [art`Vo.oV`, art`Vo.-V`, art`V-.oV`],
    error: art`V>.<V`,
  },
});
