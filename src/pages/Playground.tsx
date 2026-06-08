import { motion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { GradientText } from '../components/GradientText'
import { RotatingWord } from '../components/RotatingWord'
import { TextReveal } from '../components/TextReveal'
import { Breadcrumb } from '../components/Breadcrumb'
import { TiltCard } from '../components/TiltCard'
import { SpotlightCard } from '../components/SpotlightCard'
import { AnimatedBorder } from '../components/AnimatedBorder'
import { CountUp } from '../components/CountUp'
import { Marquee } from '../components/Marquee'
import { VelocitySkew } from '../components/VelocitySkew'
import { MagneticButton } from '../components/MagneticButton'
import { Tooltip } from '../components/Tooltip'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const EASE = [0.16, 1, 0.3, 1] as const

function Label({ children }: { children: string }) {
  return <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{children}</span>
}

export default function Playground() {
  useDocumentTitle('Playground — Arseniy Cherednichenko')
  return (
    <article id="main" tabIndex={-1} className="outline-none">
      <header className="mx-auto w-full max-w-5xl px-6 pb-12 pt-36 sm:pt-44">
        <Breadcrumb trail={[{ label: 'Home', to: '/' }, { label: 'Playground' }]} />
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-8 text-5xl font-bold leading-[1.03] tracking-tight sm:text-7xl"
        >
          The <GradientText>playground</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-white/60"
        >
          Every interaction on this site is an original component I wrote, no library drop-ins. Here is a closer look at a
          few of them. Hover, move your cursor, and poke around.
        </motion.p>
      </header>

      <section className="mx-auto w-full max-w-5xl px-6 pb-28">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Reveal>
            <TiltCard className="flex h-52 flex-col justify-between p-7">
              <Label>3D tilt</Label>
              <span className="text-xl text-white/70">Cards that lean toward your cursor with real depth.</span>
            </TiltCard>
          </Reveal>

          <Reveal delay={0.04}>
            <SpotlightCard className="h-52">
              <div className="flex h-full flex-col justify-between p-7">
                <Label>Cursor spotlight</Label>
                <span className="text-xl text-white/70">A lime glow that tracks the pointer across the surface.</span>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.08}>
            <AnimatedBorder className="h-52">
              <div className="flex h-full flex-col justify-between p-7">
                <Label>Animated border</Label>
                <span className="text-xl text-white/70">A conic sheen rotating around the edge.</span>
              </div>
            </AnimatedBorder>
          </Reveal>

          <Reveal delay={0.12}>
            <TiltCard className="flex h-52 flex-col justify-between p-7">
              <Label>Shine text</Label>
              <GradientText className="text-4xl font-bold">handcrafted</GradientText>
            </TiltCard>
          </Reveal>

          <Reveal delay={0.16}>
            <TiltCard className="flex h-52 flex-col justify-between p-7">
              <Label>Rotating words</Label>
              <div className="flex items-center gap-2 text-2xl text-white/80">
                <span>I build</span>
                <RotatingWord words={['motion.', 'interfaces.', 'delight.', 'craft.']} />
              </div>
            </TiltCard>
          </Reveal>

          <Reveal delay={0.2}>
            <TiltCard className="flex h-52 flex-col justify-between p-7">
              <Label>Count up</Label>
              <div className="text-5xl font-bold text-[#DCF87C]">
                <CountUp to={100} suffix="%" /> <span className="text-base font-normal text-white/50">hand-built</span>
              </div>
            </TiltCard>
          </Reveal>

          <Reveal delay={0.24}>
            <TiltCard className="flex h-52 flex-col justify-between p-7">
              <Label>Animated dialog</Label>
              <div>
                <p className="mb-4 text-white/70">An accessible popup with a backdrop blur and spring entrance.</p>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event('open-contact'))}
                  className="rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black transition hover:brightness-105"
                >
                  Open the dialog
                </button>
              </div>
            </TiltCard>
          </Reveal>
        </div>

        {/* MARQUEE */}
        <div className="mt-10">
          <Reveal>
            <Label>Infinite marquee with scroll-velocity skew, pauses on hover</Label>
          </Reveal>
          <VelocitySkew className="mt-5">
            <Marquee>
              {['React', 'TypeScript', 'SwiftUI', 'Tailwind', 'Framer Motion', 'Supabase', 'Vite', 'GSAP'].map((s) => (
                <Tooltip key={s} label={`built with ${s}`}>
                  <span className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-lg text-white/75">
                    {s}
                  </span>
                </Tooltip>
              ))}
            </Marquee>
          </VelocitySkew>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              <TextReveal text="It is all open source." />
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <MagneticButton
                href="https://github.com/ArseniyCherednichenko/portfolio"
                className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black"
              >
                View the source
              </MagneticButton>
              <MagneticButton href="/#work" className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white">
                See the work
              </MagneticButton>
            </div>
          </Reveal>
        </div>
      </section>
    </article>
  )
}
