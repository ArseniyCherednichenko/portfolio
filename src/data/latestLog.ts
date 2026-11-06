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
    title: 'A quotation that sets itself as you scroll',
    summary: 'PullQuote — the editorial pull-quote the type family was missing, and now the last word of the Principles manifesto. Its neighbours each move a single string — the split-text lifts letters, the scroll reveal brightens words, the decode resolves glyphs out of noise — while this composes a whole quotation unit: an oversized serif mark, the statement, an accent rule and a cite. All of it is tied to the blockquote\'s own scroll progress, so the quote sets itself top to bottom as the reader passes — the giant mark rises and warms to lime first, the statement then brightens word by word, the hairline draws across beneath it, and the cite fades up last. A real blockquote carrying the whole line as its label with a real cite, the moving words and the mark hidden from assistive tech, so a screen reader hears it once. Reduced motion pins the scroll value to its finished state, so one render path shows it lit, full and still.',
    tag: 'Component',
  },
  {
    title: 'An engraved plate turned out one rosette at a time',
    summary: 'Guilloche — the engine-turned engraving of a watch dial or a banknote, kept honest to the rose-engine lathe that makes it, and the generative-geometry kin of the Spirograph and Harmonograph. The lattice is never any one line: a lathe cuts the same simple rosette over and over while slowly indexing the work, and it is the overlap of the turned copies that weaves the dense, forgery-proof mesh. The rosette is a polar radius modulated by one or two harmonics, r(t) = base + a1·sin(p1·t) + a2·sin(p2·t), and each pass is turned by the golden angle (~137.5 degrees) — the step a sunflower packs its seeds by — so the passes fill the dial evenly and never repeat. The opposite method to its neighbours: not a single travelling pen but many rotated rosettes whose crossings do the drawing, the way an engraver cross-hatches tone. Four plates, a cut-depth slider and a re-engrave, all keyboard-reachable. One canvas, laid pass by pass onto a persistent buffer, each strand composited lighter so crossings bloom to white; the finished plate then turns on its mount through a GPU transform with no per-frame restroke. Reduced motion lays the whole plate in one pass and holds it still.',
    tag: 'Component',
  },
  {
    title: 'Sand that heaps and water that pools, side by side',
    summary: 'Falling sand — a falling-sand automaton, the granular toy the Pointer fields were missing, and the physical, order-dependent cousin of the abelian Sandpile a few cards down. It keeps the DLA\'s one-rule-per-cell honesty but drops the randomness: the grains simply fall. Two materials, told apart entirely by how they move. Sand falls straight down or, blocked, down a diagonal, so it can never stand in a column — it slumps into a heap at its angle of repose, the cone a real stream makes. Water falls the same but also spreads level when it cannot fall, so it seeks its surface and pools flat in a basin. Sand is denser, so a grain sinks through water and the water rises past it. Stone ledges give the material something to pile on, pour off, and pool against; a source drifts across the top trickling sand with pulses of water so the field pours on its own, the pointer paints a stream and a press pours water, and the bottom row drains so it never silts up. One canvas, one loop, DPR-capped. Reduced motion settles the scene in one bounded pass and holds it still.',
    tag: 'Component',
  },
  {
    title: 'A yo-yo that sleeps at the bottom of its string',
    summary: 'Yo-yo — a working yo-yo with honest rotational physics, and the momentum toy this family was missing beside the fidget spinner and the turntable. A different kind of toy from both: the spinner is an rpm winding down in place, the turntable a platter you nudge to a steady speed, and this trades height for spin and back again. Thrown down it falls slowly, because most of gravity\'s pull goes into spinning it up rather than dropping it, the way a real yo-yo creeps down its string, so it reaches the bottom turning fast; there, with the string fully out, it sleeps, its centre still while the stored spin bleeds off to friction. A tug lets the string grip the axle and the spin it has left is spent carrying it home. The honest, teachable part is the sleep — sleep too long and the spin falls below what the climb needs, the string can no longer grip, and the yo-yo dies at the bottom, so you have to reel it in by hand, exactly as a real one does. The whole state is a few numbers in a ref integrated on a fixed substep off the frame clock, so the slow fall, the fast sleep and the slept-out death all fall out of the maths rather than a script. Reduced motion shows it asleep at the bottom and the control snaps between thrown and reeled-in stills.',
    tag: 'Component',
  },
  {
    title: 'Fridge-magnet words you drag into a line',
    summary: 'Magnetic poetry — the fridge-magnet word kit, rebuilt as a draggable board, and the one piece in the type cluster you rearrange rather than read. Its neighbours each hand you a finished string and animate it into being — the split-text lifts letters into place, the braille line raises pins, the label gun punches a strip — this hands you the words loose, a scatter of little ivory tiles on a brushed fridge door, and gets out of the way, so the line is yours to compose. Every tile is its own drag: the outer element carries the x and y so the motion library owns them, while an inner span carries a fixed random tilt, which keeps the drag and the rotation from cancelling out, since both want the same transform. Pick a tile up and it rises above the pile and lifts; let go and it stays exactly where it lands. Scatter re-lays the whole board from a fresh seeded layout and resets any drag in flight. The words are honest ones the site keeps returning to — Berlin, made by hand, slow, curious. Reduced motion drops the entrance stagger and the pick-up scale but keeps the tiles fully draggable.',
    tag: 'Component',
  },
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
]
