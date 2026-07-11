// Single source of truth for the /range page — the breadth of what Arseniy
// actually builds, framed as disciplines rather than a single product. This
// exists to de-centre Guided: the through-line of the site is the craft, and
// Guided is one place that craft shows up, not the whole of it.
//
// HONESTY: every discipline below is real work Arseniy does. The detail is
// grounded in verifiable facts — the React/TypeScript web app, the SwiftUI
// iOS app, the Supabase backend behind Guided, the applied-AI Socratic tutor,
// and the hand-built motion of this very site. No invented clients, metrics,
// or credentials. Where something is aspirational it is phrased as intent, not
// as a claim of past delivery.

export interface Discipline {
  /** URL-safe id, also used as the deep-link hash on the page. */
  id: string
  /** Short label — matches the words in the Home "Range" section. */
  label: string
  /** A single-line framing of the discipline. */
  headline: string
  /** Two or three honest sentences on how Arseniy works in this discipline. */
  body: string
  /** Concrete, verifiable things he does here. Facts, not boasts. */
  does: readonly string[]
  /** The tools he actually reaches for in this discipline. */
  tools: readonly string[]
  /**
   * Where this discipline shows up on the rest of the site, so the page is a
   * hub and not a dead end. Internal routes only.
   */
  seeAlso?: { label: string; to: string }
}

export const DISCIPLINES: readonly Discipline[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    headline: 'Interfaces that feel right',
    body: 'The part people actually touch. I build in React and TypeScript, keeping the state honest and the components small, and treat motion as part of the interface rather than decoration on top of it. The goal is an app that feels effortless — where the work that went in is exactly the work you cannot see.',
    does: [
      'Component architecture in React with strict TypeScript',
      'Layout, accessibility, and responsive behaviour from the first pass',
      'Motion built into the interface, always reduced-motion aware',
    ],
    tools: ['React', 'TypeScript', 'Tailwind', 'Framer Motion', 'Vite'],
    seeAlso: { label: 'See the Playground', to: '/playground' },
  },
  {
    id: 'ios',
    label: 'Native iOS',
    headline: 'At home on the device',
    body: 'A ported web view never quite feels right on a phone, so I build the native app natively. With Guided that means SwiftUI: real gestures, real navigation, and the small platform conventions that make an app feel like it belongs. Getting properly fluent here is a current, deliberate focus.',
    does: [
      'SwiftUI layout, navigation, and gesture-driven interactions',
      'A native app sharing one backend with the web, so nothing drifts',
      'Respecting the platform: its conventions, not a web app in a shell',
    ],
    tools: ['Swift', 'SwiftUI', 'Xcode'],
    seeAlso: { label: 'What I build with', to: '/toolkit' },
  },
  {
    id: 'backend',
    label: 'Backend and data',
    headline: 'The part you never see',
    body: 'Underneath the interface is the data model, the auth, and the sync that keeps web and native telling the same story. I use Supabase to hold that layer, and I care about it precisely because a good backend is the one nobody ever has to think about.',
    does: [
      'Data modelling and auth on Supabase (Postgres underneath)',
      'Keeping web and native in sync on one shared source of truth',
      'The unglamorous reliability work that makes a product trustworthy',
    ],
    tools: ['Supabase', 'PostgreSQL', 'TypeScript'],
    seeAlso: { label: 'Read the Guided case study', to: '/work/guided' },
  },
  {
    id: 'ai',
    label: 'Applied AI',
    headline: 'Building with models, not around them',
    body: 'AI woven into a real product rather than bolted to the side of one. In Guided the interesting problem is restraint: the model is most useful when it asks the next question instead of handing over the answer, so the student earns the understanding. The craft is in the product decisions around the model, not the model itself.',
    does: [
      'Designing the interaction, not just the prompt — where AI helps and where it should hold back',
      'A Socratic tutor that withholds the answer by design',
      'Curriculum-aware behaviour grounded in real syllabuses',
    ],
    tools: ['LLMs', 'TypeScript', 'Product design'],
    seeAlso: { label: 'Read the Guided case study', to: '/work/guided' },
  },
  {
    id: 'motion',
    label: 'Motion and design',
    headline: 'Craft in the small moments',
    body: 'The timing of a transition, the weight of a heading, the spacing between things. This is where a product stops feeling templated and starts feeling like someone cared. This site is my open workbench for it — every animation here is a component I built by hand, and I add to it most days.',
    does: [
      'Interface animation: easing, spring, stagger, scroll-linked motion',
      'Typography and spacing as first-class design decisions',
      'Every motion component hand-built, never pulled off a shelf',
    ],
    tools: ['Framer Motion', 'CSS', 'Figma'],
    seeAlso: { label: 'On motion, playable', to: '/craft' },
  },
] as const
