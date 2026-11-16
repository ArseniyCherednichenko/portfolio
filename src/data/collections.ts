// Collections — Arseniy's own curated, taste-led paths through the Playground.
//
// The Playground is organised by the *kind* of motion at work (type, cards,
// pointer fields, scroll, controls) and by family; the Library is the
// exhaustive catalogue. Neither says which pieces *he* would send you to first,
// or why. This file is that missing layer: a handful of personal collections,
// each a small set of favourites grouped by a thread he actually cares about,
// with one honest line on why each one earns its place.
//
// Honesty rules, same as everywhere else on the site:
//  - Every `anchor` is a real experiment id that exists on /playground, so each
//    pick deep-links straight to the live piece (`/playground#<anchor>`). If a
//    piece is ever renamed or removed, its entry here has to move with it.
//  - The notes are opinion and observation in his own voice — taste, not
//    invented fact. No fabricated metrics, no made-up history.
//
// This page is deliberately about the craft and the person behind it, not any
// single product: it de-centres Guided by foregrounding the range of things he
// has built for their own sake.

export interface Pick {
  /** Display name, matching the piece's title on /playground. */
  name: string
  /** The experiment's real id on /playground — the deep-link target. */
  anchor: string
  /** One honest line, his voice, on why this one is here. */
  note: string
}

export interface Collection {
  /** Stable id, used for the in-page anchor and the chip rail. */
  id: string
  /** Two-digit index, for the editorial numbering. */
  num: string
  /** Short title of the thread. */
  title: string
  /** One line framing the collection — what ties these together. */
  blurb: string
  /** The curated picks, in the order he'd walk you through them. */
  picks: Pick[]
}

