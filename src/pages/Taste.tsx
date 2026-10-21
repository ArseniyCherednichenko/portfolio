import { useEffect, useMemo, useState, type ReactNode } from 'react'
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

// --- Demo 5: the toggle -----------------------------------------------------

function PlainToggle() {
  const [on, setOn] = useState(true)
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="h-4 w-4 accent-white/60"
      />
      Email notifications
    </label>
  )
}

function ConsideredToggle({ reduce }: { reduce: boolean | null }) {
  const [on, setOn] = useState(true)
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Email notifications"
        onClick={() => setOn((v) => !v)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] ${
          on ? 'bg-[#DCF87C]' : 'bg-white/12'
        }`}
      >
        <motion.span
          layout={!reduce}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className={`h-6 w-6 rounded-full bg-white shadow-sm ${on ? 'ml-auto' : ''}`}
        />
      </button>
      <div className="text-left">
        <p className="text-sm font-medium text-white/90">Email notifications</p>
        <p className="text-xs text-white/40">{on ? 'On — we will email you' : 'Off — quiet for now'}</p>
      </div>
    </div>
  )
}

// --- Demo 6: the loading state ----------------------------------------------

function PlainLoading() {
  return <p className="text-sm text-white/45">Loading...</p>
}

function ConsideredLoading({ reduce }: { reduce: boolean | null }) {
  // A skeleton shaped like the content it stands in for, with a light sweep so
  // the wait reads as motion rather than a frozen screen. Held still, and
  // dimmed to a plain pulse, under reduced motion.
  const bar = 'relative overflow-hidden rounded-md bg-white/[0.06]'
  const sweep = reduce ? (
    <span className="absolute inset-0 animate-pulse bg-white/[0.04]" />
  ) : (
    <motion.span
      aria-hidden
      className="absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent via-white/[0.09] to-transparent"
      animate={{ x: ['0%', '200%'] }}
      transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex w-full max-w-xs items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <div className={`h-11 w-11 shrink-0 rounded-full ${bar}`}>{sweep}</div>
      <div className="flex-1 space-y-2.5">
        <div className={`h-3 w-3/4 ${bar}`}>{sweep}</div>
        <div className={`h-3 w-1/2 ${bar}`}>{sweep}</div>
      </div>
    </div>
  )
}

// --- Demo 7: progress -------------------------------------------------------

function PlainProgress() {
  return <p className="text-sm text-white/55">Uploading: 68%</p>
}

function ConsideredProgress({ reduce }: { reduce: boolean | null }) {
  const target = 68
  const [value, setValue] = useState(reduce ? target : 0)
  useEffect(() => {
    if (reduce) {
      setValue(target)
      return
    }
    // Ease the bar up to its real value once on mount, so the number is felt
    // arriving rather than stamped down. Counts in step with the fill.
    const start = performance.now()
    const dur = 1100
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(eased * target))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce])
  return (
    <div className="w-full max-w-xs text-left">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Uploading</p>
        <p className="font-display text-sm font-semibold tabular-nums text-white/85">{value}%</p>
      </div>
      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="h-full rounded-full bg-[#DCF87C]"
          initial={false}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0 }}
        />
      </div>
      <p className="mt-2 text-xs text-white/40">portfolio-final-v3.zip</p>
    </div>
  )
}

// --- Demo 8: the timestamp --------------------------------------------------

function PlainDate() {
  return <p className="text-sm text-white/55">2026-10-07T12:32:00Z</p>
}

function ConsideredDate() {
  // The same instant, read the way a person actually parses it: a relative
  // phrase for the glance, the exact time kept underneath for when it matters.
  const when = useMemo(() => new Date(Date.now() - 2 * 60 * 60 * 1000 - 14 * 60 * 1000), [])
  const relative = useMemo(() => {
    const mins = Math.round((Date.now() - when.getTime()) / 60000)
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.round(mins / 60)
    return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`
  }, [when])
  const absolute = useMemo(
    () =>
      when.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [when],
  )
  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Last saved</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-white/90">{relative}</p>
      <p className="mt-1.5 text-xs tabular-nums text-white/40" title={when.toISOString()}>
        {absolute}
      </p>
    </div>
  )
}

// --- Demo 9: the destructive action -----------------------------------------

function PlainConfirm() {
  // A bare, unguarded delete. One slip and the account is gone, with no moment
  // to catch the mistake — the honest default nobody should ship.
  return (
    <button
      type="button"
      className="border border-white/25 bg-transparent px-3 py-1.5 text-sm text-white/70"
    >
      Delete account
    </button>
  )
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  )
}

