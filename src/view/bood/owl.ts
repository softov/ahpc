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
    happy: blink(art`{^,^}`, art`{-,-}`),
    sad: art`{T,T}`,
    thinking: art`{-,o}`,
    executing: [art`{o,o}`, art`{o,-}`, art`{-,o}`],
    error: art`{>,<}`,
  },
});
