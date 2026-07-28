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
      { kind: 'component', text: 'FlowField — the library had grids, needles, cells, threads, and blobs that bend toward the pointer, but nothing that read as moving current. This one advects a few hundred motes through a smooth vector field whose angle is a cheap wrap of sines of position and time — no noise library — and lets each mote leave a fading trail, so the canvas streams rather than scatters. Within reach of the cursor the field angle blends toward the tangent around the pointer, so the flow stops running straight through and curls into a lime eddy that the cursor drags along, brightening as it goes. Honest to the machine: one canvas, one RAF loop, motes recycled when they age out or drift off-frame, no per-mote React state. It debuts as a full-width pointer-fields experiment in the Playground. Reduced motion never starts the loop — it traces each streamline forward through the frozen field once, so the current’s topology is legible while nothing moves.' },
      { kind: 'component', text: 'Toast — the site’s missing notification primitive. A provider at the top of the Layout shell owns a shallow queue and hands any page, dialog, or command a toast() call; the messages render through a portal into an aria-live region pinned to the bottom edge, so a screen reader hears each one and nothing is clipped by an overflow-hidden parent. The mechanism is deliberately honest: when motion is allowed, a single CSS animation both depletes the lime meter and, on its onAnimationEnd, dismisses the toast — the bar and the clock are literally the same thing, so they can never drift, and hovering pauses both at once; the stack caps at three, so the oldest steps off the top rather than piling up. Each toast springs up from the edge, can be flicked aside, and carries a confirmation tick or a gentle error mark. It now backs the real "email address copied" confirmation from both the contact channels and the command palette — so the confirmation still lands even after the surface it came from closes — and debuts as a Navigation & controls trigger board in the Playground. Reduced motion drops the drift and the travelling meter for a clean fade on a plain timer (and never mounts the CSS meter, so the global reduced-motion collapse of animation-duration can’t fire it early).' },
      { kind: 'page', text: 'The reel (/reel) — an art-directed showreel, and the counterpoint to the Playground. Where the Playground dissects motion into a labelled workbench of controls, the reel runs nine full-screen scenes as a designed sequence: each pairs one signature hand-built backdrop (Aurora, MeshGradient, Beams, Threads, Lightning, Iridescence, Particles, Orb, Squares) with a single line of how I think about making things — motion, light, line, energy, colour, systems, form, structure. It is a small manifesto more than a pitch: it centres the point of view about craft, not any one project, so it de-centres the client work by design, and closes by handing off to /work and the Playground. Snap-scrolled (proximity, so the footer is never trapped), navigable by arrow keys, j/k, Home/End, and a dot rail, with a live NN / 09 counter. Each heavy backdrop mounts only while its scene is on or beside the screen — an IntersectionObserver tracks the scene crossing the viewport midline — so at most a couple of canvases ever run at once and the route chunk stays under 4kB gzipped. Reduced motion drops the scroll-snap and the scene reveals; every backdrop already stills itself.' },
      { kind: 'component', text: 'Aurora gains a scoped mode — an optional prop flips the ambient field from the fixed site-wide layer to an absolute fill of a positioned parent, so the real component can back a single full-bleed reel scene instead of the viewport. The site-wide use in Layout is untouched.' },
      { kind: 'component', text: 'AnimatedList — a navigation list with life. Rows stagger in one after the next as the list scrolls into view, and a single lime highlight springs between rows (a shared layoutId, so it glides its own box rather than every row fading a background) as you hover or move focus through them. Deliberately not an ARIA role game: the rows stay ordinary, individually-focusable links or buttons — so the list reads and tabs exactly as a list should — with arrow keys, Home, and End added purely as an enhancement on top. It debuts driving the Home page’s new "In the open" section (below), and as a Navigation & controls experiment of real routes. Reduced motion drops the stagger and the glide — the highlight just appears on the active row.' },
      { kind: 'page', text: 'Home "In the open" — a new closing section, between Explore and the contact band, that surfaces the most recent build-log headlines as a compact AnimatedList and links straight through to /changelog. It turns the "open source, grows most days" promise into something you can see the moment you reach the bottom of the page, and de-centres any one project by making the site’s own steady making the last note. The headlines live in a standalone data/latestLog.ts on purpose: importing them from the (large) changelog module would have dragged the whole log text into the eager Home chunk and undone the code split — this way the initial bundle stays flat.' },
      { kind: 'component', text: 'Tooltip — a small accessible hint that rises on hover and on keyboard focus and closes on leave, blur, or Escape. Unlike a naive wrapper-relative hint, the bubble is rendered through a portal as a fixed-position element and placed from the trigger’s measured rect, so it is never clipped by an overflow-hidden ancestor or trapped under a lower stacking context — and it flips to the opposite side and clamps inside the viewport when the preferred placement would run off the edge, with the arrow tracking the trigger’s centre, so an edge-hugging nav button still gets a fully visible hint. The trigger carries aria-describedby, so assistive tech announces the hint with the control. It now backs the nav’s terse buttons across the whole site — the search/command button, the get-in-touch button, and the wordmark — and debuts as a Navigation & controls experiment showing its four placements and the off-screen flip. Reduced motion just fades it, no travel' },
      { kind: 'component', text: 'TextType — a typewriter, the classic terminal cadence the library was missing. A phrase types out one keystroke at a time, holds, erases itself, and the next takes its place, a blinking block caret riding the end throughout. It is a different kind of text motion from everything around it: DecryptedText resolves glyphs out of noise, GooeyText melts one word into the next, SplitFlap hinges a whole glyph, SplitText lifts letters into place — this one is keys appearing and erasing. Honest to the machine underneath: no per-frame React state, just a single self-rescheduling timeout that advances one character per tick and clears on unmount, and the caret blink is a CSS keyframe so the reduced-motion guard stills it for free. It types a live prompt line on the /terminal page — arseniy@portfolio ~ % cycling through the real commands it accepts (help, whoami, ls, open work, stack, contact) — and debuts as a Type & text experiment. Honest to assistive tech via a full aria-label; reduced motion renders the first phrase in full with a steady caret' },
      { kind: 'component', text: 'Masonry — a real masonry wall, not a fixed grid. A single ResizeObserver measures the container and every tile, and each one is absolutely positioned into the currently-shortest column from its own measured height, so content of any height packs tight with no gaps and nothing is forced onto a shared row. Change the width or shuffle the tiles and the whole wall reflows on a spring instead of snapping; each tile lifts in the first time it lands. No per-frame React state — the layout is a memo over measured heights, recomputed only when a height or the width actually changes. It debuts as a full-width Cards & surfaces experiment holding an editorial wall of the site’s own making-by-hand ethos — 97 components, spring over tween, reduced motion always, no template — so the demo says what it is. Reduced motion drops the springs and the reveal and places the same packed layout instantly' },
      { kind: 'component', text: 'MeshGradient — a living wash of colour you steer. Five large, heavily-blurred radial blobs — lime, emerald, sky, and violet — sit at fixed anchors and each wanders on its own slow idle loop, so the field is never still; on top of that the whole mesh leans toward the pointer, every blob parallaxing by its own depth so the colour seems to gather under the cursor and warm as it nears. Distinct from its neighbours in the pointer-fields band: Aurora is a fixed ambient drift with no pointer, Iridescence is an oil-slick sheen, Beams are hard light shafts — this is a warm, liquid backdrop you can sit a headline straight on top of. Pure layered gradients moved by transforms, no canvas and no per-frame React state, so it stays cheap. It now backs the About "What I am about" manifesto — the site’s clearest statement of craft-over-any-one-project, given a living surface — and debuts as a Colour field in the Playground pointer-fields band. Reduced motion holds a balanced, still mesh with the lean off' },
      { kind: 'polish', text: 'Grain — a film-grain texture now lies over the whole site. A small tile of random grayscale bytes is reshuffled a few times a second and repeated across the surface as a canvas pattern, so a full-viewport grain costs one tiny noise buffer per refresh rather than a per-pixel repaint. It composites under content through soft-light at a whisper of opacity, so mid-gray reads as neutral while brighter specks lift and darker ones sink — the dark theme picks up a fine, printed, editorial feel instead of flat black. pointer-events: none and above content but below the nav and cursor, so it never interferes; a Playground specimen shows it turned up. Reduced motion holds a single still frame' },
      { kind: 'component', text: 'GridMotion — a living wall of tiles. Five rows drift sideways at their own pace and in alternating directions (the same seamless duplicate-and-slide loop Marquee runs, but stacked and staggered into a field), while the whole slab tilts in 3D toward the cursor like a panel you are leaning over — sprung, so it eases in and settles back rather than snapping. Distinct from the 1D text bands (Marquee, ScrollVelocity, CurvedLoop): those are single tracks, this is a two-axis surface you steer. Fed a vocabulary rather than one message — the disciplines and tools I work across, Frontend / Native iOS / Backend / Applied AI / Motion accented among React, SwiftUI, Supabase, and the rest — so it reads as range, no single tile carrying the story. It debuts as a Range field in the Playground pointer-fields band. Reduced motion holds the wall still and square, every tile there and legible' },
      { kind: 'component', text: 'GooeyText — one word melts into the next: two text layers sit under a gooey SVG filter (a Gaussian blur, then an alpha-crushing matrix — the same metaball trick GooeyTabs plays on its blobs), so as one word blurs out and the next sharpens in, their glyph-halos fuse into a single liquid mass at the midpoint before resolving into clean type. The alpha-crush eats thin strokes, so it engages only inside a morph — at rest the word renders with no filter and stays perfectly crisp. Not a crossfade but a physical morph, and distinct from GooeyTabs (a moving pill) and MetaBalls (drifting blobs) — here the fusing shapes are letters. It drives a new display-size "I work across Frontend / Native iOS / Backend / Applied AI / Motion" band on the About page — foregrounding the range rather than any one project — and is a Type & text experiment. Honest to assistive tech via an aria-live region; reduced motion drops the filter for an instant, legible swap' },
      { kind: 'component', text: 'HoverIndex — an editorial index where hovering a row floats a generative preview panel that trails the cursor with a little spring lag, the awwwards-style hover-reveal list. A different kind of thing from the rest of the library: not a field, a card, or a text effect, but a list whose entries summon a floating thumbnail (distinct from FlowingMenu, whose lime panel slides in and stays inside the row). The previews are honest brand art generated per label, not screenshots, and every row is a real link, so it doubles as navigation. It closes the Work ledger with an outward index into the rest of the site — About, Playground, Toolkit, On motion, Writing, Now — framing the projects as one facet rather than the whole story, and debuts as a Playground controls experiment fed the real site links. Touch and reduced motion drop the floating preview for a clean, fully legible list' },
      { kind: 'component', text: 'Odometer — a mechanical trip-meter count: each place is a vertical reel of 0-9 clipped to a single-digit slot, and on reveal every reel slides up from zero into place, passing through the numbers in between the way a car odometer does, with higher places landing a beat after the ones to their right. A physical slide, not a text-swap — a different kind of count from the AnimatedCounter that tweens a number or the SplitFlap that hinges a glyph. It now rolls the by-the-numbers figures on the homepage and is a Playground experiment; reduced motion parks every reel on its final digit instantly' },
      { kind: 'component', text: 'Knob — a tactile rotary control you turn like hardware: drag up or down to sweep the pointer around a 270° arc, spin the wheel for fine steps, or focus it and use the arrow, Page, and Home/End keys. The pointer rides a spring so it settles with a little physical give, and it is a real ARIA slider throughout. It gave the Design page’s Motion section its missing verb — a two-knob spring tuner where you turn stiffness and damping and watch a puck spring across on your own curve, the "held back for the physical bits" note finally made playable — and drives a live meter in the Playground controls band. Reduced motion snaps the pointer exactly and calms the puck' },
      { kind: 'page', text: 'The library (/library) — the site claims to be made, not assembled, so here is the proof laid out flat: every hand-built component in the repository, catalogued one by one into kinds (type, surfaces, pointer fields, scroll, controls, overlays, objects, foundations), each with an honest one-line note and its scan tags. A live search and kind chips filter it, tags are clickable, and where a component is actually on show a card links straight there. Backed by a glyph field; reduced-motion aware. Sourced from data/library.ts, which is kept in step with the component count' },
      { kind: 'infra', text: 'data/stats — reconciled the honest component count to the literal number of files in src/components (the two had drifted), so the Home numbers band, Colophon, Contents, Changelog, and the new library all read one true figure' },
      { kind: 'component', text: 'Globe — a turning globe on a plain 2D canvas, no WebGL and no map texture: a Fibonacci lattice of dots rotated in 3D each frame, near-face bright and the far face a faint glass haze, so the ball reads as solid. Real cities sit at their true latitude and longitude as lime pins that pulse, label themselves, and fade as they turn to the back; it drifts on its own and a flick carries an inertial spin. Backs the About At-a-glance snapshot — the turning globe pins Berlin right beside the live local clock — and is a Playground field with Berlin, New York, and Tokyo. Reduced motion holds a still frame, Berlin facing front' },
      { kind: 'component', text: 'CompareSlider — a before/after seam you drag to wipe between two states: the top layer is clipped to a vertical divider while the finished layer shows through to its right, and a spring eases the seam toward your pointer rather than snapping. Click anywhere on the frame or focus the handle and use the arrow keys; both children stay in the DOM, so it is legible and a real ARIA slider. Anchors a fifth Craft principle — Structure, then surface, the same card as bare frame and finished self — and is a Cards & surfaces experiment; reduced motion drops the spring and the entrance sweep but keeps the drag' },
      { kind: 'component', text: 'Clock — a hand-drawn SVG analog dial that reads real Berlin time, DST-safe via Intl. One RAF loop sweeps the second hand continuously and writes transforms straight to the hand nodes, so there is no per-frame React render; the twelve-marker and second hand warm to lime when the local hours are awake, and reduced motion drops the sweep to an honest once-a-second tick. The site showed Berlin as digits in a dozen places — this gives it a face, on the Contact card and in the Playground' },
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
