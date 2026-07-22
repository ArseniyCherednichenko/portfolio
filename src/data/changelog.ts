// The build log for this site.
//
// This portfolio is open source and grows in the open, one coherent
// improvement at a time — the commit history is part of the story. Rather than
// fake a precise per-day changelog, this file gathers the real work into
// honest chapters: what actually shipped, grouped by the phase it belongs to.
// Newest chapter first. Kept current by hand (and by the daily routine) as the
// site keeps moving.

export type EntryKind = 'page' | 'component' | 'motion' | 'polish' | 'infra'

export interface LogItem {
  kind: EntryKind
  text: string
}

export interface Chapter {
  /** Short marker shown on the spine, e.g. "05" or "Now". */
  marker: string
  /** Chapter title. */
  title: string
  /** One or two honest sentences framing the chapter. */
  summary: string
  /** The concrete things that shipped in this chapter. */
  items: LogItem[]
}

// Human labels + accent treatment for each kind of entry. Used by the filter
// and the little tag chips.
export const KIND_META: Record<EntryKind, { label: string; hint: string }> = {
  page: { label: 'Page', hint: 'a new route or view' },
  component: { label: 'Component', hint: 'a reusable building block' },
  motion: { label: 'Motion', hint: 'animation and interaction' },
  polish: { label: 'Polish', hint: 'refinement and detail' },
  infra: { label: 'Infra', hint: 'build, types, plumbing' },
}

export const KIND_ORDER: EntryKind[] = ['page', 'component', 'motion', 'polish', 'infra']

