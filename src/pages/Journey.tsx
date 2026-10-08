import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { JourneyPath, type JourneyStep } from '../components/JourneyPath'
import { Seo } from '../components/Seo'
import { EMAIL } from '../data/contact'

const EASE = [0.16, 1, 0.3, 1] as const

// The through-line, not a résumé. Every waypoint below is an established fact or
// an honest line about how the work actually gets made — nothing dated,
// nothing invented. Guided is one node among several by design: the page is
// about the person and the practice, not any single project.
const STEPS: JourneyStep[] = [
  {
    tag: 'Start',
    title: 'Learned by building',
    body: (
      <>
        There was never much of a plan, more a habit: pick something, try to
        build it, and find out what I did not know yet. Most of what I can do I
        picked up that way — in code, by making the thing and watching where it
        broke.
      </>
    ),
  },
  {
    tag: 'Range',
    title: 'Across the whole stack',
    body: (
      <>
        Frontend in React and TypeScript, native in SwiftUI, the backend and
        data model underneath, and applied AI woven through the middle. Holding
        every layer is what keeps the seams invisible and a product coherent.
      </>
    ),
    to: '/range',
    toLabel: 'Explore the range',
  },
  {
    tag: 'Guided',
    title: 'Co-founded a Socratic tutor',
    body: (
      <>
        Guided is an AI tutor that asks the questions a good teacher would
        instead of handing over the answer. I co-founded it and build across the
        stack. It matters to me, and it is still only one project, not the whole
        story.
      </>
    ),
    to: '/work/guided',
    toLabel: 'Read the case study',
  },
  {
    tag: 'Berlin',
    title: 'A desk, and the light outside it',
    body: (
      <>
        The work gets made from Berlin, a little most days. It is the most human
        part of the honest answer to where the work comes from: a person, a
        place, and a habit of shipping small and often.
      </>
    ),
    to: '/berlin',
    toLabel: 'See the city, live',
  },
  {
    tag: 'Student',
    title: 'Still learning, on purpose',
    body: (
      <>
        I am still a student, and I would keep the habit even if I were not. The
        day the learning stops is the day the work goes stale, so I treat every
        project as a reason to pick up one more thing I could not do before.
      </>
    ),
  },
  {
    tag: 'In the open',
    title: 'Shipping small, in public',
    body: (
      <>
        This site is open source and grows most days, one coherent improvement
        at a time. The commit history is part of the work — the process is meant
        to be as visible as the result.
      </>
    ),
    to: '/changelog',
    toLabel: 'Read the build log',
  },
]

// The /journey page — the arc of how the work gets made, drawn as a path you
// walk by scrolling. Deliberately de-centres any one project: it is the person
// and the practice, with Guided as a single waypoint among several.
export default function Journey() {
  return (
    <>
      <Seo
        title="The way here"
        description="The through-line of how Arseniy Cherednichenko works and got to now — learning by building, across the whole stack, co-founding Guided, from a desk in Berlin, in the open. An honest path, no dates, no invented history."
      />

      {/* HERO */}
      <header className="mx-auto w-full max-w-4xl px-6 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>The way here</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl"
        >
          A path, not a <GradientText>résumé</GradientText>.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease: EASE }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-white/55"
        >
          Not a timeline of titles and dates, but the honest through-line: how
          the work actually gets made, and the few waypoints that shaped it.
          Scroll, and the path draws itself.
        </motion.p>
      </header>

      {/* THE PATH */}
      <section className="mx-auto w-full max-w-4xl px-6 py-20 sm:py-28">
        <JourneyPath steps={STEPS} />
      </section>

      {/* CLOSE */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-28">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              That is the shape of it.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">
              A person who learns by building, works across the stack, and ships
              in the open from Berlin. If any of that is useful to you, the next
              step is easy.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={`mailto:${EMAIL}`}
                className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Say hello
              </a>
              <Link
                to="/work"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-[#DCF87C]/60 hover:text-white"
              >
                See the work
              </Link>
              <Link
                to="/now"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-[#DCF87C]/60 hover:text-white"
              >
                What I am on now
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
