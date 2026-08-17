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
  { title: 'A double pendulum — a family of chaotic clones released from all-but-identical starts, fanning apart into chaos', tag: 'Component' },
  { title: 'A hand-built Select menu — the styled, animated, fully keyboard-driven listbox the native one can never be', tag: 'Component' },
  { title: 'A slime-mould colony that grows a vein network from thousands of agents, each with one instinct', tag: 'Component' },
  { title: 'A Taste page that shows the same interface plain and considered, so the care reads as the delta', tag: 'Page' },
  { title: 'A fractal tree grown from one recursive rule, unfurling and swaying on honest wind', tag: 'Component' },
  { title: 'A 3D word sphere of the tools I reach for, turning in space and steered by the pointer', tag: 'Component' },
  { title: 'A Galton board where beads clatter through pegs and pile into the bell curve', tag: 'Component' },
  { title: 'A Chladni plate whose sand flees the shaking and settles on the still nodal lines', tag: 'Component' },
  { title: "A Newton's cradle with honest elastic-collision physics you drive by hand", tag: 'Component' },
  { title: 'A living Voronoi tessellation you carry and re-seed with the pointer', tag: 'Component' },
  { title: 'A radar chart drawing the shape of the whole site, section by section', tag: 'Component' },
  { title: 'An animated column chart comparing the build log by kind of work', tag: 'Component' },
  { title: 'An animated area curve charting the build growing, chapter by chapter', tag: 'Component' },
  { title: "The site's first chart — an animated single-hue donut of the library", tag: 'Component' },
  { title: 'An inline link that floats a rich preview card on hover', tag: 'Component' },
  { title: "Conway's Game of Life as a phosphor field you seed by hand", tag: 'Component' },
  { title: 'An iOS-style bottom sheet with drag-to-snap detents', tag: 'Component' },
]
