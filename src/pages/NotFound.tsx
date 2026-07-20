import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GradientText } from '../components/GradientText'
import { FuzzyText } from '../components/FuzzyText'
import { Threads } from '../components/Threads'
import { ChromaGrid, type ChromaItem } from '../components/ChromaGrid'
import { Seo } from '../components/Seo'

const EASE = [0.16, 1, 0.3, 1] as const

// A few honest places to land instead of the dead end. Sweep the cursor across
// them to light the way out.
const ELSEWHERE: ChromaItem[] = [
  { tag: 'Work', title: 'The work', subtitle: 'What I have built.', to: '/work' },
  { tag: 'Craft', title: 'Playground', subtitle: 'Motion, hand-built.', to: '/playground' },
  { tag: 'Person', title: 'About', subtitle: 'A bit about me.', to: '/about' },
  { tag: 'Reach', title: 'Contact', subtitle: 'Say hello.', to: '/contact' },
]

export default function NotFound() {
  const reduce = useReducedMotion()
  return (
    <section className="relative isolate flex min-h-[88vh] w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Seo title="Page not found" description="This page wandered off. Head back to the home page." />

      {/* Live thread field, radially masked so the copy stays legible. */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-80 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]">
        <Threads count={16} amplitude={14} />
      </div>

      {/* The number itself, torn into signal-fuzz — a lost page as a lost
          signal. Hover it to shear it harder; reduced motion holds it still. */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex justify-center"
        data-cursor
      >
        <FuzzyText text="404" fontSize={132} color="#DCF87C" />
      </motion.div>

      <motion.h1
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.06, ease: EASE }}
        className="mt-4 font-display text-7xl font-bold tracking-tight sm:text-9xl"
      >
        <GradientText>Lost the thread.</GradientText>
      </motion.h1>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
        className="mt-6 max-w-md text-lg leading-relaxed text-white/55"
      >
        This page wandered off, or never existed. The good stuff is a click away.
      </motion.p>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
        className="mt-10 flex flex-col items-center gap-6"
      >
        <Link
          to="/"
          className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition hover:brightness-105"
        >
          Take me home
        </Link>
        <div className="w-full max-w-2xl text-left">
          <ChromaGrid items={ELSEWHERE} radius={200} />
        </div>
      </motion.div>
    </section>
  )
}
