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
    title: 'A label that floats, a field that checks itself',
    summary:
      'FloatingField — the plain labelled text field the controls family never had. The label rests in the empty box and lifts to a caption on focus or fill; validation runs on blur, reddens and names the fault, then forgives it live. Password reveal, a warming counter, and a submit that gates on every field at once.',
    tag: 'Component',
  },
  {
    title: 'The page count stops lying',
    summary:
      'A stale figure read 36 where the site serves 35 pages. Reset — and the index now lists itself, so every count agrees.',
    tag: 'Polish',
  },
  {
    title: 'Four beads, four heights, one descent time',
    summary:
      'Tautochrone — the Brachistochrone turned up into a cup, the honest sibling beside it; release beads from different heights and they reach the bottom together, on the same frame. Solved exactly as simple harmonic motion in arc length, so the shared quarter-period is the maths, not a tuning.',
    tag: 'Component',
  },
  {
    title: 'An @-mention popover that finds the caret',
    summary:
      "Mentions — type '@' mid-sentence and a handle popover rises at the caret itself, not pinned to the field; a mirror div finds the caret inside the textarea so it tracks through wraps and scrolls. The handles are real pages of this site, so each mention links somewhere.",
    tag: 'Component',
  },
  {
    title: 'A frequency analyser, bass left to treble right',
    summary:
      "Spectrum — the signal corner's frequency-domain display beside the Oscilloscope and Waveform; a bar graph with falling peak-hold caps, honestly synthesized from a 1/f tilt and drifting formants rather than measured. Sweep it to excite the bins.",
    tag: 'Component',
  },
  {
    title: 'A spring hands the swing back and forth',
    summary:
      'Coupled pendulums — two equal bobs joined by a light spring; lift one and the spring winds it down to a standstill while the other takes on the whole swing, then hands it back. Solved exactly from its two normal modes, a twin meter showing the energy conserved as it crosses.',
    tag: 'Component',
  },
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
]
