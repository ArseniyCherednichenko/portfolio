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
    title: 'The essays get a reading dial',
    summary:
      "The finished pieces now carry the TracingBeam margin rule and a new corner ReadingDial — a lime ring that closes as you read, reporting progress through the essay itself and carrying you back to the top. Published-only, reduced-motion aware.",
    tag: 'Motion',
  },
  {
    title: 'A turn that only goes one way',
    summary:
      "Ratchet and pawl — the rigid-mechanism corner's one-way member, its mechanical diode; turn it forward and it counts up tooth by tooth, push it back and the steep face catches the pawl and it locks. One forward-only angle, nothing else stored.",
    tag: 'Component',
  },
  {
    title: 'A third finished essay goes up',
    summary:
      "'Ship, then refine' — the Writing section's third published piece, on the process the whole site runs on: put the smallest real version in front of people, then do the slow refinement in the open, where you can read it commit by commit.",
    tag: 'Page',
  },
  {
    title: 'A turn comes out as a straight line',
    summary:
      "Rack and pinion — the third of the rotary-into-motion trio beside the Scotch yoke and slider-crank; a pinion gear combs a toothed bar, whose travel is the pitch radius times the angle turned, s = R*theta, exactly, no error term.",
    tag: 'Component',
  },
  {
    title: 'A second finished essay goes up',
    summary:
      "'Motion that earns its place' — the Writing section's second published piece, on the site's own animation philosophy: the one question that decides whether a motion stays, and reduced-motion as a designed path, all checkable here.",
    tag: 'Page',
  },
  {
    title: 'A cursor trail whose marks stay, then go',
    summary:
      "ImageTrail — the left-behind member of the pointer-field thread; it stamps a tile wherever the cursor passes and lets it shrink, spin and fade on its own clock, the counterpart to the pixel grid and the ribbons that keep moving with you.",
    tag: 'Component',
  },
  {
    title: 'The first finished piece of writing lands',
    summary:
      "'Building this site in the open' — the Writing section's first published essay, deliberately about a subject you can verify against this very repo: public history, small daily commits, a main branch that always builds.",
    tag: 'Page',
  },
  {
    title: 'A chart that keeps every point, not a summary',
    summary:
      "Beeswarm — the box plot's complement from the other side; each reading a dot nudged clear of its neighbours so the crowd draws the distribution, showing the two humps a single median would hide.",
    tag: 'Component',
  },
  {
    title: 'A picture read out of the margin numbers',
    summary:
      "Nonogram — the Minesweeper's certainty-side complement; the clues are the run lengths of a hidden picture, every puzzle has one logical solution, and Deduce plays only the moves the numbers force, never a guess.",
    tag: 'Component',
  },
  {
    title: 'A field cleared by reading the numbers',
    summary:
      'Minesweeper — the games family\'s deduction-from-numbers piece; the first click is always safe, every number is an exact neighbour count, and Deduce plays only the moves the field forces, never a guess.',
    tag: 'Component',
  },
]
