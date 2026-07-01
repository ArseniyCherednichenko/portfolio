// Single source of truth for the /now page — a snapshot of what Arseniy is
// focused on at the moment, in the spirit of the "now page" convention
// (nownownow.com). This is deliberately time-stamped: a now page is honest
// precisely because it goes stale, so LAST_UPDATED reflects when the content
// below was actually last revised, not when the site was built or deployed.
//
// EDITING: change LAST_UPDATED to today's date whenever you touch the items.
// Keep everything here true. Entries marked `placeholder: true` render with a
// visible "to fill in" treatment — they are honest prompts, not claims, and
// should be replaced with real detail (or removed) rather than left forever.

/** ISO date (YYYY-MM-DD) the entries below were last revised. */
export const LAST_UPDATED = '2026-07-01'

/** Where Arseniy is, for the little dateline under the title. */
export const LOCATION = 'Berlin'

export interface NowItem {
  /** Small category label, e.g. "Building". */
  label: string
  /** One-line headline for the focus. */
  title: string
  /** A sentence or two of honest detail. */
  body: string
  /** Marks an item as a prompt to fill in later, not a current claim. */
  placeholder?: boolean
}

export const NOW_ITEMS: readonly NowItem[] = [
  {
    label: 'Building',
    title: 'Guided, most days',
    body: 'A Socratic AI tutor for students aged 8 to 18 — web, native iOS, and the Supabase backend underneath. It takes most of my hours, but the craft behind it is the constant, not the product.',
  },
  {
    label: 'Learning',
    title: 'Native iOS with SwiftUI',
    body: 'Getting properly fluent in SwiftUI so the iOS app feels native rather than ported. Layout, gestures, and the small platform conventions that make an app feel at home on the phone.',
  },
  {
    label: 'Sharpening',
    title: 'Motion design, in public',
    body: 'This site is my open workbench for interface animation — a new hand-built component most days. Pinned scroll, magnetic controls, cursor fields. If it lands here, I understand it.',
  },
  {
    label: 'Thinking about',
    title: 'How software should teach',
    body: 'The interesting question in Guided is restraint: when to withhold the answer so the understanding is earned. It keeps pulling me back to how interfaces guide attention without shouting.',
  },
  {
    label: 'Studying',
    title: 'Finishing school in Berlin',
    body: 'Still a student, building real products in parallel. The plan is to keep both honest — ship things people use while the foundations are still being laid.',
  },
  {
    label: 'Reading',
    title: 'A shelf to fill in',
    body: 'This is where the books and essays shaping how I think about craft and AI will go. Ask me in person for now — I would rather leave it blank than list something I only skimmed.',
    placeholder: true,
  },
]
