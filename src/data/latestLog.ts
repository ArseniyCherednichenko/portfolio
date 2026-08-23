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
  { title: 'A Signature — the name, signed. The site had a self-drawing pen but nothing personal drawn with it, so this is his signature authored once as pen strokes and fed through the same engine: one confident continuous gesture, laid down in writing order so it traces itself into being like a hand signing rather than a shape assembling. It signs off the footer as you reach the bottom of any page', tag: 'Component' },
  { title: 'A ContextMenu — the pointer\'s own menu, and the piece the Overlays family never had: right-click a wrapped surface and a fully keyboard-driven menu opens at the cursor, blooming from the corner facing it and clamping on-screen near an edge, without hijacking the rest of the page. It gives every project in the Work ledger a right-click of quick actions — quick look, case study, live site, copy link', tag: 'Component' },
  { title: 'A RadialMenu — a pie menu that fans its actions onto a wheel around a hub: each button springs out from the centre on a staggered delay with a spoke drawing behind it, the plus in the hub spins to a cross, and a live readout names the highlighted action. A full role=menu with a roving highlight the arrow keys walk around the ring', tag: 'Component' },
  { title: 'A PinCard — the 3D-pin card: at rest it sits flat, but on hover or focus the whole face lies back on its perspective while a labelled pin rises out of it on a dropped line, haloed by expanding radar rings. It closes the Contact page with two pinned doorways to the work and the playground', tag: 'Component' },
  { title: 'A Popover — the click sibling of the hover tooltip: it anchors a panel of real controls to its trigger, flips to stay on-screen, and hands focus back on close. It powers a new footer Share affordance for passing along the page you are on', tag: 'Component' },
  { title: 'A Wander page that turns the site\'s depth into a game of chance — instead of a map, it deals you one real page at a time from a shuffled deck, so no single project is the whole story and the fastest way to feel the breadth is to be sent somewhere you would not have clicked', tag: 'Page' },
  { title: 'A cyclic cellular automaton — Griffeath\'s cyclic space — that winds pure noise into rotating spirals: every colour eats the one before it around a loop, defects pin down and throw off waves, and the plane locks into interlocking pinwheels that turn forever', tag: 'Component' },
  { title: 'A frost crystal that grows itself out of pure chance — Diffusion-Limited Aggregation run live, drunk particles random-walking the field until one brushes the frost and freezes, and the tips catch everything so the lace reaches outward in fractal fingers', tag: 'Component' },
  { title: 'A pipe network that assembles itself out of pure constraint — Wave Function Collapse run live, every cell a superposition of tiles until a decision ripples across the grid and forces it down to one', tag: 'Component' },
  { title: 'A maze that carves itself with a depth-first search, then solves itself with a breadth-first flood that lights the one shortest path through it', tag: 'Component' },
  { title: 'A stroke-to-fill headline — letters that ink themselves in as thin outlines, then stay hollow until a cursor-tracked spotlight paints them with the accent triad', tag: 'Component' },
  { title: 'A hand-built Tag input — the multi-value sibling of the Select and Combobox, where each committed value becomes a removable chip and the caret keeps writing the next', tag: 'Component' },
  { title: "A hand-built Combobox — the Select's editable twin, an accessible autocomplete that filters by subsequence and underlines the letters you matched", tag: 'Component' },
  { title: 'A hand-built HSV colour picker — the control the browser hides in an unstylable OS dialog, rebuilt with a drag plane, hue rail, editable hex, and screen eyedropper', tag: 'Component' },
  { title: 'A hand-built date picker — the hardest native control, rebuilt as an accessible grid with a sliding month and a gliding lime pill', tag: 'Component' },
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
]
