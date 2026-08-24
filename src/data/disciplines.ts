// Single source of truth for the /range page — the disciplines Arseniy works
// across. This is the honest counterweight to a Guided-only reading of the
// site: the product is one thing, but the craft spans the whole stack. The
// Home "Range" section names these five in a scrolling band; here each one gets
// room to breathe, with an honest account of what it means in practice and a
// link to real evidence elsewhere on the site.
//
// HONESTY: every practice line is something actually done, not aspirational.
// Tools are the real stack. Evidence links point at pages that already exist
// and genuinely demonstrate the discipline — no invented proof.

export interface Discipline {
  id: string
  /** Short label, matches the Home Range band and the TrueFocus row. */
  tag: string
  /** Headline for the discipline. */
  title: string
  /** One-line framing. */
  lede: string
  /** An honest paragraph on what this looks like in the actual work. */
  body: string
  /** Concrete things done in this discipline — truthful, no metrics. */
  practices: readonly string[]
  /** The real tools reached for here. */
  tools: readonly string[]
  /** Where to see it on the site. `to` is a real in-app route. */
  evidence: { readonly label: string; readonly to: string }
  /** A per-discipline accent hex — a design token for the detail page's visual
   * identity, not a fact about the work. The house lime stays the site accent;
   * these only tint a discipline's own page. */
  accent: string
  /** The honest through-line for this discipline in a single line — a restated
   * pull-quote drawn from the body, used as the detail page's opening statement. */
  throughLine: string
  /** Other discipline ids this one genuinely leans on, for cross-linking the
   * detail pages. Honest structural relationships, not invented ones. */
  related: readonly string[]
}

export const DISCIPLINES: readonly Discipline[] = [
  {
    id: 'frontend',
    tag: 'Frontend',
    title: 'Interfaces that feel right',
    lede: 'The part people touch, and the part they feel.',
    body: 'React and TypeScript, held to a high bar for how it feels rather than only how it looks. Strict types, composable components, and motion that earns its place instead of decorating. Most of what I ship is the surface a person actually reaches for, so I sweat the states nobody documents — the empty, the loading, the just-tapped.',
    practices: [
      'Component-driven React with strict TypeScript',
      'Accessible, keyboard-first interactions',
      'Motion that respects prefers-reduced-motion',
      'Design systems that stay consistent as they grow',
    ],
    tools: ['React', 'TypeScript', 'Tailwind', 'Framer Motion', 'Vite'],
    evidence: { label: 'See the Playground', to: '/playground' },
    accent: '#DCF87C',
    throughLine: 'Sweat the states nobody documents — the empty, the loading, the just-tapped.',
    related: ['motion', 'backend'],
  },
  {
    id: 'ios',
    tag: 'Native iOS',
    title: 'At home on the device',
    lede: 'Apps that behave like they belong on the phone.',
    body: 'SwiftUI, learned properly rather than ported from web habits. Layout, gestures, and the small platform conventions that make an app feel native — the ones you only notice when they are missing. The Guided iOS app shares one backend with the web, so the two never drift apart on what a student sees.',
    practices: [
      'SwiftUI layout, navigation, and gestures',
      'A native app on a backend shared with the web',
      'Platform conventions honoured, not approximated',
      'Getting fluent in the details that make it feel at home',
    ],
    tools: ['SwiftUI', 'Swift', 'Supabase'],
    evidence: { label: 'Read about Guided', to: '/work/guided' },
    accent: '#8CC2FF',
    throughLine: 'The platform conventions you only notice when they are missing.',
    related: ['backend', 'frontend'],
  },
  {
    id: 'backend',
    tag: 'Backend and data',
    title: 'The part you never see',
    lede: 'The quiet layer that keeps everything honest.',
    body: 'Supabase, auth, and the data model underneath a product. The work here is invisible when it goes well: web and native reading the same truth, permissions that hold, a schema that does not fight you six months later. Not glamorous, but the difference between a demo and something people can rely on.',
    practices: [
      'Data models that keep web and native in sync',
      'Authentication and row-level access',
      'Supabase as the shared source of truth',
      'Designing for the state you cannot see',
    ],
    tools: ['Supabase', 'PostgreSQL', 'TypeScript'],
    evidence: { label: 'The full toolkit', to: '/toolkit' },
    accent: '#7EE0C8',
    throughLine: 'Invisible when it goes well — the difference between a demo and something people rely on.',
    related: ['ios', 'ai'],
  },
  {
    id: 'ai',
    tag: 'Applied AI',
    title: 'Building with models, not around them',
    lede: 'AI woven into a real product, not bolted on.',
    body: 'The interesting question with Guided is restraint: when to withhold the answer so the understanding is earned. Applied AI, to me, is less about the model and more about the product decisions around it — what to ask, what to hold back, how to keep it curriculum-aware and honest rather than a generic chatbot with a subject sticker on it.',
    practices: [
      'A Socratic tutor that asks instead of answering',
      'Curriculum-aware behaviour for Abitur, IB, and GCSE',
      'Product judgement around what a model should and should not do',
      'Restraint as a feature, not a limitation',
    ],
    tools: ['LLMs', 'Prompt design', 'TypeScript'],
    evidence: { label: 'Read about Guided', to: '/work/guided' },
    accent: '#C4A5FF',
    throughLine: 'Restraint as a feature — knowing when to withhold the answer so the understanding is earned.',
    related: ['backend', 'frontend'],
  },
  {
    id: 'motion',
    tag: 'Motion and design',
    title: 'Craft in the small moments',
    lede: 'The things people feel but cannot name.',
    body: 'Typography, timing, and the spacing between things. This site is my open workbench for it — over a hundred and seventy hand-built motion components, each one made from scratch and each one reduced-motion aware. If a technique lands here, I understand it well enough to reach for it in real work without a library doing the thinking.',
    practices: [
      'Over a hundred and seventy hand-built animation components',
      'A Fraunces-and-Inter type system, self-hosted',
      'Easing, spring, and stagger chosen by feel',
      'Every motion path with a reduced-motion fallback',
    ],
    tools: ['Framer Motion', 'CSS', 'Canvas', 'SVG'],
    evidence: { label: 'The component library', to: '/library' },
    accent: '#FF9FB2',
    throughLine: 'The things people feel but cannot name — typography, timing, the spacing between things.',
    related: ['frontend'],
  },
] as const

/** Count for the little "N disciplines, one craft" line. */
export const DISCIPLINE_COUNT = DISCIPLINES.length

/** Look up a discipline and its position by id, for the /range/:id detail
 * pages and their prev/next pager. Returns undefined for an unknown id. */
export function getDiscipline(
  id: string | undefined,
): { discipline: Discipline; index: number } | undefined {
  if (!id) return undefined
  const index = DISCIPLINES.findIndex((d) => d.id === id)
  return index === -1 ? undefined : { discipline: DISCIPLINES[index], index }
}
