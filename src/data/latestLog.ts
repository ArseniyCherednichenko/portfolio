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
    title: 'A Berlin snow globe',
    summary: 'Shake it and the city’s snow swirls up, then falls slowly back down through glycerol-slow drag.',
    tag: 'Component',
  },
  {
    title: 'A day over Berlin, wound by hand',
    summary: 'The /berlin skyline now scrubs through the whole day — drag from midnight through dawn, golden hour and back.',
    tag: 'Motion',
  },
  {
    title: 'A media scrubber with a real buffer',
    summary: 'The flat player timeline every streaming app rides on — a dim layer loads ahead of the playhead, even while paused.',
    tag: 'Component',
  },
  {
    title: 'The Chebyshev straight-line linkage',
    summary: 'Four bars that trace a line straight to about four parts in a thousand — the Peaucellier’s cheaper reply.',
    tag: 'Component',
  },
  {
    title: 'A Trammel of Archimedes',
    summary: 'One rigid rod, two slots at right angles, a pen that draws a true ellipse — and a circle at its midpoint.',
    tag: 'Component',
  },
  {
    title: 'The Scotch yoke',
    summary: 'A crank turned into an exact cosine, the yoke’s travel plumbed straight onto the sine it sweeps.',
    tag: 'Component',
  },
  {
    title: 'The way here',
    summary: 'A new /journey page — the honest through-line of how the work gets made, with Guided one waypoint of six.',
    tag: 'Page',
  },
  {
    title: 'A sortable data table',
    summary: 'The primitive every dashboard is built on — rows that glide to their new order instead of snapping to it.',
    tag: 'Component',
  },
  {
    title: 'From Berlin',
    summary: 'A new /berlin page: a generative skyline under a sky that follows the real local hour.',
    tag: 'Page',
  },
  {
    title: 'Taste, doubled',
    summary: 'The /taste page’s plain-versus-considered demos grow from four pairs to eight.',
    tag: 'Polish',
  },
]
