// Single source of truth for the Home "About / at a glance" panel — a compact,
// honest read of who Arseniy is, so the most personal section of the landing
// page carries as much life as the sections around it. Every facet here is an
// established fact echoed elsewhere on the site (bio.ts, now.ts, projects.ts,
// stats.ts): Berlin-based, a co-founder of Guided, still a student, working
// across React/TypeScript/SwiftUI/applied AI, and building this site in the
// open. No invented titles, dates, clients, or metrics. Guided is one facet of
// several here, deliberately not the hero — this panel is about the person.

import { COMPONENT_COUNT } from './stats'

export interface GlanceFacet {
  /** Small category label, e.g. "Based in". */
  label: string
  /** The fact itself, one short line. */
  value: string
  /** A sentence of honest colour under the value. */
  detail: string
  /** Optional route the whole facet links to (a deeper page on the site). */
  to?: string
  /** When true, the facet shows the live Berlin clock instead of a static value. */
  live?: boolean
  /** Layout hint: a wide facet spans two columns on the panel's grid. */
  wide?: boolean
}

// Ordered so the panel opens on place and person, keeps Guided as a single
// facet in the middle (not the headline), and closes on the making-in-the-open
// thesis that the whole site is built to prove.
export const GLANCE_FACETS: readonly GlanceFacet[] = [
  {
    label: 'Based in',
    value: 'Berlin',
    detail: 'Central European time. The little clock is honest — that is the hour where I am right now.',
    live: true,
  },
  {
    label: 'Working in',
    value: 'React · TypeScript · SwiftUI · AI',
    detail: 'The web on React, the phone on SwiftUI, applied AI woven through — the whole stack, held by one pair of hands.',
    to: '/toolkit',
    wide: true,
  },
  {
    label: 'Building',
    value: 'Guided',
    detail: 'A Socratic AI tutor that asks the questions instead of handing over answers. One thing I make, not the whole of what I do.',
    to: '/work/guided',
  },
  {
    label: 'Studying',
    value: 'Still in school',
    detail: 'A student in Berlin, shipping real products in parallel — keeping both honest at once.',
  },
  {
    label: 'The way I work',
    value: 'Craft in the small moments',
    detail: 'The timing of a transition, the weight of a heading, the space between things. The part people feel but cannot name.',
    to: '/craft',
  },
  {
    label: 'In the open',
    value: `${COMPONENT_COUNT}+ hand-built parts`,
    detail: 'This site is my open workbench — every animation coded from scratch, a little more most days. It is the proof, not the pitch.',
    to: '/changelog',
    wide: true,
  },
]
