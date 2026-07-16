import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { Reveal } from '../components/Reveal'
import { Terminal } from '../components/Terminal'
import { Seo } from '../components/Seo'

const EASE = [0.16, 1, 0.3, 1] as const

// The /terminal page: a playful, alternate way to move through the site. It is
// honest about what it is — a toy shell on top of a real site, where every
// command maps to real content and real navigation. It shows a different side
// of the interface craft than the scroll-led pages: something you drive by
// typing. De-centred from any one project; the whole site is reachable here.
export default function TerminalPage() {
  const reduce = useReducedMotion()
  return (
    <>
      <Seo
        title="Terminal"
        description="A playful, interactive terminal for Arseniy Cherednichenko's portfolio. Type commands to move through the site — every command maps to real content."
      />

      <header className="mx-auto w-full max-w-3xl px-6 pb-10 pt-36 sm:pt-44">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
        >
          <Eyebrow>Terminal</Eyebrow>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Drive the site by <GradientText>typing.</GradientText>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/55">
            A different way in. Type <Cmd>help</Cmd> to see what it knows, <Cmd>ls</Cmd> to look
            around, or <Cmd>open work</Cmd> to jump somewhere. Every command maps to something real —
            nothing here is faked, and it has no access to anything but this site.
          </p>
        </motion.div>
      </header>

      <section className="mx-auto w-full max-w-3xl px-6 pb-24">
        <Reveal>
          <Terminal />
        </Reveal>

        <Reveal delay={0.05}>
          <p className="mt-6 text-sm text-white/40">
            Prefer clicks? Everything here is also a normal page —{' '}
            <Link
              to="/work"
              className="text-white/55 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
            >
              work
            </Link>
            ,{' '}
            <Link
              to="/about"
              className="text-white/55 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
            >
              about
            </Link>
            , and{' '}
            <Link
              to="/playground"
              className="text-white/55 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline"
            >
              the playground
            </Link>
            . Or press <kbd className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[11px] font-medium text-white/50">?</kbd>{' '}
            for keyboard shortcuts.
          </p>
        </Reveal>
      </section>
    </>
  )
}

// Inline code chip for the intro copy, matching the terminal's accent.
function Cmd({ children }: { children: string }) {
  return (
    <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-[#DCF87C]/90">
      {children}
    </code>
  )
}
