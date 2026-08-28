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
    happy: blink(art`=^.^=`, art`=-.-=`),
    sad: art`=T.T=`,
    thinking: art`=-.o=`,
    executing: [art`=o.o=`, art`=o.-=`, art`=-.o=`],
    error: art`=>.<=`,
  },
});
