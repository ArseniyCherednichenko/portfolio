import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { Accordion, type AccordionItem } from '../components/Accordion'
import { Threads } from '../components/Threads'
import { Seo } from '../components/Seo'
import { useContact } from '../components/ContactDialog'
import { ANSWER_COUNT } from '../data/answers'

const EASE = [0.16, 1, 0.3, 1] as const

// A small link that matches the site's lime, used inside answer bodies.
function A({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-[#DCF87C] underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}

// The answer bodies live here as JSX so they can carry real links into the
// rest of the site. Every line is honest: co-founder of Guided, Berlin,
// student, full-stack builder — no invented clients, numbers, or promises.
const ITEMS: AccordionItem[] = [
  {
    q: 'Who are you, in one line?',
    a: (
      <>
        Arseniy Cherednichenko — I co-founded <A to="/work/guided">Guided</A>,
        build across the whole stack, and I am still a student. Berlin-based,
        happiest with an interface half-finished and a hard problem underneath
        it.
      </>
    ),
  },
  {
    q: 'What do you actually do?',
    a: (
      <>
        Design and build software end to end: the React and TypeScript web
        interface, a native iOS app in SwiftUI, and the Supabase backend and
        data model underneath. The <A to="/toolkit">toolkit</A> is the short
        version; the point is that I hold every layer, so the seams stay
        invisible.
      </>
    ),
  },
  {
    q: 'Guided keeps coming up — what is it?',
    a: (
      <>
        A Socratic AI tutor that asks the questions that build understanding
        instead of handing over answers, curriculum-aware for the Abitur, IB,
        and GCSE. I co-founded it and build across the whole thing — but it is
        one project, not the whole story. The rest of the{' '}
        <A to="/work">work</A> and the <A to="/playground">playground</A> are
        just as much me.
      </>
    ),
  },
  {
    q: 'You are a student and a founder at once?',
    a: (
      <>
        Yes, and I would not trade either. School keeps me learning things I
        would never reach for on my own; building Guided is where I find out
        which of them actually hold up. The overlap is tight, but shipping a
        real product next to coursework has taught me more about focus than
        either could alone.
      </>
    ),
  },
  {
    q: 'Why so much motion on a portfolio?',
    a: (
      <>
        Because motion is part of the craft I am showing, not decoration on top
        of it. Every animation here is a hand-built component, tuned for timing
        and weight, and every one respects{' '}
        <span className="text-white/80">prefers-reduced-motion</span> — turn
        that on and the site goes calm and still. Motion that does not earn its
        place gets cut.
      </>
    ),
  },
  {
    q: 'Did you use a template or a UI kit?',
    a: (
      <>
        No. No template, no component library, no UI kit — every piece is built
        by hand in React, TypeScript, and Tailwind. The{' '}
        <A to="/colophon">colophon</A> lays out exactly how it is made and links
        straight to the source, so you can check.
      </>
    ),
  },
  {
    q: 'Frontend, backend, native — really all of it?',
    a: (
      <>
        Really. Frontend is where most of my interface work lives, but I am just
        as at home in a SwiftUI view, an auth flow, or a Supabase schema. Owning
        the full stack is not a boast — it is how a small team keeps a product
        coherent when web and native have to agree on everything.
      </>
    ),
  },
  {
    q: 'Where are you based, and does it matter?',
    a: (
      <>
        Berlin. It matters in the ordinary ways — the timezone I answer email
        in, the pace I like to work at — more than the romantic ones. What I am
        focused on this week is always on the <A to="/now">now</A> page, kept
        current by hand.
      </>
    ),
  },
  {
    q: 'What do you care about in the work?',
    a: (
      <>
        That it feels right, and that it is honest. The slow part — the timing of
        a transition, the weight of a heading, the spacing between things — is
        where the craft actually lives, and I would rather ship one thing that
        feels finished than five that do not. Nothing on this site is faked or
        padded to look bigger than it is.
      </>
    ),
  },
  {
    q: 'How do we work together?',
    a: (
      <>
        The fastest way is to just say hello — I read everything. If a problem
        is interesting and the people are good, I want to hear about it. Reach
        me on the <A to="/contact">contact</A> page, or press{' '}
        <span className="text-white/80">g</span> then{' '}
        <span className="text-white/80">c</span> from anywhere on the site.
      </>
    ),
  },
]

// The /answers page: the questions people actually ask, answered plainly in
// Arseniy's own voice. A disclosure list on the shared Accordion, framed by a
// Threads ambient field. It de-centers Guided by design — most answers pull the
// reader outward into the rest of the site rather than back to one project.
export default function Answers() {
  const reduce = useReducedMotion()
  const { open } = useContact()

  return (
    <>
      <Seo
        title="Answers"
        description="The questions people actually ask Arseniy Cherednichenko — who he is, what he builds, and how to work together — answered plainly and honestly."
      />

      {/* HEADER */}
      <header className="relative isolate mx-auto w-full max-w-4xl overflow-hidden px-6 pb-10 pt-36 sm:pt-44">
        {/* Ambient thread field, radial-masked to the top-right so it never
            fights the left-aligned copy. This page had no ambient motion. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(120%_80%_at_80%_12%,#000_0%,transparent_66%)]"
        >
          <Threads count={11} amplitude={10} />
        </div>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Answers</Eyebrow>
        </motion.div>
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          The questions <GradientText>people ask</GradientText>.
        </motion.h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          No form to fill in, no back-and-forth. Here are the {ANSWER_COUNT}{' '}
          questions I get asked most, answered the way I would answer them in
          person — plainly, and without dressing anything up.
        </motion.p>
      </header>

      {/* Q&A */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-8">
        <Reveal>
          <Accordion items={ITEMS} defaultOpen={0} />
        </Reveal>
      </section>

      {/* STILL WONDERING */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-8">
        <Reveal>
          <p className="max-w-xl text-sm leading-relaxed text-white/40">
            Something not here? That is the most interesting kind of question.
            Ask it directly — I would rather answer the real thing than guess at
            it.
          </p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Reveal>
          <h2 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
            Still
            <br />
            wondering?
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={open}
              className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black transition hover:brightness-105"
            >
              Ask me directly
            </button>
            <Link
              to="/work"
              className="rounded-full border border-white/15 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-white/[0.06]"
            >
              See the work
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  )
}
