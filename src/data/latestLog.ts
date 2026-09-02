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
  { title: 'A Ticket — an event pass rebuilt in DOM and CSS, carrying the one detail that makes a ticket read as a ticket: the perforation and the tear. Two notches are punched clean through the card by a mask of radial gradients, so the page shows through the holes rather than a faked shadow, with a dashed seam between them. The whole pass tilts toward the cursor under a holographic foil that sweeps as it moves; press the stub and it springs off along the seam while the body stamps admitted. The copy is a personal beat, not a client — admit one, hand-built in Berlin. The tear is a real button with a live announcement, so it works by keyboard alone; reduced motion drops the tilt, the foil and the arc', tag: 'Component' },
  { title: 'A Spirograph — the geared drawing toy, kept honest to its maths and made driveable. A wheel rolls the inside of a fixed ring and a pen on its spoke traces a hypotrochoid; with integer teeth the curve closes exactly, the R : r ratio sets the lobes and the pen offset their sharpness, so every control changes the figure for a reason. The kin of the Harmonograph, but where that plotter you can only reroll, this one you drive — two steppers for the gears, a slider for the pen. Reduced motion draws the finished figure whole, no rolling wheel', tag: 'Component' },
  { title: 'A segmented control — the picker the controls family was missing: not the Select or Wheel that hide their options, but the iOS/macOS tab-of-buttons where every choice stays on screen. One lime pill glides between segments and sizes itself to each label, measured live so any length lines up. A real role=radiogroup, one tab stop, the arrows moving selection and focus together; pick a layout and the preview rearranges. Reduced motion drops only the glide', tag: 'Component' },
  { title: 'A Halftone — the oldest trick in print made a cursor-lit pointer field. No photograph underneath, only a brightness field of a few soft lights drifting on their own paths, sampled onto a regular dot screen so each dot swells and warms toward the light and starves to a pinprick in the shadows between. The cursor is a light of its own, flaring on press; reduced motion screens one frozen still', tag: 'Component' },
  { title: 'A Uses page — "The setup", the lived-in companion to the now page and the uses.tech convention in the site\'s own voice: the everyday stack, the tools that make this exact site, and the desk it happens at. Distinct from the toolkit (the full stack, catalogued), honest throughout — the real drivers are named, the personal gear left as clearly-marked blanks rather than invented', tag: 'Page' },
  { title: 'A Euclidean sequencer — a rhythm machine drawn as a ring, built on one line of maths: to spread k beats as evenly as n steps allow, put an onset on step i whenever (i·k) mod n is under k. That closed form generates the tresillo, the son clave, a bembé; set onsets against steps, spin the rotation, press play and hear the pattern sweep. Every step a real toggle, every knob keyboard-driven', tag: 'Component' },
  { title: 'A Wheel picker — the iOS date-picker wheel built as its own control: a barrel of options you spin, tracking your finger and carrying on a flick before snapping to the nearest row, the rows curving away on a real cylinder projected honestly. Drag, mouse-wheel, or keyboard; a true role=listbox, and reduced motion drops only the flick', tag: 'Component' },
  { title: 'A Sandpile — the Abelian sandpile of 1987, the original toy of self-organised criticality: grains pile up until a fourth tips the stack, and the collapse cascades outward as an avalanche of no typical size. Press or drag to pour your own; reduced motion paints the deterministic four-colour fractal', tag: 'Component' },
  { title: 'A RangeSlider — the elastic slider\'s interval sibling: two thumbs bounding a lit span, never crossing, a value bubble springing above whichever you hold and each keyboard-driven on its own', tag: 'Component' },
  { title: 'A Waveform — the voice-memo transport as an interaction study: a seeded speech-shaped waveform that colours in from the left as the playhead sweeps, click or drag to seek, hover to read the time. A real role=slider, keyboard-driven; reduced motion drops only the flourish', tag: 'Component' },
]
