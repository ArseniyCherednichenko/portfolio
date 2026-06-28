import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GradientText } from '../components/GradientText'
import { Threads } from '../components/Threads'
import { Seo } from '../components/Seo'

const EASE = [0.16, 1, 0.3, 1] as const

// A few honest places to land instead of the dead end.
const ELSEWHERE = [
  { to: '/work', label: 'Work' },
  { to: '/playground', label: 'Playground' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
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

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]"
      >
        Error 404
      </motion.p>

      <motion.h1
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.06, ease: EASE }}
        className="mt-6 font-display text-7xl font-bold tracking-tight sm:text-9xl"
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
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/45">
          <span className="text-white/30">Or try</span>
          {ELSEWHERE.map((e) => (
            <Link
              key={e.to}
              to={e.to}
              className="font-medium underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
            >
              {e.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
