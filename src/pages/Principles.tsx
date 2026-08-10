import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { ScrollReveal } from '../components/ScrollReveal'
import { Seo } from '../components/Seo'
import { PRINCIPLES, PRINCIPLE_COUNT } from '../data/principles'

const EASE = [0.16, 1, 0.3, 1] as const

// Tracks which principle is currently in view, so the sticky spine can mark the
// reader's place. One IntersectionObserver over all the section anchors; the
// entry nearest the vertical middle of the viewport wins. Purely presentational
// — the page reads fine without it, and it never moves focus or scrolls.
function useActivePrinciple(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0] ?? '')
  useEffect(() => {
    const seen = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio)
        let best = active
        let bestRatio = -1
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = id
          }
        }
        if (bestRatio > 0) setActive(best)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.5, 1] },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')])
  return active
}

// The sticky index that rides the left margin on wide screens — the manifesto's
// spine. Each row is a real in-page link to its principle; the active one lights
// lime and stretches its rule. lg-only so it never crowds the reading column.
function Spine({ active }: { active: string }) {
  return (
    <nav
      aria-label="Principles"
      className="sticky top-32 hidden max-h-[70vh] flex-col gap-1 lg:flex"
    >
      <span className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/35">
        {PRINCIPLE_COUNT} beliefs
      </span>
      {PRINCIPLES.map((p) => {
        const on = p.id === active
        return (
          <a
            key={p.id}
            href={`#${p.id}`}
            className="group flex items-center gap-3 py-1.5 text-sm transition-colors"
          >
            <span
              className={`h-px transition-all duration-300 ${
                on ? 'w-8 bg-[#DCF87C]' : 'w-4 bg-white/20 group-hover:w-6 group-hover:bg-white/40'
              }`}
            />
            <span
              className={`tabular-nums transition-colors ${
                on ? 'text-[#DCF87C]' : 'text-white/35 group-hover:text-white/70'
              }`}
            >
              {p.n}
            </span>
            <span
              className={`truncate transition-colors ${
                on ? 'text-white/85' : 'text-white/35 group-hover:text-white/70'
              }`}
            >
              {p.title.replace(/\.$/, '')}
            </span>
          </a>
        )
      })}
    </nav>
  )
}

// One principle: a huge ghost numeral behind the credo, the credo itself set in
// the display serif, a one-line lede, the honest body that assembles under the
// scroll, and a link to where the belief actually holds up on the site.
function PrincipleBlock({ index }: { index: number }) {
  const p = PRINCIPLES[index]
  return (
    <section
      id={p.id}
      className="relative scroll-mt-28 border-t border-white/10 py-16 first:border-t-0 sm:py-20"
    >
      {/* Ghost numeral — decorative, so it is hidden from assistive tech. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-4 right-0 select-none font-display text-[7rem] font-bold leading-none tracking-tight text-white/[0.04] sm:text-[10rem]"
      >
        {p.n}
      </span>
      <div className="relative max-w-2xl">
        <span className="text-sm font-semibold uppercase tracking-[0.24em] text-[#DCF87C]/70">
          {p.n}
        </span>
        <h2 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          <SplitText as="span" text={p.title} gradient />
        </h2>
        <p className="mt-5 font-display text-xl font-medium leading-snug text-white/80 sm:text-2xl">
          {p.lede}
        </p>
        <ScrollReveal className="mt-5 text-lg leading-relaxed text-white/55">
          {p.body}
        </ScrollReveal>
        <Reveal delay={0.05}>
          <Link
            to={p.evidence.to}
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            {p.evidence.label}
            <span aria-hidden>-&gt;</span>
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

// The /principles page: a manifesto of how I actually build. This is the belief
// layer under the whole site — About states it as story, Ethos as a single
// line, Craft demonstrates it in motion; here it is set down plainly, eight
// principles, each linked to where it holds up in the real work. Honest only:
// nothing here is claimed that is not already lived out elsewhere on the site.
export default function Principles() {
  const reduce = useReducedMotion()
  const ids = PRINCIPLES.map((p) => p.id)
  const active = useActivePrinciple(ids)

  return (
    <>
      <Seo
        title="Principles"
        description="How Arseniy Cherednichenko actually builds — eight working beliefs behind the whole site, from starting with the problem to staying honest. A manifesto, each principle linked to where it holds up in the real work."
      />

      {/* HEADER */}
      <header className="mx-auto w-full max-w-4xl px-6 pb-8 pt-36 sm:pt-44">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Principles</Eyebrow>
        </motion.div>
        <h1 className="mt-6 font-display text-6xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
          <SplitText as="span" text="How I" trigger="mount" delay={0.1} className="block" />
          <SplitText as="span" text="build." gradient trigger="mount" delay={0.28} className="block" />
        </h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/55"
        >
          The beliefs under everything here. About tells the story, the home page
          says it in a line, the Playground shows it moving — this is the same
          thing set down plainly. Eight principles, each linked to where it holds
          up in the real work.
        </motion.p>
      </header>

      {/* MANIFESTO — sticky spine beside the reading column */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-x-12 px-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <Spine active={active} />
        </div>
        <div>
          {PRINCIPLES.map((_, i) => (
            <PrincipleBlock key={ids[i]} index={i} />
          ))}
        </div>
      </div>

      {/* CLOSE */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <p className="mx-auto max-w-2xl font-display text-2xl font-medium leading-snug text-white/80 sm:text-3xl">
            <GradientText>Principles are cheap;</GradientText> the proof is in the
            work they produce.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/work"
              className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition-colors hover:bg-[#e6ff8f]"
            >
              See the work
            </Link>
            <Link
              to="/about"
              className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              The longer story
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
