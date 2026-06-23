import { useState } from 'react'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { RotatingWord } from '../components/RotatingWord'
import { SpotlightCard } from '../components/SpotlightCard'
import { TiltCard } from '../components/TiltCard'
import { MagneticButton } from '../components/MagneticButton'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { DotGrid } from '../components/DotGrid'
import { ScrollVelocity } from '../components/ScrollVelocity'
import { DecryptedText } from '../components/DecryptedText'
import { Seo } from '../components/Seo'

function Experiment({
  name,
  note,
  children,
}: {
  name: string
  note: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col">
      <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] p-8">
        {children}
      </div>
      <div className="mt-4 px-1">
        <h3 className="text-base font-semibold">{name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-white/45">{note}</p>
      </div>
    </div>
  )
}

export default function Playground() {
  const [likes, setLikes] = useState(128)
  const [on, setOn] = useState(false)

  return (
    <section className="mx-auto w-full max-w-5xl px-6 pt-36 pb-12">
      <Seo
        title="Playground"
        description="A gallery of live motion experiments by Arseniy Cherednichenko — tilt cards, spotlight glows, decrypt text, an interactive dot field, and more."
      />
      {/* HEADER */}
      <Reveal>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Playground</p>
      </Reveal>
      <Reveal delay={0.05}>
        <h1 className="mt-5 max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
          Motion, <GradientText>up close.</GradientText>
        </h1>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/55">
          A workbench for the interaction details I care about. Every piece here is hand-built with React and Framer
          Motion, and every one respects reduced-motion. Hover, click, and poke around.
        </p>
      </Reveal>

      {/* GRID */}
      <div className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2">
        <Reveal>
          <Experiment name="3D tilt card" note="Rotates toward the cursor with a soft lime glare. Built on motion springs.">
            <TiltCard className="w-full max-w-[260px]">
              <div className="flex flex-col gap-2 p-7">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Depth</span>
                <p className="text-2xl font-bold leading-tight">Tilt me with your cursor</p>
                <p className="text-sm text-white/50">Perspective, spring damping, parallax layer.</p>
              </div>
            </TiltCard>
          </Experiment>
        </Reveal>

        <Reveal delay={0.05}>
          <Experiment name="Cursor spotlight" note="A radial glow tracks the pointer inside the card's bounds.">
            <SpotlightCard className="w-full max-w-[260px]">
              <div className="flex flex-col gap-2 p-7">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Glow</span>
                <p className="text-2xl font-bold leading-tight">Move across me</p>
                <p className="text-sm text-white/50">Pointer-driven radial gradient, masked to the card.</p>
              </div>
            </SpotlightCard>
          </Experiment>
        </Reveal>

        <Reveal>
          <Experiment name="Animated counter" note="Counts up with an ease curve the first time it enters the viewport.">
            <div className="text-center">
              <AnimatedCounter value={2026} className="text-6xl font-bold tabular-nums sm:text-7xl" />
              <p className="mt-2 text-sm text-white/45">Eases from zero on reveal</p>
            </div>
          </Experiment>
        </Reveal>

        <Reveal delay={0.05}>
          <Experiment name="Magnetic button" note="The target drifts toward your cursor, then springs back on exit.">
            <MagneticButton href="#" className="rounded-full bg-[#DCF87C] px-8 py-4 text-lg font-semibold text-black">
              Pull me
            </MagneticButton>
          </Experiment>
        </Reveal>

        <Reveal>
          <Experiment name="Gradient + rotating type" note="A shimmering gradient sweep paired with a cross-fading word cycle.">
            <div className="text-center text-3xl font-bold leading-snug sm:text-4xl">
              <GradientText>Built for</GradientText>
              <div className="mt-2 text-white/80">
                <RotatingWord words={['delight.', 'clarity.', 'speed.', 'craft.']} />
              </div>
            </div>
          </Experiment>
        </Reveal>

        <Reveal>
          <Experiment name="Decrypt-on-view text" note="Characters resolve from random glyphs into the final string. Replays on hover.">
            <div className="text-center font-mono text-2xl font-bold tracking-tight sm:text-3xl">
              <DecryptedText text="DECODING CRAFT" className="text-[#DCF87C]" />
              <div className="mt-3 text-base text-white/70">
                <DecryptedText text="hover to replay" speed={26} />
              </div>
            </div>
          </Experiment>
        </Reveal>

        <Reveal delay={0.05}>
          <Experiment name="Stateful micro-interactions" note="Small, satisfying feedback loops: an optimistic like and a spring toggle.">
            <div className="flex flex-col items-center gap-6">
              <button
                onClick={() => setLikes((n) => n + 1)}
                className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[#DCF87C]/40 hover:text-[#DCF87C]"
              >
                <span className="transition-transform group-active:scale-125">Like</span>
                <span className="tabular-nums text-white/60">{likes}</span>
              </button>
              <button
                role="switch"
                aria-checked={on}
                onClick={() => setOn((v) => !v)}
                className={`relative h-9 w-16 rounded-full border transition-colors ${
                  on ? 'border-[#DCF87C]/50 bg-[#DCF87C]/20' : 'border-white/15 bg-white/[0.04]'
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full transition-all duration-300 ${
                    on ? 'left-9 bg-[#DCF87C]' : 'left-1 bg-white/60'
                  }`}
                  style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                />
              </button>
            </div>
          </Experiment>
        </Reveal>
      </div>

      {/* FULL-WIDTH SCROLL-VELOCITY BAND */}
      <Reveal>
        <div className="mt-12">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] py-12">
            <ScrollVelocity
              rows={[
                { text: 'Scroll to feel it · ', baseVelocity: 4, className: 'text-white/85' },
                {
                  text: 'Faster scroll, faster drift · ',
                  baseVelocity: -4,
                  className: 'text-transparent [-webkit-text-stroke:1px_rgba(220,248,124,0.5)]',
                },
              ]}
              className="space-y-1 text-5xl font-bold uppercase leading-none tracking-tight sm:text-7xl"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0c0c0c] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0c0c0c] to-transparent" />
          </div>
          <div className="mt-4 px-1">
            <h3 className="text-base font-semibold">Scroll-velocity text band</h3>
            <p className="mt-1 text-sm leading-relaxed text-white/45">
              Two rows drift on their own, then speed up and flip direction with the page's scroll velocity. Built on
              Framer Motion's useVelocity and a wrapped offset.
            </p>
          </div>
        </div>
      </Reveal>

      {/* FULL-WIDTH INTERACTIVE FIELD */}
      <Reveal>
        <div className="mt-12">
          <div className="relative h-[340px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
            <DotGrid />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Interactive field</span>
              <p className="mt-3 max-w-md px-6 text-xl font-medium text-white/80 sm:text-2xl">
                Move your cursor across the grid.
              </p>
            </div>
          </div>
          <div className="mt-4 px-1">
            <h3 className="text-base font-semibold">Cursor-reactive dot grid</h3>
            <p className="mt-1 text-sm leading-relaxed text-white/45">
              A few hundred dots on a single canvas, each a tiny spring pushed by the pointer and pulled home. Lights up
              lime within reach.
            </p>
          </div>
        </div>
      </Reveal>

      {/* CLOSER */}
      <Reveal>
        <div className="mt-20 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-2xl font-medium leading-snug text-white/85 sm:text-3xl">
            These are the building blocks behind the rest of this site.
          </p>
          <p className="mt-4 text-white/50">Want something that moves like this? Let's talk.</p>
          <div className="mt-8 flex justify-center">
            <MagneticButton
              href="mailto:ars7ars3@gmail.com"
              className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black"
            >
              ars7ars3@gmail.com
            </MagneticButton>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
