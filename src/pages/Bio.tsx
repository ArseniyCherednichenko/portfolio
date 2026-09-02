import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SpotlightCard } from '../components/SpotlightCard'
import { SegmentedControl } from '../components/SegmentedControl'
import { Threads } from '../components/Threads'
import { HoverIndex, type HoverIndexItem } from '../components/HoverIndex'
import { useToast } from '../components/Toast'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { Seo } from '../components/Seo'
import { BIO_VARIANTS, FAST_FACTS, NAME_NOTE, type FastFact } from '../data/bio'

const EASE = [0.16, 1, 0.3, 1] as const

// Best-effort clipboard write. Returns whether it landed so callers can flash a
// confirmation without assuming success on locked-down browsers.
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// A short-lived "Copied" state after a successful copy, self-resetting. One
// timer per instance, cleaned up on unmount. Mirrors the idiom on /design.
function useCopied(): [boolean, (text: string) => Promise<boolean>] {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fire = async (text: string) => {
    const ok = await copy(text)
    if (ok) {
      setDone(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setDone(false), 1400)
    }
    return ok
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  return [done, fire]
}

// Count words honestly — collapse whitespace, ignore empties. Used to put a
// real, live number under each bio rather than an invented metric.
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// The "read on" index — the last thing on the page points across the site, so a
// bio artifact still hands the reader the person, the story, and the work rather
// than ending on itself.
const READ_ON: HoverIndexItem[] = [
  { label: 'About', to: '/about', meta: 'The whole story' },
  { label: 'Résumé', to: '/resume', meta: 'The CV' },
  { label: 'Work', to: '/work', meta: 'What I have built' },
  { label: 'Contact', to: '/contact', meta: 'Say hello' },
]

// One at-a-glance fact, copyable on its own. The whole row is a button; if the
// fact has a link, a small arrow sits alongside and opens it without triggering
// the copy.
function FactRow({ fact }: { fact: FastFact }) {
  const [done, fire] = useCopied()
  const toCopy = fact.copyValue ?? fact.value
  return (
    <div className="group/fact flex items-center gap-3 border-t border-white/10 py-4 first:border-t-0">
      <button
        type="button"
        onClick={() => void fire(toCopy)}
        className="flex min-w-0 flex-1 items-baseline gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-md"
        aria-label={`Copy ${fact.label}: ${toCopy}`}
      >
        <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          {fact.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-white/85 transition-colors group-hover/fact:text-white">
          {fact.value}
        </span>
        <span
          className={`shrink-0 text-[11px] font-semibold transition-colors ${
            done ? 'text-[#DCF87C]' : 'text-white/25 group-hover/fact:text-white/55'
          }`}
        >
          {done ? 'Copied' : 'Copy'}
        </span>
      </button>
      {fact.href && (
        <a
          href={fact.href}
          target={fact.href.startsWith('http') ? '_blank' : undefined}
          rel={fact.href.startsWith('http') ? 'noreferrer' : undefined}
          className="shrink-0 rounded-md p-1 text-white/30 transition-colors hover:text-[#DCF87C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
          aria-label={`Open ${fact.label}`}
        >
          <span aria-hidden className="text-sm">-&gt;</span>
        </a>
      )}
    </div>
  )
}

export default function Bio() {
  const reduce = useReducedMotion()
  const { time, awake } = useBerlinTime()
  const { toast } = useToast()
  const [variantId, setVariantId] = useState<string>(BIO_VARIANTS[1].id)

  const variant = useMemo(
    () => BIO_VARIANTS.find((v) => v.id === variantId) ?? BIO_VARIANTS[1],
    [variantId],
  )
  const words = wordCount(variant.text)
  const chars = variant.text.length

  const copyBio = async () => {
    const ok = await copy(variant.text)
    toast(
      ok ? `Copied the ${variant.label.toLowerCase()} bio` : 'Copy blocked — select and copy by hand',
      { tone: ok ? 'success' : 'error' },
    )
  }

  return (
    <>
      <Seo
        title="Bio"
        description="The short version — copyable bios and fast facts for Arseniy Cherednichenko, a Berlin-based developer and co-founder of Guided. For when someone needs to introduce him."
      />

      {/* HEADER */}
      <header className="relative isolate mx-auto w-full max-w-4xl overflow-hidden px-6 pb-12 pt-36 sm:pt-44">
        {/* Faint drifting field, radial-masked to the top so the header has a
            pulse of its own without fighting the copy. Held to a still frame
            under reduced motion by the component itself. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(115%_78%_at_28%_8%,#000_0%,transparent_66%)]"
        >
          <Threads className="h-full w-full" count={16} amplitude={14} />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Bio</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          The <GradientText>short version.</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-white/60"
        >
          For when someone needs to introduce me — a host, an editor, an event page. Pick a length,
          copy it, and it is ready to paste. All of it honest, kept current, no funnel.
        </motion.p>

        {/* A quiet presence line, so the page reads as someone real and reachable. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/45"
        >
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {!reduce && awake && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C]/70" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${awake ? 'bg-[#DCF87C]' : 'bg-white/30'}`} />
            </span>
            Berlin
          </span>
          <span aria-hidden className="text-white/15">·</span>
          <span className="tabular-nums">{time} CET</span>
          <span aria-hidden className="text-white/15">·</span>
          <span>{awake ? 'likely around' : 'probably asleep'}</span>
        </motion.div>
      </header>

      {/* THE BIO — length picker + copyable block */}
      <section className="mx-auto w-full max-w-4xl px-6 py-8">
        <Reveal>
          <SpotlightCard>
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">Pick a length</span>
                <SegmentedControl
                  options={BIO_VARIANTS.map((v) => ({ value: v.id, label: v.label }))}
                  value={variantId}
                  onChange={setVariantId}
                  label="Bio length"
                  size="sm"
                />
              </div>

              <p className="mt-4 text-sm text-white/45">{variant.hint}</p>

              {/* The bio itself. Cross-fades as the length changes; a real,
                  live word/character count sits beneath it. */}
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={variant.id}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className={`leading-relaxed text-white/85 ${
                      variant.id === 'line' ? 'font-display text-2xl font-medium sm:text-3xl' : 'text-lg'
                    }`}
                  >
                    {variant.text}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs tabular-nums text-white/35">
                  {words} words · {chars} characters
                </span>
                <button
                  type="button"
                  onClick={() => void copyBio()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-black/70" />
                  Copy this bio
                </button>
              </div>
            </div>
          </SpotlightCard>
        </Reveal>
      </section>

      {/* FAST FACTS + NAME NOTE */}
      <section className="mx-auto grid w-full max-w-4xl gap-5 px-6 py-8 md:grid-cols-[1.3fr_1fr]">
        <Reveal>
          <SpotlightCard className="h-full">
            <div className="p-6 sm:p-7">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">Fast facts</span>
              <p className="mt-2 text-sm text-white/45">Tap any line to copy it.</p>
              <div className="mt-5">
                {FAST_FACTS.map((f) => (
                  <FactRow key={f.label} fact={f} />
                ))}
              </div>
            </div>
          </SpotlightCard>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="flex h-full flex-col gap-5">
            <SpotlightCard className="flex-1">
              <div className="flex h-full flex-col justify-between p-6 sm:p-7">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]">On the name</span>
                <p className="mt-4 font-display text-xl font-medium leading-snug text-white/85">{NAME_NOTE}</p>
              </div>
            </SpotlightCard>
            <SpotlightCard>
              <div className="p-6 sm:p-7">
                <p className="text-sm leading-relaxed text-white/55">
                  Need a portrait or logo? Email me and I will send the current ones — this page
                  stays text, honest and easy to lift.
                </p>
              </div>
            </SpotlightCard>
          </div>
        </Reveal>
      </section>

      {/* READ ON — cross-links so a bio never ends on itself */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-24 pt-10">
        <Reveal>
          <div className="flex items-baseline justify-between gap-4">
            <Eyebrow>Read on</Eyebrow>
            <span className="text-xs uppercase tracking-[0.22em] text-white/35">More of me</span>
          </div>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-white/60">
            A bio is the compressed version. The rest of the site is the long one.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <HoverIndex items={READ_ON} className="mt-6" />
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-10 text-center text-sm text-white/40">
            Prefer the real thing?{' '}
            <Link to="/contact" className="font-semibold text-[#DCF87C] transition-opacity hover:opacity-80">
              Get in touch
            </Link>
            .
          </p>
        </Reveal>
      </section>
    </>
  )
}
