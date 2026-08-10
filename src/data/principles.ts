// Single source of truth for the /principles page — the working beliefs behind
// everything on this site. This is the manifesto version of what About states
// as prose, the Home "Ethos" section says in one line, and the Craft notes
// demonstrate in motion: a small, ordered set of principles Arseniy actually
// builds by.
//
// HONESTY: every line here is a belief already lived out elsewhere on the site,
// not an aspiration invented for a poster. Each principle links to a real route
// where you can see it holding up in the actual work — no invented proof. Keep
// the copy first-person and plain; a manifesto earns nothing by inflating.

export interface Principle {
  /** Two-digit marker shown large on the spine, e.g. "01". */
  n: string
  /** Stable id for the deep-link anchor and the running count. */
  id: string
  /** The credo — a short imperative that could stand alone on a wall. */
  title: string
  /** One crisp line stating the belief. */
  lede: string
  /** An honest paragraph on what it means in the actual work. */
  body: string
  /** Where to see it holding up on the site. `to` is a real in-app route. */
  evidence: { label: string; to: string }
}

// Ordered the way the work actually moves — from deciding what to build, through
// how it gets made, to how it ships and stays honest. Eight beliefs, each one
// already visible somewhere on this site.
export const PRINCIPLES: readonly Principle[] = [
  {
    n: '01',
    id: 'problem',
    title: 'Start with the problem.',
    lede: 'The interface is the last thing to decide, not the first.',
    body: 'Before a single screen, I get clear on what someone actually needs. Often the best interface is the one you find a way not to build — a step removed, a decision made for the person, a default that quietly does the right thing. Design begins as subtraction.',
    evidence: { label: 'How I build', to: '/about' },
  },
  {
    n: '02',
    id: 'prototype',
    title: 'Prototype in the real thing.',
    lede: 'Motion and feel cannot be judged on paper.',
    body: 'I sketch fast, and in code. A transition, the weight of a spring, the way a card leans toward the cursor — none of it reads on a still frame. So I get a rough version moving early and let it tell me what is wrong, rather than defending a mockup that never had to survive contact with a pointer.',
    evidence: { label: 'See the Playground', to: '/playground' },
  },
  {
    n: '03',
    id: 'whole-stack',
    title: 'Own the whole stack.',
    lede: 'Frontend, backend, native, and the data underneath.',
    body: 'Holding every layer is how the seams stay invisible. When the same hands shape the web, the iOS app, and the backend they share, the product stays coherent — nothing drifts, no boundary becomes an excuse. Breadth here is not a résumé line; it is what keeps the whole thing honest with itself.',
    evidence: { label: 'The range', to: '/range' },
  },
  {
    n: '04',
    id: 'motion-earns',
    title: 'Motion must earn its place.',
    lede: 'Animation is a tool for meaning, never decoration.',
    body: 'Every movement on this site is there to guide attention, explain a change, or make a surface feel touchable — and if it cannot say why, it comes out. It is also always reduced-motion aware: the moment someone signals they want the room to hold still, it does, without losing the meaning underneath.',
    evidence: { label: 'On motion', to: '/craft' },
  },
  {
    n: '05',
    id: 'small-moments',
    title: 'Sweat the small moments.',
    lede: 'The craft lives in the details no one is meant to notice.',
    body: 'The timing of a transition, the optical weight of a heading, the spacing between two things, the empty and the just-tapped states nobody documents. This is the slow part, and it is where good software starts to feel like someone cared. People rarely see it; they always feel it.',
    evidence: { label: 'The design language', to: '/design' },
  },
  {
    n: '06',
    id: 'made-not-assembled',
    title: 'Make it, do not assemble it.',
    lede: 'No template underneath, nothing pulled from a shelf.',
    body: 'This whole site is hand-built — every animation component written here, not installed. Not out of stubbornness, but because a portfolio about craft should be made with craft, and because knowing a thing well enough to build it from scratch is the only way I trust that I actually understand it.',
    evidence: { label: 'By the numbers', to: '/numbers' },
  },
  {
    n: '07',
    id: 'ship-refine',
    title: 'Ship, then refine in the open.',
    lede: 'Real products beat perfect plans.',
    body: 'I would rather get something in front of people and watch how it is really used than polish it in private until the moment has passed. This site grows the same way it argues you should work — a little most days, one coherent improvement at a time, with the whole history public.',
    evidence: { label: 'The build log', to: '/changelog' },
  },
  {
    n: '08',
    id: 'stay-honest',
    title: 'Stay honest.',
    lede: 'No invented metrics, no borrowed credit, no fake polish.',
    body: 'Everything stated here is true or clearly marked as a placeholder to fill in. No fabricated clients, no vanity numbers, no testimonials I never received. A placeholder said out loud is worth more than a claim that cannot be backed — the trust is the point, and it is the one thing you cannot animate your way into.',
    evidence: { label: 'The questions people ask', to: '/answers' },
  },
]

export const PRINCIPLE_COUNT = PRINCIPLES.length
