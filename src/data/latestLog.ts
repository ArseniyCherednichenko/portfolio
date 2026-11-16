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
    title: 'A number line walked in semicircles',
    summary:
      "Recaman's sequence — the Collatz coral's sibling; jump back by n when you can and forward when you can't, drawn as nesting arcs, standing on the same kind of open question: does every number appear?",
    tag: 'Component',
  },
  {
    title: 'A hero line that never flickers blank',
    summary:
      'The rotating hero word now overlaps its swap so one is always shown, holds its width so nothing reflows, and foregrounds the range over any one product.',
    tag: 'Polish',
  },
  {
    title: 'The only five solids, drawn and proven',
    summary:
      "Platonic solids — the Tesseract's honest 3D companion; the five regular solids as draggable wireframes, their edges derived from the points and their face count read live from Euler's formula F = 2 − V + E.",
    tag: 'Component',
  },
  {
    title: 'Rotation around a bend, and the cost of it',
    summary:
      "Universal joint — the Oldham's foil; a Hooke joint carries a turn between shafts that meet at an angle, but can't keep their speeds in step — the output races then lags, twice a turn, by more the steeper the bend.",
    tag: 'Component',
  },
  {
    title: 'The other walking leg, lean enough to read',
    summary:
      "Klann linkage — the Strandbeest's counterpart; a six-bar built to the patent's own proportions that reaches the same walker's gait, a flat ground stroke then a high arc, from a leg you can read joint by joint.",
    tag: 'Component',
  },
  {
    title: 'A living fern grown from four random matrices',
    summary:
      "Barnsley fern — the chaos game's affine sibling; play the same order-out-of-chance game with four tiny affine maps instead of polygon corners and a fern precipitates, coloured by which map drew each point.",
    tag: 'Component',
  },
  {
    title: 'A fractal that folds from a flat strip',
    summary:
      'Dragon curve — the Heighway dragon, whose whole identity is the fold; run one crease angle from flat to a right angle and the strip folds up into the fractal and unfolds back.',
    tag: 'Component',
  },
  {
    title: 'A straight line drawn by rolling, not hinging',
    summary:
      'Tusi couple — roll a wheel inside a ring twice its size and a rim point traces a dead-straight line, exactly; the odd one out beside the bar-linkage straight-line makers.',
    tag: 'Component',
  },
  {
    title: 'A word whose frame springs to fit it',
    summary:
      'Container text flip — the word-swapper where the box moves, not the word; the pill measures each word and springs its own width to it while the letters turn in.',
    tag: 'Component',
  },
  {
    title: 'Three stars, and no formula can say where they go',
    summary:
      'Three-body problem — chaos in its oldest form; three stars under gravity, the butterfly effect before Lorenz named it, the dance leaning toward your hand.',
    tag: 'Component',
  },
]
