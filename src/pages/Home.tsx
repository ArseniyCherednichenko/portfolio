import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { GlassSurface } from '../components/GlassSurface'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { ProjectPoster } from '../components/ProjectPoster'
import { GlareHover } from '../components/GlareHover'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { RotatingWord } from '../components/RotatingWord'
import { SpotlightCard } from '../components/SpotlightCard'
import { Marquee } from '../components/Marquee'
import { HorizontalScroll, type HPanel } from '../components/HorizontalScroll'
import { ScrollStack, type ScrollStackCard } from '../components/ScrollStack'
import { CircularGallery, type GalleryItem } from '../components/CircularGallery'
import { TrueFocus } from '../components/TrueFocus'
import { SpotlightReveal } from '../components/SpotlightReveal'
import { ScrollVelocity } from '../components/ScrollVelocity'
import { FlowingMenu, type FlowingItem } from '../components/FlowingMenu'
import { MagneticButton } from '../components/MagneticButton'
import { HeroOrbit } from '../components/HeroOrbit'
import { CircularText } from '../components/CircularText'
import { MagnetLines } from '../components/MagnetLines'
import { ScrollCue } from '../components/ScrollCue'
import { Eyebrow } from '../components/Eyebrow'
import { SectionNav } from '../components/SectionNav'
import { useContact } from '../components/ContactDialog'
import { Seo } from '../components/Seo'
import { PROJECTS, SKILLS, type Project } from '../data/projects'

const EASE = [0.16, 1, 0.3, 1] as const

const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'about', label: 'About' },
  { id: 'range', label: 'Range' },
  { id: 'process', label: 'Process' },
  { id: 'ethos', label: 'Ethos' },
  { id: 'work', label: 'Work' },
  { id: 'playground', label: 'Playground' },
  { id: 'toolkit', label: 'Toolkit' },
  { id: 'explore', label: 'Explore' },
  { id: 'contact', label: 'Contact' },
]

// The site is more than its home page. These rows foreground the breadth of
// what is here, so no single project carries the whole story.
const EXPLORE: FlowingItem[] = [
  { label: 'Work', to: '/work', hint: 'Case studies' },
  { label: 'Range', to: '/range', hint: 'Disciplines' },
  { label: 'About', to: '/about', hint: 'Who I am' },
  { label: 'Playground', to: '/playground', hint: 'Live motion' },
  { label: 'On motion', to: '/craft', hint: 'Craft, playable' },
  { label: 'Writing', to: '/writing', hint: 'Notes, in progress' },
  { label: 'Toolkit', to: '/toolkit', hint: 'What I build with' },
  { label: 'Contact', to: '/contact', hint: 'Say hello' },
]

// How I actually build — an honest process, not a single project. Frames the
// craft that carries across everything, de-centering any one piece of work.
const PROCESS: ScrollStackCard[] = [
  {
    tag: '01 · Understand',
    title: 'Start with the problem',
    body: 'Before a single screen, I get clear on what someone actually needs. Often the best interface is the one you find a way not to build.',
  },
  {
    tag: '02 · Shape',
    title: 'Prototype in the real thing',
    body: 'I sketch fast, and in code. Motion and feel are hard to judge on paper, so I get a rough version moving early and let it tell me what is wrong.',
  },
  {
    tag: '03 · Build',
    title: 'Own the whole stack',
    body: 'Frontend, backend, native, and the data underneath. Holding every layer keeps the seams invisible and the product coherent.',
  },
  {
    tag: '04 · Refine',
    title: 'Sweat the small moments',
    body: 'Then the slow part: the timing of a transition, the weight of a heading, the spacing between things. This is where the craft actually lives.',
  },
  {
    tag: '05 · Ship',
    title: 'Get it in front of people',
    body: 'Real products beat perfect plans. I ship, watch how it is used, and keep refining in the open, a little at a time.',
  },
]

// The breadth of what I actually build. Honest disciplines, not a single project.
const RANGE: HPanel[] = [
  {
    tag: 'Frontend',
    title: 'Interfaces that feel right',
    body: 'React and TypeScript, with motion that earns its place. The part people touch, and the part they feel.',
  },
  {
    tag: 'Native iOS',
    title: 'At home on the device',
    body: 'SwiftUI apps that behave like they belong, sharing one backend with the web so nothing drifts.',
  },
  {
    tag: 'Backend and data',
    title: 'The part you never see',
    body: 'Supabase, auth, and the data model underneath, keeping web and native honest with each other.',
  },
  {
    tag: 'Applied AI',
    title: 'Building with models, not around them',
    body: 'AI woven into real products. With Guided that means asking the right question instead of handing over the answer.',
  },
  {
    tag: 'Motion and design',
    title: 'Craft in the small moments',
    body: 'The typography, the timing, the spacing between things. Hand-built, never templated, always reduced-motion aware.',
  },
]

