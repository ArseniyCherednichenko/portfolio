import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { Reveal } from '../components/Reveal'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { MagneticButton } from '../components/MagneticButton'
import { Aurora } from '../components/Aurora'
import { SiteGraph } from '../components/SiteGraph'
import { useContact } from '../components/ContactDialog'
import { CONTENTS } from '../data/contents'

const EASE = [0.16, 1, 0.3, 1] as const

// Atlas (/atlas) — the whole site as a living constellation.
//
// The site grew wide: many pages across many sections. Where /contents lists
// them and the library catalogues the components, this page shows the *shape* of
// the site — a real force-directed map where every section is a hub and every
// page a star orbiting it, all radiating from one centre. It is the strongest
// structural way to say the thing the site keeps saying in words: one project is
// a single star among many. Guided is a leaf on this map, not the middle.
//
// The map is built from the same CONTENTS source the index reads, so the two can
// never drift.
export default function Atlas() {
  const { open: openContact } = useContact()

  const sections = useMemo(
    () =>
      CONTENTS.map((s) => ({
        label: s.label,
        intro: s.intro,
        leaves: s.entries.map((e) => ({ to: e.to, title: e.title, blurb: e.blurb })),
      })),
    [],
  )

  const pageCount = useMemo(() => sections.reduce((n, s) => n + s.leaves.length, 0), [sections])

  return (
    <>
      <Seo
        title="Atlas"
        description="A living map of the whole site — every section a hub, every page a star orbiting it, all radiating from one centre. Drag the nodes, follow one to open it."
      />

      {/* HERO */}
      <header className="relative isolate overflow-hidden pb-10 pt-36 sm:pt-44">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-55 [mask-image:radial-gradient(ellipse_at_50%_28%,black,transparent_72%)]"
        >
          <Aurora />
        </div>
        <div className="mx-auto w-full max-w-4xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <Eyebrow>Atlas</Eyebrow>
          </motion.div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
            <SplitText as="span" text="The shape" trigger="mount" delay={0.1} className="block" />
            <SplitText as="span" text="of the site." gradient trigger="mount" delay={0.3} className="block" />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
            className="mt-7 max-w-xl text-lg leading-relaxed text-white/60"
          >
            Every page as a star, clustered into sections around a single centre. It is the site seen
            all at once — proof it is a whole publication, not one project with a landing page. Drag a
            star to pull the sky around; follow one to open it.
          </motion.p>
        </div>
      </header>

      {/* THE MAP */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <Reveal>
          <SiteGraph sections={sections} />
        </Reveal>
      </section>

      {/* NUMBERS — the breadth, stated plainly. */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-24">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center sm:p-14">
            <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-white/85 sm:text-3xl">
              <AnimatedCounter value={pageCount} className="text-[#DCF87C]" /> pages across{' '}
              <AnimatedCounter value={sections.length} className="text-[#DCF87C]" />{' '}
              <GradientText>sections.</GradientText>
            </p>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-white/55">
              A story, a body of work, notes on craft, words, ways to reach me, and the site turned
              inside out for the curious. One project is a single star in all of that — which is
              exactly the point.
            </p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-32">
        <Reveal>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
              Prefer it as a list?
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/contents"
                className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition-transform hover:-translate-y-0.5"
              >
                The index
              </Link>
              <MagneticButton
                onClick={openContact}
                className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                Get in touch
              </MagneticButton>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
