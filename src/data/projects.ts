export interface CaseStudySection {
  heading: string
  body: string
}

/** One area of the work and an honest one-line account of what I did in it.
 * No metrics, no invented percentages — just the truthful division of labour. */
export interface Contribution {
  area: string
  detail: string
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
  /** Where it runs, e.g. ["Web app", "Native iOS"]. Shown in the spec panel. */
  platforms?: string[]
  /** One honest status line, e.g. "Live" or "Open source · in the open". */
  status?: string
  /** The honest division of labour — what I personally made on this project. */
  contributions?: Contribution[]
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
    platforms: ['Web app', 'Native iOS'],
    status: 'Live',
    blurb: 'A Socratic AI tutor for students aged 8 to 18.',
    detail:
      'A Socratic AI tutor that asks the questions that build real understanding instead of giving away answers. Curriculum-aware for the German Abitur, IB, and GCSE. Web app plus a native iOS app on a shared Supabase backend. I co-founded it and build across the whole stack.',
    stack: ['React', 'TypeScript', 'SwiftUI', 'Supabase'],
    contributions: [
      {
        area: 'Product',
        detail: 'Co-founded it and shaped the Socratic model — the tutor that asks rather than answers.',
      },
      {
        area: 'Design',
        detail: 'Designed the interface for a wide age range, 8 to 18, across web and native.',
      },
      {
        area: 'Frontend',
        detail: 'Built the React and TypeScript web app.',
      },
      {
        area: 'Native iOS',
        detail: 'Built the SwiftUI app that shares one backend with the web.',
      },
      {
        area: 'Backend',
        detail: 'Set up the Supabase backend that keeps web and native in sync.',
      },
    ],
    sections: [
      {
        heading: 'The idea',
        body: 'Most AI tools hand a student the answer, which short-circuits the part where learning actually happens. Guided does the opposite: it asks the questions a good tutor would, nudging a student toward understanding the problem themselves.',
      },
      {
        heading: 'Curriculum-aware',
        body: 'It is built around real syllabuses, the German Abitur, the IB, and GCSE, so the questions and examples line up with what a student is actually being taught and tested on, rather than a generic approximation.',
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
    platforms: ['Web'],
    status: 'Open source · in the open',
    blurb: 'An open-source, motion-led portfolio, built in public.',
    detail:
      'This portfolio, and a working sample in its own right. React, Vite, strict TypeScript, Tailwind v4, and Framer Motion, with client-side routing across some thirty pages. Every animation is a component I built by hand: an aurora background, spotlight cards, magnetic buttons, an orbiting hero, a command palette, an interactive terminal, and close to two hundred more. It grows a little most days, in the open, so the commit history is part of the work.',
    stack: ['React', 'TypeScript', 'Tailwind v4', 'Framer Motion', 'Vite'],
    contributions: [
      {
        area: 'Design',
        detail:
          'The whole visual language: the lime-on-ink palette, the Fraunces-and-Inter type system, and the editorial layout that ties every page together.',
      },
      {
        area: 'Motion',
        detail:
          'Close to two hundred hand-built animation components, from ambient backgrounds to scroll-driven scenes, each one reduced-motion aware.',
      },
      {
        area: 'Architecture',
        detail:
          'Client-side routing over roughly thirty pages, code-split so first paint stays lean and each view streams in on navigation.',
      },
      {
        area: 'Engineering',
        detail:
          'React and Vite on strict TypeScript, Tailwind v4 with no config, and a canvas-and-RAF pattern that keeps the heavy pieces off the React render path.',
      },
    ],
    sections: [
      {
        heading: 'The brief',
        body: 'A portfolio about craft should be made with craft. So nothing here is a template or a page builder. The site is meant to be read as evidence: if it claims I care about motion, type, and the small moments, the site itself has to prove it in how it behaves.',
      },
      {
        heading: 'The motion system',
        body: 'Every effect is its own hand-built component rather than a library drop-in, from the aurora and spotlight cards to self-drawing line art and scroll-pinned scenes. The heavy ones run on a single canvas and one requestAnimationFrame loop, kept off the React render path, capped for device pixel ratio, and cleaned up on unmount. There is no motion the machine cannot afford.',
      },
      {
        heading: 'Type and palette',
        body: 'Two faces carry the whole site: Inter for body and UI, and Fraunces, a self-hosted variable serif, for display, so headlines have an editorial voice instead of a templated all-sans look. Lime on near-black is the only accent, used sparingly so it still means something when it appears.',
      },
      {
        heading: 'Architecture',
        body: 'React and Vite with strict TypeScript, Tailwind v4 auto-detecting classes with no content config, and client-side routing across about thirty pages. The landing page ships eagerly; every other route is code-split into its own chunk and streamed in on navigation, so first paint stays lean no matter how much the site grows.',
      },
      {
        heading: 'Motion with restraint',
        body: 'Motion is everywhere, and all of it defers to prefers-reduced-motion: animations collapse to calm static states rather than being faked, focus states are real, and the interactive pieces stay reachable by keyboard. Alive is not the same as loud.',
      },
      {
        heading: 'Built in the open',
        body: 'The whole thing is public on GitHub and grows a little most days, one coherent, self-contained improvement at a time. The changelog and the commit history are honest by design, so the process is as visible as the result.',
      },
    ],
    highlights: [
      'Close to 200 hand-built motion components, no template',
      'React, Vite, strict TypeScript, Tailwind v4, Framer Motion',
      'Reduced-motion aware, keyboard-reachable throughout',
      'Code-split routing across roughly thirty pages',
      'Self-hosted Fraunces variable serif for display type',
      'Open source and updated continuously, in public',
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