export const CHAPTERS: Chapter[] = [
  {
    marker: 'Now',
    title: 'Toys that light up',
    summary:
      'The most recent stretch: a run of interactive, cursor-aware experiments — the kind of thing the playground exists to hold. Each one is its own hand-built component, wired into the pages that suit it.',
    items: [
      { kind: 'component', text: 'Starfield — a warp field of points streaming out of a vanishing point and toward you, each a short streak so it reads as travel through space, not a twinkle; the vanishing point eases after the cursor so the whole field banks the way you point, and the nearest streaks warm to lime. Backs the Résumé header — the long view behind a one-page summary — and is a Playground field' },
      { kind: 'component', text: 'ProjectQuickLook — a shared project preview modal: the poster, role, blurb, stack, and highlights in a fast pop-over that always offers a way through to the full case study. Opened from the work ledger and the home cards, it replaced the one-off modal that used to live inside the home page, so both surfaces now share one honest component' },
      { kind: 'polish', text: 'Footer — the one un-crafted surface, a run-on paragraph of links, rebuilt as a proper closing statement: a get-in-touch CTA, a grouped map of every route, a live Berlin clock with an awake/asleep sense, and the keyboard hint. Present on every page, so the site now ends the way it begins' },
      { kind: 'component', text: 'Lanyard — a name badge on a cord you grab, throw, and watch swing to rest: a single constrained mass (an angle and an angular velocity) driven as a damped pendulum, with the badge as real crisp HTML that tilts with the cord. A different kind of motion from the fields and cards — one weight on a string' },
      { kind: 'component', text: 'Squares — a structural lattice field on one canvas: a soft band of light drifts along the diagonal forever while the cells under the cursor warm lime, lift their stroke, and bloom. Backs the Index header' },
      { kind: 'component', text: 'SphereMenu — a draggable 3D sphere of links you grab and spin: points on a real Fibonacci sphere, projected to 2D each frame so the labels always face you while the ones turned away shrink and dim. Every label routes into the site, so no one project sits at the centre' },
      { kind: 'motion', text: 'Home — a By-the-numbers band that turns the by-hand ethos into concrete, animated counts (components, pages, zero UI kits, one pair of hands), each figure literally true of the repo' },
      { kind: 'infra', text: 'data/stats — the site’s own counts moved to a single source of truth, so the home band, Colophon, Contents, and Changelog all read one number' },
      { kind: 'component', text: 'FlipCard — a card that physically turns over between two faces, a real half-rotation with the far face hidden; distinct from a dissolve or a cross-fade' },
      { kind: 'component', text: 'FuzzyText — clean type torn into analog signal-fuzz scanline by scanline, harder under the pointer; it turns the 404 number into a lost signal' },
      { kind: 'component', text: 'ScrollScene — a sticky scrollytelling stage that transforms as steps scroll past; on the Colophon it assembles a screen’s real layers one at a time' },
      { kind: 'component', text: 'Iridescence — a breathing, palette-tinted sheen computed on a tiny buffer and blown up smooth; the cursor spreads a ripple through it. Backs the On-motion title' },
      { kind: 'page', text: 'Design language — a living style guide of the site’s own tokens: three colours, two faces, one curve, each one copyable' },
      { kind: 'page', text: 'Index — an editorial, searchable table of contents for the whole site, grouped into sections with live counts' },
      { kind: 'component', text: 'CurvedLoop — a line of type that rides a curved path, looping forever; grab it to scrub and flick it to fling' },
      { kind: 'component', text: 'ScratchReveal — a canvas scratch-off foil you drag away to uncover the card beneath' },
      { kind: 'component', text: 'Particles — a drifting constellation field that webs and warms toward the cursor' },
      { kind: 'page', text: 'Terminal — an interactive shell that drives the whole site by typing' },
      { kind: 'page', text: 'On motion — a page where four beliefs about craft are playable, not stated' },
      { kind: 'component', text: 'ASCIIText — a word rendered as a live, cursor-lit ASCII field' },
      { kind: 'component', text: 'ChromaGrid — a torch-in-the-dark card grid that lights under the pointer' },
      { kind: 'component', text: 'Folder — a tactile folder that fans its papers out as links' },
      { kind: 'component', text: 'Stepper — an accessible step-through with a sweeping lime rail' },
    ],
  },
  {
    marker: '04',
    title: 'The component library',
    summary:
      'A deep bench of motion primitives, each built from scratch rather than pulled off a shelf — the raw material the pages are assembled from. This is where most of the craft lives.',
    items: [
      { kind: 'component', text: 'Backgrounds: Aurora, Beams, Threads, Lightning, MetaBalls, Ribbons, DotGrid, MagnetLines' },
      { kind: 'component', text: 'Text in motion: GradientText, RotatingWord, SplitText, DecryptedText, ScrollVelocity, TrueFocus, VariableProximity' },
      { kind: 'component', text: 'Surfaces: SpotlightCard, TiltCard, GlareHover, GlassSurface, BorderBeam, BentoGrid, CardStack, ScrollStack' },
      { kind: 'component', text: 'Pointer play: Cursor, ClickSpark, PixelTrail, Gravity, Lightbox, Dock, MagneticButton' },
      { kind: 'component', text: 'Structure: Marquee, HorizontalScroll, CircularGallery, FlowingMenu, Timeline, Accordion, GooeyTabs' },
    ],
  },
  {
    marker: '03',
    title: 'From one page to a whole site',
    summary:
      'A single scrolling page became a real multi-page site: client-side routing, a shared animated shell, and a set of ways to move through it that reward keyboard and mouse alike.',
    items: [
      { kind: 'page', text: 'About, Work index and per-project case studies, Toolkit, Now, Writing, Contact, Answers, Colophon, Résumé' },
      { kind: 'infra', text: 'react-router with a shared Layout, deep-linkable routes, and code-split page chunks' },
      { kind: 'motion', text: 'Page transitions on every navigation via AnimatePresence' },
      { kind: 'component', text: 'CommandPalette — a fuzzy launcher for every page, project, and action' },
      { kind: 'component', text: 'Keyboard chords — tap g then a key to jump anywhere; press ? for the map' },
      { kind: 'polish', text: 'Nav with active states, a mobile menu, a footer, back-to-top, and scroll progress' },
    ],
  },
  {
    marker: '02',
    title: 'An editorial voice',
    summary:
      'The look moved past a default all-sans template. A self-hosted variable serif gives headlines a considered, editorial tone, and the dark theme with its single lime accent settled in.',
    items: [
      { kind: 'polish', text: 'Fraunces, a self-hosted variable serif, on display headlines with live optical sizing' },
      { kind: 'infra', text: 'Preloaded latin subset so headlines paint without a flash of fallback' },
      { kind: 'polish', text: 'Dark theme and the lime accent as a consistent, restrained system' },
      { kind: 'component', text: 'Preloader, Eyebrow, Seo, and the shared Reveal used across every page' },
    ],
  },
  {
    marker: '01',
    title: 'The foundation',
    summary:
      'The first commits: a strict, fast toolchain and the first hand-built motion, chosen so the site could itself be a sample of the work rather than a description of it.',
    items: [
      { kind: 'infra', text: 'Vite, React 18, and TypeScript in strict mode' },
      { kind: 'infra', text: 'Tailwind v4 via the official Vite plugin, no config-file content globbing' },
      { kind: 'motion', text: 'Framer Motion as the single animation layer, with prefers-reduced-motion honoured throughout' },
      { kind: 'component', text: 'The first primitives: Aurora, HeroOrbit, SpotlightCard, MagneticButton, Marquee, ScrollCue' },
    ],
  },
]

/** Total concrete items across all chapters — a rough measure of ground covered. */
export const SHIPPED_COUNT = CHAPTERS.reduce((n, c) => n + c.items.length, 0)
