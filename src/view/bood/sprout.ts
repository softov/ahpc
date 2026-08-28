import { alternate, art, blink } from './art.js';
import { defineCreature } from './types.js';

/**
 * A sprout. Not an animal, and the only one here with a face that is two eyes
 * and no mouth - which is what lets the leaves do the talking.
 *
 * Leaves up and open, drooping when things are not going well, spread when
 * they are going badly. The pot never changes; everything above it does.
 */
export const sprout = defineCreature({
  name: 'sprout',
  label: 'Sprout',
  about: 'Newer than the rest of this, and growing',

  draw: {
    happy: blink(art`
   \|/
   _|_
  (^ ^)
  (\v/)
   | |
`, art`
   \|/
   _|_
  (- -)
  (\V/)
   | |
`),
    sad: art`
   ,|,
   _|_
  (T T)
  (\v/)
   | |
`,
    thinking: alternate(art`
   \|/  o
   _|_
  (o -)
  ( v )
   | |
`, art`
   \|/  .
   _|_
  (o -)
  ( V )
   | |
`),
    executing: [art`
   \|/
   _|_
  (o o)
 /( V )\
   | |
`, art`
   \|/
   _|_
 _(o -)_
  ( v )
   | |
`, art`
   \|/
   _|_
  (- o)
 /( V )\
   | |
`],
    error: art`
   /|\
   _|_
  (> <)
  (/W\)
   | |
`,
  },

  block: {
    happy: blink(art`
 \|/
(^ ^)
 |V|
`, art`
 \|/
(- -)
 |V|
`),
    sad: art`
 ,|,
(T T)
 |V|
`,
    thinking: art`
 \|/
(- o)
 |V|
`,
    executing: [art`
 \|/
(o o)
 |V|
`, art`
 \|/
(o -)
 |V|
`, art`
 \|/
(- o)
 |V|
`],
    error: art`
 /|\
(> <)
 |V|
`,
  },

  inline: {
    happy: blink(art`\^v^/`, art`\-,-/`),
    sad: art`,TvT,`,
    thinking: art`\-,o/`,
    executing: [art`\o,o/`, art`\o,-/`, art`\-,o/`],
    error: art`/>.</`,
  },
});
