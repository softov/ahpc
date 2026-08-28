import { alternate, art, blink } from './art.js';
import { defineCreature } from './types.js';

/**
 * A beetle. Antennae up, six legs, a shell drawn as a row of equals.
 *
 * The legs are what move while it is working. Antennae carry sad, the way the
 * cat's tail does: they come down, and they stay down until the mood does.
 */
export const beetle = defineCreature({
  name: 'beetle',
  label: 'Beetle',
  about: 'Carries more than it weighs',

  draw: {
    happy: blink(art`
   \   /
  __\_/__
 /( ^.^ )\
 \|=====|/
  /  |  \
`, art`
   \   /
  __\_/__
 /( -.- )\
 \|=====|/
  /  |  \
`),
    sad: art`
   |   |
  __\_/__
 /( T.T )\
 \|=====|/
  \  |  /
`,
    thinking: alternate(art`
   \  /    o
  __\_/__
 /( o.- )\
 \|=====|/
  /  |  \
`, art`
   \  /    .
  __\_/__
 /( o.- )\
 \|=====|/
  /  |  \
`),
    executing: [art`
   \   /
  __\_/__
 /( o.o )\
 \|=====|/
  /  |  \
`, art`
   \   /
  __\_/__
 /( o.- )\
 \|=====|/
  \  |  /
`, art`
   \   /
  __\_/__
 /( -.o )\
 \|=====|/
  /  |  \
`],
    error: art`
  \     /
  _\___/_
 /( >.< )\
 \|=====|/
  /  |  \
`,
  },

  block: {
    happy: blink(art`
_\_/_
(^.^)
/ | \
`, art`
_\_/_
(-.-)
/ | \
`),
    sad: art`
_|_|_
(T.T)
\ | /
`,
    thinking: art`
_\_/_
(-.o)
/ | \
`,
    executing: [art`
_\_/_
(o.o)
/ | \
`, art`
_\_/_
(o.-)
\ | /
`, art`
_\_/_
(-.o)
/ | \
`],
    error: art`
_\_/_
(>.<)
/ | \
`,
  },

  // Square brackets rather than the slashes the bigger forms use: a drawing
  // that ends in a backslash cannot be written as a template literal at all,
  // and the shell is the beetle's other outline anyway.
  inline: {
    happy: blink(art`[^.^]`, art`[-.-]`),
    sad: art`[T.T]`,
    thinking: art`[-.o]`,
    executing: [art`[o.o]`, art`[o.-]`, art`[-.o]`],
    error: art`[>.<]`,
  },
});