function ConsideredConfirm({ reduce }: { reduce: boolean | null }) {
  type Stage = 'idle' | 'confirm' | 'done'
  const [stage, setStage] = useState<Stage>('idle')

  // After the delete lands, hold the confirmation briefly, then reset so the
  // demo stays replayable without a reload.
  useEffect(() => {
    if (stage !== 'done') return
    const t = setTimeout(() => setStage('idle'), 1900)
    return () => clearTimeout(t)
  }, [stage])

  const t = { duration: reduce ? 0 : 0.26, ease: EASE }

  return (
    <div className="flex min-h-[112px] w-full max-w-xs items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        {stage === 'idle' && (
          <motion.button
            key="idle"
            type="button"
            onClick={() => setStage('confirm')}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={t}
            className="rounded-full border border-[#F0877A]/35 px-5 py-2.5 text-sm font-semibold text-[#F0877A]/90 outline-none transition-colors hover:border-[#F0877A]/60 hover:text-[#F0877A] focus-visible:ring-2 focus-visible:ring-[#F0877A]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
          >
            Delete account
          </motion.button>
        )}
        {stage === 'confirm' && (
          <motion.div
            key="confirm"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={t}
            className="w-full rounded-2xl border border-[#F0877A]/25 bg-[#F0877A]/[0.05] p-4 text-center"
          >
            <p className="text-sm font-medium text-white/90">Delete your account?</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Everything goes with it. This cannot be undone.
            </p>
            <div className="mt-3.5 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setStage('idle')}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/75 outline-none transition-colors hover:border-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => setStage('done')}
                className="rounded-full bg-[#F0877A] px-4 py-1.5 text-xs font-semibold text-black outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#F0877A]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
              >
                Yes, delete
              </button>
            </div>
          </motion.div>
        )}
        {stage === 'done' && (
          <motion.div
            key="done"
            role="status"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={t}
            className="flex items-center gap-2 text-sm text-white/65"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-white/55">
              <CheckGlyph />
            </span>
            Account deleted
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Demo 10: the save confirmation -----------------------------------------

function PlainSave() {
  // The work is done, but the screen barely admits it — a flat word that never
  // leaves, with no way back out of the change.
  const [saved, setSaved] = useState(false)
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setSaved(true)}
        className="border border-white/25 bg-transparent px-3 py-1.5 text-sm text-white/70"
      >
        Save changes
      </button>
      {saved && <p className="text-sm text-white/45">Saved.</p>}
    </div>
  )
}

function ConsideredSave({ reduce }: { reduce: boolean | null }) {
  const [toast, setToast] = useState(false)
  const [undone, setUndone] = useState(false)

  // A toast steps in to confirm, then steps back out on its own once it has
  // been read. Undo cancels both the timer and the save.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(false), 4000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => {
          setUndone(false)
          setToast(true)
        }}
        className="rounded-full bg-[#DCF87C] px-6 py-2.5 text-sm font-semibold text-black outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
      >
        Save changes
      </button>

      <div className="flex h-[56px] w-full items-start justify-center">
        <AnimatePresence mode="wait">
          {toast ? (
            <motion.div
              key="toast"
              role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
              className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/12 bg-[#141414] px-4 py-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DCF87C]/15 text-[#DCF87C]">
                <CheckGlyph />
              </span>
              <p className="flex-1 text-sm text-white/85">Changes saved</p>
              <button
                type="button"
                onClick={() => {
                  setUndone(true)
                  setToast(false)
                }}
                className="rounded-full px-2.5 py-1 text-xs font-semibold text-[#DCF87C] outline-none transition-colors hover:bg-[#DCF87C]/10 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
              >
                Undo
              </button>
              {/* The countdown rail — a quiet promise the toast will leave on
                  its own, so it never has to be dismissed by hand. */}
              {!reduce && (
                <motion.span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[#DCF87C]/40"
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 4, ease: 'linear' }}
                />
              )}
            </motion.div>
          ) : undone ? (
            <motion.p
              key="undone"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
              className="pt-2 text-xs text-white/40"
            >
              Change reverted.
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
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
                One switch, ten demos.
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
        <DemoCard
          index={4}
          title="The toggle"
          changed="A bare checkbox tells you nothing about what it did. A switch that springs over, colours to the accent, and says in words what is now on turns a setting into a small moment of certainty."
          mode={mode}
          reduce={reduce}
          plain={<PlainToggle />}
          considered={<ConsideredToggle reduce={reduce} />}
        />
        <DemoCard
          index={5}
          title="The loading state"
          changed="A dead word hangs there telling you nothing. A skeleton shaped like the thing that is coming, with a light moving across it, promises the wait is short and the layout will not jump when it lands."
          mode={mode}
          reduce={reduce}
          plain={<PlainLoading />}
          considered={<ConsideredLoading reduce={reduce} />}
        />
        <DemoCard
          index={6}
          title="Progress"
          changed="A bare percentage is a fact with no feeling. A labelled bar that eases up to its value, with tabular digits that hold still and the file named underneath, tells you what is happening and that it is moving."
          mode={mode}
          reduce={reduce}
          plain={<PlainProgress />}
          considered={<ConsideredProgress reduce={reduce} />}
        />
        <DemoCard
          index={7}
          title="The timestamp"
          changed="A machine timestamp makes a person do the arithmetic. 'Two hours ago' is read at a glance, with the exact time kept right beneath it for the moment precision actually matters."
          mode={mode}
          reduce={reduce}
          plain={<PlainDate />}
          considered={<ConsideredDate />}
        />
        <DemoCard
          index={8}
          title="The destructive action"
          changed="A bare Delete is one slip from gone. The considered version adds the one moment of friction that matters: it asks, names exactly what is at stake, and puts the safe choice first — so the undo is never needed."
          mode={mode}
          reduce={reduce}
          plain={<PlainConfirm />}
          considered={<ConsideredConfirm reduce={reduce} />}
        />
        <DemoCard
          index={9}
          title="The save confirmation"
          changed="A flat word that never leaves tells you almost nothing. The considered version confirms with a toast that steps in, keeps an Undo within reach, and steps back out on its own once it has been read — feedback that respects both your attention and your mistakes."
          mode={mode}
          reduce={reduce}
          plain={<PlainSave />}
          considered={<ConsideredSave reduce={reduce} />}
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
