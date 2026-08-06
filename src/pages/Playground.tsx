import { createRef, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { PlaygroundFinder, slugifyExperiment } from '../components/PlaygroundFinder'
import { AnimatedBeam } from '../components/AnimatedBeam'
import { ChromaGrid } from '../components/ChromaGrid'
import { GooeyTabs } from '../components/GooeyTabs'
import { GradientText } from '../components/GradientText'
import { GooeyText } from '../components/GooeyText'
import { TextType } from '../components/TextType'
import { RotatingWord } from '../components/RotatingWord'
import { SpotlightCard } from '../components/SpotlightCard'
import { TiltCard } from '../components/TiltCard'
import { GlareHover } from '../components/GlareHover'
import { BorderBeam } from '../components/BorderBeam'
import { CircularText } from '../components/CircularText'
import { MagneticButton } from '../components/MagneticButton'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Odometer } from '../components/Odometer'
import { DotGrid } from '../components/DotGrid'
import { Particles } from '../components/Particles'
import { MagnetLines } from '../components/MagnetLines'
import { Squares } from '../components/Squares'
import { FlowField } from '../components/FlowField'
import { Crosshair } from '../components/Crosshair'
import { ScrollVelocity } from '../components/ScrollVelocity'
import { DecryptedText } from '../components/DecryptedText'
import { SplitText } from '../components/SplitText'
import { BlurText } from '../components/BlurText'
import { Highlighter } from '../components/Highlighter'
import { SplitFlap } from '../components/SplitFlap'
import { Clock } from '../components/Clock'
import { CardStack } from '../components/CardStack'
import { ProfileCard } from '../components/ProfileCard'
import { PixelTransition } from '../components/PixelTransition'
import { FlipCard } from '../components/FlipCard'
import { ScratchReveal } from '../components/ScratchReveal'
import { CompareSlider } from '../components/CompareSlider'
import { Folder } from '../components/Folder'
import { ScrollStack } from '../components/ScrollStack'
import { ScrollReveal } from '../components/ScrollReveal'
import { VariableProximity } from '../components/VariableProximity'
import { SpotlightReveal } from '../components/SpotlightReveal'
import { ASCIIText } from '../components/ASCIIText'
import { CurvedLoop } from '../components/CurvedLoop'
import { FuzzyText } from '../components/FuzzyText'
import { GlitchText } from '../components/GlitchText'
import { Lens } from '../components/Lens'
import { Lamp } from '../components/Lamp'
import { Iridescence } from '../components/Iridescence'
import { TrueFocus } from '../components/TrueFocus'
import { FlowingMenu } from '../components/FlowingMenu'
import { Threads } from '../components/Threads'
import { Beams } from '../components/Beams'
import { Meteors } from '../components/Meteors'
import { BlobCursor } from '../components/BlobCursor'
import { LetterGlitch } from '../components/LetterGlitch'
import { MetaBalls } from '../components/MetaBalls'
import { PixelTrail } from '../components/PixelTrail'
import { Ribbons } from '../components/Ribbons'
import { Lightning } from '../components/Lightning'
import { Starfield } from '../components/Starfield'
import { Globe } from '../components/Globe'
import { GridMotion } from '../components/GridMotion'
import { Grain } from '../components/Grain'
import { MeshGradient } from '../components/MeshGradient'
import { BentoGrid, BentoCell } from '../components/BentoGrid'
import { GlassSurface } from '../components/GlassSurface'
import { Masonry, type MasonryItem } from '../components/Masonry'
import { Orb } from '../components/Orb'
import { Accordion } from '../components/Accordion'
import { ElasticSlider } from '../components/ElasticSlider'
import { Knob } from '../components/Knob'
import { Switch } from '../components/Switch'
import { CodeInput } from '../components/CodeInput'
import { DynamicIsland, type IslandActivity } from '../components/DynamicIsland'
import { Tooltip } from '../components/Tooltip'
import { useToast } from '../components/Toast'
import { Stepper, type StepperStep } from '../components/Stepper'
import { Dock, type DockItem } from '../components/Dock'
import { Timeline, type TimelineItem } from '../components/Timeline'
import { HorizontalScroll, type HPanel } from '../components/HorizontalScroll'
import { ScrollScene, type Scene } from '../components/ScrollScene'
import { DrawSVG } from '../components/DrawSVG'
import { PillNav, type PillLink } from '../components/PillNav'
import { CircularGallery, type GalleryItem } from '../components/CircularGallery'
import { SphereMenu, type SphereItem } from '../components/SphereMenu'
import { AnimatedList } from '../components/AnimatedList'
import { InfiniteScroll, type InfiniteScrollItem } from '../components/InfiniteScroll'
import { Lanyard } from '../components/Lanyard'
import { Turntable } from '../components/Turntable'
import { Harmonograph } from '../components/Harmonograph'
import { Kaleidoscope } from '../components/Kaleidoscope'
import { Contour } from '../components/Contour'
import { Sortable } from '../components/Sortable'
import { Carousel, type CarouselSlide } from '../components/Carousel'
import { HoverIndex, type HoverIndexItem } from '../components/HoverIndex'
import { Gravity } from '../components/Gravity'
import { GO_TARGETS, useShortcuts } from '../components/Keyboard'
import { Seo } from '../components/Seo'
import { GITHUB_URL } from '../data/contact'
import { SKILLS } from '../data/toolkit'

// Spare stroke icons for the dock — no emoji, currentColor so they warm to lime.
const ic = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
    {d.split('|').map((seg, i) => (
      <path key={i} d={seg} />
    ))}
  </svg>
)

const DOCK_ITEMS: DockItem[] = [
  { label: 'Home', to: '/', icon: ic('M3 11.5 12 4l9 7.5|M5 10v9h14v-9') },
  { label: 'Work', to: '/work', icon: ic('M4 5h7v7H4z|M13 12h7v7h-7z|M13 5h7v4h-7z|M4 14h7v5H4z') },
  { label: 'About', to: '/about', icon: ic('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z|M4.5 20a7.5 7.5 0 0 1 15 0') },
  { label: 'Toolkit', to: '/toolkit', icon: ic('M14.5 6.5a3.5 3.5 0 0 1-4.7 3.3L5 14.6 9.4 19l4.8-4.8a3.5 3.5 0 0 0 .3-7.7Z') },
  { label: 'Contact', to: '/contact', icon: ic('M4 6h16v12H4z|m4 7 8 6 8-6') },
  { label: 'GitHub', href: GITHUB_URL, icon: ic('M9 19c-4 1.4-4-2-6-2.5|M15 21v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6.2 0C8.3 1.9 7.3 2.2 7.3 2.2a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 5.9 8.6c0 4.7 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21') },
]

// Generic steps to demo the scroll-linked timeline in isolation, without
// borrowing the real About-page copy.
const TIMELINE_STEPS: TimelineItem[] = [
  { when: 'Step one', what: 'A faint spine waits', note: 'Before you scroll, the line is dim and every node sits grey and unlit.' },
  { when: 'Step two', what: 'The line draws down', note: 'As the block crosses the viewport, a lime gradient fills the spine with a glowing head at its tip.' },
  { when: 'Step three', what: 'Nodes light in turn', note: 'Each marker warms from grey to lime the moment the head reaches it, leading the eye one step at a time.' },
  { when: 'Step four', what: 'It settles', note: 'A spring smooths the progress, so the draw eases rather than snapping with the scroll.' },
]

const HSCROLL_PANELS: HPanel[] = [
  { tag: 'Pin', title: 'The section sticks', body: 'When it reaches the top of the viewport, the section pins in place and stops travelling down.' },
  { tag: 'Translate', title: 'Down becomes sideways', body: 'Your vertical scroll is mapped to horizontal travel, so the row of panels glides past instead.' },
  { tag: 'Measure', title: 'Travel is measured', body: 'It reads the real track width against the window, so the distance adapts to panel count and screen size.' },
  { tag: 'Spring', title: 'It eases, never snaps', body: 'A spring smooths the motion so the panels glide rather than jump frame to frame with the scroll.' },
  { tag: 'Fallback', title: 'Calm under reduced motion', body: 'No pinning then — it becomes a plain, user-driven horizontal scroller with snap points, fully readable.' },
]

const SCROLLSCENE_STEPS: readonly Scene[] = [
  { tag: 'Step 01', title: 'The stage pins in place', body: 'As the section arrives, the visual sticks to the viewport and waits while the steps scroll past it.' },
  { tag: 'Step 02', title: 'Each step takes the floor', body: 'A step crosses the mid-line and becomes active — the rail lights and the copy comes forward.' },
  { tag: 'Step 03', title: 'The stage cross-fades', body: 'The pinned frame transforms to match the active step, so the picture and the words stay in lock-step.' },
  { tag: 'Step 04', title: 'It reads on a phone too', body: 'On a narrow screen the stage pins to the top and the steps scroll underneath it. Same story, one column.' },
]

// The Playground's five families of experiments. `PillNav` scroll-spies these
// ids, and each drives a titled section below.
const CATEGORIES: { id: string; num: string; label: string; title: string; blurb: string }[] = [
  {
    id: 'type',
    num: '01',
    label: 'Type & text',
    title: 'Type in motion.',
    blurb: 'Letters and words that respond to the cursor, the scroll, and the moment they first appear.',
  },
  {
    id: 'cards',
    num: '02',
    label: 'Cards & surfaces',
    title: 'Surfaces that respond.',
    blurb: 'Cards that tilt, glow, and catch the light as the cursor moves across them.',
  },
  {
    id: 'fields',
    num: '03',
    label: 'Pointer fields',
    title: 'Fields that follow.',
    blurb: 'Full-canvas fields — dots, needles, cells, threads, glyphs, blobs, ribbons, sheens — that bend and warm toward the pointer.',
  },
  {
    id: 'scroll',
    num: '04',
    label: 'Scroll-driven',
    title: 'Tied to the scroll.',
    blurb: 'Motion wired to the scroll position — drawing, stacking, and travelling as you move down the page.',
  },
  {
    id: 'controls',
    num: '05',
    label: 'Navigation & controls',
    title: 'Controls with feel.',
    blurb: 'Buttons, menus, and switches built for feel — magnetic pulls, gooey tabs, a magnifying dock, keyboard chords.',
  },
]

const NAV_LINKS: PillLink[] = CATEGORIES.map((c) => ({ id: c.id, label: c.label }))

// Panels for the Carousel demo — honest beliefs about the craft, one line each,
// deliberately about how the work is made rather than any single project.
const CRAFT_FRAMES: CarouselSlide[] = [
  { n: '01', title: 'Made, not assembled.', body: 'Every field, cursor, and card here is written by hand — nothing pulled from a shelf.' },
  { n: '02', title: 'Motion with a reason.', body: 'It moves to guide the eye and give weight to a moment, never just to show off.' },
  { n: '03', title: 'Respect the still.', body: 'Reduced motion is a real path through everything, designed on purpose — not an afterthought.' },
  { n: '04', title: 'The details you feel.', body: 'Most of the work lives in small moments people never consciously notice, only sense.' },
  { n: '05', title: 'Built in the open.', body: 'The site grows most days, one commit at a time, all of it on GitHub to read.' },
].map(({ n, title, body }) => ({
  id: n,
  label: title,
  content: (
    <div className="text-center">
      <span className="font-display text-5xl font-semibold tabular-nums text-[#DCF87C]/25 sm:text-6xl">{n}</span>
      <h4 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
        <GradientText>{title}</GradientText>
      </h4>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/55 sm:text-base">{body}</p>
    </div>
  ),
}))

// A titled band of experiments. The eyebrow/heading orient the reader and give
// the PillNav a real target to scroll-spy and jump to.
function Category({
  id,
  num,
  label,
  title,
  blurb,
  children,
}: {
  id: string
  num: string
  label: string
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <section id={id} data-category={label} className="scroll-mt-32 pt-20">
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">
          {num} — {label}
        </p>
      </Reveal>
      <Reveal delay={0.05}>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      </Reveal>
      <Reveal delay={0.08}>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-white/50">{blurb}</p>
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  )
}

