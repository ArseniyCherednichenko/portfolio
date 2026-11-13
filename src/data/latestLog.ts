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
  {
    title: 'A grid that dims the cards you are not reading',
    summary:
      'Focus cards — the quiet opposite of the spotlight and glow cards beside it. Those make the card you touch do more; this makes everything else do less. Hover or tab into any card and it holds still and sharp while its neighbours blur a touch, dim, and settle back a hair, so the eye is led by what falls away rather than what lights up, the way a good page dims what you are not reading. In the spirit of Aceternity\'s focus cards, rebuilt by hand. It coordinates without fragile indices — a small context where every card mints a stable id and the grid holds only which one is active, so a card is dimmed exactly when some sibling is focused and it is not, however the children are composed. And it answers the keyboard, not just the mouse: focus landing on a link inside a card raises it the same way a hover does, and the clear only fires if the leaving card is still the active one, so a fast sweep between neighbours never blanks the grid. Pure CSS transitions on blur, opacity and scale; nothing on a canvas. Reduced motion keeps the meaning and drops the movement — the active card gains a calm, even ring and the rest are left untouched. It debuts as a grid of the range, so no one card is ever the whole story.',
    tag: 'Component',
  },
  {
    title: 'The range shown live, not just named',
    summary:
      'The five discipline demos, once buried on deep pages, now switch live inside the range explorer and on the home page.',
    tag: 'Page',
  },
  {
    title: 'A cursor that tells your hand what a click does',
    summary: "Contextual cursor — the site's own custom pointer grew a caption. A tight lime dot and a trailing ring already run on every page, springing after the cursor at two tensions, the ring swelling and filling over anything interactive; what is new is the word. Any element can hand the cursor a label through a data-cursor attribute, and that word rides in as a small lime pill a beat behind the ring on its own softer spring — Preview over a project card, Open on a link that leaves for the web, Read on a case study — so the pointer narrates what a click will do before you take it, the way Linear and Vercel caption their affordances. The dot yields to the word so the eye reads one mark, not two, and the pill trails just below-right of the point so it never hides under the hand. One global pointer listener reads the nearest declaring ancestor, so it costs nothing per element and can never drift out of sync. Pointer-and-motion only by design: touch devices and reduced-motion visitors keep the native cursor with no caption, untouched. A new Contextual cursor surface in the Playground's controls family shows it off, each tile declaring its own word.",
    tag: 'Motion',
  },
]