// A taste of the Playground, foregrounded on the home page so the site reads as
// a body of craft, not one project. Each card leads into a real category there.
const FEATURED: GalleryItem[] = [
  {
    tag: 'Type in motion',
    title: 'Text that assembles',
    body: 'Split-character reveals, decrypting glyphs, cursor-pressure display type. Headlines that arrive with intent.',
    to: '/playground#type',
    cta: 'See type',
  },
  {
    tag: 'Surfaces',
    title: 'Cards that respond',
    body: 'Spotlight glows, real 3D tilt, pixel dissolves. Surfaces that lean toward the cursor as you move.',
    to: '/playground#cards',
    cta: 'See surfaces',
  },
  {
    tag: 'Fields',
    title: 'Fields that follow',
    body: 'Gooey metaballs, a magnetic needle grid, a pointer heat-trail that ignites and cools in your wake.',
    to: '/playground#fields',
    cta: 'See fields',
  },
  {
    tag: 'Scroll',
    title: 'Tied to the scroll',
    body: 'Sticky stacking decks, a pinned section that travels sideways, word-by-word scroll reveals.',
    to: '/playground#scroll',
    cta: 'See scroll',
  },
  {
    tag: 'Controls',
    title: 'Controls with feel',
    body: 'Magnetic buttons, a liquid tab switcher, a magnifying macOS dock. Inputs worth reaching for.',
    to: '/playground#controls',
    cta: 'See controls',
  },
]

// A live glass chip anchored in the hero — refracts the orbit drifting behind
// it and shows the honest local time, so the page opens feeling present. lg-only
// so it never crowds the mobile hero; balances the scroll seal opposite it.
function HeroStatus() {
  const { time, awake } = useBerlinTime()
  const reduce = useReducedMotion()
  return (
    <GlassSurface radius={20} className="w-[15rem] p-4" tint="rgba(255,255,255,0.05)">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {awake && !reduce && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C] opacity-70" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${awake ? 'bg-[#DCF87C]' : 'bg-white/30'}`}
          />
        </span>
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/55">
          Berlin, local time
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight text-white">{time}</p>
      <p className="mt-0.5 text-xs text-white/45">{awake ? 'Around, probably building.' : 'Likely asleep.'}</p>
    </GlassSurface>
  )
}

