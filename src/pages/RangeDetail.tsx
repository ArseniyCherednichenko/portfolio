import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { SplitText } from '../components/SplitText'
import { MagneticButton } from '../components/MagneticButton'
import { Seo } from '../components/Seo'
import { useContact } from '../components/ContactDialog'
import { DISCIPLINES, getDiscipline } from '../data/disciplines'

const EASE = [0.16, 1, 0.3, 1] as const

// A per-discipline accent glow behind the header. Two slow-drifting blobs tinted
// with the discipline's own accent hex, so each page reads distinctly instead of
// wearing the same house lime. Held to a single still frame under reduced motion.
function AccentField({ accent }: { accent: string }) {
  const reduce = useReducedMotion()
  const drift = (a: number[], b: number[]) =>
    reduce ? undefined : { x: a, y: b }
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden [mask-image:radial-gradient(ellipse_at_50%_20%,black,transparent_75%)]"
    >
      <motion.div
        className="absolute -top-1/4 left-1/4 h-[46vmax] w-[46vmax] rounded-full blur-[130px]"
        style={{ backgroundColor: accent, opacity: 0.18 }}
        animate={drift([0, 70, -30, 0], [0, 50, 15, 0])}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 right-1/5 h-[38vmax] w-[38vmax] rounded-full blur-[140px]"
        style={{ backgroundColor: accent, opacity: 0.1 }}
        animate={drift([0, -50, 25, 0], [0, -30, 10, 0])}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

export default function RangeDetail() {
  const { id } = useParams()
  const found = getDiscipline(id)
  const { open: openContact } = useContact()
  const reduce = useReducedMotion()

  // Scroll to the top on each discipline change — deep links and pager clicks
  // should land at the header, not wherever the last page left the scroll.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  // Unknown id — send it back to the overview rather than showing a broken page.
  if (!found) return <Navigate to="/range" replace />

  const { discipline: d, index } = found
  const num = String(index + 1).padStart(2, '0')
  const prev = DISCIPLINES[(index - 1 + DISCIPLINES.length) % DISCIPLINES.length]
  const next = DISCIPLINES[(index + 1) % DISCIPLINES.length]
  const related = d.related
    .map((rid) => DISCIPLINES.find((x) => x.id === rid))
    .filter((x): x is (typeof DISCIPLINES)[number] => Boolean(x))

  return (
    <>
      <Seo
        title={`${d.tag} — the range`}
        description={`${d.title}. ${d.lede} How ${d.tag.toLowerCase()} shows up in Arseniy Cherednichenko's actual work — one of five disciplines across the stack.`}
      />

      {/* HERO */}
      <header className="relative isolate overflow-hidden pb-16 pt-36 sm:pt-44">
        <AccentField accent={d.accent} />
        <div className="mx-auto w-full max-w-4xl px-6">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="flex items-center gap-3 text-sm"
          >
            <Link to="/range" className="text-white/40 transition-colors hover:text-white/70">
              Range
            </Link>
            <span aria-hidden className="text-white/20">
              /
            </span>
            <span style={{ color: d.accent }} className="font-semibold">
              {d.tag}
            </span>
          </motion.div>

          <div className="mt-8 flex items-baseline gap-4">
            <span
              aria-hidden
              className="font-display text-2xl font-bold tabular-nums"
              style={{ color: d.accent }}
            >
              {num}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
              Discipline {num} of {String(DISCIPLINES.length).padStart(2, '0')}
            </span>
          </div>

          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
            <SplitText as="span" text={d.title} trigger="mount" delay={0.1} className="block" />
          </h1>

          <motion.p
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
            className="mt-7 max-w-xl text-xl leading-relaxed text-white/70"
          >
            {d.lede}
          </motion.p>
        </div>
      </header>

      {/* THROUGH-LINE — a large pull-quote drawn straight from the body copy. */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-20">
        <Reveal>
          <figure
            className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 sm:p-14"
            style={{ borderLeft: `3px solid ${d.accent}` }}
          >
            <blockquote className="font-display text-2xl font-semibold leading-snug tracking-tight text-white/90 sm:text-3xl">
              {d.throughLine}
            </blockquote>
          </figure>
        </Reveal>
      </section>

      {/* BODY + PRACTICE + TOOLS */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-8">
        <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <p className="text-lg leading-relaxed text-white/65">{d.body}</p>

            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
                Reached for
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {d.tools.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border px-3 py-1 text-xs font-medium text-white/75"
                    style={{ borderColor: `${d.accent}40`, backgroundColor: `${d.accent}0d` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
              In practice
            </p>
            <ul className="mt-5 space-y-3.5">
              {d.practices.map((p, i) => (
                <motion.li
                  key={p}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.06 }}
                  className="flex items-start gap-3 text-sm leading-relaxed text-white/70"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: d.accent }}
                  />
                  {p}
                </motion.li>
              ))}
            </ul>

            <div className="mt-8">
              <Link
                to={d.evidence.to}
                className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: d.accent }}
              >
                {d.evidence.label}
                <span aria-hidden>-&gt;</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* RELATED DISCIPLINES */}
      {related.length > 0 && (
        <section className="mx-auto w-full max-w-4xl px-6 pb-8 pt-16">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
              Leans on
            </p>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {related.map((r, i) => (
              <Reveal key={r.id} delay={i * 0.06}>
                <Link
                  to={`/range/${r.id}`}
                  className="group block h-full rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.05]"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: r.accent }}
                    />
                    <span className="text-sm font-semibold text-white/80 group-hover:text-white">
                      {r.tag}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{r.lede}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* PAGER — walk the disciplines without going back to the index. */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-16 pt-12">
        <div className="grid gap-3 border-t border-white/10 pt-8 sm:grid-cols-2">
          <Link
            to={`/range/${prev.id}`}
            className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5 transition-colors hover:bg-white/[0.05]"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/35">
              <span aria-hidden>&larr;</span> Previous
            </span>
            <span className="mt-1.5 font-display text-lg font-semibold text-white/85 group-hover:text-white">
              {prev.tag}
            </span>
          </Link>
          <Link
            to={`/range/${next.id}`}
            className="group flex flex-col items-end rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5 text-right transition-colors hover:bg-white/[0.05]"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/35">
              Next <span aria-hidden>&rarr;</span>
            </span>
            <span className="mt-1.5 font-display text-lg font-semibold text-white/85 group-hover:text-white">
              {next.tag}
            </span>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-32">
        <Reveal>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl">
              Have something in {d.tag.toLowerCase()}?
            </h2>
            <div className="flex flex-wrap gap-3">
              <MagneticButton
                onClick={openContact}
                className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black"
              >
                Get in touch
              </MagneticButton>
              <Link
                to="/range"
                className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                All disciplines
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
