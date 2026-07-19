// Single source for the /contents page — an editorial table of contents for the
// whole site. Every entry points at a real route with an honest, one-line
// description. Grouped into named sections so the breadth reads as a publication
// about the work, not a flat link list. Keep paths and copy in sync with the
// router (src/App.tsx), the command palette, and the go-chords in Keyboard.tsx.

export interface ContentEntry {
  /** Route path, e.g. "/about". */
  to: string
  /** Display title. */
  title: string
  /** One honest line about what lives there. */
  blurb: string
  /** Keyboard go-chord destination key, if it has one (tap `g` then this). */
  chord?: string
}

export interface ContentSection {
  /** Short editorial label for the group. */
  label: string
  /** A sentence framing the section. */
  intro: string
  entries: ContentEntry[]
}

export const CONTENTS: ContentSection[] = [
  {
    label: 'Start',
    intro: 'Who I am and what I am doing right now.',
    entries: [
      { to: '/', title: 'Home', blurb: 'The landing page — the hero, the range, the work.', chord: 'h' },
      { to: '/about', title: 'About', blurb: 'The story, the path, the principles behind the work.', chord: 'a' },
      { to: '/now', title: 'Now', blurb: 'What I am focused on, learning, and building this season.', chord: 'n' },
    ],
  },
  {
    label: 'Work',
    intro: 'The projects, and the thinking underneath them.',
    entries: [
      { to: '/work', title: 'Work', blurb: 'Every project as an animated ledger, each with its own case study.', chord: 'w' },
    ],
  },
  {
    label: 'Craft',
    intro: 'How the work is made, and the tools that make it.',
    entries: [
      { to: '/playground', title: 'Playground', blurb: 'A live gallery of motion experiments you can poke at.', chord: 'p' },
      { to: '/toolkit', title: 'Toolkit', blurb: 'The stack and the tools, and how I actually reach for them.', chord: 't' },
      { to: '/craft', title: 'On motion', blurb: 'Notes on animation craft, each one playable in place.', chord: 'm' },
      { to: '/design', title: 'Design language', blurb: 'A living style guide — palette, type, and motion, each token copyable.', chord: 'd' },
      { to: '/colophon', title: 'Colophon', blurb: 'How this site is built, down to the fonts and the counts.', chord: 'l' },
    ],
  },
  {
    label: 'Words',
    intro: 'Writing, and answers to what people tend to ask.',
    entries: [
      { to: '/writing', title: 'Writing', blurb: 'Notes and essays, honestly still in progress.', chord: 'j' },
      { to: '/answers', title: 'Answers', blurb: 'The questions people ask, answered plainly.', chord: 'q' },
    ],
  },
  {
    label: 'Reach',
    intro: 'Ways to get in touch, and the short version of the CV.',
    entries: [
      { to: '/contact', title: 'Contact', blurb: 'Reach me — email, availability, and where else I am.', chord: 'c' },
      { to: '/resume', title: 'Résumé', blurb: 'A one-page CV, laid out to print cleanly.', chord: 'r' },
    ],
  },
  {
    label: 'Play',
    intro: 'The site turned inside out, for the curious.',
    entries: [
      { to: '/terminal', title: 'Terminal', blurb: 'Drive the whole site by typing, like a real shell.', chord: 's' },
      { to: '/changelog', title: 'Changelog', blurb: 'The build log, in honest chapters, filterable by kind.', chord: 'b' },
    ],
  },
]

/** Flat list of every entry, for filtering and counts. */
export const ALL_CONTENT_ENTRIES: ContentEntry[] = CONTENTS.flatMap((s) => s.entries)
