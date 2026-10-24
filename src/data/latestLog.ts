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
  {
    title: 'The tabbed panel from every settings screen',
    summary: 'Tabs — a real WAI-ARIA tablist wired to panels, one tab stop you arrow across; the lime indicator glides to your tab and the panel slides in from the way you moved. Underline or enclosed-pill.',
    tag: 'Component',
  },
  {
    title: 'A panel that slides in from the edge',
    summary: 'Drawer — the settings/filter/cart side panel, openable from either edge; drag the header toward its rim to dismiss, flick it shut, or press Escape. Its position is one value the drag writes and the backdrop reads.',
    tag: 'Component',
  },
  {
    title: 'A book you turn with your hands',
    summary: 'Flipbook — a right-hand page swings around the spine on a real 3D turn; drag it and the leaf follows your finger, release past halfway and it falls. It holds the eight beliefs the site is built by.',
    tag: 'Component',
  },
  {
    title: 'The bar and ring under every upload',
    summary: 'Progress — a determinate bar and ring whose fill springs and readout counts, plus an indeterminate sweep for when the end is unknown; a reduced-motion pulse stands in for the sweep.',
    tag: 'Component',
  },
  {
    title: 'A radio group where each option is a card',
    summary: 'Radio cards — a choose-one list of cards with headings and descriptions, a real radiogroup you arrow through on one tab stop, the lime outline springing to your choice.',
    tag: 'Component',
  },
  {
    title: 'The same two things, built with care and without',
    summary: 'Taste gains a ninth and tenth demo — a destructive action and a save — each shown as the bare default and the considered version, one switch flipping all ten at once.',
    tag: 'Polish',
  },
  {
    title: 'An onboarding flow that will not let you skip ahead',
    summary: 'A multi-step form, done as a reusable shell — steps slide in from the way you travel, a half-filled step blocks the advance, focus follows into each one, and the card glides to its height.',
    tag: 'Component',
  },
]
