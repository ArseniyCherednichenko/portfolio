export interface CaseStudySection {
  heading: string
  body: string
}

export interface Project {
  slug: string
  title: string
  year: string
  blurb: string
  detail: string
  stack: string[]
  href?: string
  repo?: string
  soon?: boolean
  /** Short label for the kind of involvement, e.g. "Co-founder · full stack". */
  role?: string
  /** Longer narrative shown on the project detail page. Keep honest. */
  sections?: CaseStudySection[]
  /** Short, factual highlights shown as a list on the detail page. */
  highlights?: string[]
}

export const PROJECTS: Project[] = [
  {
    slug: 'guided',
    title: 'Guided',
    year: '2026',
    href: 'https://askguided.com',
    role: 'Co-founder · full stack',
    blurb: 'A Socratic AI tutor for students aged 8 to 18.',
    detail:
      'A Socratic AI tutor that asks the questions that build real understanding instead of giving away answers. Curriculum-aware for the German Abitur, IB, and GCSE. Web app plus a native iOS app on a shared Supabase backend. I co-founded it and build across the whole stack.',
    stack: ['React', 'TypeScript', 'SwiftUI', 'Supabase'],
    sections: [
      {
        heading: 'The idea',
        body: 'Most AI tools hand a student the answer, which short-circuits the part where learning actually happens. Guided does the opposite: it asks the questions a good tutor would, nudging a student toward understanding the problem themselves.',
      },
      {
        heading: 'Curriculum-aware',
        body: 'It is built around real syllabuses, the German Abitur, the IB, and GCSE, so the questions and examples line up with what a student is actually being taught and tested on, rather than a generic approximation.',
      },
      {
        heading: 'What I build',
        body: 'As a co-founder I work across the whole stack: the React and TypeScript web app, a native iOS app in SwiftUI, and a shared Supabase backend that keeps both in sync. Design, frontend, backend, native, the seams are mine to keep invisible.',
      },
    ],
    highlights: [
      'Socratic by design, it asks rather than answers',
      'Curriculum-aware for Abitur, IB, and GCSE',
      'Web plus native iOS on one shared backend',
    ],
  },
  {
    slug: 'portfolio',
    title: 'This site',
    year: '2026',
    repo: 'https://github.com/ArseniyCherednichenko/portfolio',
    role: 'Design and build',
    blurb: 'An open-source, motion-led portfolio.',
    detail:
      'This portfolio. React, Vite, Tailwind v4, and Framer Motion. Every animation is a hand-built component: an aurora background, spotlight cards, magnetic buttons, an orbiting hero, a marquee, and more. Open source on GitHub.',
    stack: ['React', 'Tailwind', 'Framer Motion', 'Vite'],
    sections: [
      {
        heading: 'Why build it from scratch',
        body: 'A portfolio about craft should be made with craft. Nothing here is a template. Every motion component, the aurora, the spotlight cards, the magnetic buttons, the orbiting hero, is hand-built, so the site is itself a sample of the work.',
      },
      {
        heading: 'How it is made',
        body: 'React and Vite with strict TypeScript, Tailwind v4 for styling, Framer Motion for animation, and client-side routing for the pages and project views. Motion is everywhere but always respects prefers-reduced-motion.',
      },
      {
        heading: 'Open source',
        body: 'The whole thing is public on GitHub. It grows a little most days, one coherent improvement at a time, so the commit history is part of the story too.',
      },
    ],
    highlights: [
      'Hand-built motion components, no template',
      'React, Vite, Tailwind v4, Framer Motion',
      'Open source and updated continuously',
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

// SKILLS now lives in toolkit.ts (single source of truth) and is re-exported
// here for the existing imports (e.g. the homepage marquee).
export { SKILLS } from './toolkit'

/** Find a non-placeholder project by slug. */
export function getProject(slug: string | undefined): Project | undefined {
  if (!slug) return undefined
  return PROJECTS.find((p) => p.slug === slug && !p.soon)
}

/** Real (non-placeholder) projects, in display order, for prev/next navigation. */
export const CASE_STUDIES: Project[] = PROJECTS.filter((p) => !p.soon)
