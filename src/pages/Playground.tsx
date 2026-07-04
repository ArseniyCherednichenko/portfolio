import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { GooeyTabs } from '../components/GooeyTabs'
import { GradientText } from '../components/GradientText'
import { RotatingWord } from '../components/RotatingWord'
import { SpotlightCard } from '../components/SpotlightCard'
import { TiltCard } from '../components/TiltCard'
import { GlareHover } from '../components/GlareHover'
import { BorderBeam } from '../components/BorderBeam'
import { CircularText } from '../components/CircularText'
import { MagneticButton } from '../components/MagneticButton'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { DotGrid } from '../components/DotGrid'
import { MagnetLines } from '../components/MagnetLines'
import { ScrollVelocity } from '../components/ScrollVelocity'
import { DecryptedText } from '../components/DecryptedText'
import { SplitText } from '../components/SplitText'
import { CardStack } from '../components/CardStack'
import { ProfileCard } from '../components/ProfileCard'
import { ScrollStack } from '../components/ScrollStack'
import { ScrollReveal } from '../components/ScrollReveal'
import { VariableProximity } from '../components/VariableProximity'
import { SpotlightReveal } from '../components/SpotlightReveal'
import { TrueFocus } from '../components/TrueFocus'
import { FlowingMenu } from '../components/FlowingMenu'
import { Threads } from '../components/Threads'
import { LetterGlitch } from '../components/LetterGlitch'
import { MetaBalls } from '../components/MetaBalls'
import { BentoGrid, BentoCell } from '../components/BentoGrid'
import { Accordion } from '../components/Accordion'
import { Dock, type DockItem } from '../components/Dock'
import { Timeline, type TimelineItem } from '../components/Timeline'
import { HorizontalScroll, type HPanel } from '../components/HorizontalScroll'
import { GO_TARGETS, useShortcuts } from '../components/Keyboard'
import { Seo } from '../components/Seo'
import { GITHUB_URL } from '../data/contact'

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

function Experiment({
  name,
  note,
  children,
}: {
  name: string
  note: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-8">
        {children}
      </div>
      <div className="mt-4 px-1">
        <h3 className="text-base font-semibold">{name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-white/45">{note}</p>
      </div>
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

// Panels for the gooey-tabs demo. Honest and self-referential: each tab
// describes a facet of how the effect itself is built, so nothing is claimed
// that the component does not actually do.
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

export default function Playground() {
  const [likes, setLikes] = useState(128)
  const [on, setOn] = useState(false)
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
            A workbench for the interaction details I care about. Every piece here is hand-built with React and Framer
            Motion, and every one respects reduced-motion. Hover, click, and poke around.
          </p>
        </Reveal>
      </div>

      {/* GRID */}
      <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2">
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

        <Reveal>
          <Experiment name="Animated counter" note="Counts up with an ease curve the first time it enters the viewport.">
            <div className="text-center">
              <AnimatedCounter value={2026} className="text-6xl font-bold tabular-nums sm:text-7xl" />
              <p className="mt-2 text-sm text-white/45">Eases from zero on reveal</p>
            </div>
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

        <Reveal delay={0.05}>
          <Experiment name="Circular text" note="A string laid around a ring that rotates on a constant loop. Each glyph is aria-hidden; the real label is read once. Drives the hero's scroll seal.">
            <CircularText text="CRAFT · MOTION · DETAIL · " radius={52} spin={18} label="Craft, motion, detail">
              <span aria-hidden className="block h-2.5 w-2.5 rounded-full bg-[#DCF87C]" />
            </CircularText>
          </Experiment>
        </Reveal>

        <Reveal delay={0.05}>
          <Experiment name="Magnetic button" note="The target drifts toward your cursor, then springs back on exit.">
            <MagneticButton href="#" className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black">
              Pull me
            </MagneticButton>
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
              <button
                role="switch"
                aria-checked={on}
                onClick={() => setOn((v) => !v)}
                className={`relative h-9 w-16 rounded-full border transition-colors ${
                  on ? 'border-[#DCF87C]/50 bg-[#DCF87C]/20' : 'border-white/15 bg-white/[0.04]'
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full transition-all duration-300 ${
                    on ? 'left-9 bg-[#DCF87C]' : 'left-1 bg-white/60'
                  }`}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                />
              </button>
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

      {/* FULL-WIDTH SCROLL-VELOCITY BAND */}
      <Reveal>
        <div className="mt-12">
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

      {/* CLOSER */}
      <Reveal>
        <div className="mt-20 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center">
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
    </section>
  )
}
