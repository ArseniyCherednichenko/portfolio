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
  {
    title: 'A radar scope that lights what the sweep finds',
    summary: 'A plan-position sonar — a bearing line rotates and strikes each contact to a phosphor glow that fades before the next lap. Click the face to drop your own.',
    tag: 'Component',
  },
  {
    title: 'The framework stops re-downloading every day',
    summary: 'React, the router and Framer Motion now sit in their own cached chunks, so a daily content deploy no longer re-hashes 295KB of code that never changed.',
    tag: 'Infra',
  },
  {
    title: 'The oldest trick for drawing a straight line',
    summary: 'The fourteenth mechanism — Watt’s 1784 linkage, three bars whose coupler midpoint rides the straight crossing of a figure-eight, within 1.9% of true, the roughest of the straight-line trio by design.',
    tag: 'Component',
  },
  {
    title: 'A mechanism that cuts slow and returns fast',
    summary: 'The thirteenth mechanism — a Whitworth quick-return turning one steady crank into a ram that crawls out on the working stroke and snaps back, the ratio measured off the geometry.',
    tag: 'Component',
  },
]