export default function Home() {
  const [active, setActive] = useState<Project | null>(null)
  const navigate = useNavigate()
  const { open: openContact } = useContact()
  return (
    <>
      <Seo />
      <SectionNav sections={SECTIONS} />
      {/* HERO */}
      <header id="intro" className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6">
        <HeroOrbit />
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-white/50"
        >
          Berlin · builder · founder
        </motion.p>
        <h1 className="font-display text-6xl font-bold leading-[1.02] tracking-tight sm:text-8xl">
          <SplitText
            as="span"
            text="Arseniy"
            gradient
            trigger="mount"
            delay={0.15}
            className="block"
          />
          <SplitText
            as="span"
            text="Cherednichenko"
            trigger="mount"
            delay={0.36}
            className="block"
          />
        </h1>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-7 flex flex-wrap items-center gap-2 text-2xl text-white/70 sm:text-3xl"
        >
          <span>I build</span>
          <RotatingWord words={['beautiful products.', 'Socratic AI.', 'calm interfaces.', 'things with craft.']} />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-white/55"
        >
          Co-founder of Guided, a Socratic AI tutor. I work mostly in React, TypeScript, and SwiftUI, with a lot of AI.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
          className="mt-10 flex flex-wrap gap-3"
        >
          <MagneticButton href="#work" className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black">
            See my work
          </MagneticButton>
          <Link
            to="/playground"
            className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
          >
            Playground
          </Link>
        </motion.div>
        <ScrollCue />
        {/* Live glass status — refracts the orbit behind it, lg-only. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
          className="absolute bottom-10 left-6 hidden lg:block"
        >
          <HeroStatus />
        </motion.div>
        {/* Rotating seal — a premium scroll affordance, lg-only so it never
            crowds the mobile hero, links down to the first section. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
          className="pointer-events-none absolute bottom-10 right-8 hidden lg:block"
        >
          <div className="pointer-events-auto">
            <CircularText
              href="#about"
              label="Scroll to explore"
              text="SCROLL TO EXPLORE · SCROLL TO EXPLORE · "
              radius={54}
              spin={24}
            >
              <motion.span
                aria-hidden
                className="block text-2xl leading-none"
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                &darr;
              </motion.span>
            </CircularText>
          </div>
        </motion.div>
      </header>

      {/* ABOUT */}
      <section id="about" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <Eyebrow>About</Eyebrow>
        </Reveal>
        <Reveal delay={0.05}>
          <p className="mt-6 font-display text-3xl font-medium leading-snug text-white/85 sm:text-4xl">
            I care about products that feel effortless. Real craft in the motion, the typography, and the small
            moments, the things people feel but cannot name.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <Link
            to="/about"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
          >
            More about me
            <span aria-hidden>-&gt;</span>
          </Link>
        </Reveal>
      </section>

      {/* RANGE */}
      <section id="range" className="py-24">
        <div className="mx-auto w-full max-w-4xl px-6">
          <Reveal>
            <Eyebrow>Range</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              More than <GradientText>one project.</GradientText>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
              Guided is what I am building, but it is not the whole of what I do. I work across the
              stack and across disciplines. Scroll, and the range moves past.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <TrueFocus
              words={['Frontend', 'iOS', 'Backend', 'Applied AI', 'Motion']}
              className="mt-9 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            />
          </Reveal>
          <Reveal delay={0.2}>
            <Link
              to="/range"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
            >
              Explore the range
              <span aria-hidden>-&gt;</span>
            </Link>
          </Reveal>
        </div>
        <HorizontalScroll panels={RANGE} className="mt-12" />
      </section>

      {/* PROCESS */}
      <section id="process" className="mx-auto w-full max-w-4xl px-6 py-24">
        <div className="mb-10">
          <Reveal>
            <Eyebrow>How I build</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              A way of <GradientText>working.</GradientText>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
              Whatever the project, the process is the same. Keep scrolling, and the steps stack up.
            </p>
          </Reveal>
        </div>
        <ScrollStack cards={PROCESS} />
      </section>

      {/* ETHOS — a statement you light up with the cursor */}
      <section id="ethos" className="relative isolate overflow-hidden py-32">
        <div className="mx-auto w-full max-w-4xl px-6">
          <Reveal>
            <Eyebrow>Ethos</Eyebrow>
          </Reveal>
          <SpotlightReveal
            text="Good software should feel like someone cared. So I sweat the motion, the type, and the small moments no one notices, but everyone feels."
            highlight={['cared', 'motion', 'type', 'feels']}
            hint="Move your cursor across the words"
            className="mt-8 max-w-3xl font-display text-3xl font-semibold leading-[1.18] tracking-tight sm:text-5xl sm:leading-[1.16]"
          />
        </div>
      </section>

      {/* WORK */}
      <section id="work" className="mx-auto w-full max-w-4xl px-6 py-24">
        <Reveal>
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow>Selected work</Eyebrow>
            <Link
              to="/work"
              className="text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
            >
              All work <span aria-hidden>-&gt;</span>
            </Link>
          </div>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {PROJECTS.map((p, idx) =>
            p.soon ? (
              <Reveal key={p.title} delay={idx * 0.05}>
                <div className="flex h-full min-h-[210px] flex-col justify-between rounded-3xl border border-dashed border-white/15 p-8 text-white/40">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">In progress</span>
                  <div>
                    <h3 className="text-2xl font-bold text-white/55">{p.title}</h3>
                    <p className="mt-2 text-sm">{p.blurb}</p>
                  </div>
                </div>
              </Reveal>
            ) : (
              <Reveal key={p.title} delay={idx * 0.05}>
                <SpotlightCard className="h-full">
                  <button
                    onClick={() => setActive(p)}
                    className="flex h-full w-full flex-col justify-between p-8 text-left"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="text-2xl font-bold">{p.title}</h3>
                      <span className="text-sm text-white/40">{p.year}</span>
                    </div>
                    <p className="mt-4 leading-relaxed text-white/60">{p.blurb}</p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {p.stack.map((s) => (
                        <span key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                          {s}
                        </span>
                      ))}
                    </div>
                    <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[#DCF87C]">Read more</span>
                  </button>
                </SpotlightCard>
              </Reveal>
            ),
          )}
        </div>
      </section>

      {/* VELOCITY BAND */}
      <section aria-hidden className="relative py-20">
        <div className="pointer-events-none select-none">
          <ScrollVelocity
            rows={[
              { text: 'Craft · Motion · Typography · Detail · ', baseVelocity: 3, className: 'text-white/85' },
              {
                text: 'React · TypeScript · SwiftUI · AI · Berlin · ',
                baseVelocity: -3,
                className: 'text-transparent [-webkit-text-stroke:1px_rgba(220,248,124,0.45)]',
              },
            ]}
            className="space-y-2 text-6xl font-bold uppercase leading-none tracking-tight sm:text-8xl"
          />
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0a0a0a] to-transparent sm:w-40" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0a0a0a] to-transparent sm:w-40" />
      </section>

      {/* PLAYGROUND — a coverflow taste of the live motion work */}
      <section id="playground" className="mx-auto w-full max-w-5xl overflow-hidden px-6 py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Reveal>
            <Eyebrow>Playground</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              Motion, <GradientText>hand-built.</GradientText>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-white/55">
              A shelf of live experiments. Drag to flip through, then open one.
              Every piece here is coded from scratch and respects reduced motion.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.12}>
          <CircularGallery items={FEATURED} />
        </Reveal>
        <Reveal delay={0.16}>
          <div className="mt-12 text-center">
            <Link
              to="/playground"
              className="text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
            >
              Open the playground <span aria-hidden>-&gt;</span>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* TOOLKIT */}
      <section id="toolkit" className="py-24">
        <div className="mx-auto mb-9 w-full max-w-4xl px-6">
          <Reveal>
            <div className="flex items-baseline justify-between gap-4">
              <Eyebrow>Toolkit</Eyebrow>
              <Link
                to="/toolkit"
                className="text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
              >
                Full toolkit <span aria-hidden>-&gt;</span>
              </Link>
            </div>
          </Reveal>
        </div>
        <Marquee>
          {SKILLS.map((s) => (
            <span key={s} className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-lg text-white/75">
              {s}
            </span>
          ))}
        </Marquee>
      </section>

      {/* EXPLORE */}
      <section id="explore" className="mx-auto w-full max-w-4xl px-6 py-24">
        <div className="mb-9">
          <Reveal>
            <Eyebrow>Explore</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              There is more <GradientText>to see.</GradientText>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
              The whole site, a row at a time. Pick a thread and follow it.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.12}>
          <FlowingMenu items={EXPLORE} />
        </Reveal>
      </section>

      {/* CONTACT */}
      <section id="contact" className="relative isolate overflow-hidden py-32">
        {/* Live needle field: rotates to follow the cursor across the closing band. */}
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]">
          <MagnetLines />
        </div>
        <div className="mx-auto w-full max-w-4xl px-6 text-center">
          <Reveal>
            <h2 className="font-display text-5xl font-bold tracking-tight sm:text-7xl">
              Let us build
              <br />
              something good.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-10 flex justify-center">
              <MagneticButton
                href="mailto:ars7ars3@gmail.com"
                className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black"
              >
                ars7ars3@gmail.com
              </MagneticButton>
            </div>
          </Reveal>
          <Reveal delay={0.18}>
            <button
              type="button"
              onClick={openContact}
              className="mt-6 text-sm font-medium text-white/45 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
            >
              Other ways to reach me
            </button>
          </Reveal>
        </div>
      </section>

      <Modal open={active !== null} onClose={() => setActive(null)}>
        {active && (
          <div>
            <GlareHover className="mb-6">
              <ProjectPoster project={active} className="aspect-[16/9] w-full" />
            </GlareHover>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
              {active.year || 'Project'}
            </span>
            <h3 className="mt-2 font-display text-3xl font-bold">{active.title}</h3>
            <p className="mt-4 leading-relaxed text-white/65">{active.detail}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {active.stack.map((s) => (
                <span key={s} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  const slug = active.slug
                  setActive(null)
                  navigate(`/work/${slug}`)
                }}
                className="rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black"
              >
                Read the full case study
              </button>
              {active.href && (
                <a
                  href={active.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                  Visit
                </a>
              )}
              {active.repo && (
                <a
                  href={active.repo}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                  Source
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
