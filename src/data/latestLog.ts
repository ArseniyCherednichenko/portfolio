// A compact, standalone list of the most recent build-log headlines, for the
// Home page's "In the open" section.
//
// Why its own tiny module and not derived from `changelog.ts`: the Home chunk
// ships eagerly, while the full Changelog page is lazy-loaded. If Home imported
// anything from `changelog.ts`, that (large) module would be shared with the
// eager entry and Rollup would hoist the whole log — every long entry string —
// into the initial bundle, undoing the code split. This file imports nothing
// heavy, so the headlines cost almost nothing up front.
//
// CONTRACT — keep this list tight and glanceable, because every string here
// ships in the eager landing bundle and renders as a headline on the home page:
//   • `title`   — a short, scannable name for the thing that shipped. Keep it
//                 under ~56 characters. NOT a paragraph. NOT the full changelog
//                 sentence. The full prose lives on /changelog.
//   • `summary` — one honest line of context, under ~120 characters.
//   • `tag`     — the kind chip, matching a KIND_META label in changelog.ts
//                 ('Page' | 'Component' | 'Motion' | 'Polish' | 'Infra').
//
// Newest first, kept to the ~10 most recent. When you prepend a new entry each
// run, drop the oldest so the list never grows unbounded and the landing page
// stays premium. If you catch yourself pasting a long changelog paragraph in
// here, stop: that belongs in `changelog.ts`, and a glanceable headline belongs
// here.

export interface LogHeadline {
  /** The short name of the thing that shipped. Under ~56 chars, never prose. */
  title: string
  /** One honest line of context. Under ~120 chars. */
  summary: string
  /** The kind label shown as a chip, matching KIND_META in changelog.ts. */
  tag: string
}

export const LATEST_LOG: LogHeadline[] = [
  {
    title: 'A linkage that copies a drawing, twice the size',
    summary: 'The eleventh mechanism — trace a small figure with the stylus and a pen draws a true 2x copy, pole, stylus and pen on one line the whole way.',
    tag: 'Component',
  },
  {
    title: 'A reply that streams in, word by word',
    summary: 'The message-arrival choreography every chat rides on — your line snaps in, three dots hold the beat, then the reply precipitates in a few words at a time.',
    tag: 'Component',
  },
  {
    title: 'Deep links now reach four more pages',
    summary: 'The section permalinks thread through About, Numbers, Colophon and Design too — deep-linkable section by section, not just Home.',
    tag: 'Infra',
  },
  {
    title: 'A cam whose edge is a program of motion',
    summary: 'The tenth mechanism — a shaped disc turns and the follower obeys a motion drawn into its edge: rise, dwell, fall, dwell, once a turn.',
    tag: 'Component',
  },
  {
    title: 'A braille display read by touch, not light',
    summary: 'The third display in the thread — six pins per cell rising and sinking through a face, spelling standard Grade-1 braille.',
    tag: 'Component',
  },
  {
    title: 'A flip-dot board that rolls words over',
    summary: 'The dot-matrix sign’s mechanical twin — real discs flipping on and off in a cascade, sharing one 5x7 font with the LED sign.',
    tag: 'Component',
  },
  {
    title: 'A stat tile that counts itself up',
    summary: 'The chart family’s compact member — a dashboard KPI tile: a big counted-up number, a trend arrow, and a sparkline that draws itself inside the card.',
    tag: 'Component',
  },
  {
    title: 'Every section is now a shareable link',
    summary: 'A chain glyph beside each section label copies a deep link to that exact spot — it reveals on hover, and leaves the page still.',
    tag: 'Infra',
  },
  {
    title: 'A copy button that draws its own check',
    summary: 'A reusable copy button, now shared across the bio, design and type pages; its checkmark draws itself on when a copy lands.',
    tag: 'Component',
  },
  {
    title: 'A border that trembles like live current',
    summary: 'The border beam’s opposite — instead of one comet orbiting a still ring, the whole edge wavers, a turbulence-displaced stroke under a glow.',
    tag: 'Component',
  },
]
