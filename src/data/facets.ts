import type { GridMotionItem } from '../components/GridMotion'

// Facets of the work and the person, laid out for the drifting GridMotion field.
// Everything here is honest: the tools actually reached for, the real roles, the
// place, and the rules this site is built by. No invented clients or metrics.
// A handful are accented to break the rhythm — the real project, the home city,
// the one line that sums up how Guided teaches.
export const FACETS: GridMotionItem[][] = [
  [
    { label: 'React' },
    { label: 'TypeScript', accent: true },
    { label: 'Framer Motion' },
    { label: 'Tailwind' },
    { label: 'Vite' },
    { label: 'SwiftUI' },
    { label: 'Supabase' },
    { label: 'Git' },
  ],
  [
    { label: 'Co-founder' },
    { label: 'Frontend' },
    { label: 'Backend' },
    { label: 'Native iOS' },
    { label: 'Design', accent: true },
    { label: 'Motion' },
    { label: 'Full stack' },
  ],
  [
    { label: 'Berlin', accent: true },
    { label: 'Student' },
    { label: 'Guided' },
    { label: 'This site, in the open' },
    { label: 'Ships most days' },
    { label: 'Open source' },
  ],
  [
    { label: 'Ask, don’t tell' },
    { label: 'Hand-built, no templates' },
    { label: 'Spring, never snap', accent: true },
    { label: 'Reduced-motion aware' },
    { label: 'Detail is the work' },
  ],
]
