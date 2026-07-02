// Writing — an honest, in-the-open notes section.
//
// This is a real, intentional part of the site, but the pieces themselves are
// still being written. Every entry below is a genuine topic Arseniy plans to
// write about, and each is marked `status: 'planned'` so it reads as an honest
// promise, not a fabricated post. NOTHING here pretends to be finished, and no
// note invents a claim, a client, or a result. As real pieces land, flip a
// note to `status: 'published'`, give it a `date`, and (later) a detail route.
//
// Keep it honest: only topics he actually means to write, in his own voice,
// when he writes them.

export type NoteStatus = 'planned' | 'published'

export interface Note {
  slug: string
  title: string
  /** One honest line on what the piece will be about. */
  summary: string
  /** A single grouping tag, used by the on-page filter. */
  tag: NoteTag
  status: NoteStatus
  /** ISO date, only once genuinely published. */
  date?: string
}

export type NoteTag = 'Craft' | 'Building in the open' | 'AI' | 'iOS'

// The filter tabs, in display order. "All" is prepended by the page.
export const NOTE_TAGS: NoteTag[] = ['Craft', 'Building in the open', 'AI', 'iOS']

export const NOTES: Note[] = [
  {
    slug: 'motion-that-earns-its-place',
    title: 'Motion that earns its place',
    summary:
      'When an animation helps someone understand where they are, and when it is just noise. How I decide, and why every motion here respects reduced-motion.',
    tag: 'Craft',
    status: 'planned',
  },
  {
    slug: 'building-a-portfolio-in-the-open',
    title: 'Building this site in the open',
    summary:
      'This portfolio is public and grows a little each day. What it is like to build something continuously, in full view, and what that changes about how you work.',
    tag: 'Building in the open',
    status: 'planned',
  },
  {
    slug: 'a-tutor-that-asks-not-answers',
    title: 'A tutor that asks, not answers',
    summary:
      'The design idea behind Guided: why handing a student the answer short-circuits learning, and what it takes to build a tool that asks the right question instead.',
    tag: 'AI',
    status: 'planned',
  },
  {
    slug: 'one-backend-two-apps',
    title: 'One backend, two apps',
    summary:
      'Keeping a React web app and a native SwiftUI app honest with each other on a single shared backend, without the two ever quietly drifting apart.',
    tag: 'iOS',
    status: 'planned',
  },
  {
    slug: 'ship-then-refine',
    title: 'Ship, then refine',
    summary:
      'Why I put rough things in front of people early, and how the slow, quiet work of refinement is where the craft actually lives.',
    tag: 'Craft',
    status: 'planned',
  },
  {
    slug: 'building-with-models-not-around-them',
    title: 'Building with models, not around them',
    summary:
      'Weaving AI into a real product so it feels like part of the thing, not a chatbot bolted on the side. Notes from actually doing it.',
    tag: 'AI',
    status: 'planned',
  },
]

export const PUBLISHED_COUNT = NOTES.filter((n) => n.status === 'published').length
export const NOTE_COUNT = NOTES.length
