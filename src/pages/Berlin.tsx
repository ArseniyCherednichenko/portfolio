import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { ShinyText } from '../components/ShinyText'
import { SkylineScene } from '../components/SkylineScene'
import { Seo } from '../components/Seo'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { EMAIL } from '../data/contact'

const EASE = [0.16, 1, 0.3, 1] as const

// A short, honest phrase for what the day is doing right now, keyed to the local
// hour. Purely descriptive — the kind of thing you'd say glancing out a window —
// never a claim of precise sunrise/sunset times, which shift through the year.
function phaseOf(hour: number): { label: string; line: string } {
  if (hour < 5) return { label: 'Late night', line: 'The city is mostly asleep. A scatter of windows is still awake.' }
  if (hour < 8) return { label: 'First light', line: 'Dawn is coming up over the rooftops. The sky is warming at the edge.' }
  if (hour < 12) return { label: 'Morning', line: 'Full daylight. The desk is at its most useful about now.' }
  if (hour < 17) return { label: 'Afternoon', line: 'Bright and open. The long middle of a working day.' }
  if (hour < 20) return { label: 'Golden hour', line: 'The light is going warm and low. The best hour to stop and look up.' }
  if (hour < 22) return { label: 'Dusk', line: 'The sky is deepening. Windows are coming on across the skyline.' }
  return { label: 'Night', line: 'Dark over the city, with the odd late window and a high moon.' }
}

// Honest, verifiable facts about the place. Berlin's coordinates are a matter of
// public geography; the timezone is Europe/Berlin (CET in winter, CEST in
// summer). Nothing here is invented, and the live clock is read straight from
// the browser's timezone database.
const FACTS: { label: string; value: string }[] = [
  { label: 'City', value: 'Berlin, Germany' },
  { label: 'Coordinates', value: '52.52° N, 13.40° E' },
  { label: 'Timezone', value: 'Europe/Berlin (CET / CEST)' },
]

// The /berlin page — the most human corner of the site. Not about a project or a
// skill, just the place the work is made from, rendered as a living illustration
// that tracks the real local hour. It de-centres everything else by design: this
// is the person and the city, nothing to sell.
export default function Berlin() {
  const reduce = useReducedMotion()
  const { time, hour } = useBerlinTime()
  // A fractional hour (adding the live minutes) so the sun/moon arc moves
  // smoothly rather than jumping on the hour.
  const minutes = Number(time.slice(3, 5)) || 0
  const fracHour = hour + minutes / 60
  const phase = phaseOf(hour)

  return (
    <>
      <Seo
        title="From Berlin"
        description="The place the work is made from — a living illustration of Berlin that follows the real local hour, with the time read live from the clock. The most human corner of Arseniy Cherednichenko's site."
      />

      {/* HERO — the scene fills the top of the page, the time floats over it. */}
      <header className="relative isolate w-full overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <SkylineScene hour={fracHour} />
          {/* Legibility wash so the overlaid type always reads, whatever the sky
              colour happens to be at this hour. */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-[#05060a]" />
        </div>

        <div className="mx-auto flex min-h-[78vh] w-full max-w-5xl flex-col justify-end px-6 pb-16 pt-40 sm:min-h-[82vh] sm:pt-48">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <Eyebrow>From Berlin</Eyebrow>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
            className="mt-6 max-w-2xl font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl"
          >
            This is where the <GradientText>work is made</GradientText>.
          </motion.h1>

          {/* The live clock + phase, floated as a glass readout. */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4"
          >
            <div>
              <div className="font-display text-4xl font-semibold tabular-nums tracking-tight text-white sm:text-5xl">
                {time}
              </div>
              <ShinyText className="mt-1 block text-sm font-medium uppercase tracking-[0.22em]">
                Local time in Berlin
              </ShinyText>
            </div>
            <div className="h-12 w-px bg-white/15" aria-hidden />
            <div className="max-w-xs">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">
                {phase.label}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-white/65">{phase.line}</p>
            </div>
          </motion.div>
        </div>
      </header>

      {/* NOTE + FACTS */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28">
        <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
          <Reveal>
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Why the city is on the page
              </h2>
              <div className="mt-6 space-y-5 text-lg leading-relaxed text-white/65">
                <p>
                  Most of this site is about the work — the motion, the type, the
                  hundreds of little hand-built pieces. This page is about the
                  other half of the honest answer to{' '}
                  <span className="text-white/85">where does it come from</span>:
                  a desk in Berlin, and whatever the light is doing outside the
                  window at the time.
                </p>
                <p>
                  The scene above is drawn in the browser from seeded canvas code,
                  the same way everything here is made rather than dropped in. It
                  is an illustration that follows the clock, not an observatory —
                  the sky shifts through dawn, day, dusk and night with the real
                  local hour, the windows come on as it gets dark, and the moon or
                  the sun rides a shallow arc across it. If you load this at two in
                  the morning, Berlin time, the city is dark and nearly asleep.
                </p>
                <p>
                  I build mostly in the open, a little most days, from here. That
                  is the whole of it: a person, a place, and a habit of shipping
                  small and often.
                </p>
              </div>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/now"
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-[#DCF87C]/60 hover:text-white"
                >
                  What I am on right now
                </Link>
                <a
                  href={`mailto:${EMAIL}`}
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:border-[#DCF87C]/60 hover:text-white"
                >
                  Say hello
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <dl className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] px-6">
              {FACTS.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-6 py-5">
                  <dt className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
                    {f.label}
                  </dt>
                  <dd className="text-right font-display text-lg text-white/90">{f.value}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-6 py-5">
                <dt className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
                  Right now
                </dt>
                <dd className="text-right font-display text-lg tabular-nums text-[#DCF87C]">
                  {time}
                </dd>
              </div>
            </dl>
            <p className="mt-5 px-1 text-sm leading-relaxed text-white/45">
              {reduce
                ? 'Motion is turned down, so the scene above is held still at the current hour rather than animating.'
                : 'The clock and the scene update live. Leave the tab a while and come back; the sky will have moved on.'}
            </p>
          </Reveal>
        </div>
      </section>
    </>
  )
}
