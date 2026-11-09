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
    title: 'A card whose border lights toward your cursor',
    summary: "Glow card — the glowing border of 21st.dev and Aceternity rebuilt by hand, and the cursor-driven counterpart to the two border effects beside it: the border beam runs a comet on a timer and the electric border jitters on a timer, both blind to the pointer, where this one is handed to it. A conic gradient whose bright wedge always points at the cursor lights only the stretch of border nearest it, ramping up as you near and fading with distance. It comes alive as a grid, not one card: each card tracks the single global pointer, so none needs hovering — sweep the gutters between them and every facing edge lights at once, like a torch passing framed glass — and the lift is proximity, not a hover flag, so the glow slides across the gaps instead of snapping per card. It stays on the frame, a crisp masked ring over a blurred bloom with no wash across the surface, which is what keeps it distinct from the spotlight card rather than a restyle of it. Reduced motion never wires the pointer: each card rests with a calm, even, faint ring, framed but still.",
    tag: 'Component',
  },
  {
    title: 'A spinning coin whose roll races as its spin dies',
    summary: "Euler's disk — the physics toy where a spinning coin settling on a table does the thing your intuition refuses, and the opposite kind of strangeness to the two pendulums beside it: those are chaos you cannot predict, this is utterly predictable and defies you anyway. Spin a coin on its edge and as it loses energy it leans flatter and flatter, yet the point where its rim meets the table races around faster and faster, the hum rising to a whirr, until in one last blur it slaps flat and stops dead — the spin winding to nothing while the roll runs away toward infinity. Two clocks run at once in opposite directions, and both are integrated honestly: the disk is a circle tilted from the table by an angle, its centre riding at R·sin(angle) and its contact point the lowest point of the rim, and as the lean bleeds to zero the contact precesses at a rate the physics sends to infinity, growing like one over the square root of that angle — so the lean decays as minus one over the root of the angle, a collapse slow while the coin stands and suddenly very fast as it goes flat, and the instant it visibly flattens is the instant the bright contact bead blurs into a ring. Drawn in true perspective, not a faked ellipse: the outline is a real circle of rim points leaning in 3-D and projected through one camera pitched down over the table, the coin has a milled metal edge and a brushed face with a specular glint, and it throws a contact shadow that spreads as it lies down. A fixed timestep, so it reads the same on any monitor, and a seeded release sequence, so the same coins spin the same way every load with nothing on the hot path touching Math.random. Press anywhere to release a fresh spin; reduced motion lays one coin down mid-lean, still, with a faint hint of the ring, and holds it.",
    tag: 'Component',
  },
  {
    title: 'Rain on a window you wipe to see the city',
    summary: "Rain on glass — the water the pointer fields had not shown, and the third kind: not the ripple tank's surface waves or the fluid sim's stirred dye, but condensation held by surface tension against a vertical pane, where the whole subject is the glass. So the backdrop — a blurred, out-of-focus night city — is deliberately never in focus, and the only way to see it sharply is to clear the mist, by letting a running drop cut a streak through the fog or by dragging a palm across the cold glass. A greyscale fog mask holds where the pane is clear and is faded a hair back toward fogged every frame, so the glass slowly re-mists after you wipe it and a drop's trail heals over behind it — a living equilibrium, not a one-way erase. Tiny beads nucleate across the pane and grow; when one passes the point where gravity beats surface tension it breaks free and runs, accelerating down, cutting a cleared trail and absorbing every smaller bead it rolls over, radii adding in quadrature so a fat drop is visibly the sum of what it swept up. Each frame composites three layers: the fogged pane, the sharp city shown through the mask, and the beads drawn as little lenses with a contact shadow and a specular catch, each clearing its own patch of fog beneath it. One canvas over offscreen buffers in device pixels so it stays crisp, the canvas aria-hidden and the Wipe a real button; reduced motion draws one still frame of settled beads and healed trails, the city showing through.",
    tag: 'Component',
  },
  {
    title: 'A menu that changes shape between its panels',
    summary: "Morph menu — the morphing menu the Overlays family was missing, and the deliberate opposite of the popover and the context menu beside it. Where the popover anchors one fixed panel and the context menu opens one flat list, this holds a stack of panels and makes moving between them the whole show. Pick a row that owns a sub-panel and the card does not swap abruptly or push a second menu on top of the first — it springs its height from the old panel's to the new one's while the outgoing panel slides off one way and the incoming slides in from the other, so a tall root easing down to a short sub (or climbing back up) reads as one object changing shape rather than two screens cutting. It is the dynamic-island / 'Family drawer' idea — content-driven size made to animate — brought down to an ordinary settings menu. The height is real, not guessed: each panel's own content is measured by a callback ref the instant that panel mounts, and a ResizeObserver keeps it honest when a row's live 'current value' hint changes width under it. A genuine menu underneath, not a flourish — aria-haspopup and aria-expanded on the trigger, a labelled role=menu of menuitem rows, a single roving tabindex the arrow keys walk, ArrowRight or Enter to descend and ArrowLeft or Backspace to climb back, Escape or an outside click to close with focus handed back to the trigger — and rows can be internal links, external anchors, or callbacks, one of them tintable for a destructive action. Reduced motion drops the morph and the slide for a clean cross-cut, every control intact.",
    tag: 'Component',
  },
  {
    title: 'Needles dropped at random that count out pi',
    summary: "Buffon's needle — the 1733 problem run as a live experiment among the toys, and the sharper cousin of the Galton board beside it: where the board lets a whole shape fall out of chance (the bell curve), this lets a single number fall out of it, and that number is pi. Rule a floor with parallel lines one needle-length apart, drop needles on it at random, and the fraction that come to rest crossing a line is 2L / (pi·t) — so the crossings are quietly counting pi, with no circle drawn anywhere. The maths is exact and only the drawing is tuned: a needle whose centre lands a distance d from the nearest line at angle theta crosses exactly when (L/2)·|sin theta| is at least d, and with the lines a needle-length apart it straddles at most one, so the estimate is just twice the needle count over the crossing count. Crossing needles land in the accent and misses in cool grey, piling onto a floor that is never wiped so a frame costs only the fresh matchsticks, and the estimate up top crawls toward 3.14159, noisy at first, earning each digit as the law of large numbers does its slow work. No Math.random on the hot path — the drops are a seeded pseudo-random stream, so the same experiment runs identically every load; press the floor or tap Rain to pour a burst and hurry the digits in, Reset reseeds a fresh run. The canvas is decorative and hidden from assistive tech; the running tally sits in a polite live region and the controls are real buttons. Reduced motion drops one bounded batch at once and holds the floor and the number still.",
    tag: 'Component',
  },
  {
    title: 'A pendulum that hunts three magnets and settles',
    summary: "Magnetic pendulum — the double pendulum's quieter cousin among the toys, and its opposite argument. That one is chaos that never lands, a family of arms diverging forever onto nothing; this is chaos that always lands, and the whole drama is which of three magnets it lands on. A single bob hangs on an idealised pendulum over a triangle of magnets, and two forces fight for it: the pendulum pulls it back toward the centre while each magnet tugs it closer with a pull that sharpens as it nears — an inverse-cube attraction, softened by the height the bob swings above the plane so it never blows up directly overhead. A whisper of friction bleeds the energy off and the bob spirals, loops, doubles back, and is finally captured by one magnet and comes to rest. Which one is the textbook picture of a fractal basin of attraction: start a hair's breadth from where you did and it can spiral into a different magnet entirely, because the border where the three basins meet is infinitely filigreed and the outcome there is, for all practical purposes, unknowable in advance. The physics is honest — the real equation of motion (restoring pull, inverse-cube magnet attraction, linear friction) integrated with symplectic Euler on a fixed 1/240s substep, and the release points come from a fixed hash of the run index rather than Math.random. The trail is tinted toward whichever magnet is currently winning it, so the colour tells you where it is being pulled before the capture is decided. Press anywhere to drop the bob there at rest and hunt for the hairline borders. Reduced motion integrates one run to its resting place and lays the settled spiral down still.",
    tag: 'Component',
  },
  {
    title: 'A card finished in holographic foil',
    summary: 'Holo card — the holographic finish of a collectible trading card, and the deliberate opposite of the tilt, parallax and wobble cards beside it. All three of those answer the pointer by moving the card; this one barely moves. A few degrees of tilt is only the vehicle — what answers you is the foil: a band of rainbow interference and a field of glitter that live inside the surface and shift hue and position with the viewing angle, the way a foil-stamped card throws a different rainbow at every tilt. No other card in the family has anything living in its surface; here the surface is the effect. Three stacked layers do it — a smooth holo band blended with color-dodge, the same rainbow seen through a fine dot mask so it breaks into thousands of sparkles that travel the opposite way to the band (the counter-parallax the eye reads as depth), and a soft glare with a lime kiss of the accent riding the pointer. All pure CSS gradients on a handful of springs, nothing on a canvas; left alone the foil drifts in a slow ellipse so the rainbow is never dead. The children are the real, untouched content a screen reader reads once; every foil layer is decorative and hidden. An intensity prop scales the foil and the tilt for a louder or quieter surface. Reduced motion never starts the drift or wires the pointer — the card rests flat with the foil parked at one fixed, fully visible angle, a still photograph of foil.',
    tag: 'Component',
  },
  {
    title: 'Type carved into the surface, lit by your cursor',
    summary: 'Letterpress — the one piece in the type family that does not move the letters at all, a still effect about depth rather than motion. Its neighbours each animate a string — the split-text lifts the glyphs into place, the shiny sweep runs a band of light through them, the decode resolves them out of noise — while this sets the word almost exactly the colour of the surface, so there is nothing to read in the fill. The whole of it is legible only from the lime caught on one bevelled edge and the black thrown on the other; that pair of offset shadow copies is the relief, and a light vector points from the word to the pointer and swings the lit and dark edges around it, so pointing at the word is like carrying a lamp past an engraving. Deboss presses the type into the surface and emboss raises it out — the same bevel with the two copies swapped, dark on the lit side for a groove, bright on it for a ridge. Left alone the light drifts in a slow circle so the relief is never dead. Honest and cheap: the real word is a normal selectable element a screen reader reads once, the bevel pure CSS text-shadow on two springs with nothing on a render path. Reduced motion never starts the drift or wires the pointer — the light rests at the upper-left and the word holds one still, fully legible relief.',
    tag: 'Component',
  },
  {
    title: 'A card that leans and squishes toward your cursor',
    summary: 'Wobble card — the playful cousin of the tilt and parallax cards, and their deliberate opposite. Both of those answer the pointer by rotating a plane in 3D; this one never rotates and never leaves the flat. It leans — the whole body translates a few pixels toward the cursor on an under-damped spring, while the content inside trails a beat behind on a softer one. That gap between the body and its contents is the squish; the under-damped spring is the wobble, so letting go over-shoots home and settles like jelly rather than snapping. Built for a feature tile or a call-to-action you want springy under the hand: a cursor-tracked lime sheen eases in on hover, the moving layers are decorative, and the text stays real content, so a reader hears a plain card. Reduced motion never wires the pointer — the card rests flat with zero travel and keeps its own hover border.',
    tag: 'Component',
  },
  {
    title: 'An ink ripple that answers the press, in place',
    summary: 'Ripple — the Material touch-feedback ink wave, rebuilt by hand as a reusable surface primitive and the deliberate counterpart to the click spark. That one throws decorative particles off any click, site-wide and above everything; this is bounded and surface-contained — an ink circle clipped to the pressed element\'s own rounded shape, so the press reads as the surface itself acknowledging the touch rather than confetti over the top. The wave\'s radius is sized to the farthest corner from the exact point you pressed, so it always sweeps the whole surface however off-centre the press, and several overlap cleanly when you press in a hurry. It takes no semantics of its own — a wrapper that lays a decorative, aria-hidden ink layer over whatever you give it, so the child stays the real button or list row and a screen reader hears exactly what it did before. Keyboard parity by design: Enter or Space on a focused control, the one case with no pointer to read, spawns the ripple from the centre, so the feedback is never a mouse-only reward. Reduced motion drops the wave; the control keeps its own hover and active states, fully usable with nothing expanding.',
    tag: 'Component',
  },
]
