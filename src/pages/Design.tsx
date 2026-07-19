import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { DotGrid } from '../components/DotGrid'
import { Seo } from '../components/Seo'
import {
  CORE_COLORS,
  MOTION,
  SIGNATURE_EASE,
  SURFACE_LADDER,
  TEXT_LADDER,
  TYPE,
  TYPE_SCALE,
  type Swatch,
} from '../data/design'

const EASE = [0.16, 1, 0.3, 1] as const

// Copy a string to the clipboard, best-effort. Returns whether it landed, so
// the caller can flash a confirmation without assuming success on locked-down
// browsers where the API is unavailable.
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// A hook that gives a token a short-lived "Copied" state after a successful
// copy, then resets itself. One timer per instance, cleaned up on unmount.
function useCopied(): [boolean, (text: string) => void] {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fire = (text: string) => {
    void copy(text).then((ok) => {
      if (!ok) return
      setDone(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setDone(false), 1100)
    })
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  return [done, fire]
}

// One colour chip. The whole chip is a button: press it to copy the value.
// The near-black ground gets a hairline so it separates from the page; the
// lime is flagged as the single accent.
function ColorChip({ swatch }: { swatch: Swatch }) {
  const [done, fire] = useCopied()
  return (
    <button
      type="button"
      onClick={() => fire(swatch.value)}
      className="group/chip flex flex-col text-left focus:outline-none"
      aria-label={`Copy ${swatch.name}, ${swatch.value}`}
    >
      <span
        className={`relative flex h-24 w-full items-end justify-end overflow-hidden rounded-2xl p-3 transition-transform duration-300 group-hover/chip:-translate-y-0.5 group-focus-visible/chip:ring-2 group-focus-visible/chip:ring-[#DCF87C] ${
          swatch.dark ? 'border border-white/15' : ''
        }`}
        style={{ background: swatch.value }}
      >
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-opacity duration-200 ${
            done ? 'opacity-100' : 'opacity-0 group-hover/chip:opacity-100'
          } ${swatch.accent || !swatch.dark ? 'bg-black/70 text-white' : 'bg-white/85 text-black'}`}
        >
          {done ? 'Copied' : 'Copy'}
        </span>
      </span>
      <span className="mt-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-white/90">{swatch.name}</span>
        <span className="font-mono text-xs uppercase text-white/45">{swatch.value}</span>
      </span>
      <span className="mt-1 text-xs leading-relaxed text-white/45">{swatch.note}</span>
    </button>
  )
}

// A rung of the opacity ladder: a bar filled to its strength, its token, and
// the job it does. Rendered for both the text and surface ladders.
function LadderRow({ token, opacity, role }: { token: string; opacity: number; role: string }) {
  const [done, fire] = useCopied()
  return (
    <button
      type="button"
      onClick={() => fire(token)}
      className="group/row flex w-full items-center gap-4 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#DCF87C]"
      aria-label={`Copy ${token}`}
    >
      <span className="h-6 w-24 shrink-0 overflow-hidden rounded-md border border-white/10">
        <span className="block h-full w-full" style={{ background: `rgba(255,255,255,${opacity / 100})` }} />
      </span>
      <span className="w-40 shrink-0 font-mono text-xs text-white/70">{token}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-white/45">{role}</span>
      <span className={`shrink-0 text-[11px] font-semibold ${done ? 'text-[#DCF87C]' : 'text-white/25 group-hover/row:text-white/50'}`}>
        {done ? 'Copied' : `${opacity}%`}
      </span>
    </button>
  )
}

// The signature-ease demo: a marker that slides the width of its track on the
// house curve whenever you press replay. Reduced-motion users get a still
// marker at rest and a note, so the curve is described rather than performed.
function EaseDemo() {
  const reduce = useReducedMotion()
  const [run, setRun] = useState(0)
  const [done, fire] = useCopied()
  return (
    <div>
      <div className="relative h-14 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="absolute inset-y-0 left-0 flex w-full items-center px-2">
          {reduce ? (
            <span className="h-8 w-8 rounded-lg bg-[#DCF87C]" />
          ) : (
            <motion.span
              key={run}
              initial={{ x: 0 }}
              animate={{ x: 'calc(100% - 2rem)' }}
              transition={{ duration: 0.9, ease: EASE }}
              className="h-8 w-8 rounded-lg bg-[#DCF87C]"
              style={{ position: 'relative', left: 0 }}
            />
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => fire(SIGNATURE_EASE)}
          className="font-mono text-xs text-white/60 transition-colors hover:text-white/90"
        >
          {done ? 'Copied' : SIGNATURE_EASE}
        </button>
        {!reduce && (
          <button
            type="button"
            onClick={() => setRun((n) => n + 1)}
            className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:border-[#DCF87C]/50 hover:text-white"
          >
            Replay
          </button>
        )}
      </div>
    </div>
  )
}

// The /design page: a living style guide. Every colour, face, and curve here is
// pulled from what the site is actually built on, and the whole thing is
// interactive — press a token to copy it. It shows taste directly rather than
// describing it, and belongs to the craft, not to any one project.
export default function Design() {
  return (
    <>
      <Seo
        title="Design language"
        description="The palette, type, and motion this site is built from — a living, interactive style guide by Arseniy Cherednichenko. Press any token to copy it."
      />

      {/* HEADER */}
      <header className="relative isolate overflow-hidden pb-12 pt-36 sm:pt-44">
        {/* An interactive dot grid behind the title — a fitting ambient layer
            for a page about the system underneath. Radial-masked so it fades
            into the dark and never competes with the copy. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(120%_80%_at_70%_20%,#000_0%,transparent_70%)]"
        >
          <DotGrid gap={30} dotSize={2} />
        </div>
        <div className="mx-auto w-full max-w-4xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <Eyebrow>Design language</Eyebrow>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
            className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
          >
            The <GradientText>system</GradientText> underneath.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
            className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
          >
            Not a description of the design — the design itself, laid out as a
            living guide. Three colours, two faces, one curve. Every token here
            is the real one the site is built on, so press any of them to copy
            it and see how little it takes to hold a whole site together.
          </motion.p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-6 pb-28">
        {/* COLOUR */}
        <section className="border-t border-white/10 py-16">
          <Reveal>
            <Eyebrow>Colour</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">{CORE_COLORS.label}</h2>
            <p className="mt-3 max-w-xl text-white/55">{CORE_COLORS.blurb}</p>
          </Reveal>
          <Reveal delay={0.05} className="mt-8 grid gap-6 sm:grid-cols-3">
            {CORE_COLORS.swatches.map((s) => (
              <ColorChip key={s.name} swatch={s} />
            ))}
          </Reveal>

          {/* The ladders do the real hierarchy work. */}
          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <Reveal>
              <SpotlightCard className="h-full">
                <div className="p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Text on ink</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">
                    White at a few fixed strengths does every level of the type hierarchy. No second hue.
                  </p>
                  <div className="mt-5 space-y-1">
                    {TEXT_LADDER.map((r) => (
                      <LadderRow key={r.token} {...r} />
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
            <Reveal delay={0.05}>
              <SpotlightCard className="h-full">
                <div className="p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">Surfaces & edges</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">
                    A card lifts, a hairline separates — all from the same white, a few percent strong.
                  </p>
                  <div className="mt-5 space-y-1">
                    {SURFACE_LADDER.map((r) => (
                      <LadderRow key={r.token} {...r} />
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          </div>
        </section>

        {/* TYPE */}
        <section className="border-t border-white/10 py-16">
          <Reveal>
            <Eyebrow>Type</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">Two faces, clear jobs</h2>
            <p className="mt-3 max-w-xl text-white/55">
              A variable serif for the display voice, a neutral sans for everything people read and touch.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {TYPE.map((t, i) => (
              <Reveal key={t.family} delay={i * 0.05}>
                <SpotlightCard className="h-full">
                  <div className="flex h-full flex-col p-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-xl font-bold tracking-tight">{t.family}</h3>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">{t.role}</span>
                    </div>
                    <p className={`mt-5 text-3xl leading-tight ${t.className}`}>{t.specimen}</p>
                    <p className="mt-5 text-sm leading-relaxed text-white/50">{t.note}</p>
                    <p className="mt-4 font-mono text-xs text-white/35">{t.weights}</p>
                  </div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>

          {/* The scale, as a visible ladder. */}
          <Reveal className="mt-8">
            <SpotlightCard>
              <div className="p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">The scale</h3>
                <div className="mt-6 space-y-4">
                  {TYPE_SCALE.map((s) => (
                    <div key={s.token} className="flex items-baseline gap-5 border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
                      <span className="w-24 shrink-0 font-mono text-xs text-white/35">{s.token}</span>
                      <span
                        className={`min-w-0 flex-1 truncate font-bold leading-none tracking-tight text-white/90 ${s.display ? 'font-display' : 'font-sans'}`}
                        style={{ fontSize: `min(${s.rem}rem, 12vw)` }}
                      >
                        {s.label}
                      </span>
                      <span className="shrink-0 text-xs text-white/30">{s.rem}rem</span>
                    </div>
                  ))}
                </div>
              </div>
            </SpotlightCard>
          </Reveal>
        </section>

        {/* MOTION */}
        <section className="border-t border-white/10 py-16">
          <Reveal>
            <Eyebrow>Motion</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight">One curve, mostly</h2>
            <p className="mt-3 max-w-xl text-white/55">
              Almost every entrance rides a single expo-out curve. Springs are held back for the things
              that should feel physical.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <SpotlightCard className="h-full">
                <div className="p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">The house curve</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">
                    Press replay to watch it, or copy the value straight into your own project.
                  </p>
                  <div className="mt-6">
                    <EaseDemo />
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
            <Reveal delay={0.05}>
              <SpotlightCard className="h-full">
                <div className="p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">The tokens</h3>
                  <div className="mt-5 space-y-4">
                    {MOTION.map((m) => (
                      <div key={m.name} className="border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-semibold text-white/85">{m.name}</span>
                          <span className="font-mono text-xs text-white/40">{m.value}</span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-white/45">{m.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          </div>
        </section>

        {/* CLOSE */}
        <section className="border-t border-white/10 pt-16">
          <Reveal className="flex flex-col items-start gap-6">
            <p className="max-w-xl text-lg leading-relaxed text-white/70">
              A small palette, held with discipline, is what lets everything else move. See where these
              tokens end up, or read how the whole thing is put together.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/playground"
                className="rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition hover:brightness-105"
              >
                See it move
              </Link>
              <Link
                to="/colophon"
                className="rounded-full border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-white/[0.06]"
              >
                How it is built
              </Link>
            </div>
          </Reveal>
        </section>
      </div>
    </>
  )
}
