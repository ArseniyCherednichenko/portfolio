import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { MagneticButton } from '../components/MagneticButton'
import { Seo } from '../components/Seo'
import {
  RESUME_NAME,
  RESUME_ROLE,
  RESUME_SUMMARY,
  RESUME_CONTACT,
  RESUME_EXPERIENCE,
  RESUME_EDUCATION,
  RESUME_SKILLS,
  RESUME_LOOKING,
} from '../data/resume'

const EASE = [0.16, 1, 0.3, 1] as const

// A quiet section heading inside the CV sheet.
function SheetHeading({ children }: { children: string }) {
  return (
    <h2 className="mb-5 font-display text-lg font-semibold tracking-tight text-white/90 print:text-black">
      {children}
    </h2>
  )
}

// The /résumé page: the whole person on one page, arranged as a real document.
// On screen it wears the site's dark, editorial styling; on print (or ⌘P) the
// `.resume-print` sheet flips to clean ink-on-paper and the site chrome drops
// away — a genuinely useful, save-to-PDF CV, not a screenshot. It de-centers
// Guided by placing it as one entry in a fuller professional picture.
export default function Resume() {
  const reduce = useReducedMotion()

  // Toggle a class on <html> around print so any leftover motion transforms are
  // neutralised even for browsers that snapshot before `@media print` settles.
  useEffect(() => {
    const before = () => document.documentElement.classList.add('is-printing')
    const after = () => document.documentElement.classList.remove('is-printing')
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [])

  return (
    <>
      <Seo
        title="Résumé"
        description="Arseniy Cherednichenko's résumé — a one-page, print-ready CV. Builder and co-founder of Guided, based in Berlin, working across web, native iOS, and applied AI."
      />

      {/* HEADER — screen only */}
      <header className="no-print mx-auto w-full max-w-3xl px-6 pb-10 pt-36 sm:pt-44">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Résumé</Eyebrow>
        </motion.div>
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          The <GradientText>short</GradientText> version.
        </motion.h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          One page, honest and current. The site is the long version — the{' '}
          <Link to="/work" className="text-[#DCF87C] underline-offset-4 hover:underline">
            case studies
          </Link>{' '}
          and{' '}
          <Link to="/playground" className="text-[#DCF87C] underline-offset-4 hover:underline">
            playground
          </Link>{' '}
          hold the detail. This is built to print: it saves to a clean PDF.
        </motion.p>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-9 flex flex-wrap items-center gap-4"
        >
          <MagneticButton
            onClick={() => window.print()}
            className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black"
          >
            Save as PDF
          </MagneticButton>
          <span className="text-sm text-white/40">
            or press{' '}
            <kbd className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[11px] font-medium text-white/60">
              ⌘P
            </kbd>
          </span>
        </motion.div>
      </header>

      {/* THE SHEET — the printable document */}
      <Reveal>
        <article className="resume-print mx-auto mb-28 w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-10 sm:px-12 sm:py-14 print:mb-0 print:max-w-none print:rounded-none print:border-0 print:bg-transparent print:px-0 print:py-0">
          {/* Identity */}
          <div className="flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between print:border-black/15">
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl print:text-black">
                {RESUME_NAME}
              </h1>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#DCF87C] print:text-black/70">
                {RESUME_ROLE}
              </p>
            </div>
            <ul className="space-y-1 text-sm sm:text-right">
              {RESUME_CONTACT.map((c) => (
                <li key={c.label} className="text-white/60 print:text-black/70">
                  {c.href ? (
                    <a
                      href={c.href}
                      target={c.href.startsWith('mailto') ? undefined : '_blank'}
                      rel="noreferrer"
                      className="underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline print:text-black print:no-underline"
                    >
                      {c.value}
                    </a>
                  ) : (
                    <span className="print:text-black">{c.value}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Summary */}
          <section className="py-8">
            <p className="max-w-2xl text-[15px] leading-relaxed text-white/70 print:text-black/80">
              {RESUME_SUMMARY}
            </p>
          </section>

          {/* Experience */}
          <section className="border-t border-white/10 py-8 print:border-black/15">
            <SheetHeading>Experience</SheetHeading>
            <div className="space-y-8">
              {RESUME_EXPERIENCE.map((e) => (
                <div key={e.org} className="print:break-inside-avoid">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-display text-xl font-semibold tracking-tight print:text-black">
                      {e.role}
                    </h3>
                    <span className="text-sm tabular-nums text-white/45 print:text-black/60">{e.period}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[#DCF87C] print:text-black/70">
                    {e.href ? (
                      <a
                        href={e.href}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-4 hover:underline print:no-underline"
                      >
                        {e.org}
                      </a>
                    ) : (
                      e.org
                    )}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {e.points.map((p) => (
                      <li
                        key={p}
                        className="relative pl-5 text-[15px] leading-relaxed text-white/65 print:text-black/80"
                      >
                        <span
                          aria-hidden
                          className="absolute left-0 top-[0.6em] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#DCF87C] print:bg-black"
                        />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Two-up: education + what I'm looking for */}
          <section className="grid gap-8 border-t border-white/10 py-8 sm:grid-cols-2 print:border-black/15">
            <div className="print:break-inside-avoid">
              <SheetHeading>Education</SheetHeading>
              {RESUME_EDUCATION.map((ed) => (
                <div key={ed.what}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <h3 className="font-display text-lg font-semibold tracking-tight print:text-black">
                      {ed.what}
                    </h3>
                    <span className="text-sm text-white/45 print:text-black/60">{ed.period}</span>
                  </div>
                  <p className="text-sm font-medium text-[#DCF87C] print:text-black/70">{ed.where}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/60 print:text-black/80">{ed.note}</p>
                </div>
              ))}
            </div>
            <div className="print:break-inside-avoid">
              <SheetHeading>Looking for</SheetHeading>
              <p className="text-[15px] leading-relaxed text-white/60 print:text-black/80">{RESUME_LOOKING}</p>
            </div>
          </section>

          {/* Skills */}
          <section className="border-t border-white/10 py-8 print:border-black/15">
            <SheetHeading>Toolkit</SheetHeading>
            <div className="grid gap-6 sm:grid-cols-2">
              {RESUME_SKILLS.map((g) => (
                <div key={g.label} className="print:break-inside-avoid">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 print:text-black/60">
                    {g.label}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {g.items.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-xs text-white/65 print:border-black/20 print:bg-transparent print:text-black/80"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Closing line — appears in print as a footer note */}
          <footer className="border-t border-white/10 pt-6 text-sm text-white/40 print:border-black/15 print:text-black/60">
            The full story, with case studies and live motion, lives on the site this was printed from — hand-built
            and open source at{' '}
            <span className="text-white/60 print:text-black/80">github.com/ArseniyCherednichenko</span>.
          </footer>
        </article>
      </Reveal>
    </>
  )
}
