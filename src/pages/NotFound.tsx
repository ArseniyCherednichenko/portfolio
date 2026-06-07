import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GradientText } from '../components/GradientText'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const EASE = [0.16, 1, 0.3, 1] as const

export default function NotFound() {
  useDocumentTitle('Not found — Arseniy Cherednichenko')
  return (
    <section
      id="main"
      tabIndex={-1}
      className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 outline-none"
    >
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]"
      >
        404
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
        className="mt-4 text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl"
      >
        <GradientText>Lost the thread.</GradientText>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
        className="mt-6 max-w-md text-lg leading-relaxed text-white/55"
      >
        This page does not exist, or has not been built yet. Let us get you back to something real.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
        className="mt-10 flex flex-wrap gap-3"
      >
        <Link to="/" className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition hover:brightness-105">
          Back home
        </Link>
        <Link
          to="/#work"
          className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/5"
        >
          See the work
        </Link>
      </motion.div>
    </section>
  )
}
