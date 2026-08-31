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
//
// Kept to the ~10 most recent, as short one-line headlines: the Home section is
// a teaser ("the most recent of them") with a "Read the full build log" link,
// and every title here ships in the eager bundle — so this stays a tight,
// glanceable list, not the whole archive re-stated in full paragraphs. When you
// prepend a new entry each run, drop the oldest so the list does not grow
// unbounded and the landing page stays premium.

export interface LogHeadline {
  /** The short name of the thing that shipped. */
  title: string
  /** The kind label shown as a chip, matching KIND_META in changelog.ts. */
  tag: string
}

export const LATEST_LOG: LogHeadline[] = [
  { title: 'A Sandpile — the Abelian sandpile of 1987, the original toy of self-organised criticality: grains pile up until a fourth tips the stack, and the collapse cascades outward as an avalanche of no typical size. Press or drag to pour your own; reduced motion paints the deterministic four-colour fractal', tag: 'Component' },
  { title: 'A RangeSlider — the elastic slider\'s interval sibling: two thumbs bounding a lit span, never crossing, a value bubble springing above whichever you hold and each keyboard-driven on its own', tag: 'Component' },
  { title: 'A Waveform — the voice-memo transport as an interaction study: a seeded speech-shaped waveform that colours in from the left as the playhead sweeps, click or drag to seek, hover to read the time. A real role=slider, keyboard-driven; reduced motion drops only the flourish', tag: 'Component' },
  { title: 'Preferences — a site-wide motion switch, handed to the visitor. One MotionConfig above the whole tree drives all ~180 hand-built components at once; a small dialog offers System, Calm, or Full, remembered per browser and reachable from the nav, the command palette, and the mobile drawer', tag: 'Component' },
  { title: 'A ParticleText — a word with no body of its own, only the shape a free swarm settles into: particles spring home from noise, warm to lime, and scatter under the cursor before healing behind you', tag: 'Component' },
  { title: 'A Mandelbrot set — the map of every Julia set, built to be fallen into: click, scroll, or press to dive as the iteration budget grows with the zoom and the coastline keeps resolving', tag: 'Component' },
  { title: 'A keyboard page — the site\'s go-chords lifted out of a help dialog into a real, playable on-screen keyboard where every lit cap is a working link', tag: 'Page' },
  { title: 'A Langton\'s ant — the smallest honest argument for emergence, generalised to a turmite: one walker, a two-line rule, and order that simply arrives', tag: 'Component' },
  { title: 'A Julia set — the escape-time fractal whose constant follows the cursor, its infinitely crinkled coastline re-forming live as the point under the pointer becomes c', tag: 'Component' },
  { title: 'An Etch A Sketch — the aluminium-powder toy, drawn with two knobs and no lifting the pen, so every picture is a single unbroken line; shake to erase', tag: 'Component' },
]
