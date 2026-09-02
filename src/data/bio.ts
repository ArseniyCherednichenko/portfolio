// Single source of truth for the /bio page — the copyable "introduce me"
// artifact a public profile keeps on hand. Every line here is honest and made
// only of established facts: Berlin-based, a co-founder of Guided, works across
// React/TypeScript/SwiftUI/applied AI, and builds this site in the open. No
// invented titles, dates, clients, or metrics. Kept in sync with data/contact.ts
// and data/projects.ts so the person reads the same everywhere.

import { EMAIL, GITHUB_URL } from './contact'

export interface BioVariant {
  /** Stable value for the segmented control. */
  id: string
  /** Short label shown on the segment. */
  label: string
  /** One line describing when to reach for this length. */
  hint: string
  /** The bio itself — plain prose, first- or third-person as noted. */
  text: string
}

// Three lengths, third-person, the way a host, an editor, or an event page would
// want them. Each is a strict superset of the shorter one in spirit, not copy,
// so they read naturally rather than padded. Nothing here claims anything the
// rest of the site does not already state plainly.
export const BIO_VARIANTS: readonly BioVariant[] = [
  {
    id: 'line',
    label: 'One line',
    hint: 'A byline, a footer, an introduction in passing.',
    text: 'Arseniy Cherednichenko is a Berlin-based developer and designer, and a co-founder of Guided.',
  },
  {
    id: 'short',
    label: 'Short',
    hint: 'A speaker bio, an about box, a directory entry.',
    text: 'Arseniy Cherednichenko is a developer and designer based in Berlin, and a co-founder of Guided, a Socratic AI tutor for students aged 8 to 18. He works across the whole stack — React and TypeScript on the web, SwiftUI on iOS, and applied AI in between — and cares most about how an interface moves and feels.',
  },
  {
    id: 'full',
    label: 'Full',
    hint: 'A feature, a profile, anywhere the whole picture fits.',
    text: 'Arseniy Cherednichenko is a developer and designer based in Berlin, and a co-founder of Guided, a Socratic AI tutor that asks the questions that build understanding instead of handing over answers. He builds across the whole stack — a React and TypeScript web app, a native SwiftUI iOS app, and the shared backend underneath — with applied AI woven through the product rather than bolted on. He cares most about the craft in the small moments: the timing of a transition, the weight of a heading, the space between things. He works mostly in the open, and this portfolio is part of the proof — open source, grown a little most days, with every animation on it hand-built rather than pulled from a library.',
  },
]

export interface FastFact {
  label: string
  /** What is shown on the page. */
  value: string
  /** What lands on the clipboard when copied (defaults to `value`). */
  copyValue?: string
  /** When set, the value is a link. */
  href?: string
}

// The at-a-glance facts, each one copyable on its own. Only verifiable things:
// the name, the city, the honest role, the current build, the real stack, and
// the two real channels — no socials that do not exist.
export const FAST_FACTS: readonly FastFact[] = [
  { label: 'Name', value: 'Arseniy Cherednichenko' },
  { label: 'Based in', value: 'Berlin, Germany' },
  { label: 'Role', value: 'Developer, designer, co-founder' },
  { label: 'Building', value: 'Guided — a Socratic AI tutor', href: 'https://askguided.com' },
  { label: 'Works in', value: 'React, TypeScript, SwiftUI, applied AI' },
  { label: 'Email', value: EMAIL, href: `mailto:${EMAIL}` },
  {
    label: 'GitHub',
    value: 'github.com/ArseniyCherednichenko',
    copyValue: GITHUB_URL,
    href: GITHUB_URL,
  },
]

// How to refer to the name and the work, so an introduction gets it right.
// Honest guidance, no invented pronunciation guide (I do not have one to give).
export const NAME_NOTE = 'Arseniy Cherednichenko — Arseniy on first reference, and the work is his own, not a company.'
