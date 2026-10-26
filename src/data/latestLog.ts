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
    title: 'A tic-tac-toe you cannot beat, only draw',
    summary: 'Tic-tac-toe — you are X against a perfect O that plays a full minimax search of the whole game tree; no openings book, no letting you win. A draw is the best anyone can force, verified in Node with zero losses over all play.',
    tag: 'Component',
  },
  {
    title: 'A keycap that answers your real keyboard',
    summary: 'Kbd — the one keycap every shortcut on the site is now drawn with; push it with the pointer and it sinks, press the key it names and it depresses and lights lime. A legend, never a handler, so it never intercepts the shortcut.',
    tag: 'Component',
  },
  {
    title: 'A panel that levels toward you as you scroll',
    summary: 'ContainerScroll — a framed panel tilted back on the x-axis that rotates flat toward you as the section scrolls, scaling up and lighting its lime rim, all scrubbed from scroll and smoothed with a spring. Reduced motion shows it flat and still.',
    tag: 'Motion',
  },
  {
    title: 'Links that roll over on hover and focus',
    summary: 'RollingLink — a label whose letters turn over one after the next, built as two stacked copies of the word; aria-hidden with a plain label, rolls on keyboard focus too, and drops to a colour change under reduced motion. Now under every footer row.',
    tag: 'Component',
  },
  {
    title: 'A Mastermind you crack by deduction',
    summary: 'Mastermind — guess a hidden four-colour code and read back honest black/white pegs (right-place, then right-colour by the true count); the code is a fair draw, made once and never changed. Fully keyboard-playable.',
    tag: 'Component',
  },
  {
    title: 'A Lights Out puzzle with a provable par',
    summary: 'Lights Out — press a cell to flip it and its four neighbours and clear the 5x5 to dark; every board is scrambled from solved so it is always solvable, and the fewest shown is the true minimum, solved over GF(2).',
    tag: 'Component',
  },
  {
    title: 'A game of Simon you play by memory',
    summary: 'Simon — it lights a lengthening run of pads and tones and you return it, one step longer each round, on a true random draw; score and best are the rounds you really reached. Optional tones; reduced motion keeps every pad readable.',
    tag: 'Component',
  },
  {
    title: 'A coin flip that drifts toward fifty-fifty',
    summary: 'Coin flip — press it and it springs up, tumbles, and lands heads or tails on an honest even draw; a running tally bar shows the split settling toward 50/50 the more you flip. Reduced motion lands it at once.',
    tag: 'Component',
  },
  {
    title: 'A fidget spinner that coasts on real momentum',
    summary: 'Fidget spinner — grab a lobe and swing it and it keeps the throw you gave it, winding down against two frictions while a live rpm readout counts the coast. Reduced motion lands it at rest instead.',
    tag: 'Component',
  },
  {
    title: 'A Magic 8-ball you shake for an answer',
    summary: 'Magic 8-ball — ask a yes-or-no question and the die floats up out of the ink with one of the twenty classic replies, a fair random draw, nothing weighted. Pure SVG; reduced motion just swaps the reply.',
    tag: 'Component',
  },
]
