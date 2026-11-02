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
  {
    title: 'A card you point at to decrypt',
    summary: 'Cipher card — a face filled edge to edge with randomising glyphs you cannot read, until a soft window of light follows your pointer and decrypts only the stream beneath it; move on and it scrambles back. Pointer-masked, not a timed resolve: the reveal is a place you point. The message above stays legible and names the range behind any one project. Reduced motion holds it as a dim watermark.',
    tag: 'Component',
  },
  {
    title: 'A card that unfolds like a folded letter',
    summary: 'Fold reveal — the trifold gesture, rebuilt by hand: two wings creased back behind a teaser panel swing flat into one lit surface as the full line fades and lifts up, each wing catching the light as it lands. A different mechanism from the flip card — three panels into one, not one plane to its back. The teaser names one project, the reveal opens onto the whole range. Reduced motion shows it flat and lit.',
    tag: 'Component',
  },
  {
    title: 'A 2048 you slide a whole board at a time',
    summary: '2048 — the sliding-tile game, rebuilt by hand: swipe or arrow a whole board, equal tiles merge into their doubled sum, a fresh 2 or 4 drops in. Every tile keeps a stable id so each move really slides, a merged tile pops and the one it absorbs slides under it and leaves. The score and best are honest; reduced motion cuts straight to the new cells.',
    tag: 'Component',
  },
  {
    title: 'A stories bar that paces a sequence',
    summary: 'Story progress — the segmented bar across the top of every story: the active segment fills off a real-elapsed-time loop, the ones behind snap full, and it ticks on when it brims. Hold to pause and read, tap the sides to step. The demo slides are the five disciplines, not one project. Reduced motion runs no clock; you advance by hand.',
    tag: 'Component',
  },
  {
    title: 'A field that records your keyboard shortcut',
    summary: 'Shortcut recorder — the keybinding capture from a real settings panel: arm the well, hold your modifiers, strike a key, and the live chord freezes into keycaps. It swallows the keystroke while recording, so Cmd-S records instead of saving the page. Escape cancels; reduced motion drops the pulse and flash.',
    tag: 'Component',
  },
  {
    title: 'A line of type that rides a travelling wave',
    summary: 'Wave type — a slow sine wave rolls through a line, each letter bobbing a beat behind the last so a crest and a band of light travel across the word. The ambient member of the type family: it never arrives, the motion is the point. Reduced motion lays it flat and still.',
    tag: 'Motion',
  },
]
