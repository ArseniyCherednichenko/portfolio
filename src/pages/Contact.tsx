import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { ChannelList } from '../components/ChannelList'
import { SpotlightCard } from '../components/SpotlightCard'
import { Seo } from '../components/Seo'

const EASE = [0.16, 1, 0.3, 1] as const

// Honest list of the kinds of conversations I actually welcome. Not a service
// menu, not fabricated clients — just what I'm into right now.
const OPEN_TO: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Products with real craft',
    body: 'Teams who care how the thing feels, not just whether it works. Frontend, motion, and the details in between.',
  },
  {
    title: 'AI in education',
    body: 'I co-founded Guided, a Socratic AI tutor. I am always up for talking about where this is going.',
  },
  {
    title: 'Just talking shop',
    body: 'Interface design, animation, the stack. Reach out even if there is nothing on the table yet.',
  },
]

// Live local time in Berlin, so the page feels present rather than static.
function useBerlinTime() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Berlin',
    hour12: false,
  }).format(now)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Europe/Berlin' }).format(now),
  )
  // A soft sense of whether a reply is likely soon, never a hard promise.
  const awake = hour >= 8 && hour < 24
  return { time, awake }
}

export default function Contact() {
  const reduce = useReducedMotion()
  const { time, awake } = useBerlinTime()

  return (
    <>
      <Seo
        title="Contact"
        description="Get in touch with Arseniy Cherednichenko — email, GitHub, and the kinds of conversations he is open to. Based in Berlin."
      />
      {/* HEADER */}
      <header className="mx-auto w-full max-w-4xl px-6 pb-12 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Contact</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Let us build something <GradientText>that feels right.</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          Whether it is a product to build, a collaboration, or just a conversation about craft and
          AI, I would love to hear from you. Email is the fastest way to reach me.
        </motion.p>
      </header>

      {/* CHANNELS + AVAILABILITY */}
      <section className="mx-auto grid w-full max-w-4xl gap-5 px-6 py-8 md:grid-cols-[1.2fr_1fr]">
        <Reveal>
          <SpotlightCard className="h-full">
            <div className="p-6 sm:p-7">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
                Reach me
              </span>
              <div className="mt-5">
                <ChannelList />
              </div>
            </div>
          </SpotlightCard>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="flex h-full flex-col gap-5">
            <SpotlightCard className="flex-1">
              <div className="flex h-full flex-col justify-between p-6 sm:p-7">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                    Local time
                  </span>
                  <p className="mt-4 font-mono text-4xl font-semibold tabular-nums tracking-tight">
                    {time}
                  </p>
                  <p className="mt-1 text-sm text-white/40">Berlin · CET</p>
                </div>
                <div className="mt-6 flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    {!reduce && awake && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C]/70" />
                    )}
                    <span
                      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                        awake ? 'bg-[#DCF87C]' : 'bg-white/30'
                      }`}
                    />
                  </span>
                  <span className="text-sm text-white/60">
                    {awake ? 'Likely around and replying' : 'Probably asleep, will reply soon'}
                  </span>
                </div>
              </div>
            </SpotlightCard>
            <SpotlightCard>
              <div className="p-6 sm:p-7">
                <p className="text-sm leading-relaxed text-white/55">
                  No forms, no funnels. A short, direct note about what you are working on gets the
                  best reply.
                </p>
              </div>
            </SpotlightCard>
          </div>
        </Reveal>
      </section>

      {/* OPEN TO */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16">
        <Reveal>
          <Eyebrow>What I am open to</Eyebrow>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] sm:grid-cols-3">
          {OPEN_TO.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.06}>
              <div className="h-full bg-[#0A0A0A] p-7 transition-colors hover:bg-white/[0.02]">
                <span className="text-sm font-semibold text-white/30">0{i + 1}</span>
                <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CLOSING */}
      <section className="mx-auto w-full max-w-4xl px-6 py-20 text-center">
        <Reveal>
          <p className="text-2xl font-medium leading-snug text-white/80 sm:text-3xl">
            Prefer to look around first?{' '}
            <Link to="/work" className="text-[#DCF87C] underline-offset-4 hover:underline">
              See the work
            </Link>{' '}
            or wander the{' '}
            <Link to="/playground" className="text-[#DCF87C] underline-offset-4 hover:underline">
              playground
            </Link>
            .
          </p>
        </Reveal>
      </section>
    </>
  )
}