export const COLLECTIONS: Collection[] = [
  {
    id: 'start-here',
    num: '01',
    title: 'If you click one thing',
    blurb:
      'The pieces I would hand a stranger first — the ones that explain, in a few seconds of motion, what the rest of the shelf is for.',
    picks: [
      {
        name: 'Lorenz',
        anchor: 'lorenz',
        note: 'Three simple equations that never repeat and never escape. I could watch the ribbon draw itself all day.',
      },
      {
        name: 'Strandbeest',
        anchor: 'strandbeest',
        note: 'A linkage that turns a spinning crank into a convincing walk. Built to the real proportions, so the gait is honest.',
      },
      {
        name: 'Tesseract',
        anchor: 'tesseract',
        note: 'A four-dimensional cube turned down into three so you can grab it. The closest I can get you to seeing 4D.',
      },
      {
        name: 'Holo card',
        anchor: 'holo-card',
        note: 'The one people reach for the cursor to touch. All of it is light and angle — there is no image under there.',
      },
      {
        name: 'Chaos game',
        anchor: 'chaos-game',
        note: 'Roll a die, step halfway to a corner, repeat. A Sierpinski triangle falls out of pure randomness. It should not work, and it does.',
      },
    ],
  },
  {
    id: 'quiet-machines',
    num: '02',
    title: 'Quiet machines',
    blurb:
      'Clockwork and linkages — the honest mechanical kind. No physics engine faking it; each one is drawn from the geometry that actually makes it move.',
    picks: [
      {
        name: 'Geneva drive',
        anchor: 'geneva-drive',
        note: 'Continuous turning in, precise stop-and-go out. The mechanism that used to advance film one frame at a time.',
      },
      {
        name: 'Escapement',
        anchor: 'escapement',
        note: 'The tick of a clock, made visible — the one part that doles out time in equal bites.',
      },
      {
        name: 'Peaucellier-Lipkin linkage',
        anchor: 'peaucellier',
        note: 'The first linkage to draw a perfectly straight line from nothing but rotation. A small nineteenth-century miracle.',
      },
      {
        name: 'Planetary gears',
        anchor: 'planetary-gears',
        note: 'Sun, planets, and ring turning at once. The ratios are exact, so you can count the teeth and check my work.',
      },
      {
        name: 'Whitworth quick-return',
        anchor: 'whitworth',
        note: 'Slow on the cut, fast on the way back. Geometry doing the job a motor controller would do today.',
      },
    ],
  },
  {
    id: 'order-from-noise',
    num: '03',
    title: 'Order out of noise',
    blurb:
      'Start with something random or local and simple, let it run, and watch structure arrive on its own. Emergence is the thing I find hardest to stop building.',
    picks: [
      {
        name: 'Barnsley fern',
        anchor: 'barnsley-fern',
        note: 'Four little matrices, chosen at random thousands of times, and a living fern grows pixel by pixel.',
      },
      {
        name: 'Particle life',
        anchor: 'particle-life',
        note: 'A few coloured dots and some attraction rules. No cells coded in — but cells, and chases, and whole ecologies turn up anyway.',
      },
      {
        name: 'Diffusion-limited aggregation',
        anchor: 'dla',
        note: 'Particles wander until they stick, and a frost-coloured coral branches outward. The same rule builds real snowflakes.',
      },
      {
        name: 'Dragon curve',
        anchor: 'dragon-curve',
        note: 'Fold a strip of paper the same way again and again, unfold it, and this is the edge. It tiles the plane without a single gap.',
      },
      {
        name: 'Elementary automaton',
        anchor: 'elementary-ca',
        note: 'One row of cells, one tiny rule, read top to bottom. Rule 30 is so unpredictable it has been used to make random numbers.',
      },
    ],
  },
  {
    id: 'touch-it',
    num: '04',
    title: 'Reach out and touch it',
    blurb:
      'The toys. Pieces that want a pointer, a drag, a press — the ones that are more fun than they have any right to be.',
    picks: [
      {
        name: 'Bubble wrap',
        anchor: 'bubble-wrap',
        note: 'Pop them. That is the whole thing. I will not pretend there is more to it.',
      },
      {
        name: 'Theremin',
        anchor: 'theremin',
        note: 'Play it without touching it — pitch on one axis, volume on the other, the way the real instrument works.',
      },
      {
        name: 'Music box',
        anchor: 'music-box',
        note: 'Pin the drum, turn the crank, and the comb plays it back. A sequencer disguised as an antique.',
      },
      {
        name: 'Snow globe',
        anchor: 'snow-globe',
        note: 'Shake it. The snow obeys a little gravity and a lot of nostalgia.',
      },
      {
        name: 'Zen garden',
        anchor: 'zen-garden',
        note: 'Rake the sand into lines around the stones. No goal, no score — just somewhere to put your hands while you think.',
      },
    ],
  },
  {
    id: 'light-and-glass',
    num: '05',
    title: 'Light and glass',
    blurb:
      'Where the work stops being diagrams and starts being an image — refraction, caustics, grain, and sheen, all computed live rather than painted.',
    picks: [
      {
        name: 'Rain on glass',
        anchor: 'rain-glass',
        note: 'Droplets gather, merge, and finally run, dragging a clear trail through the fog behind them. Weather, simulated.',
      },
      {
        name: 'Caustics',
        anchor: 'caustics',
        note: 'The bright, wandering net of light you see on the floor of a pool. One of my favourite things to just leave running.',
      },
      {
        name: 'Frost',
        anchor: 'frost',
        note: 'Ice feathering across the pane from the edges in. It grows differently every time you load it.',
      },
      {
        name: 'Dither',
        anchor: 'dither',
        note: 'A gradient with no in-between shades, faked by a careful scatter of dots. The trick that made old screens look richer than they were.',
      },
      {
        name: 'Plasma',
        anchor: 'plasma',
        note: 'Pure sine waves stacked into something that looks molten. A demoscene classic, and a soft spot of mine.',
      },
    ],
  },
  {
    id: 'telling-time',
    num: '06',
    title: 'Time, told differently',
    blurb:
      'Every one of these reads the real clock or the real sky. A quiet obsession with the instruments we built to measure time before we had screens.',
    picks: [
      {
        name: 'Sundial',
        anchor: 'sundial',
        note: 'The oldest clock there is, casting a true shadow for the actual hour where you are sitting.',
      },
      {
        name: 'Moon phase',
        anchor: 'moon',
        note: 'Tonight’s real moon, lit from the real angle. I like that the site quietly knows what the sky is doing.',
      },
      {
        name: 'Orrery',
        anchor: 'orrery',
        note: 'The inner planets on their actual orbital periods. Slow, patient, and correct.',
      },
      {
        name: 'Chronograph',
        anchor: 'chronograph',
        note: 'A stopwatch with real hands and real sweep. The detail is in the way the needle settles.',
      },
      {
        name: 'Foucault pendulum',
        anchor: 'foucault',
        note: 'It swings in a fixed plane while the floor turns under it — the plainest proof you can draw that the Earth rotates.',
      },
    ],
  },
]

/** Total curated picks across every collection — a live count for the intro. */
export const PICK_COUNT = COLLECTIONS.reduce((n, c) => n + c.picks.length, 0)
