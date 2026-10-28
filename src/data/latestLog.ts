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
    title: 'A presence row that spreads as you reach',
    summary: 'Avatar stack — the who-is-here cluster collaborative products grow: faces overlap at rest, ease apart when you point or tab in, and the one under you lifts with a tooltip. Past a cap they collapse into a +N that opens the full roster; people join and leave on a layout spring. Reduced motion settles it in place.',
    tag: 'Component',
  },
  {
    title: 'A notification pile you swipe to clear',
    summary: 'Notification stack — the persistent counterpart to the Toast: notifications pile up and wait, collapse into a peeking deck, and a new one springs in and pushes the rest down. Swipe a card to dismiss, or press Backspace on a focused one. Reduced motion settles it in place.',
    tag: 'Component',
  },
  {
    title: 'A reading beam that draws down the margin',
    summary: 'TracingBeam — the Craft page\'s five motion notes now read on a beam that fills down the margin as you scroll, a lit head riding the leading edge where your eye is. The margin-rule kin of the top bar and the page spine; reduced motion draws it full and still.',
    tag: 'Motion',
  },
  {
    title: 'A zen garden you rake and never finish',
    summary: 'Zen garden — a karesansui you rake with the pointer; a seven-tooth rake carves parallel grooves that follow your hand and stay where you leave them, passing behind two stones. The calm toy with no score, only tending. Nothing moves on a clock, so reduced motion needs no case.',
    tag: 'Component',
  },
  {
    title: 'An input whose words scatter into pixels',
    summary: 'Vanish input — the search box every app has, rebuilt by hand: it cycles its prompts while empty, and on submit the text rasterises and its pixels drift away rather than just clearing. A real labelled form; reduced motion clears it at once.',
    tag: 'Component',
  },
  {
    title: 'A peg solitaire that solves itself, honestly',
    summary: 'Peg solitaire — the English cross board; jump every peg off but one, cleanest finish in the centre. The rules are strictly enforced, and Solve it replays a real 31-move line, verified move by move.',
    tag: 'Component',
  },
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
]
