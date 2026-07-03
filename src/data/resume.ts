// Single source of truth for the résumé / CV page. Honest facts only — the
// same story the rest of the site tells, arranged as a one-page document that
// can be read on screen or printed to a clean PDF. No invented dates, titles,
// employers, or metrics. Skills are pulled straight from the toolkit so the CV
// can never drift from the /toolkit page.

import { EMAIL, GITHUB_URL } from './contact'
import { TOOLKIT } from './toolkit'

export const RESUME_NAME = 'Arseniy Cherednichenko'
export const RESUME_ROLE = 'Builder · founder · interface engineer'
export const RESUME_LOCATION = 'Berlin, Germany'

// A short, honest lede. Mirrors the About page voice, kept to CV length.
export const RESUME_SUMMARY =
  'Product builder based in Berlin. I work end to end — interface, systems, and increasingly native iOS — with a lot of applied AI in between. Co-founder of Guided, a Socratic AI tutor. I care most about the craft people feel but cannot name: the motion, the typography, and the small moments.'

export interface ResumeContact {
  label: string
  value: string
  href: string
}

export const RESUME_CONTACT: readonly ResumeContact[] = [
  { label: 'Email', value: EMAIL, href: `mailto:${EMAIL}` },
  { label: 'GitHub', value: 'github.com/ArseniyCherednichenko', href: GITHUB_URL },
  { label: 'Location', value: RESUME_LOCATION, href: '' },
]

export interface ResumeEntry {
  /** Role or headline for the entry. */
  role: string
  /** Where it happened. */
  org: string
  /** Honest date range. "Present" for ongoing work. */
  period: string
  /** Optional link (project or source). */
  href?: string
  /** Factual bullets. Keep them true and specific. */
  points: readonly string[]
}

// Real work, in reverse-chronological order. Nothing invented.
export const RESUME_EXPERIENCE: readonly ResumeEntry[] = [
  {
    role: 'Co-founder · full-stack engineer',
    org: 'Guided',
    period: '2026 — Present',
    href: 'https://askguided.com',
    points: [
      'Co-founded a Socratic AI tutor for students aged 8 to 18 — curriculum-aware for the German Abitur, IB, and GCSE.',
      'Build across the whole stack: a React and TypeScript web app, a native SwiftUI iOS app, and a shared Supabase backend that keeps both in sync.',
      'Own design, frontend, backend, and applied AI so the product stays coherent and the seams stay invisible.',
    ],
  },
  {
    role: 'Designer and developer',
    org: 'This portfolio — open source',
    period: '2026 — Present',
    href: GITHUB_URL + '/portfolio',
    points: [
      'Designed and built a motion-led personal site in React, Vite, Tailwind v4, and Framer Motion.',
      'Hand-built every animation as its own component — no UI kit and no template.',
      'Ship one coherent improvement most days, in public, so the commit history is part of the work.',
    ],
  },
]

export interface ResumeEducation {
  what: string
  where: string
  period: string
  note: string
}

// Honest and lightweight — a student finishing school while shipping.
export const RESUME_EDUCATION: readonly ResumeEducation[] = [
  {
    what: 'Secondary education',
    where: 'Berlin',
    period: 'In progress',
    note: 'Finishing school in Berlin while building and shipping real products.',
  },
]

// Skills, grouped exactly as the toolkit is — the CV stays a projection of the
// single toolkit source, never a second list to maintain.
export const RESUME_SKILLS: ReadonlyArray<{ label: string; items: string[] }> =
  TOOLKIT.map((g) => ({ label: g.label, items: g.tools.map((t) => t.name) }))

// A closing, honest line about what I am after. No invented availability.
export const RESUME_LOOKING =
  'Open to hard problems worth solving and people who care about the details. If the work is interesting, I want to hear about it.'