function Experiment({
  name,
  note,
  children,
}: {
  name: string
  note: string
  children: React.ReactNode
}) {
  const id = slugifyExperiment(name)
  const [copied, setCopied] = useState(false)
  function copyLink() {
    const url = `${window.location.origin}/playground#${id}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }
  return (
    <div id={id} data-experiment={name} className="group/exp flex scroll-mt-32 flex-col">
      <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-8">
        {children}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3 px-1">
        <div>
          <h3 className="text-base font-semibold">{name}</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/45">{note}</p>
        </div>
        {/* Every experiment is addressable — copy a deep link that scrolls here
            and flashes the card on arrival. Quiet until hover/focus. */}
        <button
          type="button"
          onClick={copyLink}
          aria-label={`Copy link to ${name}`}
          className="mt-0.5 shrink-0 rounded-full border border-white/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/40 opacity-0 transition-all hover:border-[#DCF87C]/50 hover:text-[#DCF87C] focus-visible:opacity-100 group-hover/exp:opacity-100"
        >
          {copied ? 'Copied' : 'Link'}
        </button>
      </div>
    </div>
  )
}

// A node-web demo of AnimatedBeam: three source nodes on the left feed a lime
// hub, which fans out to two on the right, so the light reads as flowing left
// -> hub -> right through the whole graph. Shows off the primitive's curvature,
// the staggered delays, and the two reversed spokes. Beams are measured off the
// real DOM nodes, so the wiring holds however the flex boxes lay out.
const BEAM_LEFT = ['Design', 'Systems', 'Motion']
const BEAM_RIGHT = ['Web', 'iOS']
function BeamDemo() {
  const containerRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)
  const leftRefs = useRef(BEAM_LEFT.map(() => createRef<HTMLDivElement>()))
  const rightRefs = useRef(BEAM_RIGHT.map(() => createRef<HTMLDivElement>()))
  const lMid = (BEAM_LEFT.length - 1) / 2
  const rMid = (BEAM_RIGHT.length - 1) / 2

  const dot =
    'grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-[#0B0B0B] text-[10px] font-semibold uppercase tracking-wide text-white/60 sm:h-14 sm:w-14 sm:text-xs'

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-between gap-2 px-2 py-6 sm:px-10"
    >
      {/* Sources */}
      <div className="relative z-10 flex flex-col gap-5 sm:gap-8">
        {BEAM_LEFT.map((l, i) => (
          <div key={l} ref={leftRefs.current[i]} className={dot}>
            {l}
          </div>
        ))}
      </div>

      {/* Hub */}
      <div className="relative z-10">
        <div
          ref={hubRef}
          className="grid h-16 w-16 place-items-center rounded-full border border-[#DCF87C]/50 bg-[#DCF87C]/[0.07] sm:h-20 sm:w-20"
        >
          <span className="font-display text-lg font-bold text-[#DCF87C] sm:text-xl">AC</span>
        </div>
      </div>

      {/* Outputs */}
      <div className="relative z-10 flex flex-col gap-8 sm:gap-12">
        {BEAM_RIGHT.map((r, i) => (
          <div key={r} ref={rightRefs.current[i]} className={dot}>
            {r}
          </div>
        ))}
      </div>

      {/* Left -> hub */}
      {BEAM_LEFT.map((l, i) => (
        <AnimatedBeam
          key={`l-${l}`}
          containerRef={containerRef}
          fromRef={leftRefs.current[i]}
          toRef={hubRef}
          curvature={(i - lMid) * 20}
          delay={i * 0.4}
          duration={3}
        />
      ))}
      {/* Hub -> right (reversed, so the light keeps travelling outward) */}
      {BEAM_RIGHT.map((r, i) => (
        <AnimatedBeam
          key={`r-${r}`}
          containerRef={containerRef}
          fromRef={hubRef}
          toRef={rightRefs.current[i]}
          curvature={(i - rMid) * 26}
          delay={0.6 + i * 0.4}
          duration={3}
          gradientStartColor="#8ad0ff"
          gradientStopColor="#DCF87C"
        />
      ))}
    </div>
  )
}

// A Knob showcase: the dial drives a live preview so the value is felt, not
// just read. Turning it warms a lime meter and grows the ring — pointer drag,
// wheel, or keyboard all move it.
function KnobDemo() {
  const [level, setLevel] = useState(62)
  return (
    <div className="flex items-center gap-10">
      <Knob label="Level" min={0} max={100} value={level} onChange={setLevel} format={(v) => `${Math.round(v)}`} />
      <div className="flex h-28 w-8 items-end overflow-hidden rounded-full border border-white/12 bg-white/[0.03]">
        <div
          className="w-full rounded-full bg-[#DCF87C] transition-[height] duration-150"
          style={{ height: `${level}%` }}
        />
      </div>
    </div>
  )
}

// A CodeInput showcase: a live six-cell passcode field wired to a real success
// state. Filling every cell fires onComplete once — flipping the field into a
// verified chip and raising a toast — and Reset clears it back to empty. The
// value is controlled so the reset and the completion state stay in step.
function CodeInputDemo() {
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(false)
  const { toast } = useToast()
  return (
    <div className="flex flex-col items-center gap-6">
      <CodeInput
        value={code}
        onChange={(v) => {
          setCode(v)
          if (verified) setVerified(false)
        }}
        onComplete={(v) => {
          setVerified(true)
          toast(`Code ${v} entered`, { tone: 'success' })
        }}
        label="Verification code"
        size={50}
      />
      <div className="flex items-center gap-4">
        <span
          className={`inline-flex items-center gap-2 text-sm transition-colors ${
            verified ? 'text-[#DCF87C]' : 'text-white/40'
          }`}
          aria-live="polite"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              verified ? 'bg-[#DCF87C]' : 'bg-white/25'
            }`}
          />
          {verified ? 'Code entered' : 'Enter all six'}
        </span>
        <button
          type="button"
          onClick={() => {
            setCode('')
            setVerified(false)
          }}
          className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition-colors hover:border-[#DCF87C]/40 hover:text-[#DCF87C]"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

// A live trigger board for the site-wide toast queue. Each button raises a real
// toast through the same useToast() the contact channels and command palette
// use, so the demo shows the exact stacking, countdown meter, hover-pause, and
// flick-to-dismiss that ship everywhere else.
function ToastDemo() {
  const { toast } = useToast()
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => toast('Email address copied', { tone: 'success' })}
        className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-5 py-2.5 text-sm font-semibold text-[#DCF87C] transition hover:bg-[#DCF87C]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        Confirmation
      </button>
      <button
        type="button"
        onClick={() => toast('Nothing to send yet — write a line first', { tone: 'error' })}
        className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        Gentle error
      </button>
      <button
        type="button"
        onClick={() => toast('This one waits for you — hover to hold it', { duration: 6000 })}
        className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        Longer
      </button>
      <button
        type="button"
        onClick={() => {
          toast('First')
          toast('Second, stacking up')
          toast('Third — the oldest falls off the top')
        }}
        className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        Stack three
      </button>
    </div>
  )
}

// A masonry "wall" of honest tiles — the site's own making-by-hand ethos and a
// couple of plain facts, deliberately varied in height so the packing shows.
// Distinct from the site's fixed grids: each tile drops into the shortest
// column from its measured height, and a shuffle reflows the wall on a spring.
type WallTile =
  | { id: string; kind: 'stat'; value: string; unit?: string; label: string; accent?: boolean }
  | { id: string; kind: 'note'; eyebrow: string; title: string; body?: string; tall?: boolean }
  | { id: string; kind: 'quote'; text: string }

const WALL_BASE: WallTile[] = [
  { id: 'w-count', kind: 'stat', value: '100', unit: '+', label: 'components, hand-built', accent: true },
  { id: 'w-motto', kind: 'quote', text: 'Build it well. Then make it move.' },
  {
    id: 'w-spring',
    kind: 'note',
    eyebrow: 'Motion',
    title: 'Spring, not tween',
    body: 'Almost everything here eases on a spring, so it settles with a little physical give instead of a mechanical stop.',
  },
  { id: 'w-faces', kind: 'stat', value: '2', label: 'type faces: Inter + Fraunces' },
  {
    id: 'w-reduced',
    kind: 'note',
    eyebrow: 'Care',
    title: 'Reduced motion, always',
    body: 'Every effect has a still, legible fallback. The calm path is designed, not bolted on.',
    tall: true,
  },
  { id: 'w-berlin', kind: 'note', eyebrow: 'Place', title: 'Berlin', body: 'Where I build from.' },
  {
    id: 'w-template',
    kind: 'note',
    eyebrow: 'Ethos',
    title: 'No template',
    body: 'The aurora, the cursor, every card — each is its own file in this repository, written by hand.',
  },
  { id: 'w-open', kind: 'stat', value: '100', unit: '%', label: 'open source, on GitHub' },
  {
    id: 'w-pointer',
    kind: 'note',
    eyebrow: 'Feel',
    title: 'The pointer is a light',
    body: 'Fields warm and lean toward the cursor, so a surface feels alive before you touch it.',
  },
  { id: 'w-student', kind: 'note', eyebrow: 'Now', title: 'Student, co-founder', body: 'Learning in the day, building at night.' },
]

function WallCard({ tile }: { tile: WallTile }) {
  if (tile.kind === 'stat') {
    return (
      <div
        className={`rounded-3xl border p-6 ${
          tile.accent
            ? 'border-[#DCF87C]/30 bg-[#DCF87C]/[0.06]'
            : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        <p className="font-display text-5xl font-bold leading-none tracking-tight text-white">
          {tile.value}
          {tile.unit ? <span className="text-[#DCF87C]">{tile.unit}</span> : null}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{tile.label}</p>
      </div>
    )
  }
  if (tile.kind === 'quote') {
    return (
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-7">
        <p className="font-display text-2xl font-bold leading-snug tracking-tight text-white">
          &ldquo;{tile.text}&rdquo;
        </p>
      </div>
    )
  }
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.03] p-6 ${tile.tall ? 'sm:pb-10' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#DCF87C]">{tile.eyebrow}</p>
      <p className="mt-3 font-display text-xl font-bold leading-tight tracking-tight text-white">{tile.title}</p>
      {tile.body ? <p className="mt-2 text-sm leading-relaxed text-white/50">{tile.body}</p> : null}
    </div>
  )
}

// Fisher-Yates with a caller-supplied index seed (no Math.random in render):
// each "Shuffle" click advances the seed so the reflow is deterministic yet
// visibly different every press.
function reorder<T>(list: T[], seed: number): T[] {
  const out = list.slice()
  let s = seed * 9301 + 49297
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function MasonryDemo() {
  const [seed, setSeed] = useState(0)
  const items: MasonryItem[] = (seed === 0 ? WALL_BASE : reorder(WALL_BASE, seed)).map((tile) => ({
    id: tile.id,
    content: <WallCard tile={tile} />,
  }))
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-white/45">
          Tiles of any height, packed into the shortest column. Resize the window, or shuffle.
        </p>
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/40 hover:text-white"
        >
          Shuffle
        </button>
      </div>
      <Masonry items={items} minColWidth={220} gap={18} />
    </div>
  )
}

// A replayable SplitText demo. Bumping the key remounts the lines so the
// staggered entrance runs again on demand.
function SplitTextDemo() {
  const [run, setRun] = useState(0)
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div key={run} className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
        <SplitText as="span" text="Made to" gradient trigger="mount" className="block" />
        <SplitText as="span" text="move." trigger="mount" delay={0.24} className="block" />
      </div>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        Replay
      </button>
    </div>
  )
}

// A replayable BlurText demo. Bumping the key remounts the lines so the
// blur-to-focus reveal runs again on demand.
function BlurTextDemo() {
  const [run, setRun] = useState(0)
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <div key={run} className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
        <BlurText as="span" text="Pulled into" trigger="mount" className="block" />
        <BlurText as="span" text="focus." trigger="mount" gradient delay={0.4} className="block" />
      </div>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        Replay
      </button>
    </div>
  )
}

// A replayable Highlighter demo. Bumping the key remounts the line so both
// marker strokes sweep in again — one behind a phrase, one under another — with
// the trigger set to 'mount' so they run on demand rather than on scroll.
function HighlighterDemo() {
  const [run, setRun] = useState(0)
  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <p
        key={run}
        className="max-w-sm font-display text-2xl font-semibold leading-[1.5] tracking-tight text-white sm:text-3xl"
      >
        The best work is the part you{' '}
        <Highlighter trigger="mount" delay={0.2}>
          never notice
        </Highlighter>
        , only the part you{' '}
        <Highlighter trigger="mount" delay={0.85} underline>
          feel
        </Highlighter>
        .
      </p>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        Replay
      </button>
    </div>
  )
}

// A split-flap board that cycles the craft words on a timer, so the two-phase
// hinge flip reads like an airport departure board. All words are six letters,
// so no cell is added or removed between changes.
const FLAP_WORDS = ['MOTION', 'DESIGN', 'DETAIL', 'REFINE']

function SplitFlapDemo() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % FLAP_WORDS.length), 2200)
    return () => window.clearInterval(id)
  }, [])
  return (
    <SplitFlap value={FLAP_WORDS[i]} height={62} width={42} aria-label="Split-flap board cycling craft words" />
  )
}

// Panels for the gooey-tabs demo. Honest and self-referential: each tab
// describes a facet of how the effect itself is built, so nothing is claimed
// that the component does not actually do.
// Self-referential cards for the coverflow demo — each describes a facet of the
// component itself, so nothing is claimed that it does not actually do.
const COVERFLOW_CARDS: GalleryItem[] = [
  { tag: 'Drag', title: 'Grab and flip', body: 'Pointer or touch drags the deck; it rubber-bands past the ends and snaps to the nearest card on release.' },
  { tag: 'Perspective', title: 'Real 3D depth', body: 'Side cards rotate away in perspective and dim, so the row reads as a coverflow, not a flat carousel.' },
  { tag: 'Interpolated', title: 'Follows your finger', body: 'The same transform curve is evaluated at fractional offsets mid-drag, so cards glide rather than jump.' },
  { tag: 'Steerable', title: 'Many ways in', body: 'Drag, wheel, arrow keys, the prev/next buttons, the dots, or a click on a side card to bring it forward.' },
  { tag: 'Fallback', title: 'Calm without motion', body: 'Under reduced motion it drops the perspective and becomes a plain, fully readable snap-scroll row.' },
]

// The whole site, orbiting — every destination as a link on the sphere, so no
// single project is the centre. Grab it and spin to browse.
const SPHERE_LINKS: SphereItem[] = [
  { label: 'Home', to: '/' },
  { label: 'Work', to: '/work', hint: 'Case studies' },
  { label: 'About', to: '/about' },
  { label: 'Playground', to: '/playground' },
  { label: 'Toolkit', to: '/toolkit' },
  { label: 'Writing', to: '/writing' },
  { label: 'On motion', to: '/craft' },
  { label: 'Design', to: '/design' },
  { label: 'Now', to: '/now' },
  { label: 'Contact', to: '/contact' },
  { label: 'Colophon', to: '/colophon' },
  { label: 'Answers', to: '/answers' },
  { label: 'Résumé', to: '/resume' },
  { label: 'Terminal', to: '/terminal' },
  { label: 'Changelog', to: '/changelog' },
  { label: 'Index', to: '/contents' },
  { label: 'GitHub', href: 'https://github.com/ArseniyCherednichenko/portfolio', hint: 'Source' },
]

const INDEX_LINKS: HoverIndexItem[] = [
  { label: 'Work', to: '/work', meta: 'Case studies' },
  { label: 'About', to: '/about', meta: 'Who' },
  { label: 'Playground', to: '/playground', meta: 'Motion' },
  { label: 'Toolkit', to: '/toolkit', meta: 'What I build with' },
  { label: 'On motion', to: '/craft', meta: 'Craft' },
  { label: 'Design language', to: '/design', meta: 'Tokens' },
  { label: 'Writing', to: '/writing', meta: 'Notes' },
  { label: 'Now', to: '/now', meta: 'This week' },
  { label: 'Contact', to: '/contact', meta: 'Reach me' },
]

// An endless column for the InfiniteScroll demo — the disciplines Arseniy
// works across, one honest line each. Non-interactive display cards (the loop
// duplicates them), so nothing here is a link.
const SCROLL_ROWS: { tag: string; title: string; line: string; accent?: boolean }[] = [
  { tag: 'Frontend', title: 'React & TypeScript', line: 'The web app — components, state, the whole surface.', accent: true },
  { tag: 'Native', title: 'iOS in SwiftUI', line: 'A native app on the same backend, built by hand.' },
  { tag: 'Motion', title: 'Framer Motion', line: 'Entrances, springs, and reveals — the site itself.', accent: true },
  { tag: 'Backend', title: 'Supabase & Postgres', line: 'Auth, data, and the seams kept invisible.' },
  { tag: 'Applied AI', title: 'Building with LLMs', line: 'A Socratic tutor that asks rather than answers.' },
  { tag: 'Design', title: 'The whole thing', line: 'Type, colour, and rhythm, not just the code.' },
]

const SCROLL_ITEMS: InfiniteScrollItem[] = SCROLL_ROWS.map((r, i) => ({
  key: `${r.tag}-${i}`,
  content: (
    <div
      className={`mx-auto flex w-[min(340px,80vw)] items-center gap-4 rounded-2xl border px-5 py-4 ${
        r.accent
          ? 'border-[#DCF87C]/25 bg-[#DCF87C]/[0.05]'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
          r.accent ? 'bg-[#DCF87C]/15 text-[#DCF87C]' : 'bg-white/[0.05] text-white/60'
        }`}
      >
        {String(i + 1).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#DCF87C]/80">{r.tag}</span>
          <span className="truncate text-sm font-semibold text-white/90">{r.title}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-white/45">{r.line}</p>
      </div>
    </div>
  ),
}))

const STEPPER_DEMO: StepperStep[] = [
  {
    label: 'Ways in',
    title: 'Move it however you like',
    body: 'Click a node on the rail, press the buttons, or focus the rail and use the arrow keys. On the panel below you can also drag or swipe. No single right way in.',
  },
  {
    label: 'The rail',
    title: 'A rail that keeps score',
    body: 'The lime fill sweeps along the connector to the active node, cleared steps carry a check, and the dots under the buttons widen to mark where you are. Orientation without a word of instruction.',
  },
  {
    label: 'Direction',
    title: 'Motion that mirrors intent',
    body: 'Advance and the next panel slides in from the right; go back and it comes from the left. The travel matches the direction you asked for, so the change reads as movement, not a flicker.',
  },
  {
    label: 'Reduced',
    title: 'Calm when asked',
    body: 'Under prefers-reduced-motion the drag comes off and panels cross-fade in place with no directional drift. Same content, same controls, none of the travel.',
  },
]

const GOO_PANELS: { label: string; title: string; body: string }[] = [
  {
    label: 'Blobs',
    title: 'Two blobs, not one pill',
    body: 'A snappy head jumps to the tab you pick; a laggier tail chases it. In the gap between them the selection reads as a single stretched shape.',
  },
  {
    label: 'Goo',
    title: 'Merged by a filter',
    body: 'Both blobs live inside an SVG gooey filter: a blur fans them into halos, then a crushed alpha ramp fuses those halos wherever they overlap and keeps them crisp where they do not.',
  },
  {
    label: 'Springs',
    title: 'Timed by two springs',
    body: 'The head and tail run on different spring stiffness, so the tail always trails a beat behind. That mismatch is what makes the shape drip forward instead of gliding rigidly.',
  },
  {
    label: 'Reduced',
    title: 'Calm fallback',
    body: 'With reduced motion the goo and the tail both drop away. A single pill moves instantly under the active tab, and every label stays perfectly legible.',
  },
]

function GooeyTabsDemo() {
  const [active, setActive] = useState(0)
  const panel = GOO_PANELS[active]
  return (
    <div className="flex flex-col items-center gap-8">
      <GooeyTabs
        tabs={GOO_PANELS.map((p) => p.label)}
        value={active}
        onChange={setActive}
      />
      <div className="relative min-h-[120px] w-full max-w-md text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <h4 className="font-display text-2xl font-semibold tracking-tight">{panel.title}</h4>
            <p className="mt-3 text-sm leading-relaxed text-white/50">{panel.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// A replayable Lamp scene. The rig switches on when it scrolls into view; the
// remount key lets you flick it off and on again to watch the ignition, since
// the real thing fires once per arrival. A dim scene behind it so the additive
// lime light reads.
function LampDemo() {
  const [run, setRun] = useState(0)
  return (
    <div className="relative">
      <div key={run} className="flex min-h-[360px] flex-col items-center px-6 pb-10">
        <Lamp className="w-full">
          <h4 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
            Switched <GradientText>on.</GradientText>
          </h4>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/55">
            The tube stretches, the beam fans down, and the words rise up into the light it casts.
          </p>
        </Lamp>
      </div>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/50 px-5 py-2 text-sm font-semibold text-white/80 backdrop-blur-sm transition-colors hover:border-[#DCF87C]/40 hover:text-white"
      >
        Switch off, then on
      </button>
    </div>
  )
}

export default function Playground() {
  const [likes, setLikes] = useState(128)
  const [on, setOn] = useState(false)
  const [wifi, setWifi] = useState(true)
  const [reduce, setReduce] = useState(false)
  const [volume, setVolume] = useState(62)
  const [island, setIsland] = useState<IslandActivity>('music')
  const { openShortcuts } = useShortcuts()

  return (
    <section className="mx-auto w-full max-w-5xl px-6 pt-36 pb-12">
      <Seo
        title="Playground"
        description="A gallery of live motion experiments by Arseniy Cherednichenko — tilt cards, spotlight glows, decrypt text, an interactive dot field, and more."
      />
      {/* HEADER */}
      <div className="relative isolate">
        {/* A faint gooey field drifts behind the title so the page opens in motion. */}
        <div className="pointer-events-none absolute -top-24 right-0 -z-10 h-[380px] w-[min(560px,90%)] opacity-30 [mask-image:radial-gradient(120%_100%_at_70%_30%,#000_35%,transparent_75%)]">
          <MetaBalls count={6} />
        </div>
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Playground</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            Motion, <GradientText>up close.</GradientText>
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/55">
            A workbench for the interaction details I care about, grouped by the kind of motion at work. Every piece here
            is hand-built with React and Framer Motion, and every one respects reduced-motion. Hover, click, and poke
            around.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/45">
            Want it art-directed instead of dissected?{' '}
            <Link
              to="/reel"
              className="font-medium text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:decoration-[#DCF87C]"
            >
              Watch the reel
            </Link>{' '}
            — the same pieces, full-screen, as a sequence.
          </p>
        </Reveal>
      </div>

      {/* STICKY CATEGORY NAV */}
      <Reveal delay={0.14}>
        <div className="sticky top-24 z-30 mt-12">
          <PillNav links={NAV_LINKS} layoutId="playground-nav" />
        </div>
      </Reveal>

      {/* 01 — TYPE & TEXT */}
      <Category {...CATEGORIES[0]}>
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
          <Reveal>
            <Experiment name="Animated counter" note="Counts up with an ease curve the first time it enters the viewport.">
              <div className="text-center">
                <AnimatedCounter value={2026} className="text-6xl font-bold tabular-nums sm:text-7xl" />
                <p className="mt-2 text-sm text-white/45">Eases from zero on reveal</p>
              </div>
            </Experiment>
          </Reveal>

          <Reveal delay={0.05}>
            <Experiment name="Odometer" note="A mechanical trip-meter count: each place is a reel of 0-9 that rolls up from zero into place, higher places landing a beat later. A physical slide, not a text-swap. Drives the by-the-numbers row on the homepage.">
              <div className="text-center">
                <Odometer value={1024} minDigits={4} className="text-6xl font-bold tabular-nums text-[#DCF87C] sm:text-7xl" />
                <p className="mt-2 text-sm text-white/45">Reels travel up on reveal</p>
              </div>
            </Experiment>
          </Reveal>

          <Reveal delay={0.05}>
            <Experiment name="Circular text" note="A string laid around a ring that rotates on a constant loop. Each glyph is aria-hidden; the real label is read once. Drives the hero's scroll seal.">
              <CircularText text="CRAFT · MOTION · DETAIL · " radius={52} spin={18} label="Craft, motion, detail">
                <span aria-hidden className="block h-2.5 w-2.5 rounded-full bg-[#DCF87C]" />
              </CircularText>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment name="Gradient + rotating type" note="A shimmering gradient sweep paired with a cross-fading word cycle.">
              <div className="text-center text-3xl font-bold leading-snug sm:text-4xl">
                <GradientText>Built for</GradientText>
                <div className="mt-2 text-white/80">
                  <RotatingWord words={['delight.', 'clarity.', 'speed.', 'craft.']} />
                </div>
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment name="Decrypt-on-view text" note="Characters resolve from random glyphs into the final string. Replays on hover.">
              <div className="text-center font-mono text-2xl font-bold tracking-tight sm:text-3xl">
                <DecryptedText text="DECODING CRAFT" className="text-[#DCF87C]" />
                <div className="mt-3 text-base text-white/70">
                  <DecryptedText text="hover to replay" speed={26} />
                </div>
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment name="Split-text reveal" note="Each character lifts and fades into place, one after the next. Hit replay to run it again.">
              <SplitTextDemo />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment name="Blur-to-focus text" note="Words resolve out of a soft focus — each begins heavily blurred and drifts a touch as it sharpens, like a lens pulling in. The blur is the signature, distinct from the split-text lift and the scroll-linked word fade. Drives the Home 'More than one project.' line. Hit replay to run it again.">
              <BlurTextDemo />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Marker highlight"
              note="A highlighter dragged once across the words: a translucent lime band with soft, slightly uneven ends grows left-to-right from nothing, transform-origin left, one phrase behind the text and one as an underline. Distinct from the self-drawing underline (a traced vector path) and the cursor spotlight (a moving mask) — this is a marker sweep, and the text stays real and selectable on top. It marks two beliefs in the About intro. Reduced motion paints the band still. Hit replay to run it again."
            >
              <HighlighterDemo />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Gooey text morph"
              note="One word melts into the next. Two text layers live under a gooey SVG filter (blur, then an alpha-crushing matrix — the same metaball trick GooeyTabs uses on its blobs); as one word blurs out and the next sharpens in, their glyph-halos fuse into a liquid mass mid-swap before resolving. The filter engages only mid-morph, so resting type stays crisp. It drives the About page's 'I work across ...' band. Reduced motion swaps them plainly."
            >
              <GooeyText
                words={['Motion', 'Craft', 'Detail', 'Type']}
                label="I build with"
                interval={2200}
                blur={16}
                className="font-display text-5xl font-bold tracking-tight text-[#DCF87C] sm:text-6xl"
              />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="True focus"
              note="A lime corner frame glides to the focused word while the rest blur out. It auto-cycles, or hover a word to pin it."
            >
              <TrueFocus
                words={['Design', 'Build', 'Refine', 'Ship']}
                className="justify-center text-3xl font-bold tracking-tight sm:text-4xl"
              />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Split-flap board"
              note="A departure-board display: the top leaf folds down to hide the old glyph while a fresh bottom leaf drops into place. A two-phase mechanical hinge, not a spring. Drives the live Berlin clock on the contact page."
            >
              <SplitFlapDemo />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Analog clock"
              note="A hand-drawn SVG dial reading real Berlin time. One RAF loop sweeps the second hand continuously and writes transforms straight to the hand nodes — no per-frame React render. Timezone-correct via Intl; the twelve-marker and second hand warm to lime when the local hours are awake. Reduced motion drops the sweep to an honest once-a-second tick."
            >
              <div className="flex justify-center py-2">
                <Clock size={132} label="Berlin" />
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Signal fuzz"
              note="Clean type torn sideways scanline by scanline, like a word caught on a detuned screen. Drawn once to an offscreen buffer, then blitted back row by row with a jitter that swells under the pointer. Reduced motion holds it crisp and still."
            >
              <div data-cursor className="flex justify-center">
                <FuzzyText text="FUZZY" fontSize={78} />
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Chromatic glitch"
              note="Two colour-split ghost copies snap to sliced offsets over a clean base, so the word tears into digital signal corruption then re-forms. Distinct from the signal-fuzz tear beside it: that shears grayscale scanlines, this rips coloured channels off the type. The base stays crisp and readable throughout; the slices are pure CSS keyframes cut with steps(1). Reduced motion drops the ghosts for clean type."
            >
              <GlitchText
                text="GLITCH"
                intensity={5}
                className="font-display text-6xl font-bold tracking-tight sm:text-7xl"
              />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Typewriter"
              note="The classic terminal cadence: a phrase types out one keystroke at a time, holds, erases, and the next one takes its place — a blinking block caret riding the end. A single self-rescheduling timeout advances one character per tick; distinct from the scramble, melt, and hinge effects elsewhere. It types a live prompt line on the /terminal page. Reduced motion renders the first phrase in full with a steady caret."
            >
              <div className="text-center font-mono text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="text-white/40">$ </span>
                <TextType
                  phrases={['ship the detail', 'make it move', 'build by hand', 'respect the still']}
                  caret="block"
                  className="text-[#DCF87C]"
                />
              </div>
            </Experiment>
          </Reveal>
        </div>

        {/* FULL-WIDTH VARIABLE PROXIMITY */}
        <Reveal>
          <div className="mt-12">
            <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-20 text-center">
              <p className="max-w-3xl text-5xl leading-[1.05] tracking-tight sm:text-7xl">
                <VariableProximity text="Lean in." radius={200} />{' '}
                <VariableProximity text="Type that feels you." radius={200} />
              </p>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor-pressure variable type</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Each letter rides the variable Fraunces weight and optical-size axes, swelling toward the cursor and
                easing back as it leaves. Pure requestAnimationFrame, no per-letter React state. Reduced-motion gets a
                fixed-weight line.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH SPOTLIGHT REVEAL */}
        <Reveal>
          <div className="mt-12">
            <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-20 text-center sm:px-14">
              <SpotlightReveal
                text="Bring your own light. The words are already here, waiting in the dark for the cursor to find them."
                highlight={['light.', 'dark', 'find']}
                hint="Sweep the cursor across the line"
                className="max-w-3xl font-display text-3xl font-semibold leading-[1.2] tracking-tight sm:text-5xl sm:leading-[1.18]"
              />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor torch reveal</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A dim statement sits nearly dark until a soft torch of light, masked to the cursor, resolves the words
                (and a few lime highlights) as you sweep across, then fades back out. A springed radial mask over a lit
                copy of the text. Touch and reduced-motion get it fully lit.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH LAMP */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40">
              <LampDemo />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Overhead lamp</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A light rig that switches on as the section arrives: a thin glowing tube stretches wide, a beam fans
                down, a soft pool blooms, and the heading rises up into the light. The whole thing is additive lime
                over the background, so it lights what is behind rather than boxing it in. In the spirit of
                Aceternity&rsquo;s Lamp, rebuilt from scratch. It lights the closing statement on the work page.
                Reduced motion renders it already lit and still.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH ASCII TEXT */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[300px] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40">
              <ASCIIText text="PLAYGROUND" cell={10} />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Live ASCII type</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                The word is rendered once into a grid-resolution buffer, so every cell knows how much
                of a letter it covers, then painted one monospace glyph at a time, picking a denser
                character the brighter the cell. A slow shimmer keeps it breathing; the cursor is a
                torch that lights the field as it passes. Reduced-motion paints one still frame.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH CURVED LOOP */}
        <Reveal>
          <div className="mt-12">
            <div className="relative flex min-h-[240px] items-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <CurvedLoop
                text="Design · Motion · Type · Detail ·"
                textClassName="fill-white font-display text-[76px] font-bold uppercase tracking-tight"
                curveAmount={360}
              />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Type on a curve</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                The phrase is laid along an SVG arc with a textPath and looped by driving its
                startOffset every frame — no straight marquee, the words bow with the curve. Grab
                the band to scrub it and a flick carries a decaying fling on top of the drift.
                Reduced-motion paints one still frame on the curve.
              </p>
            </div>
          </div>
        </Reveal>
      </Category>

      {/* 02 — CARDS & SURFACES */}
      <Category {...CATEGORIES[1]}>
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
          <Reveal>
            <Experiment name="3D tilt card" note="Rotates toward the cursor with a soft lime glare. Built on motion springs.">
              <TiltCard className="w-full max-w-[260px]">
                <div className="flex flex-col gap-2 p-7">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Depth</span>
                  <p className="text-2xl font-bold leading-tight">Tilt me with your cursor</p>
                  <p className="text-sm text-white/50">Perspective, spring damping, parallax layer.</p>
                </div>
              </TiltCard>
            </Experiment>
          </Reveal>

          <Reveal delay={0.05}>
            <Experiment name="Glowing orb" note="A lit sphere with real volume: a dark base shaded from the upper-left, a slow energy band rotating inside, and a specular highlight plus a 3D tilt that both track the cursor. Anchors the Contact page.">
              <Orb size={180} listen="self" />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment name="Cursor spotlight" note="A radial glow tracks the pointer inside the card's bounds.">
              <SpotlightCard className="w-full max-w-[260px]">
                <div className="flex flex-col gap-2 p-7">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Glow</span>
                  <p className="text-2xl font-bold leading-tight">Move across me</p>
                  <p className="text-sm text-white/50">Pointer-driven radial gradient, masked to the card.</p>
                </div>
              </SpotlightCard>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment name="Glare sweep" note="A skewed band of light glides across the surface on hover, then slides back out. Pure CSS, clipped to the shape.">
              <GlareHover className="w-full max-w-[260px] border border-white/10 bg-white/[0.03]">
                <div className="flex flex-col gap-2 p-7">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Sheen</span>
                  <p className="text-2xl font-bold leading-tight">Hover for the light</p>
                  <p className="text-sm text-white/50">Used across the work posters site-wide.</p>
                </div>
              </GlareHover>
            </Experiment>
          </Reveal>

          <Reveal delay={0.05}>
            <Experiment name="Border beam" note="A comet of light laps the border on a loop. A conic gradient masked to a thin ring, its angle spun by a registered CSS property.">
              <div className="relative w-full max-w-[260px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                <div className="flex flex-col gap-2 p-7">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Frame</span>
                  <p className="text-2xl font-bold leading-tight">Watch the edge</p>
                  <p className="text-sm text-white/50">The light traces the corners on a loop.</p>
                </div>
                <BorderBeam />
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Auto-advancing card deck"
              note="A 3D stack where the front card recedes to the back on a timer. Click a card or a dot to drive it; hover to pause."
            >
              <CardStack
                className="w-full"
                interval={3000}
                cards={[
                  { tag: 'Depth', title: 'Cards behind peek out', body: 'Each layer is offset, scaled, and tilted for a real sense of stack.' },
                  { tag: 'Springs', title: 'Every move is eased', body: 'The recede-to-back transition runs on a shared motion curve.' },
                  { tag: 'Control', title: 'Yours to drive', body: 'Click, tab to focus, or use the dots. It pauses while you do.' },
                ]}
              />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Holographic profile card"
              note="An identity card that tilts toward the cursor while an iridescent film sweeps across it, brightening as you move off-centre. The same card anchors the About page."
            >
              <ProfileCard
                name="Arseniy Cherednichenko"
                role="Builder - Co-founder of Guided. Web, native iOS, and applied AI."
                location="Berlin, Germany"
                initials="AC"
                status="Building"
                tags={['Frontend', 'Native iOS', 'Motion']}
              />
            </Experiment>
          </Reveal>

          <Reveal delay={0.05}>
            <Experiment
              name="Pixel dissolve"
              note="Hover and a grid of squares flashes on in a scattered order to cover the card, swaps the face underneath at the peak, then flashes back off. The same reveal sits on every Work poster."
            >
              <PixelTransition
                className="aspect-[4/3] w-full max-w-[260px] border border-white/10"
                gridSize={10}
                front={
                  <div className="flex h-full w-full flex-col justify-between rounded-2xl bg-white/[0.03] p-6">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Pixels</span>
                    <p className="font-display text-2xl font-bold leading-tight">Hover to dissolve</p>
                    <p className="text-sm text-white/50">A grid, not a fade.</p>
                  </div>
                }
                back={
                  <div className="flex h-full w-full flex-col justify-between rounded-2xl bg-gradient-to-br from-[#DCF87C] to-[#c2e85a] p-6 text-black">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">Revealed</span>
                    <p className="font-display text-2xl font-bold leading-tight">The other face</p>
                    <p className="text-sm font-medium text-black/70">Move away to flip it back.</p>
                  </div>
                }
              />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="3D flip card"
              note="A card that physically turns over — not a dissolve or a cross-fade, a real half-rotation with the far face hidden. Hover on a mouse, tap or press Enter on touch and keyboard. Reduced motion swaps the faces instantly instead."
            >
              <FlipCard
                className="w-full max-w-[260px]"
                label="Flip: a card that turns over"
                front={
                  <div className="flex min-h-[196px] w-full flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Front</span>
                    <p className="font-display text-2xl font-bold leading-tight">Turn me over</p>
                    <p className="text-sm text-white/50">Hover, tap, or press Enter.</p>
                  </div>
                }
                back={
                  <div className="flex h-full w-full flex-col justify-between rounded-3xl bg-gradient-to-br from-[#DCF87C] to-[#c2e85a] p-6 text-black">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">Back</span>
                    <p className="font-display text-2xl font-bold leading-tight">The other side.</p>
                    <p className="text-sm font-medium text-black/70">A real rotation, backface hidden.</p>
                  </div>
                }
              />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Scratch-off foil"
              note="Drag across the panel and a canvas foil erases under a soft round brush, uncovering the card beneath. A coarse grid tracks how much is cleared; past the threshold the foil fades on its own. Reduced motion skips the foil so the content is never gated behind it."
            >
              <ScratchReveal className="aspect-[4/3] w-full max-w-[260px] border border-white/10">
                <div className="flex h-full w-full flex-col justify-between rounded-3xl bg-gradient-to-br from-[#DCF87C] to-[#c2e85a] p-6 text-black">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">Uncovered</span>
                  <p className="font-display text-2xl font-bold leading-tight">You did the work.</p>
                  <p className="text-sm font-medium text-black/70">Nice scratch. Try again below.</p>
                </div>
              </ScratchReveal>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Compare slider"
              note="A before/after seam you drag to wipe between two states. The top layer is clipped to the divider; a spring eases the seam toward your pointer. Click anywhere on the frame, or focus the handle and use the arrow keys. Reduced motion drops the spring and the entrance sweep — the seam still drags."
            >
              <CompareSlider
                className="aspect-[4/3] w-full max-w-[280px]"
                beforeLabel="Flat"
                afterLabel="Lit"
                before={
                  <div className="flex h-full w-full flex-col justify-between bg-[#101014] p-6 text-white/70 grayscale">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Same card</span>
                    <p className="font-display text-2xl font-bold leading-tight">No finish yet.</p>
                    <p className="text-sm text-white/40">Flat, grey, waiting.</p>
                  </div>
                }
                after={
                  <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-[#DCF87C] to-[#b7e048] p-6 text-black shadow-[inset_0_0_60px_rgba(0,0,0,0.06)]">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">Same card</span>
                    <p className="font-display text-2xl font-bold leading-tight">With the finish.</p>
                    <p className="text-sm font-medium text-black/70">Colour, weight, glow.</p>
                  </div>
                }
              />
            </Experiment>
          </Reveal>

          <Reveal delay={0.05}>
            <Experiment
              name="Folder"
              note="A container that opens. Closed it is a slim folder with a tab; click and the pocket tips open while the papers lift out into a fanned hand of clickable links. The same folder holds the other facets on the About page. Reduced-motion drops to a plain grid."
            >
              <div className="flex min-h-[360px] w-full items-end justify-center pb-2">
                <Folder
                  label="Open me"
                  papers={[
                    { label: 'Résumé', hint: 'The one-pager', to: '/resume' },
                    { label: 'Writing', hint: 'Notes', to: '/writing' },
                    { label: 'Now', hint: 'What I am on', to: '/now' },
                    { label: 'Toolkit', hint: 'The bench', to: '/toolkit' },
                  ]}
                />
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Magnifying lens"
              note="A loupe that follows your pointer and magnifies the fine print in place. One radial mask over a copy of the surface scaled from the cursor — so whatever sits under the glass stays put as it grows, and the alignment holds at any zoom without measuring. The rim and inner light are pointer-events-none. Reduced motion drops the entrance and the springy rim; the loupe still works, since it is direct manipulation."
            >
              <Lens className="aspect-[4/3] w-full max-w-[280px] rounded-3xl border border-white/10 bg-[#0B0B0B]" zoom={2.1} size={150}>
                <div className="flex h-full w-full flex-col justify-between p-6">
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#DCF87C]">Loupe</span>
                    <span className="font-mono text-[9px] leading-none text-white/30">01 · 08 · 26</span>
                  </div>
                  <p className="font-display text-2xl font-bold leading-[1.05] text-white">
                    Made, not assembled.
                  </p>
                  <p className="max-w-[34ch] font-mono text-[8px] leading-[1.5] text-white/45">
                    Every surface on this site is a hand-built React and Framer Motion
                    component — no template, no UI kit, nothing pulled from a shelf. Bring
                    the glass close and the small print holds its edge.
                  </p>
                </div>
              </Lens>
            </Experiment>
          </Reveal>
        </div>

        {/* FULL-WIDTH BENTO GRID */}
        <Reveal>
          <div className="mt-12">
            <BentoGrid>
              <BentoCell className="col-span-2 sm:col-span-2 sm:row-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Bento</p>
                <p className="mt-auto font-display text-3xl font-bold leading-tight sm:text-4xl">
                  Asymmetric, alive.
                </p>
              </BentoCell>
              <BentoCell className="col-span-1 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Spotlight</p>
                <p className="mt-auto text-sm leading-snug text-white/70">A lime glow tracks your cursor per cell.</p>
              </BentoCell>
              <BentoCell className="col-span-1 sm:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Lift</p>
                <p className="mt-auto text-sm leading-snug text-white/70">Cells rise on hover.</p>
              </BentoCell>
              <BentoCell className="col-span-2 sm:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Stagger</p>
                <p className="mt-auto text-sm leading-snug text-white/70">Reveals in sequence on view.</p>
              </BentoCell>
            </BentoGrid>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Bento grid</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A dense, asymmetric card layout that staggers in on scroll, with a per-cell cursor spotlight and a
                subtle hover lift. Drives the About page snapshot. Reduced-motion aware.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH LIQUID GLASS */}
        <Reveal>
          <div className="mt-12">
            <div className="relative flex min-h-[22rem] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] p-6">
              {/* A vivid, moving backdrop so the refraction is unmistakable —
                  the glass bends these fields and the type as it passes over. */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <motion.div
                  className="absolute -left-10 top-2 h-56 w-56 rounded-full bg-[#DCF87C]/30 blur-3xl"
                  animate={{ x: [0, 60, 0], y: [0, 24, 0] }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl"
                  animate={{ x: [0, -50, 0], y: [0, -20, 0] }}
                  transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="font-display text-6xl font-bold tracking-tight text-white/[0.08] sm:text-8xl">
                    REFRACTION
                  </p>
                </div>
              </div>

              <GlassSurface radius={26} displace={16} className="w-full max-w-sm p-7">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Glass</span>
                <p className="mt-2 font-display text-3xl font-bold leading-tight text-white">Poured, not blurred</p>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  A displacement map warps everything behind the pane, so the fields and the type bend as if seen
                  through real glass. Move the window; it refracts what it passes over.
                </p>
              </GlassSurface>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Liquid glass</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A refractive pane — an feTurbulence noise field drives an feDisplacementMap wired into the element's
                backdrop-filter, bending the content behind it, then frosting and tinting it with a specular edge and a
                slow sheen. Anchors the live status chip in the Home hero. Degrades to premium frost where refraction is
                unsupported; reduced-motion stills the sheen.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH CHROMA GRID */}
        <Reveal>
          <div className="mt-12">
            <ChromaGrid
              items={[
                { tag: 'Craft', title: 'Motion, hand-built', subtitle: 'Every effect on this site is its own component.', to: '/playground' },
                { tag: 'Work', title: 'What I have shipped', subtitle: 'Guided, this site, and what comes next.', to: '/work' },
                { tag: 'Person', title: 'A bit about me', subtitle: 'Berlin, student, co-founder.', to: '/about' },
                { tag: 'Tools', title: 'The bench', subtitle: 'What I reach for, and why.', to: '/toolkit' },
                { tag: 'Notes', title: 'Thinking in the open', subtitle: 'Drafts and outlines, honestly marked.', to: '/writing' },
                { tag: 'Reach', title: 'Say hello', subtitle: 'The inbox is open.', to: '/contact' },
              ]}
            />
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Chroma grid</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A torch in the dark. The grid is drawn twice — a lit layer of real links beneath a drained copy on top —
                and the cursor punches a spotlight hole in the dim layer, so the cards it sweeps over warm up and light.
                Two CSS variables carry the pointer; no per-frame React state. Reduced motion leaves it fully lit and still.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH MASONRY WALL */}
        <Reveal>
          <div className="mt-12">
            <MasonryDemo />
            <div className="mt-6 px-1">
              <h3 className="text-base font-semibold">Masonry wall</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A real masonry layout, not a fixed grid. A single ResizeObserver measures the container and every tile,
                and each one is absolutely positioned into the currently-shortest column from its own height — so content
                of any height packs tight with no gaps. Change the width or shuffle and the whole wall reflows on a spring
                rather than snapping. No per-frame React state; reduced motion places the same layout instantly.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH ANIMATED BEAM NODE WEB */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-4 py-10 sm:px-12">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Wire</span>
              <p className="mt-3 max-w-md text-xl font-medium text-white/85 sm:text-2xl">
                Light travelling a line drawn between two things.
              </p>
              <div className="mt-6">
                <BeamDemo />
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Animated beam</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A beam of light that travels a curved line drawn between two real DOM nodes — the connective cousin of
                BorderBeam. The path geometry is measured off the nodes with getBoundingClientRect and re-measured on
                resize, so the wiring holds at any width; the travelling light is a single SVG gradient whose endpoints
                sweep across, so no per-frame React state runs. Wires the About &ldquo;How it fits together&rdquo; hub.
                Reduced motion holds every beam as a faint resting line.
              </p>
            </div>
          </div>
        </Reveal>
      </Category>

      {/* 03 — POINTER FIELDS */}
      <Category {...CATEGORIES[2]}>
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
          <Reveal>
            <Experiment
              name="Custom cursor"
              note="On a pointer device with motion enabled, a lime dot tracks you site-wide and the trailing ring swells over anything you can click."
            >
              <div
                data-cursor
                className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 px-6 text-center"
              >
                <p className="text-2xl font-bold leading-tight">Hover in here</p>
                <p className="text-sm text-white/50">Watch the ring open up as it meets a target.</p>
              </div>
            </Experiment>
          </Reveal>

          <Reveal delay={0.1}>
            <Experiment
              name="Click spark"
              note="Every press anywhere on the site flings a small lime burst from the pointer. Canvas-drawn, and it sleeps when idle."
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <button
                  type="button"
                  className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold transition-colors hover:border-[#DCF87C]/40 hover:text-[#DCF87C]"
                >
                  Click me
                </button>
                <p className="text-xs text-white/40">Or click anywhere at all.</p>
              </div>
            </Experiment>
          </Reveal>
        </div>

        {/* FULL-WIDTH INTERACTIVE FIELD */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <DotGrid />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Interactive field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Move your cursor across the grid.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor-reactive dot grid</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A few hundred dots on a single canvas, each a tiny spring pushed by the pointer and pulled home. Lights up
                lime within reach.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH PARTICLES */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
              <Particles />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Constellation field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Gather the web toward your cursor.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Drifting constellation</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A cloud of points floats on a slow wrapping drift, joined by a line whenever two pass close, so the field
                reads as a shifting web. The cursor is a soft attractor: points within reach lean toward it and warm from
                white to lime, and the links they share warm with them, dragging a brighter knot along behind the pointer.
                All on one canvas, no per-point React state. Reduced-motion gets a single calm static web.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH MAGNET LINES */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <MagnetLines />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Needle field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Every line turns to face the cursor.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor-tracking needle grid</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A canvas grid of small lines, each easing its angle toward the pointer and brightening lime within reach.
                Reduced-motion gets a calm static radial instead.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH FLOW FIELD */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#09090b]">
              <FlowField />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Flow field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Move through the current, and it curls around you.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor-swirled vector field</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A few hundred motes stream through a smooth vector field whose angle is a cheap wrap of sines of position
                and time, each leaving a fading trail so the canvas reads as moving current. Within reach of the pointer the
                flow bends toward the tangent and curls into a lime eddy that the cursor drags along. One canvas, one loop,
                no noise library. Reduced motion traces static streamlines through the frozen field instead.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH SQUARES */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="absolute inset-0 [mask-image:radial-gradient(120%_120%_at_50%_50%,#000_45%,transparent_92%)]">
                <Squares />
              </div>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Lattice field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  A scan drifts through, cells bloom under your cursor.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor-reactive lattice</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A grid of square cells on one canvas. A soft band of light drifts along the diagonal forever, and the cells
                under the pointer warm lime and lift their stroke while a faint bloom fills the nearest ones. Backs the Index
                page. Reduced-motion gets a single calm lattice, no scan.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH CROSSHAIR */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#09090b]">
              <Crosshair />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Precision reticle</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Two hairlines find your cursor, and read out where it is.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Section-scoped crosshair</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Not the site cursor and not a canvas — a DOM overlay of two spring-eased guide-lines that span the surface,
                meet at a lit node, and carry live X/Y readouts along a calibrated tick scale, written straight to the DOM off
                the springs so a moving cursor never re-renders. It is decorative and never intercepts a click. Reduced-motion
                and touch get a single still, centred crosshair.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH THREADS */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <Threads count={18} amplitude={16} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Thread field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  The lines bend around your cursor.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor-reactive thread field</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Travelling sine waves on a single canvas; the threads nearest the pointer bulge away and warm lime.
                Backs the 404 page. Reduced-motion gets a calm static set of waves.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH BEAMS */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
              <Beams />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Light field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Shafts of light lean toward your cursor.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Tilted light-shaft field</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Soft vertical gradients drawn with additive blending on one tilted canvas, so overlaps glow like light
                through blinds. The beams sway, and the ones nearest the pointer brighten and warm lime. Backs the
                Toolkit page. Reduced-motion gets a single calm static frame.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH METEORS */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#08080b]">
              <Meteors count={28} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Meteor field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Pass your cursor through, and the streaks near it warm and stretch.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Diagonal meteor shower</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A steady rain of light streaks on one canvas — the gentle, directional kind the field family did not have
                (not Starfield's radial warp, Lightning's filaments, or Beams' shafts). Each streak crosses along one
                angle with a bright head and a tail that fades out, its brightness enveloped over the run so a recycle
                never pops, most cool white with a lime minority; any streak whose head passes near the pointer warms
                toward lime and lengthens. Seeded so the scatter is stable, no per-streak React state. Backs the reel's
                'On pace' scene. Reduced-motion lays a few faint streaks still.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH BLOB CURSOR */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] cursor-none overflow-hidden rounded-3xl border border-white/10 bg-[#08080a]">
              <BlobCursor count={5} size={72} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Gooey cursor</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Move across the panel — the blob chases you, and pressing swells it.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Gooey blob cursor</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A short chain of solid circles trails the pointer — the lead eases toward the cursor and each follower
                toward the one ahead — all welded under an SVG gooey filter (a Gaussian blur crushed by an alpha-ramp
                matrix), so they fuse into one liquid mass with a stretching tail rather than reading as separate dots.
                The soft, physical kind of pointer response the field family did not have (not MetaBalls' free drift,
                Ribbons' thin streaks, or Crosshair's precise reticle); pressing swells the whole chain and the release
                ripples down the tail. One RAF loop writes the transforms, no per-blob React state. Reduced motion rests
                a single still blob at the centre.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH LETTER GLITCH */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-black/40">
              <LetterGlitch />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(8,8,8,0.92)_85%)]" />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Glyph field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/85 sm:text-2xl">
                  Characters flicker and recolor in place.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Letter glitch field</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A monospace grid drawn on one canvas. Every frame a slice of random cells swap glyph and ease toward a new
                color, mostly cool grays with the odd cell warming lime, like a terminal mid-decode. A radial mask fades
                the edges. Reduced-motion gets a single calm static frame.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH META BALLS */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[380px] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b]">
              <div className="absolute inset-0 [mask-image:radial-gradient(120%_120%_at_50%_50%,#000_55%,transparent_100%)]">
                <MetaBalls />
              </div>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-black/70 mix-blend-hard-light">
                  Liquid field
                </span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/70 sm:text-2xl">
                  Move across the blobs and watch them merge.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Gooey metaballs</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Lime blobs drift on their own paths inside an SVG gooey filter, so where two meet they fuse with a
                stretching liquid neck instead of overlapping as flat discs. A cursor blob eases toward the pointer and
                gathers the drifters as it passes. Attributes are written straight from requestAnimationFrame, no
                per-blob React state. Reduced motion gets a single calm static arrangement.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH PIXEL TRAIL */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
              <PixelTrail gap={22} radius={48} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Pixel field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Sweep across the grid and leave a trail.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor pixel trail</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A grid of squares on one canvas, each holding a heat value. The pointer paints heat along its path,
                interpolated between frames so a fast sweep leaves no gaps, and every cell cools a little each frame, so
                the field glows lime in your wake and fades behind you. Backs the Writing page title. Reduced-motion gets
                a single calm static grid.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH RIBBONS */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
              <Ribbons count={5} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Ribbon field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Move, and the ribbons whip after you.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor-chasing ribbons</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A few tapered trails, each a chain of points whose head eases toward the cursor while the body lags
                behind, so every ribbon whips and settles like ink in water. Left alone they drift on their own paths.
                Widest and brightest at the head, fading to nothing at the tail. Backs the Now page title.
                Reduced-motion gets a calm static set of arcs.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH LIGHTNING */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#070707]">
              <Lightning count={6} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Filament field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Draw near and the current reaches for you.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Cursor-reactive lightning</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A few electric filaments, each a jagged polyline that wriggles between two drifting anchors while a bright
                charge rides its length. The wriggle is summed seeded sines, never per-frame randomness, so it flickers
                like live current instead of strobing. Come close and each bolt stretches its far end toward the pointer
                and brightens. Backs the Colophon page title. Reduced-motion gets a still set of dim bolts.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH IRIDESCENCE */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#070707]">
              <Iridescence />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Iridescent field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Trail the cursor and a ripple spreads out from it.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Breathing iridescent sheen</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A handful of drifting sine waves summed into a scalar at every pixel of a small offscreen buffer, read
                through the site's own navy-to-lime ramp, then blown up smoothly to fill the panel — so the whole sheen
                costs a few thousand pixels a frame, not a few million. The pointer adds a travelling ripple that warms
                the field toward lime as it passes. Reduced-motion holds a single calm frame.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH STARFIELD */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-[#050505]">
              <Starfield count={260} speed={1.1} listen="self" />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Warp field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Point, and the whole field banks your way.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Pointer-steered warp starfield</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Points stream out of a vanishing point and toward you, each drawn as a short streak so the field reads as
                travel through space rather than a twinkle — nearer stars fan out faster and warm toward lime. The
                vanishing point eases after the cursor, so the whole field banks the way you point. One RAF loop over a
                simple frustum, no per-star React state. Reduced-motion paints a still star lattice with no streaks.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH GLOBE */}
        <Reveal>
          <div className="mt-12">
            <div className="relative flex h-[420px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#060606]">
              <div className="h-[360px] w-[360px] max-w-full">
                <Globe
                  markers={[
                    { lat: 52.52, lon: 13.405, label: 'Berlin' },
                    { lat: 40.7128, lon: -74.006, label: 'New York' },
                    { lat: 35.6762, lon: 139.6503, label: 'Tokyo' },
                  ]}
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Real coordinates</span>
                <p className="mt-2 max-w-md px-6 text-lg font-medium text-white/70">
                  Grab it and spin. Berlin is where I am.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Draggable dotted globe</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A Fibonacci lattice of dots rotated in 3D on a plain 2D canvas — near-face dots bright, the far face a
                faint glass haze, no WebGL and no map texture. Cities sit at their true latitude and longitude as lime
                pins that pulse and label themselves, then fade as they turn to the back. It drifts on its own and a
                flick carries an inertial spin. Backs the About snapshot. Reduced-motion holds a still frame, Berlin
                facing front.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH GRID MOTION — a wall of the range, tilting to the cursor */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
              <GridMotion
                className="h-full w-full"
                rows={5}
                accent={['Frontend', 'Native iOS', 'Backend', 'Applied AI', 'Motion']}
                items={[
                  'Frontend',
                  'Native iOS',
                  'Backend',
                  'Applied AI',
                  'Motion',
                  'React',
                  'TypeScript',
                  'SwiftUI',
                  'Supabase',
                  'Tailwind',
                  'Framer Motion',
                  'Typography',
                  'Accessibility',
                  'Detail',
                  'Vite',
                  'Berlin',
                ]}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Range field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  Lean over it, and the whole wall tilts your way.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Tilting wall of tiles</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Five rows of tiles drift sideways at their own pace and in alternating directions — the seamless
                duplicate-and-slide loop stacked into a field — while the whole slab tilts in 3D toward the cursor like a
                panel you are leaning over. Fed the disciplines and tools I work across rather than one message, so it
                reads as range: no single tile carries the story. Reduced motion holds it still and square, every tile
                there and legible.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH GRAIN — the site's own film grain, turned up to show */}
        <Reveal>
          <div className="mt-12">
            <div className="relative flex h-[340px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141414] via-[#0c0c0c] to-[#161616]">
              {/* A pooled lime glow beneath the grain so the specks read against
                  a mid-tone the way film emulsion does — soft-light needs a
                  surface to bite into. */}
              <div className="pointer-events-none absolute -inset-24 bg-[radial-gradient(ellipse_at_50%_40%,rgba(220,248,124,0.12),transparent_60%)]" />
              <Grain opacity={0.5} fps={20} blend="overlay" className="rounded-3xl" />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Film grain</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                  The same texture is over this whole site — turned up here.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Editorial film grain</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A small tile of random grayscale bytes is reshuffled a few times a second and repeated across the surface
                as a canvas pattern — so a full-screen grain costs one tiny noise buffer per refresh, not a per-pixel
                repaint. It composites under content through a blend mode, so mid-gray reads as neutral while brighter
                specks lift and darker ones sink: the classic filmic texture, not a flat wash. Held at a whisper site-wide;
                cranked up on this panel so you can see it move. Reduced motion holds a single still frame.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH MESH GRADIENT — a warm colour wash you steer with the cursor */}
        <Reveal>
          <div className="mt-12">
            <MeshGradient className="h-[420px] rounded-3xl border border-white/10">
              <div className="pointer-events-none flex h-[420px] flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Colour field</span>
                <p className="mt-3 max-w-md px-6 text-xl font-medium text-white sm:text-2xl">
                  Move across it — the colour gathers toward your cursor.
                </p>
              </div>
            </MeshGradient>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Flowing colour mesh</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Five large, heavily-blurred radial blobs — lime, emerald, sky, violet — sit at fixed anchors and each
                wanders on its own slow idle loop, so the field is never still. On top of that the whole mesh leans toward
                the pointer, every blob parallaxing by its own depth so the colour seems to pool under the cursor and warm
                as it nears. Pure layered gradients moved by transforms, no canvas. Backs the About manifesto; reduced
                motion holds a balanced, still mesh with the lean off.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH KALEIDOSCOPE — the pointer's path folded into a mandala */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[440px] overflow-hidden rounded-3xl border border-white/10 bg-[#09090b]">
              <Kaleidoscope />
              <div className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Draw</span>
                <p className="mx-auto mt-3 max-w-md px-6 text-lg font-medium text-white/90 sm:text-xl">
                  Move across it. Whatever you trace blooms into a mandala.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Kaleidoscope</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A pointer field of a different kind from all the others here. The rest react locally — dots spring,
                needles turn, threads bulge, ribbons chase; this one takes the path your pointer traces and reflects it
                into six-fold rotational and mirror symmetry, then lets the strokes accumulate into a slowly-fading
                figure. A translucent fill of the background decays the whole surface every frame — that is the trail —
                while the fresh strokes composite additively, so crossings build into light. Move slowly to draw
                deliberate petals; sweep fast to fling bright arms to the rim. Leave it be and a gentle lissajous keeps
                the figure blooming on its own. One canvas, one animation loop, no per-point state on the hot path.
                Reduced motion lays down a single still, seeded mandala.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH CONTOUR — a topographic map that rises under the pointer */}
        <Reveal>
          <div className="mt-12">
            <div className="relative h-[440px] overflow-hidden rounded-3xl border border-white/10 bg-[#09090b]">
              <Contour />
              <div className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Survey</span>
                <p className="mx-auto mt-3 max-w-md px-6 text-lg font-medium text-white/90 sm:text-xl">
                  Move over the land. It rises into a peak wherever you rest.
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Contour</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A different pointer field again: not a swarm that reacts locally but a whole terrain. A smooth elevation
                field of soft hills, drifting on their own slow paths, is resampled onto a grid every frame and traced
                into iso-lines with marching squares — the exact contour a real map uses to draw elevation. Where two
                hills meet the rings merge like the saddle between peaks; the higher a ring sits, the more it warms from
                cool white to lime. The pointer is a hill of its own, easing under the cursor and swelling while it hovers,
                so a bright lime bullseye rises and the surrounding land bends around it. One canvas, one loop, no
                per-line state. Reduced motion contours the frozen field once into a calm, still relief.
              </p>
            </div>
          </div>
        </Reveal>
      </Category>

      {/* 04 — SCROLL-DRIVEN */}
      <Category {...CATEGORIES[3]}>
        {/* FULL-WIDTH SCROLL-VELOCITY BAND */}
        <Reveal>
          <div>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] py-12">
              <ScrollVelocity
                rows={[
                  { text: 'Scroll to feel it · ', baseVelocity: 4, className: 'text-white/85' },
                  {
                    text: 'Faster scroll, faster drift · ',
                    baseVelocity: -4,
                    className: 'text-transparent [-webkit-text-stroke:1px_rgba(220,248,124,0.5)]',
                  },
                ]}
                className="space-y-1 text-5xl font-bold uppercase leading-none tracking-tight sm:text-7xl"
              />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0c0c0c] to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0c0c0c] to-transparent" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Scroll-velocity text band</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Two rows drift on their own, then speed up and flip direction with the page's scroll velocity. Built on
                Framer Motion's useVelocity and a wrapped offset.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH SCROLL REVEAL */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-20 sm:px-14 sm:py-28">
              <ScrollReveal
                className="text-2xl font-semibold leading-[1.3] tracking-tight text-white/85 sm:text-4xl sm:leading-[1.25]"
                highlight={['word', 'scroll', 'reads', 'itself']}
              >
                Scroll slowly and watch each word resolve. The paragraph reads
                itself into focus as it travels up the page, one word at a time,
                tied directly to your scroll.
              </ScrollReveal>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Scroll-linked text reveal</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Each word's opacity and lift map to a slice of the block's scroll progress, built on Framer Motion's
                useScroll and useTransform. The full sentence stays the accessible label.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH SCROLL STACK */}
        <Reveal>
          <div className="mt-12">
            <ScrollStack
              cards={[
                { tag: 'Pin', title: 'Each card sticks in turn', body: 'As you scroll, a card pins to the top of the viewport and waits for the next one to arrive.' },
                { tag: 'Stack', title: 'The next slides up and lands', body: 'New cards travel up and settle on top, building a deck the further you scroll.' },
                { tag: 'Recede', title: 'The ones beneath scale back', body: 'Covered cards shrink and dim a touch, so the growing stack reads as real depth.' },
              ]}
            />
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Scroll-stacking cards</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Scroll-driven sticky cards that pin, stack, and recede as the section moves. Built on position sticky and
                a section-level scroll progress. Drives the Home process section. Reduced-motion gets a plain list.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH TIMELINE */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-8 py-12 sm:px-12">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Draw</span>
              <p className="mt-3 max-w-md text-xl font-medium text-white/85 sm:text-2xl">
                Scroll through it. The spine fills and the nodes catch.
              </p>
              <Timeline items={TIMELINE_STEPS} className="mt-10" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Scroll-linked timeline</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A vertical timeline whose lime spine draws itself down as the list scrolls through the viewport, a glowing
                head riding the tip, each node warming from grey to lime as the line reaches it. A spring eases the
                progress so it never snaps. Drives the About page Path. Reduced-motion renders it fully drawn and static.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH HORIZONTAL SCROLL */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-8 py-10 sm:px-12">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Sideways</span>
              <p className="mt-3 max-w-md text-xl font-medium text-white/85 sm:text-2xl">
                Keep scrolling down. The panels move across.
              </p>
            </div>
            <HorizontalScroll panels={HSCROLL_PANELS} className="mt-6" />
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Pinned horizontal scroll</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                The section pins to the viewport and maps vertical scroll to horizontal travel, so a row of panels glides
                past as you scroll down. Travel is measured from the real track width, and a spring smooths it. Drives the
                Home Range section. Reduced-motion gets a plain native scroller with snap points.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH SCROLL SCENE */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-8 py-10 sm:px-12">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Scrollytelling</span>
              <p className="mt-3 max-w-md text-xl font-medium text-white/85 sm:text-2xl">
                Keep scrolling. The stage stays; the story moves through it.
              </p>
              <ScrollScene scenes={SCROLLSCENE_STEPS} className="mt-8" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Sticky scroll scene</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A visual stage pins to the viewport while a column of steps scrolls past; the stage cross-fades to whichever
                step crosses the mid-line. Active tracking is a rAF-throttled measure of the step rects, no per-step
                listeners. Drives the Colophon anatomy section. Reduced-motion shows the stage composed and a plain list.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH SELF-DRAWING LINE ART */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-14 sm:px-12">
              <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4">
                <div className="flex flex-col items-center gap-4">
                  <DrawSVG
                    viewBox="0 0 320 34"
                    className="h-8 w-full max-w-[180px] text-[#DCF87C]"
                    strokeWidth={4}
                    duration={0.9}
                    stagger={0.22}
                    trigger="loop"
                    paths={[
                      'M8 20 C 78 8, 168 6, 236 14 C 274 18, 300 17, 314 9',
                      { d: 'M18 27 C 96 21, 214 22, 292 27', strokeWidth: 2.5 },
                    ]}
                  />
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40">Underline swash</span>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <DrawSVG
                    viewBox="0 0 80 80"
                    className="h-20 w-20 text-[#DCF87C]"
                    strokeWidth={4}
                    duration={1.3}
                    trigger="loop"
                    paths={[
                      'M40 8 A 32 32 0 1 1 39.9 8',
                      { d: 'M40 40 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0', fill: '#DCF87C', strokeWidth: 0, delay: 0.2 },
                    ]}
                  />
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40">Orbit mark</span>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <DrawSVG
                    viewBox="0 0 84 64"
                    className="h-20 w-24 text-[#DCF87C]"
                    strokeWidth={5}
                    duration={0.7}
                    trigger="loop"
                    paths={['M10 34 L 32 54 L 74 12']}
                  />
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40">Check</span>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <DrawSVG
                    viewBox="0 0 80 72"
                    className="h-20 w-20 text-white"
                    strokeWidth={5}
                    duration={0.6}
                    stagger={0.3}
                    trigger="loop"
                    paths={['M14 64 L 40 8 L 66 64', { d: 'M24 46 L 56 46', stroke: '#DCF87C' }]}
                  />
                  <span className="text-xs uppercase tracking-[0.2em] text-white/40">Monogram</span>
                </div>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Self-drawing line art</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Each mark traces itself one stroke at a time by animating the real path length (Framer's pathLength 0 to 1),
                not by scaling a bar — so any hand-authored curve appears as if drawn by a pen, rounded caps and all. These
                loop to show the trace; in the wild it fires once on scroll-in and re-traces on hover. Drives the swash
                under the About page title. Reduced motion paints every stroke finished from the first frame.
              </p>
            </div>
          </div>
        </Reveal>
      </Category>

      {/* 05 — NAVIGATION & CONTROLS */}
      <Category {...CATEGORIES[4]}>
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
          <Reveal>
            <Experiment name="Magnetic button" note="The target drifts toward your cursor, then springs back on exit.">
              <MagneticButton href="#" className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black">
                Pull me
              </MagneticButton>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Keyboard navigation"
              note="The whole site is keyboard-driven. Tap g then a page key to jump around, or open the full shortcuts panel with ?."
            >
              <div className="flex w-full flex-col items-center gap-5">
                <div className="flex items-center gap-2 font-mono text-sm text-white/55">
                  <kbd className="inline-flex min-w-[1.8rem] items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-2 py-1.5 text-[#DCF87C]">
                    g
                  </kbd>
                  <span className="text-white/30">then</span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {GO_TARGETS.map((t) => (
                      <kbd
                        key={t.key}
                        title={t.label}
                        className="inline-flex min-w-[1.8rem] items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-2 py-1.5 text-white/55"
                      >
                        {t.key}
                      </kbd>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openShortcuts}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[#DCF87C]/40 hover:text-[#DCF87C]"
                >
                  Open shortcuts
                  <kbd className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[11px] text-white/50">
                    ?
                  </kbd>
                </button>
              </div>
            </Experiment>
          </Reveal>

          <Reveal delay={0.05}>
            <Experiment
              name="Animated list"
              note="A navigation list with life: rows stagger in on scroll and a lime highlight springs to whichever row you hover or move focus to. They stay real, individually-focusable links — arrow keys and Home/End move between them. Drives the Home 'In the open' build-log list. Reduced motion drops the stagger and the glide."
            >
              <AnimatedList
                className="w-full max-w-[300px]"
                items={[
                  { id: 'l-work', to: '/work', content: <span className="font-medium">Work</span>, meta: <span className="text-xs text-white/35">Case studies</span> },
                  { id: 'l-play', to: '/playground', content: <span className="font-medium">Playground</span>, meta: <span className="text-xs text-white/35">Live motion</span> },
                  { id: 'l-about', to: '/about', content: <span className="font-medium">About</span>, meta: <span className="text-xs text-white/35">Who I am</span> },
                  { id: 'l-tools', to: '/toolkit', content: <span className="font-medium">Toolkit</span>, meta: <span className="text-xs text-white/35">The bench</span> },
                ]}
              />
            </Experiment>
          </Reveal>

          <Reveal delay={0.05}>
            <Experiment name="Stateful micro-interactions" note="Small, satisfying feedback loops: an optimistic like and a spring toggle.">
              <div className="flex flex-col items-center gap-6">
                <button
                  onClick={() => setLikes((n) => n + 1)}
                  className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[#DCF87C]/40 hover:text-[#DCF87C]"
                >
                  <span className="transition-transform group-active:scale-125">Like</span>
                  <span className="tabular-nums text-white/60">{likes}</span>
                </button>
                <Switch checked={on} onChange={setOn} label="Notifications" size={34} />
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Elastic slider"
              note="Drag the thumb, or click anywhere on the track. Push past either end and the whole bar stretches against the pull, then springs back the moment you let go — the give an iOS volume slider has at its limits. Fully keyboard-driven, and reduced motion drops the stretch for a plain slider."
            >
              <div className="w-full max-w-[320px]">
                <ElasticSlider
                  label="Volume"
                  value={volume}
                  onChange={setVolume}
                  format={(v) => `${Math.round(v)}%`}
                  leading={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M11 5 6 9H2v6h4l5 4z" />
                    </svg>
                  }
                  trailing={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M11 5 6 9H2v6h4l5 4z" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                    </svg>
                  }
                />
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Rotary knob"
              note="A dial you turn like hardware: drag up or down to sweep the pointer around a 270° arc, spin the wheel for fine steps, or focus it and use the arrows. The pointer rides a spring so it settles with a little give. A real role=slider, keyboard-driven, and calm under reduced motion. Drives the spring tuner on the Design page."
            >
              <KnobDemo />
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="Toggle switch"
              note="The binary control the sliders and dial were missing. The thumb rides a spring across the track instead of snapping, squashing and stretching into the travel so a flick lands with weight; the rail crossfades to lime and a dash morphs into a check as it crosses. A real role=switch — click or Space/Enter, controlled, disable-able. Reduced motion drops the physics for a near-instant, plain toggle."
            >
              <div className="flex w-full max-w-[280px] flex-col gap-5">
                <Switch checked={wifi} onChange={setWifi} label="Wi-Fi" size={34} />
                <Switch checked={reduce} onChange={setReduce} label="Reduce motion" size={34} />
                <Switch defaultChecked label="Locked on" size={34} disabled />
              </div>
            </Experiment>
          </Reveal>

          <Reveal>
            <Experiment
              name="One-time-code field"
              note="The segmented passcode box the entry family was missing. Type and focus hands itself forward; Backspace clears and steps back; paste a whole code and it scatters across the empty cells. Each digit springs in, the focused cell blinks a lime caret while empty, and a full code lifts the row in a lime-lit stagger — then flips to a verified chip. A real per-cell input, arrow/Home/End navigable and autofill-ready. Reduced motion drops the pop and the blink."
            >
              <CodeInputDemo />
            </Experiment>
          </Reveal>
        </div>

        {/* FULL-WIDTH DYNAMIC ISLAND */}
        <Reveal>
          <div className="mt-12">
            <div className="flex flex-col items-center gap-8 rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-14 sm:px-10">
              <DynamicIsland activity={island} onActivityChange={setIsland} />
              <div className="flex flex-wrap items-center justify-center gap-2">
                {(['idle', 'music', 'timer', 'call'] as IslandActivity[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setIsland(a)}
                    aria-pressed={island === a}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                      island === a
                        ? 'bg-[#DCF87C] text-black'
                        : 'bg-white/[0.06] text-white/60 hover:bg-white/10 hover:text-white/85'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Dynamic island</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A pill that changes its own shape to fit what it carries, in the spirit of Apple's Dynamic Island. Pick a
                state and the frame springs to a new width, height, and radius while the contents crossfade in — a
                resting notch, a now-playing bar with a live waveform, a countdown draining a lime ring, or an incoming
                call with real accept and decline buttons. The size change is the animation, not a decoration on one:
                one spring drives the frame, the inner faces blur-and-rise across each other, and a role=status label
                narrates the current activity. Reduced motion keeps the shape change but stills every loop.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH FLOWING MENU */}
        <Reveal>
          <div className="mt-12">
            <FlowingMenu
              items={[
                { label: 'Slide', hint: 'From the top', href: 'https://reactbits.dev' },
                { label: 'Marquee', hint: 'Label scrolls', href: 'https://reactbits.dev' },
                { label: 'Edge-aware', hint: 'Follows the cursor', href: 'https://reactbits.dev' },
              ]}
            />
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Flowing menu</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                Editorial link rows: hover one and a lime panel slides in from whichever edge the cursor crossed, the
                label scrolling across it, then leaves the same way out. Drives the Home Explore section. Reduced-motion
                just warms the row.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH COVERFLOW */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-10 sm:px-10">
              <CircularGallery items={COVERFLOW_CARDS} />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Coverflow gallery</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A draggable 3D coverflow. Cards fan out in perspective around an upright active card; drag, wheel, arrow
                keys, the arrows, the dots, or a click on a side card all drive it, and it snaps to the nearest on
                release. Drives the Home Playground section. Reduced-motion becomes a plain snap-scroll row.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH ACCORDION */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-6 sm:px-10 sm:py-8">
              <Accordion
                defaultOpen={0}
                items={[
                  {
                    q: 'What is a disclosure?',
                    a: 'A row that expands to reveal its answer. One opens at a time here — the body springs down on a height and opacity transition.',
                  },
                  {
                    q: 'How does the icon work?',
                    a: 'Two short bars make a plus; the vertical one rotates flat to a minus when the row opens, and the whole mark warms to lime.',
                  },
                  {
                    q: 'Is it accessible?',
                    a: 'Each control carries aria-expanded and points at its panel, the panel is a labelled region, and under reduced motion it toggles instantly with no height animation.',
                  },
                ]}
              />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Animated accordion</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                An accessible disclosure list: one row open at a time, the body easing down on a height and opacity
                transition while a lime plus rotates into a minus. Drives the About page Questions section. Reduced-motion
                toggles instantly.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH DOCK */}
        <Reveal>
          <div className="mt-12">
            <div className="relative flex h-[340px] items-end justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 pb-12">
              <div className="pointer-events-none absolute inset-x-0 top-10 text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Magnify</span>
                <p className="mx-auto mt-3 max-w-md px-6 text-xl font-medium text-white/85 sm:text-2xl">
                  Sweep the row. Each tile leans toward the cursor.
                </p>
              </div>
              <Dock items={DOCK_ITEMS} />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Magnifying dock</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A working nav in the spirit of the macOS Dock: one shared pointer value feeds every tile, which swells
                along a bell curve by its distance from the cursor and springs back as you leave, with a label rising on
                hover. The tiles are real links, so it actually gets you around. Reduced-motion drops the magnify for a
                plain, fully usable row.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH GOOEY TABS */}
        <Reveal>
          <div className="mt-12">
            <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-14">
              <GooeyTabsDemo />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Liquid gooey tabs</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                The active indicator is two lime blobs inside an SVG gooey filter, timed by two different springs so the
                trailing blob stretches out of the old tab and drips into the new one before they merge. Labels sit above
                the filter so text stays sharp. Reduced motion swaps it for a single instant pill.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH STEPPER */}
        <Reveal>
          <div className="mt-12">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-12 sm:px-10">
              <Stepper steps={STEPPER_DEMO} className="mx-auto max-w-2xl" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Guided stepper</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A step-through with more ways in than most: the numbered rail is clickable, the Back and Next buttons
                move one at a time, arrow keys walk it when the rail is focused, and you can drag or swipe the panel
                itself. The lime connector sweeps up to the active node, and each panel slides in from the direction of
                travel. Reduced motion cross-fades in place with no drift. It drives the real build pipeline on the
                colophon.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH GRAVITY */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30">
              <div className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Toss</span>
                <p className="mx-auto mt-3 max-w-md px-6 text-lg font-medium text-white/85 sm:text-xl">
                  Grab a tag and fling it. They fall, pile, and bounce off each other.
                </p>
              </div>
              <Gravity items={SKILLS} accent={['TypeScript', 'React', 'Framer Motion']} className="h-[440px] w-full" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Gravity tags</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A different paradigm from the rest of this page: nothing else here simulates mass or contact. Each tool I
                actually use is a physical body dropped into a bin, integrated frame by frame under gravity, with wall and
                pairwise collisions resolved along the axis of least penetration. Grab one and it carries the momentum of
                your throw. All hand-rolled, no physics library. Reduced motion lays the same tags out as a calm static
                wrap.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH SPHERE MENU */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-12">
              <div className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Spin</span>
                <p className="mx-auto mt-3 max-w-md px-6 text-lg font-medium text-white/85 sm:text-xl">
                  The whole site, orbiting. Grab it and give it a spin.
                </p>
              </div>
              <SphereMenu items={SPHERE_LINKS} className="mt-16" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Sphere menu</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A different 3D from the coverflow: points sit on a real Fibonacci sphere and are projected to 2D every
                frame, so the labels always face you while the ones turned away shrink and dim. One RAF loop rotates all
                of them and writes transform and depth straight onto the nodes, no React state on the hot path. Drag to
                spin with release inertia; left alone it drifts. Every label is a real link into the site, so no single
                project sits at the centre. Reduced motion drops the sphere for a plain, legible wrap of the same links.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH LANYARD */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 pb-6">
              <div className="pointer-events-none absolute inset-x-0 top-8 z-20 text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Throw</span>
                <p className="mx-auto mt-3 max-w-md px-6 text-lg font-medium text-white/85 sm:text-xl">
                  Grab the badge and let it go. It swings, then settles.
                </p>
              </div>
              <Lanyard className="h-[440px]" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Lanyard</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A name badge on a cord, hung from a pin. The whole thing is a single constrained mass — the state is just
                an angle and an angular velocity, so grabbing and flinging it sets a throw the physics carries into a
                swing that damps back to hanging straight down. The badge is real HTML, so the type stays crisp and
                on-brand while it tilts; the cord and the placement are written straight onto refs every frame, no React
                state on the hot path. A different kind of motion from everything else here: not a field, a card, or a
                trail, but one weight on a string. Reduced motion just lets it hang still.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH TURNTABLE */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-12 sm:px-10">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Spin</span>
                <p className="mx-auto mt-3 max-w-md text-lg font-medium text-white/85 sm:text-xl">
                  Hit play, or grab the vinyl and spin it yourself.
                </p>
              </div>
              <Turntable className="mt-10" title="Side A" subtitle="hand-built in Berlin" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Turntable</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A record deck with real momentum. The platter is a free-spinning mass carrying a single number — an
                angular velocity in degrees per second — integrated every frame off the animation clock, no React state
                on the hot path. Play eases it up to 33 rpm and swings the tonearm down onto the lead-in groove; grab the
                vinyl and you drive the rotation straight from the pointer angle, and the hand motion you impart becomes
                the velocity it coasts on when you let go, bleeding off on friction. A different kind of object from the
                Lanyard next door: not a weight on a string but a wheel you can flick and watch spin down. Reduced motion
                keeps it still, arm resting, fully labelled.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH HARMONOGRAPH */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-12 sm:px-10">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Draw</span>
                <p className="mx-auto mt-3 max-w-md text-lg font-medium text-white/85 sm:text-xl">
                  Hang a fresh set of pendulums and watch the pen find its figure.
                </p>
              </div>
              <Harmonograph className="mt-10" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Harmonograph</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                The Victorian drawing machine, in maths. Each axis is the sum of two decaying sinusoids —
                x(t) = Σ aᵢ·sin(fᵢt + pᵢ)·e^(−dᵢt) — and it is the near-integer frequency ratios with a hair of detuning
                that make the loops precess into a figure instead of closing on themselves. The whole curve is pre-sampled
                once from a seed, then a pen tip replays it in real time; crossings glow because the trace is composited
                additively, so density reads as light, the way graphite builds on paper. A different kind of thing from the
                turntable next door: not an object with momentum but a deterministic plotter — the same seed always draws
                the same plate. Click the plate or the button to hang new pendulums. Reduced motion lays the finished
                figure down in one frame.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH SORTABLE */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-12 sm:px-10">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Order</span>
                <p className="mx-auto mt-3 max-w-md text-lg font-medium text-white/85 sm:text-xl">
                  Grab a row and drag it. The rest make room and settle into the gap.
                </p>
              </div>
              <div className="mt-10 flex justify-center">
                <Sortable />
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Sortable</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A list you put in order by hand. Rows are laid out absolutely by index, so the whole reorder collapses to
                one number — index times the row pitch — and the dragged row simply tracks the pointer while every other
                row springs to its new slot. The moment your dragged row's centre crosses a neighbour, the order re-solves
                live underneath you and the layout re-solves with it; let go and the row settles into the gap it made. A
                different kind of interaction from the objects nearby: not a mass with momentum but a structure you
                rearrange, the state itself becoming the toy. Honest to a11y — each row is a real control with an
                arrow-key travel and a polite live region that reads the new position, so it reorders exactly the same by
                keyboard as by drag, and reduced motion swaps the glide for an instant jump.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH CAROUSEL */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-12 sm:px-10">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Sequence</span>
                <p className="mx-auto mt-3 max-w-md text-lg font-medium text-white/85 sm:text-xl">
                  It runs on its own. Hold to pause, click an edge to step, or swipe.
                </p>
              </div>
              <div className="mt-10 flex justify-center">
                <Carousel slides={CRAFT_FRAMES} label="How the work is made" />
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Carousel</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                The stories pattern, hand-built: a timed sequence of panels with a row of segmented bars filling across
                the top. The bar is the clock — the active segment fills over the interval, and when it tops out the panel
                advances, so the progress you see and the timing are the same thing and can never disagree. A different
                kind of motion from the objects nearby — not a coverflow you scrub (CircularGallery) or a passive deck on
                a timer (CardStack), but a sequence you can drive: hold anywhere to pause, click the left or right edge to
                step, swipe on touch, tap a bar to jump, or use the arrows and the keyboard. Honest to a11y — the controls
                are real labelled buttons and a polite live region names each panel; under reduced motion the auto-run and
                the fill drop away and it becomes a plain, manually-stepped sequence.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH HOVER INDEX */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-10 sm:px-10">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Hover</span>
              <p className="mt-3 max-w-md text-lg font-medium text-white/85 sm:text-xl">
                Run the cursor down the list. Each row summons its own preview.
              </p>
              <HoverIndex items={INDEX_LINKS} className="mt-8" />
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Hover index</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                An editorial index where hovering a row floats a generative preview panel that trails the cursor with a
                little spring lag — the awwwards-style hover-reveal list. A different kind of thing from the rest here:
                not a field, a card, or a text effect, but a list whose entries call up a floating thumbnail (distinct
                from FlowingMenu, whose panel slides in and stays inside the row). The previews are honest brand art
                generated per label, not screenshots; every row is a real link into the site, so it doubles as
                navigation. On touch or under reduced motion the floating preview is dropped for a clean, fully legible
                list.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH TOOLTIP */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-14 sm:px-10">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Hover</span>
              <p className="mt-3 max-w-md text-lg font-medium text-white/85 sm:text-xl">
                Point at each control. The hint rises from the edge, and flips when it would run off-screen.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Tooltip content="Rises from above" placement="top">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
                  >
                    Top
                  </button>
                </Tooltip>
                <Tooltip content="Drops from below" placement="bottom">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
                  >
                    Bottom
                  </button>
                </Tooltip>
                <Tooltip content="Slides in from the left" placement="left">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
                  >
                    Left
                  </button>
                </Tooltip>
                <Tooltip content="Slides in from the right" placement="right">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm text-white/80 transition hover:border-white/30 hover:text-white"
                  >
                    Right
                  </button>
                </Tooltip>
              </div>
              {/* An edge-hugging trigger: its preferred side has no room, so the
                  bubble flips to the opposite side and clamps into the frame. */}
              <div className="mt-8 flex justify-end">
                <Tooltip
                  content="I asked to open to the right, but there is no room — so I flipped left and stayed on-screen."
                  placement="right"
                >
                  <button
                    type="button"
                    className="rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-5 py-2.5 text-sm text-[#DCF87C] transition hover:bg-[#DCF87C]/20"
                  >
                    Corner control
                  </button>
                </Tooltip>
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Tooltip</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A small accessible hint that rises on hover and on keyboard focus, then closes on leave, blur, or Escape.
                It is rendered through a portal as a fixed-position bubble, positioned from the trigger's measured rect,
                so it is never clipped by an overflow-hidden parent or trapped under a lower stacking context — and it
                flips to the opposite side and clamps inside the viewport when the preferred placement would run off the
                edge, with the arrow tracking the trigger's centre. The trigger carries aria-describedby, so assistive
                tech announces the hint with the control. It backs the nav's terse buttons across the whole site. Under
                reduced motion it just fades, no travel.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH TOAST */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-14 sm:px-10">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Press</span>
              <p className="mt-3 max-w-md text-lg font-medium text-white/85 sm:text-xl">
                Raise a toast. It springs up from the edge, counts itself down, pauses when you hover, and can be
                flicked aside — stack a few and the oldest steps off the top.
              </p>
              <div className="mt-10">
                <ToastDemo />
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Toast</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A site-wide notification queue. A provider at the top of the shell owns a shallow stack and hands any
                page or dialog a toast() call; the messages render through a portal into an aria-live region pinned to
                the bottom edge, so a screen reader hears each one. When motion is allowed, a single CSS animation both
                depletes the lime meter and, on its end, dismisses the toast — meter and clock are the same thing, and
                hovering pauses both. It backs the real "email copied" confirmation from the contact channels and the
                command palette. Under reduced motion the drift and travelling meter drop for a clean fade on a plain
                timer.
              </p>
            </div>
          </div>
        </Reveal>

        {/* FULL-WIDTH INFINITE SCROLL */}
        <Reveal>
          <div className="mt-12">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/30 px-6 py-12 sm:px-10">
              <div className="pointer-events-none absolute inset-x-0 top-8 z-10 text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Drag</span>
                <p className="mx-auto mt-3 max-w-md px-6 text-lg font-medium text-white/85 sm:text-xl">
                  A column that never ends. It drifts on its own — grab it and throw it to send it spinning.
                </p>
              </div>
              <div className="mt-24 grid gap-8 sm:grid-cols-2">
                <InfiniteScroll items={SCROLL_ITEMS} speed={38} direction="up" height={360} />
                <InfiniteScroll items={SCROLL_ITEMS} speed={30} direction="down" tilt={8} height={360} />
              </div>
            </div>
            <div className="mt-4 px-1">
              <h3 className="text-base font-semibold">Infinite scroll</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/45">
                A vertical column of cards that loops forever and never seams. One RAF loop drifts the track at a steady
                speed and wraps it by exactly one sequence height — measured off the real DOM, so it holds at any size or
                gap — so the same content re-enters from the opposite edge with no pop. A different primitive from the
                Marquee (horizontal, CSS-only, no drag) and the coverflow (which snaps): grab it and it scrubs under your
                finger, and the release carries a decaying momentum on top of the drift before it eases back to the base
                speed. The second column leans in 3D and drifts the other way. No per-item React state — the loop writes
                the transform straight onto the track. Under reduced motion the loop is dropped entirely for a plain,
                natively-scrollable column, fully legible.
              </p>
            </div>
          </div>
        </Reveal>
      </Category>

      {/* CLOSER */}
      <Reveal>
        <div className="mt-24 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-2xl font-medium leading-snug text-white/85 sm:text-3xl">
            These are the building blocks behind the rest of this site.
          </p>
          <p className="mt-4 text-white/50">Want something that moves like this? Let's talk.</p>
          <div className="mt-8 flex justify-center">
            <MagneticButton
              href="mailto:ars7ars3@gmail.com"
              className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black"
            >
              ars7ars3@gmail.com
            </MagneticButton>
          </div>
        </div>
      </Reveal>

      {/* A scoped finder for the three dozen experiments below — search, jump,
          surprise, deep-link. Floating trigger, or press "/". */}
      <PlaygroundFinder />
    </section>
  )
}
