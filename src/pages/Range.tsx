import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { MagneticButton } from '../components/MagneticButton'
import { Seo } from '../components/Seo'
import { DISCIPLINES } from '../data/range'

const EASE = [0.16, 1, 0.3, 1] as const

// /range — the breadth of what Arseniy builds, framed as disciplines instead of
// one product. The centrepiece is an index/detail explorer: a vertical list of
// disciplines drives an animated detail panel, so the page reads as a body of
// craft that no single project carries. Deep-linkable (#frontend, #ios, …),
// keyboard-operable, and reduced-motion aware.

// Resolve the discipline index from a URL hash like "#ios"; -1 when absent.
function indexFromHash(hash: string): number {
  const id = hash.replace(/^#/, '')
  return DISCIPLINES.findIndex((d) => d.id === id)
}

export default function Range() {
  const reduce = useReducedMotion()
  const { hash } = useLocation()
  const [active, setActive] = useState(() => {
    const i = indexFromHash(hash)
    return i >= 0 ? i : 0
  })

  // Keep the panel in sync when someone lands on or navigates to a deep link.
  useEffect(() => {
    const i = indexFromHash(hash)
    if (i >= 0) setActive(i)
  }, [hash])

  const select = (i: number) => {
    setActive(i)
    // Reflect the choice in the URL without a scroll jump, so it is shareable.
    if (typeof history !== 'undefined') {
      history.replaceState(null, '', `#${DISCIPLINES[i].id}`)
    }
  }

  const current = DISCIPLINES[active]

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-32 pt-36 sm:pt-44">
      <Seo
        title="Range"
        description="More than one project — the disciplines Arseniy works across: frontend, native iOS, backend and data, applied AI, and motion design."
      />

      {/* HEADER */}
      <header className="max-w-3xl">
        <Reveal>
          <Eyebrow>Range</Eyebrow>
        </Reveal>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
          <SplitText text="More than" trigger="mount" />{' '}
          <GradientText>one project.</GradientText>
        </h1>
        <Reveal delay={0.1}>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/55">
            Guided is what I am building, but it is not the whole of what I do. The
            through-line is the craft; these are the disciplines it moves through.
            Pick one.
          </p>
        </Reveal>
      </header>

      {/* EXPLORER */}
      <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-12">
        {/* Index — the list that drives the panel. */}
        <Reveal delay={0.05}>
          <ul className="flex flex-col gap-1" role="tablist" aria-label="Disciplines">
            {DISCIPLINES.map((d, i) => {
              const on = i === active
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => select(i)}
                    className="group relative flex w-full items-baseline gap-4 rounded-2xl px-4 py-4 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    {on && (
                      <motion.span
                        layoutId="range-rail"
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[#DCF87C]"
                        transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
                      />
                    )}
                    <span
                      aria-hidden
                      className={`w-6 shrink-0 font-display text-sm tabular-nums transition-colors ${
                        on ? 'text-[#DCF87C]' : 'text-white/25 group-hover:text-white/45'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block font-display text-xl font-semibold tracking-tight transition-colors ${
                          on ? 'text-white' : 'text-white/60 group-hover:text-white/85'
                        }`}
                      >
                        {d.label}
                      </span>
                      <span
                        className={`block text-sm leading-snug transition-colors ${
                          on ? 'text-white/45' : 'text-white/30'
                        }`}
                      >
                        {d.headline}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </Reveal>

        {/* Detail — the animated panel for the selected discipline. */}
        <Reveal delay={0.1}>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
            {/* A soft lime wash anchored top-right, quiet behind the copy. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#DCF87C]/[0.06] blur-3xl"
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: reduce ? 0.15 : 0.4, ease: EASE }}
                className="relative"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
                  {current.label}
                </span>
                <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  {current.headline}
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">
                  {current.body}
                </p>

                <div className="mt-8">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
                    What that looks like
                  </span>
                  <ul className="mt-4 space-y-3">
                    {current.does.map((item, i) => (
                      <motion.li
                        key={item}
                        initial={reduce ? false : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: reduce ? 0 : 0.1 + i * 0.06, ease: EASE }}
                        className="flex gap-3 text-white/70"
                      >
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#DCF87C]/70" />
                        <span className="leading-relaxed">{item}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  {current.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/55"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                {current.seeAlso && (
                  <Link
                    to={current.seeAlso.to}
                    className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
                  >
                    {current.seeAlso.label}
                    <span aria-hidden>-&gt;</span>
                  </Link>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>

      {/* CLOSER */}
      <section className="mt-28 border-t border-white/10 pt-16 text-center">
        <Reveal>
          <p className="mx-auto max-w-2xl font-display text-2xl font-medium leading-snug text-white/80 sm:text-3xl">
            The disciplines change. The care does not.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <MagneticButton>
              <Link
                to="/work"
                className="inline-flex rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition hover:brightness-105"
              >
                See the work
              </Link>
            </MagneticButton>
            <Link
              to="/about"
              className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              More about me
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
