export interface Project {
  title: string
  year: string
  blurb: string
  detail: string
  stack: string[]
  href?: string
  repo?: string
  soon?: boolean
}

export const PROJECTS: Project[] = [
  {
    title: 'Guided',
    year: '2026',
    href: 'https://askguided.com',
    blurb: 'A Socratic AI tutor for students aged 8 to 18.',
    detail:
      'A Socratic AI tutor that asks the questions that build real understanding instead of giving away answers. Curriculum-aware for the German Abitur, IB, and GCSE. Web app plus a native iOS app on a shared Supabase backend. I co-founded it and build across the whole stack.',
    stack: ['React', 'TypeScript', 'SwiftUI', 'Supabase'],
  },
  {
    title: 'This site',
    year: '2026',
    repo: 'https://github.com/ArseniyCherednichenko/portfolio',
    blurb: 'An open-source, motion-led portfolio.',
    detail:
      'This portfolio. React, Vite, Tailwind v4, and Framer Motion. Every animation is a hand-built component: an aurora background, spotlight cards, magnetic buttons, an orbiting hero, a marquee, and more. Open source on GitHub.',
    stack: ['React', 'Tailwind', 'Framer Motion', 'Vite'],
  },
  {
    title: 'More soon',
    year: '',
    blurb: 'New projects in progress. Real work lands here.',
    detail: '',
    stack: [],
    soon: true,
  },
]

export const SKILLS = ['React', 'TypeScript', 'SwiftUI', 'Tailwind', 'Framer Motion', 'Supabase', 'Vite', 'Node', 'Figma', 'GSAP']
