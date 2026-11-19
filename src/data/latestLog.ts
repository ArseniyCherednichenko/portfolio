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
  {
    title: 'A picture that exists only while it spins',
    summary:
      "Thaumatrope — the Zoetrope's inverse; a bird on one disc face and an empty cage on the other that fuse into one still neither face holds alone, the bird landing in the cage only while it spins fastest.",
    tag: 'Component',
  },
  {
    title: 'A chart that keeps five numbers, not the shape',
    summary:
      "Box plot — the ridgeline's summary sibling; throws the silhouette away and draws Tukey's five-number skeleton, the box of the middle half with its one bright median and the outliers past the fence.",
    tag: 'Component',
  },
  {
    title: 'A chart that keeps the shape, not the number',
    summary:
      "Ridgeline — the data-viz family's distribution shape; several densities stacked and overlapping the Unknown Pleasures way, each ridge opaque so it hides the crest behind it and the one lime stepped only by depth.",
    tag: 'Component',
  },
  {
    title: 'A control that hands back a direction, not a number',
    summary:
      'Joystick — the controls family\'s first whole-vector control; grab the nub, it clamps to the rim and springs back to centre, reporting an x and y with the spoken throw and full keyboard travel.',
    tag: 'Component',
  },
  {
    title: 'A set composed by moving rows between two lists',
    summary:
      'Transfer list — the picker that keeps a set, not a value; two multi-select listboxes with arrows between, each moved row springing from one pane to the other, fully keyboard-driven.',
    tag: 'Component',
  },
  {
    title: 'A race read from the crossings, not the scores',
    summary:
      'Bump chart — keeps the order, not the amount; lines cross as contenders overtake, the one lime stepped by who finishes on top.',
    tag: 'Component',
  },
  {
    title: 'A number line walked in semicircles',
    summary:
      "Recaman's sequence — the Collatz coral's sibling; jump back by n when you can and forward when you can't, drawn as nesting arcs, standing on the same kind of open question: does every number appear?",
    tag: 'Component',
  },
]
