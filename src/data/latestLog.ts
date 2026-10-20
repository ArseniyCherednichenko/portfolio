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
    title: 'The framework stops re-downloading every day',
    summary: 'React, the router and Framer Motion now sit in their own cached chunks, so a daily content deploy no longer re-hashes 295KB of code that never changed.',
    tag: 'Infra',
  },
  {
    title: 'The oldest trick for drawing a straight line',
    summary: 'The fourteenth mechanism — Watt’s 1784 linkage, three bars whose coupler midpoint rides the straight crossing of a figure-eight, within 1.9% of true, the roughest of the straight-line trio by design.',
    tag: 'Component',
  },
  {
    title: 'A mechanism that cuts slow and returns fast',
    summary: 'The thirteenth mechanism — a Whitworth quick-return turning one steady crank into a ram that crawls out on the working stroke and snaps back, the ratio measured off the geometry.',
    tag: 'Component',
  },
  {
    title: 'A coupling that turns two misaligned shafts as one',
    summary: 'The twelfth mechanism — an Oldham coupling passing rotation across an offset gap with zero phase error, its floating disc orbiting at twice the rate to swallow the offset.',
    tag: 'Component',
  },
  {
    title: 'A grid that draws every harmonic ratio at once',
    summary: 'A Lissajous table on one canvas — each cell the figure two sine waves trace, a lime pen riding every curve. Drag or let the phase drift, and watch each one open and close.',
    tag: 'Component',
  },
  {
    title: 'A checkbox that keeps its third state',
    summary: 'The plain checkbox, built tri-state on a real native input — check some of a list and the parent reads the mixed dash; the mark draws in and the lime fill springs up.',
    tag: 'Component',
  },
  {
    title: 'A contents rail on the long inner pages',
    summary: 'Craft, the specimen and thanks gain a right-side rail and per-section deep links — navigable section by section, every part shareable.',
    tag: 'Infra',
  },
  {
    title: 'A button that carries its own work',
    summary: 'The action button, done right — idle, running, landed or failed as one object: the width morphs per word, it cannot double-fire, and a failure shakes and announces instead of going quiet.',
    tag: 'Component',
  },
  {
    title: 'A pendulum that proves the Earth turns',
    summary: 'A Foucault pendulum seen from above — slide the latitude and its swing plane turns at sin(latitude), knocking down a ring of pegs. Starts at Berlin.',
    tag: 'Component',
  },
  {
    title: 'A live status board for the person, not a project',
    summary: 'Berlin time on a cold-cathode clock, a soft presence state flipping on a split-flap, and the real library count rolling up — all live, all honest.',
    tag: 'Page',
  },
]
