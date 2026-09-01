// Single source of truth for the /uses page — "The setup".
//
// A /uses page (the uses.tech convention) is the lived-in companion to /now:
// where /now says what I am focused on, this says what I actually reach for to
// do it. It is deliberately distinct from /toolkit — Toolkit is the full
// professional stack grouped by purpose, a catalogue of capability; this is the
// everyday environment and the desk it happens at, day to day.
//
// HONESTY: everything not marked `placeholder` is literally true of how the
// work gets made (and, for the "How this site is made" group, true of this
// exact repository). The personal hardware and app specifics I would rather
// leave as honest, clearly-marked prompts than fabricate — an empty card is
// more truthful than an invented gadget. Fill those in (or drop them) over
// time; change LAST_UPDATED whenever the content below is revised.

/** ISO date (YYYY-MM-DD) the entries below were last revised. */
export const LAST_UPDATED = '2026-09-01'

/** Where the desk is, for the dateline under the title. */
export const LOCATION = 'Berlin'

export interface UsesItem {
  /** The thing itself, e.g. "TypeScript". */
  name: string
  /** One honest line: what it is for, or why it is the daily driver. */
  note: string
  /** A prompt to fill in later, rendered muted with a "to fill in" chip —
   *  an honest blank, never a claim. */
  placeholder?: boolean
}

export interface UsesGroup {
  /** Short editorial label for the group. */
  label: string
  /** A sentence framing what the group covers. */
  intro: string
  items: UsesItem[]
}

// Ordered so the true, concrete material leads and the personal specifics (the
// desk) come last, framed plainly as mine to fill in.
export const USES: readonly UsesGroup[] = [
  {
    label: 'The stack I live in',
    intro:
      'What is actually open on the machine most days — the daily drivers, not a full inventory. The complete, grouped list is the toolkit.',
    items: [
      {
        name: 'TypeScript',
        note: 'Everything is typed, strict mode on. The compiler is the first reviewer of every change.',
      },
      {
        name: 'React',
        note: 'The web is React and hooks — small components, honest state, no framework magic to fight.',
      },
      {
        name: 'SwiftUI',
        note: 'The native iOS side. Layout, gestures, and the small platform conventions that make an app feel at home.',
      },
      {
        name: 'Framer Motion',
        note: 'Every transition and spring on the web goes through it. The motion here is hand-tuned, never a preset.',
      },
      {
        name: 'Tailwind CSS',
        note: 'v4, via the Vite plugin. Styling stays next to the markup so a component is one file to read.',
      },
      {
        name: 'Vite',
        note: 'The dev server and the build. Fast enough that the feedback loop never breaks the flow.',
      },
      {
        name: 'Supabase',
        note: 'Postgres, auth, and the data model underneath — one backend keeping web and native honest with each other.',
      },
      {
        name: 'Git and GitHub',
        note: 'Small, frequent commits, in the open. This whole site is a public repository, built a little at a time.',
      },
    ],
  },
  {
    label: 'How this site is made',
    intro:
      'Not a description — the literal setup behind the page you are reading. All of it is in the repository.',
    items: [
      {
        name: 'Hand-built components',
        note: 'No UI kit, no template. Every card, field, and cursor effect is written from scratch in this repo.',
      },
      {
        name: 'React 18 + Vite + strict TS',
        note: 'The exact stack this site runs on. Client-side routing, code-split pages, a lean initial bundle.',
      },
      {
        name: 'Self-hosted type',
        note: 'Fraunces (a variable serif) for display, Inter for text — subset, preloaded, served from the site itself.',
      },
      {
        name: 'Dark, with one accent',
        note: 'A near-black ground and a single lime. Restraint is the point: one colour has to earn its place.',
      },
      {
        name: 'Reduced-motion first',
        note: 'Every animation has a still fallback. The calm path is a real design, not an afterthought.',
      },
      {
        name: 'Static, open, in the open',
        note: 'A static build, open source on GitHub, growing most days. The changelog is the honest record.',
      },
    ],
  },
  {
    label: 'The desk',
    intro:
      'The physical setup — the machine, the screen, the things on the table. These are honest blanks for now: I would rather leave them empty than list something I only half mean.',
    items: [
      {
        name: 'Machine',
        note: 'The computer the work happens on. To fill in with the real one.',
        placeholder: true,
      },
      {
        name: 'Display',
        note: 'What the code and the canvas live on. To fill in.',
        placeholder: true,
      },
      {
        name: 'Editor',
        note: 'Where the code is actually written, and how it is set up. To fill in.',
        placeholder: true,
      },
      {
        name: 'Terminal and shell',
        note: 'The prompt the commits go through. To fill in.',
        placeholder: true,
      },
      {
        name: 'Browser',
        note: 'The one kept open with devtools while building. To fill in.',
        placeholder: true,
      },
      {
        name: 'Sound',
        note: 'What is on while the small moments get sweated. To fill in.',
        placeholder: true,
      },
    ],
  },
]

/** How many entries are real, honest picks (not blanks) — read at render so the
 *  page can say plainly how much of it is filled in. */
export const USES_REAL_COUNT = USES.reduce(
  (sum, g) => sum + g.items.filter((i) => !i.placeholder).length,
  0,
)
