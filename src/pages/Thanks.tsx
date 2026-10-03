import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SplitText } from '../components/SplitText'
import { SpotlightCard } from '../components/SpotlightCard'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Squares } from '../components/Squares'
import { Seo } from '../components/Seo'
import { CREDITS, ALL_CREDITS, type Credit } from '../data/thanks'

const EASE = [0.16, 1, 0.3, 1] as const
const GITHUB_URL = 'https://github.com/ArseniyCherednichenko/portfolio'

// One credit as a row inside a group card: the name, an honest line on what it
// does here, a licence/nature chip, and an arrow that slides out to its real
// home. The whole row is the link; it opens in a new tab since it leaves the
// site. SpotlightCard around the group supplies the cursor glow.
function CreditRow({ credit }: { credit: Credit }) {
  return (
    <li>
      <a
        href={credit.href}
        target="_blank"
        rel="noreferrer"
        className="group/row flex items-start justify-between gap-4 bg-white/[0.02] px-5 py-4 transition-colors hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#DCF87C]/60"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2.5">
            <span className="font-display text-lg font-semibold tracking-tight text-white">
              {credit.name}
            </span>
            {credit.note && (
              <span className="shrink-0 rounded-full border border-white/12 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/40">
                {credit.note}
              </span>
            )}
          </span>
          <span className="mt-1.5 block text-sm leading-relaxed text-white/55">{credit.role}</span>
        </span>
        <span
          aria-hidden
          className="mt-1 shrink-0 text-[#DCF87C] opacity-40 transition-all duration-300 ease-out group-hover/row:translate-x-1 group-hover/row:opacity-100"
        >
          &#8599;
        </span>
      </a>
    </li>
  )
}

export default function Thanks() {
  const reduce = useReducedMotion()

  return (
    <>
      <Seo
        title="With thanks"
        description="No one builds alone. The open-source software, type, and public galleries that Arseniy Cherednichenko's portfolio stands on and learns from — credited honestly."
      />

      {/* HEADER */}
      <header className="relative isolate mx-auto w-full max-w-5xl overflow-hidden px-6 pb-12 pt-36 sm:pt-44">
        {/* A faint animated grid, masked toward the top-right — the same ambient
            texture the Start and Index pages use. Squares stills under reduced
            motion on its own. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(115%_75%_at_78%_12%,#000_0%,transparent_66%)]"
        >
          <Squares size={54} />
        </div>

        <Reveal>
          <Eyebrow>With thanks</Eyebrow>
        </Reveal>
        <h1 className="mt-6 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
          <SplitText as="span" text="No one builds" trigger="mount" delay={0.05} className="block" />
          <SplitText as="span" text="alone." gradient trigger="mount" delay={0.22} className="block" />
        </h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          Every piece of motion on this site is written by hand — but none of it
          would exist without the open-source software it runs on, the type it is
          set in, and the public work that showed me what good looks like. Here is
          the honest debt, with links to each one.
        </motion.p>
      </header>

      {/* THE GROUPS */}
      {CREDITS.map((group, gi) => (
        <section key={group.label} className="mx-auto w-full max-w-5xl px-6 py-10">
          <Reveal>
            <Eyebrow>{group.label}</Eyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/55">{group.intro}</p>
          </Reveal>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, ease: EASE, delay: Math.min(gi * 0.04, 0.16) }}
            className="mt-8"
          >
            <SpotlightCard>
              <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl">
                {group.credits.map((credit) => (
                  <CreditRow key={credit.name} credit={credit} />
                ))}
              </ul>
            </SpotlightCard>
          </motion.div>
        </section>
      ))}

      {/* PAY IT FORWARD — the honest symmetry: the site is itself open. */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center sm:p-14">
            <p className="font-display text-2xl font-semibold leading-snug tracking-tight text-white/85 sm:text-3xl">
              <AnimatedCounter value={ALL_CREDITS.length} className="text-[#DCF87C]" /> debts owed, and{' '}
              <GradientText>one paid forward.</GradientText>
            </p>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/55">
              The only honest answer to standing on this much open work is to build in the open too. This
              whole site is public — the source, the commit history, every component — so it can be read
              and learned from the same way.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition hover:brightness-105"
              >
                Read the source
              </a>
              <Link
                to="/colophon"
                className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                How it is built
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
