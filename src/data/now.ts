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
export const LAST_UPDATED = '2026-09-22'

/** Where Arseniy is, for the little dateline under the title. */
export const LOCATION = 'Berlin'

export interface NowItem {
  /** Small category label, e.g. "Building". */
  label: string
  /** One-line headline for the focus. */
  title: string
  /** A sentence or two of honest detail. */
  body: string
  /**
   * A longer, honest elaboration shown when the card is opened into its detail
   * dialog — an array of paragraph strings. These only expand on the one-line
   * `body`: no new claim, client, metric, or result appears here that is not
   * already true elsewhere on the site. A placeholder item has none.
   */
  detail?: string[]
  /** An internal route the detail dialog links out to, if one is relevant. */
  to?: string
  /** The wording for that link, e.g. "See the project". */
  toLabel?: string
  /** Marks an item as a prompt to fill in later, not a current claim. */
  placeholder?: boolean
}

export const NOW_ITEMS: readonly NowItem[] = [
  {
    label: 'Building',
    title: 'Guided, most days',
    body: 'A Socratic AI tutor for students aged 8 to 18 — web, native iOS, and the Supabase backend underneath. It takes most of my hours, but the craft behind it is the constant, not the product.',
    detail: [
      'I co-founded Guided, so the work runs the whole width of it: the interface, the native app, and the Supabase backend that holds it together. Most weeks that means moving between all three rather than living in one.',
      'It sits here on the Now page as one focus among several on purpose. It is where the hours go, but it is not the whole of what I am, and this site is the place I keep proving that to myself.',
    ],
    to: '/work/guided',
    toLabel: 'See the project',
  },
  {
    label: 'Learning',
    title: 'Native iOS with SwiftUI',
    body: 'Getting properly fluent in SwiftUI so the iOS app feels native rather than ported. Layout, gestures, and the small platform conventions that make an app feel at home on the phone.',
    detail: [
      'The web comes easily to me now; the phone is the deliberate stretch. I am learning SwiftUI the slow way — building the real screens, not tutorials — so I understand the layout system and the gesture model rather than fighting them.',
      'The aim is an app that feels made for the platform: the transitions, the touch targets, the quiet conventions a native user never notices until they are missing.',
    ],
  },
  {
    label: 'Sharpening',
    title: 'Motion design, in public',
    body: 'This site is my open workbench for interface animation, now past two hundred and thirty hand-built components — pinned scroll, magnetic controls, cursor fields, self-drawing line art. A new one most days. If it lands here, I understand it.',
    detail: [
      'The playground is not a portfolio of finished things so much as a practice done in the open. Something new most days, built from scratch, no UI kit underneath — the rule is that it only ships here once I actually understand how it works.',
      'It is the honest version of "sharpening": you can watch the range grow commit by commit rather than take my word for it.',
    ],
    to: '/playground',
    toLabel: 'Wander the playground',
  },
  {
    label: 'Thinking about',
    title: 'How software should teach',
    body: 'The interesting question in Guided is restraint: when to withhold the answer so the understanding is earned. It keeps pulling me back to how interfaces guide attention without shouting.',
    detail: [
      'A tutor that just hands over the answer teaches nothing. The hard part is the restraint — knowing when to hold it back so the understanding is actually earned. That question turns out to be an interface question as much as a teaching one.',
      'It bleeds into how I think about motion here: guiding attention without shouting, letting a screen lead the eye rather than grab it.',
    ],
    to: '/craft',
    toLabel: 'Read the craft notes',
  },
  {
    label: 'Studying',
    title: 'Finishing school in Berlin',
    body: 'Still a student, building real products in parallel. The plan is to keep both honest — ship things people use while the foundations are still being laid.',
    detail: [
      'I am still in school in Berlin, building real products alongside it rather than waiting until after. Keeping both honest is the whole trick: not letting the studying become an excuse, and not letting the shipping crowd it out.',
      'It is an unusual way to do it, and I would rather it stay that way than tidy the story up.',
    ],
    to: '/about',
    toLabel: 'Read the long story',
  },
  {
    label: 'Reading',
    title: 'A shelf to fill in',
    body: 'This is where the books and essays shaping how I think about craft and AI will go. Ask me in person for now — I would rather leave it blank than list something I only skimmed.',
    placeholder: true,
  },
]
