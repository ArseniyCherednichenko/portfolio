import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { Reveal } from '../components/Reveal'
import { Squares } from '../components/Squares'
import { useContact } from '../components/ContactDialog'

const EASE = [0.16, 1, 0.3, 1] as const

// Taste (/taste) — "Taste is the difference."
//
// The site says, over and over, that Arseniy sweats "the small moments no one
// notices, but everyone feels" (the Home ethos). This page stops describing
// that and shows it: the same tiny piece of interface rendered two ways —
// Plain, the honest default anyone would ship, and Considered, the same thing
// after the care — with a single switch that flips every demo at once, so the
// taste reads as the *delta* between them.
//
// Deliberately distinct from its neighbours: /craft ("On motion") demonstrates
// motion mechanics, /design is a static token style-guide, /playground is a
// component gallery. This one is about applied judgement on ordinary product
// surfaces — a button, an empty state, a number, a field — the parts that never
// make a showreel. It de-centres Guided entirely (zero mention); its subject is
// his taste. It invents no facts — every demo is a live component, not a claim.

type Mode = 'plain' | 'considered'

// A two-option segmented control. The active pill glides on a shared layoutId
// spring; reduced motion drops the glide. Drives the whole page's mode.
function ModeSwitch({
  value,
  onChange,
  reduce,
}: {
  value: Mode
  onChange: (m: Mode) => void
  reduce: boolean | null
}) {
  const options: { id: Mode; label: string }[] = [
    { id: 'plain', label: 'Plain' },
    { id: 'considered', label: 'Considered' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Level of care"
      className="inline-flex gap-1 rounded-full border border-white/10 bg-white/[0.02] p-1.5"
    >
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              active ? 'text-black' : 'text-white/55 hover:text-white/85'
            }`}
          >
            {active && (
              <motion.span
                layoutId={reduce ? undefined : 'taste-mode-pill'}
                transition={{ type: 'spring', stiffness: 440, damping: 36 }}
                className="absolute inset-0 rounded-full bg-[#DCF87C]"
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// The frame around every demo: a number, a title, the live stage that swaps
// between the two renderings, and an always-visible note naming what changed —
// so the taste is legible even without touching the switch.
function DemoCard({
  index,
  title,
  changed,
  mode,
  reduce,
  plain,
  considered,
}: {
  index: number
  title: string
  changed: string
  mode: Mode
  reduce: boolean | null
  plain: ReactNode
  considered: ReactNode
}) {
  return (
    <Reveal delay={index * 0.05}>
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <span className="font-display text-sm font-semibold tabular-nums text-white/30">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h2 className="font-display text-lg font-semibold tracking-tight text-white/90">{title}</h2>
          <span
            className={`ml-auto rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors ${
              mode === 'considered'
                ? 'border-[#DCF87C]/30 text-[#DCF87C]/80'
                : 'border-white/10 text-white/35'
            }`}
          >
            {mode}
          </span>
        </div>

        {/* Stage — fixed min-height so the cross-fade never jumps the layout. */}
        <div className="relative flex min-h-[190px] flex-1 items-center justify-center px-6 py-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : 0.32, ease: EASE }}
              className="flex w-full items-center justify-center"
            >
              {mode === 'plain' ? plain : considered}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="border-t border-white/10 px-6 py-4 text-sm leading-relaxed text-white/50">
          <span className="font-semibold text-white/70">What changed — </span>
          {changed}
        </p>
      </div>
    </Reveal>
  )
}

// --- Demo 1: the button -----------------------------------------------------

function PlainButton() {
  return (
    <button
      type="button"
      className="border border-white/25 bg-transparent px-3 py-1.5 text-sm text-white/70"
    >
      Get started
    </button>
  )
}

function ConsideredButton({ reduce }: { reduce: boolean | null }) {
  return (
    <motion.button
      type="button"
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="rounded-full bg-[#DCF87C] px-7 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_-12px_rgba(220,248,124,0.7)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
    >
      Get started
    </motion.button>
  )
}

// --- Demo 2: the empty state ------------------------------------------------

function PlainEmpty() {
  return (
    <div className="w-full max-w-xs rounded-md border border-white/12 p-5 text-left">
      <p className="text-sm text-white/45">No results.</p>
    </div>
  )
}

function ConsideredEmpty({ reduce }: { reduce: boolean | null }) {
  return (
    <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.02] p-7 text-center">
      <motion.span
        aria-hidden
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#DCF87C]/30"
        animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="h-2 w-2 rounded-full bg-[#DCF87C]" />
      </motion.span>
      <p className="mt-4 font-display text-lg font-semibold tracking-tight text-white/90">
        Nothing here yet
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-white/50">
        Your saved projects will show up here once you add one.
      </p>
      <span className="mt-4 inline-flex rounded-full bg-[#DCF87C] px-4 py-2 text-xs font-semibold text-black">
        Add a project
      </span>
    </div>
  )
}

// --- Demo 3: the number -----------------------------------------------------

const AMOUNT = 1234567.5

function PlainNumber() {
  return (
    <div className="text-left">
      <p className="text-3xl text-white/85">${AMOUNT}</p>
    </div>
  )
}

function ConsideredNumber() {
  const formatted = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
      }).format(AMOUNT),
    [],
  )
  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
        Processed this month
      </p>
      <p className="mt-2 font-display text-5xl font-bold leading-none tracking-tight text-white">
        <span className="align-top text-2xl text-white/45">$</span>
        <span className="tabular-nums">{formatted}</span>
      </p>
      <p className="mt-2 text-xs text-white/40">across 4,120 transactions</p>
    </div>
  )
}

// --- Demo 4: the field ------------------------------------------------------

function PlainField() {
  return (
    <div className="w-full max-w-xs">
      <input
        type="text"
        placeholder="Email"
        className="w-full border border-white/25 bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/35"
      />
    </div>
  )
}

function ConsideredField() {
  return (
    <div className="w-full max-w-xs text-left">
      <label htmlFor="taste-email" className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
        Work email
      </label>
      <input
        id="taste-email"
        type="email"
        placeholder="you@studio.com"
        className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#DCF87C]/50 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/30"
      />
      <p className="mt-2 text-xs leading-relaxed text-white/40">
        We will only use this to reply. No lists, ever.
      </p>
    </div>
  )
}

export default function Taste() {
  const reduce = useReducedMotion()
  const { open: openContact } = useContact()
  const [mode, setMode] = useState<Mode>('considered')

  return (
    <>
      <Seo
        title="Taste"
        description="Taste is the difference — the same small pieces of interface rendered plain and considered, side by side. Flip one switch and watch the care appear."
      />

      {/* HERO */}
      <header className="relative isolate mx-auto w-full max-w-4xl overflow-hidden px-6 pb-10 pt-36 sm:pt-44">
        {/* Ambient structural lattice — precision, fitting for a page about the
            details. pointer-events pass through; radial-masked to the top-left. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(120%_90%_at_18%_20%,#000_0%,transparent_68%)]"
        >
          <Squares size={40} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Taste</Eyebrow>
        </motion.div>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
          <SplitText as="span" text="Taste is the" trigger="mount" delay={0.1} className="block" />
          <SplitText as="span" text="difference." gradient trigger="mount" delay={0.28} className="block" />
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24, ease: EASE }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-white/60"
        >
          The whole site keeps promising I sweat the small moments no one notices but everyone
          feels. Rather than say it again, here it is: the same ordinary pieces of interface, built
          twice. Flip the switch, and watch the care arrive.
        </motion.p>
      </header>

      {/* THE SWITCH */}
      <section className="mx-auto w-full max-w-4xl px-6">
        <Reveal>
          <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.015] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-white/90">
                One switch, four demos.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/50">
                Same components, two levels of care. The delta between them is the whole craft.
              </p>
            </div>
            <ModeSwitch value={mode} onChange={setMode} reduce={reduce} />
          </div>
        </Reveal>
      </section>

      {/* THE DEMOS */}
      <section className="mx-auto grid w-full max-w-4xl gap-5 px-6 py-10 sm:grid-cols-2">
        <DemoCard
          index={0}
          title="The button"
          changed="Weight, a radius, a hover that lifts, and a focus ring you can actually find with the keyboard. The same action, now worth reaching for."
          mode={mode}
          reduce={reduce}
          plain={<PlainButton />}
          considered={<ConsideredButton reduce={reduce} />}
        />
        <DemoCard
          index={1}
          title="The empty state"
          changed="An empty screen is not a dead end — it is the best chance to reassure someone and point them at the next step, instead of a flat line of grey text."
          mode={mode}
          reduce={reduce}
          plain={<PlainEmpty />}
          considered={<ConsideredEmpty reduce={reduce} />}
        />
        <DemoCard
          index={2}
          title="The number"
          changed="Tabular figures that hold still, thousands grouped, the currency stepped back, and a label so you know what you are reading before you read the digits."
          mode={mode}
          reduce={reduce}
          plain={<PlainNumber />}
          considered={<ConsideredNumber />}
        />
        <DemoCard
          index={3}
          title="The field"
          changed="A real label, a focus state you can reach by keyboard, and one honest line of help before someone can make the mistake — not a bare box to guess at."
          mode={mode}
          reduce={reduce}
          plain={<PlainField />}
          considered={<ConsideredField />}
        />
      </section>

      {/* CLOSING */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-28 pt-6">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12">
            <p className="max-w-2xl font-display text-2xl font-semibold leading-snug tracking-tight text-white/85 sm:text-3xl">
              None of this shows up in a screenshot. It is felt, not seen — and it is the same care
              running under <GradientText>every screen I build.</GradientText>
            </p>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/55">
              This page is the taste stated on ordinary surfaces. The motion side of the same
              instinct is playable on the craft page, the tokens it all rests on live in the design
              language, and the whole library of hand-built pieces is in the playground.
            </p>
            <div className="mt-9 flex flex-wrap gap-3 text-sm">
              <Link
                to="/craft"
                className="rounded-full bg-[#DCF87C] px-5 py-2.5 font-semibold text-black transition hover:brightness-105"
              >
                On motion
              </Link>
              <Link
                to="/design"
                className="rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Design language
              </Link>
              <Link
                to="/playground"
                className="rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Into the playground
              </Link>
              <button
                type="button"
                onClick={openContact}
                className="rounded-full border border-white/15 px-5 py-2.5 font-semibold text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Work with me
              </button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
