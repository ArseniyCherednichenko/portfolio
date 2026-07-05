import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { MagneticButton } from '../components/MagneticButton'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Beams } from '../components/Beams'
import { Seo } from '../components/Seo'
import { TOOLKIT, TOOL_COUNT, type Tool } from '../data/toolkit'

const EASE = [0.16, 1, 0.3, 1] as const

// One tool: a spotlight card with the name, a hover-reactive index, and an
// honest note on where it fits into the work.
function ToolCard({ tool }: { tool: Tool }) {
  return (
    <SpotlightCard className="h-full">
      <div className="flex h-full flex-col p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xl font-bold tracking-tight transition-transform duration-500 ease-out group-hover:translate-x-1">
            {tool.name}
          </h3>
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 translate-y-[-2px] rounded-full bg-white/15 transition-colors duration-300 group-hover:bg-[#DCF87C]"
          />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{tool.note}</p>
      </div>
    </SpotlightCard>
  )
}

export default function Toolkit() {
  const reduce = useReducedMotion()

  return (
    <>
      <Seo
        title="Toolkit"
        description="The languages, frameworks, and tools Arseniy Cherednichenko builds with — and an honest note on where each one fits."
      />
      {/* INTRO */}
      <header className="relative isolate overflow-hidden pb-12 pt-36 sm:pt-44">
        {/* Light shafts drifting behind the title — this page's ambient layer,
            radial-masked so it fades into the dark and never fights the copy. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_at_50%_35%,black,transparent_75%)]"
        >
          <Beams />
        </div>
        <div className="mx-auto w-full max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Toolkit</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          What I build <GradientText>with.</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          Not a wall of logos. A short, honest list of the tools I actually reach for, across the web, native iOS,
          and the design that comes first. Each one earns its place.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-10 flex items-end gap-3"
        >
          <AnimatedCounter
            value={TOOL_COUNT}
            className="text-5xl font-bold leading-none text-[#DCF87C] sm:text-6xl"
          />
          <span className="pb-1 text-sm leading-snug text-white/45">
            tools I use
            <br />
            day to day
          </span>
        </motion.div>
        </div>
      </header>

      {/* GROUPS */}
      <div className="mx-auto w-full max-w-4xl px-6 pb-8">
        {TOOLKIT.map((group, gi) => (
          <section key={group.label} className="border-t border-white/10 py-12 sm:py-16">
            <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
              <div className="md:sticky md:top-28 md:self-start">
                <Reveal>
                  <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{group.label}</h2>
                </Reveal>
                <Reveal delay={0.05}>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/45">{group.blurb}</p>
                </Reveal>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2">
                {group.tools.map((tool, ti) => (
                  <motion.li
                    key={tool.name}
                    initial={reduce ? false : { opacity: 0, y: 22 }}
                    whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.5, ease: EASE, delay: Math.min(ti * 0.06, 0.24) }}
                    className="h-full"
                  >
                    <ToolCard tool={tool} />
                  </motion.li>
                ))}
              </ul>
            </div>
            <span className="sr-only">{`Group ${gi + 1} of ${TOOLKIT.length}`}</span>
          </section>
        ))}
        <div className="border-t border-white/10" />
      </div>

      {/* HONEST NOTE */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-8">
        <Reveal>
          <p className="max-w-xl text-sm leading-relaxed text-white/40">
            Tools are just tools. I care far more about whether a thing feels right than about the stack it was made
            with, and I will pick up whatever a project actually needs.
          </p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
            See it
            <br />
            in motion.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/work"
              className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black transition hover:brightness-105"
            >
              See the work
            </Link>
            <Link
              to="/playground"
              className="rounded-full border border-white/15 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              Playground
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-8 flex justify-center">
            <MagneticButton
              href="mailto:ars7ars3@gmail.com"
              className="text-sm font-medium text-white/45 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
            >
              Or get in touch
            </MagneticButton>
          </div>
        </Reveal>
      </section>
    </>
  )
}
