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
    title: 'A label gun that embosses tape as you type',
    summary: 'Label maker — the Dymo embossing gun, and the tactile cousin of the braille line beside it in the display thread: where that raises round pins read by touch, this punches raised letters into a strip of coloured plastic tape. The honest tell is the emboss — a real Dymo letter comes out lighter than its tape, because the die stretches the pigment film as it raises the glyph, so every character is a light ink lit along its top edge and shadowed below, reading as pushed up out of the strip rather than printed onto it. The motion is the gun doing its work: only the letters that actually changed stamp in, a quick drop-and-punch rippling left to right across the new tail, so typing appends one fresh letter rather than re-punching the whole strip. Pure DOM and CSS, no canvas; the strip is one role=img carrying the text as its label, so a reader hears the word, not the tape, and four classic tape colours swap underneath. Reduced motion shows the finished label, every letter already raised.',
    tag: 'Component',
  },
  {
    title: "Every page's first load got lighter",
    summary: 'The command palette loads its big component catalogue on demand now, so the initial bundle fell from 522kB to 199kB on every route — the first paint finally as lean as the site has always claimed.',
    tag: 'Infra',
  },
  {
    title: 'Frost that grows on its own, reaching for your pointer',
    summary: 'DLA — diffusion-limited aggregation, the way frost grows on a cold window and a dendrite crystallises in rock, and the emergence cousin of the Slime mould next door. Plant one frozen seed, then release particles far off that wander at random until they touch the cluster and freeze exactly where they stick. Repeat, and what assembles is not a blob but a branching, self-similar coral: the arms that reach out catch wandering walkers first and so grow faster, starving the hollows behind them — the fractal is pure consequence of the rule, nothing drawn by hand. Each cell is coloured as it freezes by its distance from the core, a cool teal heart out to bright lime tips, and drawn once so a frame costs only the new cells; walkers spawn on a ring and are recycled if they stray, keeping the walk cheap as it grows. The pointer is a cold draft the frost drifts toward; a press plants a competing nucleus. Reduced motion grows a whole cluster in one pass and holds it still.',
    tag: 'Component',
  },
  {
    title: 'A cord you grab anywhere and whip',
    summary: 'Rope — the cloth\'s one-dimensional sibling, and the live answer to the Catenary a few cards down: that one draws the ideal hanging-chain curve as pure maths, while this is the physical cord that settles into exactly it on its own. A string of point masses carried by Verlet — each remembers only where it was last frame, velocity read as the gap — linked by distance constraints relaxed many passes a frame. A rope barely stretches, so the pass count runs high and the solve stays taut: pull the middle down and the slack is drawn evenly from both shoulders, not one link ballooning. Both ends are pinned; grab a node and it rides the pointer while the rest lashes and trails, and because the held node keeps its last position as its velocity, the throw you were making when you let go is carried into the swing. A slow breeze keeps it breathing; reduced motion hangs it still in its resting catenary.',
    tag: 'Component',
  },
  {
    title: 'A triangle that drills a square hole',
    summary: 'Reuleaux rotor — the odd one out in the mechanism corner: not a linkage but a curve of constant width, the working heart of the Watts square-hole drill, a real 1914 bit still sold. Bulge each edge of an equilateral triangle into an arc centred on the opposite vertex and the shape is exactly as wide in every direction, the way a circle is — so a square of that width always holds it with all four sides kissed at once, and as it turns the three corners sweep into the square\'s corners and scrub out the whole area bar four hair-thin nicks. The price of constant width is that the centre cannot sit still; it wanders a tiny looping path, traced here as a faint lime loop the live centre rides. The square fit is measured, not faked — the rotated bounding box is centred, which is exactly the constant-width constraint. It turns on its own; the pointer takes the wheel. Reduced motion draws it still, the swept hole already complete.',
    tag: 'Component',
  },
  {
    title: 'The Lorenz butterfly, turning in three dimensions',
    summary: 'Lorenz — the most famous picture in chaos, and the one its flat neighbours could not show: where the Clifford map folds a plane and the Julia set colours one, this orbit lives in 3D and the point is the shape it traces there. One point obeying three rules Lorenz drew from convection in 1963 — the equation that named the butterfly effect — winds around one lobe, flips to the other at a moment you cannot predict, forever. Carried forward by fourth-order Runge–Kutta, a few thousand points held as a faint lime ghost of the whole butterfly with the newest ramped to white as a comet head. It turns on its own; the pointer takes the wheel to spin and tilt it, depth read as brightness so the near wing glows. Reduced motion draws the whole butterfly still, at a three-quarter angle.',
    tag: 'Component',
  },
  {
    title: 'A moiré field that beats under your pointer',
    summary: 'Moiré — the quiet one in the pointer fields, where nothing moves on its own yet nothing is ever still. Two fine gratings laid over one another, and the coarse third pattern that lives in neither: lay one ruling over another that differs by a hair and the slow beat between them falls out, and nudging one a few degrees swings it across the whole field. Rings sets two circular gratings, one on the pointer, so ellipses and hyperbolae sweep like two stones in a pond; Lines rotates one ruling a few degrees to open a pivoting fan; a density slider rules both. Pure arithmetic once per pixel on a small buffer. Reduced motion drops the drift and tracks the pointer directly.',
    tag: 'Component',
  },
  {
    title: 'A before/after diff, matched line by line',
    summary: 'Diff — the counterpart to the Code block: it shows two versions of a file and marks what moved, matched by a hand-built longest-common-subsequence pass (what git diff runs on), so unchanged lines are found, not guessed. Toggle unified or split; lime for additions, rose for removals, two gutters. Building it lifted the Code block\'s TSX highlighter into a shared lib — one highlighter, two readers — and the demo is that very commit. Reduced motion paints it at rest.',
    tag: 'Component',
  },
  {
    title: 'A poll you vote in and watch tally',
    summary: 'Poll — the single-choice feedback widget the controls family never had: pick one option, commit, and the result bars grow in and count up to their share. A real radiogroup to choose (one tab stop, arrows that walk and select), reversible with Change vote. The question names the five disciplines, so even a poll de-centers any one project. Tallies are illustrative, the vote lives only in the tab; reduced motion snaps the bars.',
    tag: 'Component',
  },
  {
    title: 'A calling card that saves to your contacts',
    summary: 'Calling card — the physical business card the site never had, made interactive: it leans and lights toward the cursor in real 3D, and its one real job is useful. Save it and it writes a spec-correct vCard (.vcf) your phone or laptop reads straight into its address book, built only from the honest facts — Berlin, the one role, the real channels, nothing stored on my end. Reachable from the Contact page, the Get-in-touch dialog, and the command palette. Flat and glare-free under reduced motion.',
    tag: 'Component',
  },
]
