import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { KeyboardMap } from '../components/KeyboardMap'
import { Seo } from '../components/Seo'
import { GO_TARGETS } from '../components/Keyboard'

const EASE = [0.16, 1, 0.3, 1] as const

// A small keycap, matching the one in the shortcuts dialog, for the inline copy.
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-white/15 bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-medium text-white/70 shadow-[0_1px_0_rgba(0,0,0,0.4)]">
      {children}
    </kbd>
  )
}

// The two honest layers of the system, framed as prose rather than a feature
// list — this page is a piece of the craft on show, not a manual.
const LAYERS = [
  {
    n: '01',
    title: 'Tap, then go',
    body: 'Press the leader, then a destination key, and the whole site is one keystroke away. No modifier to hold, no menu to open — the way you would move around a tool you live in.',
  },
  {
    n: '02',
    title: 'Or open the palette',
    body: 'When you would rather read than remember, the command palette lists every page and searches as you type. Same destinations, a different door.',
  },
  {
    n: '03',
    title: 'Never in the way',
    body: 'The handler stands down the moment you are typing in a field or a dialog is open, so it never once fights what you are actually doing.',
  },
]

export default function Keys() {
  const reduce = useReducedMotion()
  const [armed, setArmed] = useState(false)

  return (
    <>
      <Seo
        title="Keyboard"
        description="The whole site is built to be driven from the keyboard. A playable on-screen keyboard: tap the leader, then a key, and travel — or click any lit cap to go straight there."
      />

      {/* INTRO */}
      <header className="relative isolate overflow-hidden px-6 pb-10 pt-36 sm:pt-44">
        <div className="mx-auto max-w-5xl">
          <Eyebrow>Keyboard</Eyebrow>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
            <SplitText as="span" text="Driven by keys." trigger="mount" />
          </h1>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55">
              A site about craft should reward the people who reach for the
              keyboard. This one does: every page has a <Key>g</Key> chord, the
              command palette is a keystroke away, and the whole thing stays out
              of your way when you are typing. The board below is the real map —
              press a key to feel it, or click a lit cap to travel.
            </p>
          </Reveal>
        </div>
      </header>

      {/* THE KEYBOARD */}
      <section className="px-6 pb-6">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <KeyboardMap onArmedChange={setArmed} />
          </Reveal>
          <div className="mt-8 flex min-h-[1.5rem] items-center justify-center text-center">
            <motion.p
              key={armed ? 'armed' : 'idle'}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: EASE }}
              className="text-sm text-white/50"
            >
              {armed ? (
                <span className="text-[#DCF87C]">
                  Armed — now press a lit key to travel.
                </span>
              ) : (
                <>
                  Tap <Key>g</Key>, then a highlighted key. Or just click a cap.
                </>
              )}
            </motion.p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {LAYERS.map((layer, i) => (
            <Reveal key={layer.n} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#DCF87C]/70">
                  {layer.n}
                </span>
                <h2 className="mt-3 font-display text-xl font-semibold tracking-tight">
                  {layer.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{layer.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* THE FULL MAP — every destination as a plain, linkable reference, so the
          page works as a directory even without touching the keyboard. */}
      <section className="px-6 pb-28">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                <GradientText>Every chord</GradientText>
              </h2>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/35">
                {GO_TARGETS.length} destinations
              </span>
            </div>
          </Reveal>
          <div className="mt-6 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {GO_TARGETS.map((g, i) => (
              <motion.div
                key={g.key}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: reduce ? 0 : 0.3, delay: reduce ? 0 : (i % 3) * 0.04, ease: EASE }}
              >
                <Link
                  to={g.to}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3.5 py-2.5 transition-colors hover:border-[#DCF87C]/40 hover:bg-[#DCF87C]/[0.05]"
                >
                  <span className="text-sm text-white/70 transition-colors group-hover:text-white">
                    {g.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Key>g</Key>
                    <span className="text-[10px] text-white/25">then</span>
                    <Key>{g.key === '0' ? '0' : g.key.toUpperCase()}</Key>
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>

          <Reveal delay={0.1}>
            <p className="mt-10 text-center text-sm text-white/40">
              Prefer to read the list? Open the command palette with{' '}
              <Key>⌘</Key> <Key>K</Key>, or press <Key>?</Key> anywhere for the
              same shortcuts in a panel.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  )
}
