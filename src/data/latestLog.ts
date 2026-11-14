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
  {
    title: 'One gear set, three ratios from which part you hold',
    summary:
      'Planetary gears — the gear train folded onto one axis; hold the ring, the sun or the carrier and the same wheels give a reduction, an overdrive or reverse.',
    tag: 'Component',
  },
  {
    title: 'One spotlight that crosses the gaps between cards',
    summary:
      'Spotlight grid — a grid of cards that share a single cursor-tracked light, the continuous counterpart to the per-card spotlight and glow cards; sweep the gutters and both facing edges light together.',
    tag: 'Component',
  },
  {
    title: 'A piston that lags the sine its twin draws clean',
    summary:
      "Slider-crank — the piston engine beside the Scotch yoke; its connecting rod bends the yoke's perfect sine lopsided.",
    tag: 'Component',
  },
  {
    title: 'An endless tunnel you fall through, not look at',
    summary:
      "Tunnel — the demoscene's depth classic, and the one thing the three flat fields beside it never do. The plasma folds soft lime light, the dither quantises it to a hard stipple, the caustics focus it into filaments; all three paint a surface you look at. This opens a hole in the surface and falls through it — perspective, not texture — the trick every 1990s intro reached for once it had a palette, and it is built the exact way those were. A tunnel has only two coordinates, how far down the bore a point sits and how far around the wall, and both are fixed functions of a pixel's place relative to the centre. So depth (a constant over the radius, so the value races toward infinity at the vanishing point and crawls at the rim — that one-over-r is the whole sense of distance) and angle are each computed once into a lookup table and read millions of times. A frame then costs no atan2 and no sqrt at all: it only scrolls an offset through those stored coordinates, reads a woven wall of rings crossed with staves and a depth fog that darkens everything toward the centre so the bore falls to a true black vanishing point rather than a bright hole, and maps the lit wall through the same 256-entry colour lookup its siblings use. That is why a 486 could run it, and why it is near free here. The pointer leans you into the tube — move across it and the walls twist toward the cursor while the fall rushes faster down the bore, easing back to a steady drop when it leaves. Coarse buffer upscaled soft so device pixel ratio is irrelevant, one animation-frame loop cancelled on unmount, the canvas decorative and hidden from assistive tech. Under prefers-reduced-motion there is no loop and no pointer — one still frame is painted and only redrawn on resize.",
    tag: 'Component',
  },
  {
    title: 'The light net on the floor of a sunlit pool',
    summary:
      'Caustics — the third demoscene field, and the one that focuses. The plasma beside it folds soft lime light and the dither quantises it to a hard stipple; sunlight bent through a rippling water surface does neither, it converges, pulling the light into thin, bright, branching filaments over dark water. A sharpened interference field gives you exactly that: each pixel\'s coordinates are domain-warped twice, each axis pushed by a sine read of the other so a plain grid drifts into organic cells, then two interfering wavefronts are multiplied into one value and that value is raised to a high power — so most of the panel falls to dark water and only the crests survive as a lit web that wanders and reknits. Same cheap recipe as its siblings keeps it honest: a deliberately coarse offscreen buffer upscaled soft, a 256-entry colour lookup so the inner loop never interpolates, device pixel ratio irrelevant to a buffer coarse on purpose, one animation-frame loop cleaned up on unmount. The pointer is a finger on the surface — drop it anywhere and a ring spreads out, bending the net where it passes. Reduced motion paints one still frame and runs no loop.',
    tag: 'Component',
  },
]
