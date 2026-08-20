import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { TrueFocus } from '../components/TrueFocus'
import { SpotlightCard } from '../components/SpotlightCard'
import { MagneticButton } from '../components/MagneticButton'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Aurora } from '../components/Aurora'
import { useContact } from '../components/ContactDialog'
import { Seo } from '../components/Seo'
import { DISCIPLINES, DISCIPLINE_COUNT } from '../data/disciplines'

const EASE = [0.16, 1, 0.3, 1] as const

// The detail panel for whichever discipline is selected. Cross-fades and lifts
// as the selection changes; under reduced motion it swaps instantly.
function DisciplineDetail({ index }: { index: number }) {
  const reduce = useReducedMotion()
  const d = DISCIPLINES[index]
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={d.id}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="flex h-full flex-col p-8 sm:p-10"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#DCF87C]">{d.tag}</p>
        <h3 className="mt-4 font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl">
          {d.title}
        </h3>
        <p className="mt-3 text-lg text-white/70">{d.lede}</p>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/55">{d.body}</p>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">In practice</p>
          <ul className="mt-4 space-y-2.5">
            {d.practices.map((p, i) => (
              <motion.li
                key={p}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: 0.08 + i * 0.06 }}
                className="flex items-start gap-3 text-sm leading-relaxed text-white/70"
              >
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#DCF87C]" />
                {p}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">Reached for</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.tools.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/70"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-8">
          <Link
            to={`/range/${d.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-80"
          >
            Open this discipline
            <span aria-hidden>-&gt;</span>
          </Link>
          <Link
            to={d.evidence.to}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            {d.evidence.label}
            <span aria-hidden>-&gt;</span>
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function Range() {
  const { open: openContact } = useContact()
  const [active, setActive] = useState(0)

  // Arrow-key navigation across the discipline list, so the explorer is fully
  // keyboard-drivable, not just clickable.
  function onListKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      setActive((i) => (i + 1) % DISCIPLINES.length)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setActive((i) => (i - 1 + DISCIPLINES.length) % DISCIPLINES.length)
    }
  }

  return (
    <>
      <Seo
        title="The range"
        description="The disciplines Arseniy Cherednichenko works across — frontend, native iOS, backend, applied AI, and motion. One product, but the craft spans the whole stack."
      />

      {/* HERO */}
      <header className="relative isolate overflow-hidden pb-16 pt-36 sm:pt-44">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_72%)]"
        >
          <Aurora />
        </div>
        <div className="mx-auto w-full max-w-4xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <Eyebrow>Range</Eyebrow>
          </motion.div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
            <SplitText as="span" text="More than" trigger="mount" delay={0.1} className="block" />
            <SplitText as="span" text="one project." gradient trigger="mount" delay={0.3} className="block" />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
            className="mt-7 max-w-xl text-lg leading-relaxed text-white/60"
          >
            Guided is what I am building, but it is not the whole of what I do. I work across the stack
            and across disciplines — and the constant underneath all of them is the craft, not the
            product.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
            className="mt-9"
          >
            <TrueFocus
              words={DISCIPLINES.map((d) => d.tag)}
              className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl"
            />
          </motion.div>
        </div>
      </header>

      {/* EXPLORER */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
          {/* Discipline selector — a keyboard-navigable list with a springing
              lime marker on the active row. */}
          <div
            role="tablist"
            aria-label="Disciplines"
            aria-orientation="vertical"
            tabIndex={0}
            onKeyDown={onListKey}
            className="flex flex-col gap-1.5 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40 lg:sticky lg:top-28 lg:self-start"
          >
            {DISCIPLINES.map((d, i) => {
              const isActive = i === active
              return (
                <button
                  key={d.id}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  onClick={() => setActive(i)}
                  className="relative flex items-center gap-4 rounded-2xl px-4 py-4 text-left transition-colors"
                >
                  {isActive && (
                    <motion.span
                      layoutId="range-active"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-2xl border border-[#DCF87C]/25 bg-white/[0.05]"
                    />
                  )}
                  <span
                    aria-hidden
                    className={`font-display text-sm font-bold tabular-nums transition-colors ${
                      isActive ? 'text-[#DCF87C]' : 'text-white/30'
                    }`}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-base font-semibold transition-colors ${
                        isActive ? 'text-white' : 'text-white/60'
                      }`}
                    >
                      {d.tag}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/40">{d.lede}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Detail panel. */}
          <SpotlightCard className="min-h-[34rem]">
            <DisciplineDetail index={active} />
          </SpotlightCard>
        </div>
      </section>

      {/* THE CONSTANT — a small statement band that ties it together. */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-24">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center sm:p-14">
            <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-white/85 sm:text-3xl">
              <AnimatedCounter value={DISCIPLINE_COUNT} className="text-[#DCF87C]" /> disciplines,{' '}
              <GradientText>one craft.</GradientText>
            </p>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/55">
              I would rather be a builder who can carry an idea from a data model to the last frame of an
              animation than a specialist who has to hand it off four times. The range is the point.
            </p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-32">
        <Reveal>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
              Have something that spans a few of these?
            </h2>
            <div className="flex flex-wrap gap-3">
              <MagneticButton
                onClick={openContact}
                className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black"
              >
                Get in touch
              </MagneticButton>
              <Link
                to="/work"
                className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                See the work
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
