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
  /**
   * The threads Arseniy actually means to pull in the finished piece. These
   * are honest planning notes — an outline of intent, NOT fabricated
   * conclusions or claims. Shown on the note's detail page while it is still
   * in draft, so a reader can see where it is headed.
   */
  plan?: string[]
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
    plan: [
      'The one question I ask before adding any animation',
      'Where motion genuinely helps: orientation, continuity, feedback',
      'Treating reduced-motion as a first-class path, not a fallback',
    ],
  },
  {
    slug: 'building-a-portfolio-in-the-open',
    title: 'Building this site in the open',
    summary:
      'This portfolio is public and grows a little each day. What it is like to build something continuously, in full view, and what that changes about how you work.',
    tag: 'Building in the open',
    status: 'planned',
    plan: [
      'What changes when the commit history is part of the work',
      'Moving in small, daily, coherent steps instead of big drops',
      'The discipline of never pushing something broken to main',
    ],
  },
  {
    slug: 'a-tutor-that-asks-not-answers',
    title: 'A tutor that asks, not answers',
    summary:
      'The design idea behind Guided: why handing a student the answer short-circuits learning, and what it takes to build a tool that asks the right question instead.',
    tag: 'AI',
    status: 'planned',
    plan: [
      'Why the answer is often the least useful thing to hand a student',
      'Designing prompts that nudge toward understanding, not solve',
      'Staying curriculum-aware without becoming rigid',
    ],
  },
  {
    slug: 'one-backend-two-apps',
    title: 'One backend, two apps',
    summary:
      'Keeping a React web app and a native SwiftUI app honest with each other on a single shared backend, without the two ever quietly drifting apart.',
    tag: 'iOS',
    status: 'planned',
    plan: [
      'Keeping a React web app and a SwiftUI app in step',
      'Where a shared Supabase schema helps, and where it leaks',
      'Catching drift between the two before anyone feels it',
    ],
  },
  {
    slug: 'ship-then-refine',
    title: 'Ship, then refine',
    summary:
      'Why I put rough things in front of people early, and how the slow, quiet work of refinement is where the craft actually lives.',
    tag: 'Craft',
    status: 'planned',
    plan: [
      'Why rough-but-real beats polished-but-late',
      'The slow work of refinement, and why it is where craft lives',
      'Telling which details are actually worth the sweat',
    ],
  },
  {
    slug: 'building-with-models-not-around-them',
    title: 'Building with models, not around them',
    summary:
      'Weaving AI into a real product so it feels like part of the thing, not a chatbot bolted on the side. Notes from actually doing it.',
    tag: 'AI',
    status: 'planned',
    plan: [
      'Making AI feel like part of the product, not bolted on',
      'Designing for the moments when the model is wrong',
      'The seam between deterministic code and a model',
    ],
  },
]

export const PUBLISHED_COUNT = NOTES.filter((n) => n.status === 'published').length
export const NOTE_COUNT = NOTES.length

/** Find a note by slug, for the deep-linkable detail page. */
export function getNote(slug: string | undefined): Note | undefined {
  if (!slug) return undefined
  return NOTES.find((n) => n.slug === slug)
}

/**
 * The next note in reading order, wrapping around the list. Used for
 * "keep reading" navigation on a note's detail page.
 */
export function nextNote(slug: string): Note | undefined {
  const i = NOTES.findIndex((n) => n.slug === slug)
  if (i === -1) return undefined
  const next = NOTES[(i + 1) % NOTES.length]
  return next.slug === slug ? undefined : next
}

/** Other planned notes sharing a tag, excluding the given slug. */
export function relatedNotes(note: Note): Note[] {
  return NOTES.filter((n) => n.tag === note.tag && n.slug !== note.slug)
}
