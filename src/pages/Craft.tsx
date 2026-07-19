import { useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { Iridescence } from '../components/Iridescence'
import { Seo } from '../components/Seo'

const EASE = [0.16, 1, 0.3, 1] as const
const LIME = '#DCF87C'

// A small segmented toggle used across the demos so every control on the page
// reads the same. Purely presentational — the parent owns the state.
function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className="relative rounded-full px-4 py-1.5 text-sm font-semibold transition-colors"
          >
            {active && (
              <motion.span
                layoutId={`seg-${label}`}
                className="absolute inset-0 rounded-full bg-[#DCF87C]"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className={`relative z-10 ${active ? 'text-black' : 'text-white/60'}`}>
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// A pill that replays a demo. Reused so the affordance is consistent.
function Replay({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      <span aria-hidden>&#8635;</span>
      Play again
    </button>
  )
}

// The frame every demo sits in: a title, a one-line reading of what to notice,
// the controls, and the stage. Keeps the four demos visually consistent.
function Demo({
  n,
  title,
  claim,
  controls,
  children,
}: {
  n: string
  title: string
  claim: string
  controls: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Reveal>
      <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-7 sm:p-9">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <span className="font-mono text-xs text-[#DCF87C]">{n}</span>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          </div>
          {controls}
        </div>
        <p className="mt-4 max-w-xl leading-relaxed text-white/55">{claim}</p>
        <div className="mt-8">{children}</div>
      </section>
    </Reveal>
  )
}

// 01 — Easing. The same 900ms travel, run linear or on the site's signature
// curve, with the two curves drawn so you can see the shape you just felt.
function EasingDemo() {
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<'linear' | 'eased'>('eased')
  const [run, setRun] = useState(0)
  const eased = mode === 'eased'
  return (
    <>
      <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-5">
          {(['linear', 'eased'] as const).map((m) => {
            const isRow = m === mode
            return (
              <div key={m} className="flex items-center gap-4">
                <span className="w-16 shrink-0 font-mono text-xs text-white/40">{m}</span>
                <div className="relative h-2 flex-1 rounded-full bg-white/[0.06]">
                  {isRow && (
                    <motion.span
                      key={run}
                      className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#DCF87C] shadow-[0_0_18px_rgba(220,248,124,0.6)]"
                      initial={{ left: reduce ? '100%' : '0%' }}
                      animate={{ left: 'calc(100% - 16px)' }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : { duration: 0.9, ease: m === 'eased' ? EASE : 'linear' }
                      }
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {/* The curve you selected, drawn in a unit square (y flips up). */}
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" aria-hidden>
          <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <path d="M0,100 L100,0" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2" />
          <motion.path
            d="M0,100 C16,0 30,0 100,0"
            fill="none"
            stroke={LIME}
            strokeWidth="2.5"
            strokeLinecap="round"
            animate={{ opacity: eased ? 1 : 0.15, pathLength: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        </svg>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Segmented
          label="easing"
          value={mode}
          onChange={(v) => {
            setMode(v)
            setRun((r) => r + 1)
          }}
          options={[
            { value: 'linear', label: 'Linear' },
            { value: 'eased', label: 'Eased' },
          ]}
        />
        <Replay onClick={() => setRun((r) => r + 1)} />
      </div>
    </>
  )
}

// 02 — Spring, not snap. Drag the tile aside and let go; it returns on a
// spring or a fixed tween. The difference is entirely in the release.
function SpringDemo() {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const [mode, setMode] = useState<'spring' | 'tween'>('spring')
  const back = () => {
    if (reduce) {
      x.set(0)
      return
    }
    animate(
      x,
      0,
      mode === 'spring'
        ? { type: 'spring', stiffness: 320, damping: 16 }
        : { type: 'tween', duration: 0.32, ease: EASE },
    )
  }
  return (
    <>
      <div className="relative flex h-32 items-center justify-center rounded-2xl border border-white/[0.06] bg-[radial-gradient(circle_at_center,rgba(220,248,124,0.05),transparent_70%)]">
        <div className="pointer-events-none absolute h-14 w-14 rounded-2xl border border-dashed border-white/15" />
        <motion.button
          type="button"
          drag={reduce ? false : 'x'}
          dragConstraints={{ left: -130, right: 130 }}
          dragElastic={0.35}
          onDragEnd={back}
          style={{ x }}
          whileTap={{ cursor: 'grabbing' }}
          className="relative z-10 flex h-14 w-14 cursor-grab touch-none items-center justify-center rounded-2xl bg-[#DCF87C] text-xs font-bold text-black"
          aria-label="Drag me sideways, then release"
        >
          drag
        </motion.button>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Segmented
          label="return"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'spring', label: 'Spring' },
            { value: 'tween', label: 'Tween' },
          ]}
        />
        <span className="text-sm text-white/40">
          {reduce ? 'Reduced motion is on, so it just returns.' : 'Drag it, then let go.'}
        </span>
      </div>
    </>
  )
}

// 03 — Stagger. Six bars arrive all at once or one after another. Staggering
// gives the eye an order to read, so the group feels composed, not dumped.
function StaggerDemo() {
  const reduce = useReducedMotion()
  const [staggered, setStaggered] = useState(true)
  const [run, setRun] = useState(0)
  const bars = [0, 1, 2, 3, 4, 5]
  return (
    <>
      <div key={run} className="flex h-32 items-end gap-3">
        {bars.map((i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-lg bg-gradient-to-t from-[#DCF87C]/25 to-[#DCF87C]"
            initial={{ height: reduce ? `${30 + i * 11}%` : '0%', opacity: reduce ? 1 : 0 }}
            animate={{ height: `${30 + i * 11}%`, opacity: 1 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.55, ease: EASE, delay: staggered ? i * 0.09 : 0 }
            }
          />
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Segmented
          label="timing"
          value={staggered ? 'stagger' : 'together'}
          onChange={(v) => {
            setStaggered(v === 'stagger')
            setRun((r) => r + 1)
          }}
          options={[
            { value: 'together', label: 'All at once' },
            { value: 'stagger', label: 'Staggered' },
          ]}
        />
        <Replay onClick={() => setRun((r) => r + 1)} />
      </div>
    </>
  )
}

// 04 — Respect the still. Every effect on this site has a calm path for people
// who ask their system to reduce motion. This demo lets you stand in both.
function ReducedMotionDemo() {
  const reduce = useReducedMotion()
  const [still, setStill] = useState<boolean>(!!reduce)
  const [run, setRun] = useState(0)
  return (
    <>
      <div key={run} className="grid gap-4 sm:grid-cols-3">
        {['Type', 'Surface', 'Field'].map((label, i) => (
          <motion.div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            initial={still ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={still ? { duration: 0.25 } : { duration: 0.6, ease: EASE, delay: i * 0.1 }}
          >
            <span className="font-mono text-xs text-white/40">0{i + 1}</span>
            <p className="mt-2 font-display text-lg font-semibold text-white/85">{label}</p>
          </motion.div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Segmented
          label="motion"
          value={still ? 'still' : 'full'}
          onChange={(v) => {
            setStill(v === 'still')
            setRun((r) => r + 1)
          }}
          options={[
            { value: 'full', label: 'In motion' },
            { value: 'still', label: 'Calm' },
          ]}
        />
        <Replay onClick={() => setRun((r) => r + 1)} />
      </div>
      <p className="mt-4 text-sm text-white/40">
        {reduce
          ? 'Your system asks for reduced motion, so the whole site already defaults to the calm path.'
          : 'The calm path is what plays automatically when a visitor asks their system to reduce motion.'}
      </p>
    </>
  )
}

export default function Craft() {
  return (
    <>
      <Seo
        title="On motion"
        description="Notes on interface motion — four small, playable demonstrations of the craft behind the animation on this site: easing, springs, stagger, and respecting reduced motion."
      />
      <div className="mx-auto w-full max-w-4xl px-6 py-24 sm:py-32">
        {/* HEADER */}
        <header className="relative isolate max-w-2xl">
          {/* A breathing iridescent sheen behind the title — a fitting ambient
              layer for a page about motion. Radial-masked and dimmed so it
              fades into the dark and never competes with the copy. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -top-16 -z-10 h-72 opacity-40 [mask-image:radial-gradient(120%_80%_at_20%_30%,#000_0%,transparent_70%)]"
          >
            <Iridescence scale={13} speed={0.85} />
          </div>
          <Reveal>
            <Eyebrow>Notes on craft</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
              On <GradientText>motion.</GradientText>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-7 text-lg leading-relaxed text-white/60">
              The About page tells you how I work. This one shows it. Four beliefs I hold about
              interface motion, each one a small thing you can play with rather than a claim you
              have to take on trust. Move the controls. The difference is meant to be felt, not read.
            </p>
          </Reveal>
        </header>

        {/* DEMOS */}
        <div className="mt-16 space-y-8">
          <Demo
            n="01"
            title="Easing has a voice"
            claim="Linear motion is a machine moving a thing from A to B. A good curve makes the same travel feel intentional — quick to commit, slow to settle. Watch the dot, then read the curve it followed."
            controls={null}
          >
            <EasingDemo />
          </Demo>

          <Demo
            n="02"
            title="Spring, not snap"
            claim="Real things have weight. When an element returns to rest, a spring carries a little of that physics — it overshoots and settles — where a fixed tween just arrives. Drag the tile and feel both."
            controls={null}
          >
            <SpringDemo />
          </Demo>

          <Demo
            n="03"
            title="Stagger guides the eye"
            claim="When a group of things appears all at once, the eye has nowhere to land. Offset each one by a beat and you hand the viewer an order to read them in. The group stops feeling dumped and starts feeling composed."
            controls={null}
          >
            <StaggerDemo />
          </Demo>

          <Demo
            n="04"
            title="Respect the still"
            claim="Motion is a choice, and not everyone wants it. Every effect on this site has a calm path for anyone who asks their system to reduce motion — nothing essential lives in the animation. You can stand in both here."
            controls={null}
          >
            <ReducedMotionDemo />
          </Demo>
        </div>

        {/* OUTRO */}
        <Reveal>
          <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
            <p className="max-w-xl font-display text-2xl font-semibold leading-snug text-white/85 sm:text-3xl">
              These four ideas run under every animation on the site.
            </p>
            <p className="mt-4 max-w-xl leading-relaxed text-white/55">
              The Playground is where they are put to work across seventy-odd hand-built components.
              The work is where they ship.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/playground"
                className="rounded-full bg-[#DCF87C] px-6 py-3 font-semibold text-black transition-opacity hover:opacity-90"
              >
                See it applied
              </Link>
              <Link
                to="/work"
                className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                See the work
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </>
  )
}
