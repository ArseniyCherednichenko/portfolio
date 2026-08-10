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
// It mirrors the top of `CHAPTERS[0]` in `changelog.ts` — keep the two in step
// (the daily routine edits the log each run anyway). The full sentences, the
// kinds, and the filter all still live on `/changelog`.

export interface LogHeadline {
  /** The short name of the thing that shipped. */
  title: string
  /** The kind label shown as a chip, matching KIND_META in changelog.ts. */
  tag: string
}

export const LATEST_LOG: LogHeadline[] = [
  { title: 'An isometric field of cubes that rise to the cursor', tag: 'Component' },
  { title: 'A sunflower head packed by the golden angle', tag: 'Component' },
  { title: 'A living Turing pattern, grown by chemistry', tag: 'Component' },
  { title: 'Atlas — the whole site as a constellation', tag: 'Page' },
  { title: 'A word clock that spells the time', tag: 'Component' },
  { title: 'A living weave of Truchet tiles', tag: 'Component' },
  { title: 'A sheet of Verlet-simulated cloth', tag: 'Component' },
  { title: 'The range — a page for the five disciplines', tag: 'Page' },
  { title: 'An emergent flock of starlings', tag: 'Component' },
]
