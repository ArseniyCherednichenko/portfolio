// Single source of truth for projects. Used by the homepage work grid, the
// case-study pages (/work/:slug), and the command palette. Real, verifiable
// facts only — no invented metrics, clients, or awards.

export interface ProjectSection {
  heading: string
  body: string
}

export interface Project {
  slug: string
  title: string
  year: string
  /** One-line summary for the work grid. */
  blurb: string
  /** A short paragraph shown at the top of the case study. */
  detail: string
  stack: string[]
  href?: string
  repo?: string
  /** Placeholder card the homepage renders as "in progress". */
  soon?: boolean
  // Case-study fields (omitted for `soon` placeholders).
  role?: string
  timeframe?: string
  sections?: ProjectSection[]
}

export const PROJECTS: Project[] = [
  {
    slug: 'guided',
    title: 'Guided',
    year: '2026',
    href: 'https://askguided.com',
    role: 'Co-founder, full-stack',
    timeframe: '2025 — present',
    blurb: 'A Socratic AI tutor for students aged 8 to 18.',
    detail:
      'A Socratic AI tutor that asks the questions that build real understanding instead of giving away answers. Curriculum-aware for the German Abitur, IB, and GCSE, on the web and on native iOS.',
    stack: ['React', 'TypeScript', 'SwiftUI', 'Supabase'],
    sections: [
      {
        heading: 'The idea',
        body: 'Most tutoring tools hand over the answer. Guided does the opposite. It is built on the Socratic method: instead of solving the problem for you, it asks the one question that moves you a single step forward, so the understanding ends up being yours. It is curriculum-aware for the German Abitur, the IB, and GCSE, so the questions stay anchored to what a student is actually being taught.',
      },
      {
        heading: 'What I build',
        body: 'I co-founded Guided and work across the whole stack. A React and TypeScript web app and a native SwiftUI iOS app share one Supabase backend for auth, Postgres, and storage, and a single design language so the product feels like one thing on either platform.',
      },
      {
        heading: 'The hard parts',
        body: 'The interesting problems live in the prompting: guiding without telling, staying curriculum-accurate, and never quietly handing over the solution. On the front end, the work is making AI latency feel calm — optimistic UI, motion that covers the wait, and interfaces that stay legible while a model is thinking.',
      },
    ],
  },
  {
    slug: 'portfolio',
    title: 'This site',
    year: '2026',
    repo: 'https://github.com/ArseniyCherednichenko/portfolio',
    role: 'Design & build',
    timeframe: '2026 — ongoing',
    blurb: 'An open-source, motion-led portfolio.',
    detail:
      'This portfolio. React, Vite, Tailwind v4, and Framer Motion — where every animation is an original, hand-built component rather than a library drop-in.',
    stack: ['React', 'Tailwind', 'Framer Motion', 'Vite'],
    sections: [
      {
        heading: 'The idea',
        body: 'A portfolio that is itself the proof of work. Nothing here is a template. Every interaction — the aurora behind this text, the spotlight cards, the magnetic buttons, the command palette — is a component I wrote, so the site demonstrates the craft it talks about.',
      },
      {
        heading: 'How it is made',
        body: 'React and Vite with strict TypeScript, styled with Tailwind v4 and animated with Framer Motion. The motion is built to be felt, not noticed: staggered entrances, scroll-linked reveals, cursor effects, and an orbiting hero, all of which fall back gracefully when a visitor prefers reduced motion.',
      },
      {
        heading: 'Open source',
        body: 'The whole thing is public on GitHub and grows a little every day. It doubles as a living playground for the UI ideas I want to keep sharp.',
      },
    ],
  },
  {
    slug: 'more-soon',
    title: 'More soon',
    year: '',
    blurb: 'New projects in progress. Real work lands here.',
    detail: '',
    stack: [],
    soon: true,
  },
]

export const CASE_STUDIES = PROJECTS.filter((p) => !p.soon)

export function getProject(slug: string | undefined): Project | undefined {
  return PROJECTS.find((p) => p.slug === slug)
}
