import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { SegmentedControl } from '../components/SegmentedControl'
import { ElasticSlider } from '../components/ElasticSlider'
import { MagneticButton } from '../components/MagneticButton'
import { useToast } from '../components/Toast'
import { Seo } from '../components/Seo'
import {
  GenerativePoster,
  paintPoster,
  paletteById,
  POSTER_MOTIFS,
  POSTER_PALETTES,
  type PosterMotif,
  type PosterOptions,
} from '../components/GenerativePoster'

const EASE = [0.16, 1, 0.3, 1] as const

const MOTIF_IDS = POSTER_MOTIFS.map((m) => m.id) as PosterMotif[]

function isMotif(v: string | null): v is PosterMotif {
  return v != null && (MOTIF_IDS as string[]).includes(v)
}

function clampDensity(v: number) {
  if (!Number.isFinite(v)) return 0.5
  return Math.min(1, Math.max(0, v))
}

// A fresh integer seed for the "Randomize" button. This is the one place chance
// is welcome: it only chooses which deterministic poster to draw next. The
// renderer itself never touches Math.random — the seed alone decides the pixels.
function freshSeed() {
  return Math.floor(Math.random() * 1_000_000_000)
}

export default function Studio() {
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  // The whole composition lives in the URL, so a poster you like is a link you
  // can share and someone else opens to the exact same picture. Read on mount,
  // clamped and validated, with honest fallbacks.
  const seedParam = Number.parseInt(params.get('seed') ?? '', 10)
  const [seed, setSeed] = useState<number>(Number.isFinite(seedParam) ? seedParam >>> 0 : 73_501)
  const [motif, setMotif] = useState<PosterMotif>(isMotif(params.get('motif')) ? (params.get('motif') as PosterMotif) : 'bloom')
  const paletteParam = params.get('palette') ?? ''
  const [paletteId, setPaletteId] = useState<string>(
    POSTER_PALETTES.some((p) => p.id === paletteParam) ? paletteParam : 'lime',
  )
  const densityParam = Number.parseFloat(params.get('d') ?? '')
  const [density, setDensity] = useState<number>(Number.isFinite(densityParam) ? clampDensity(densityParam) : 0.55)

  const options: PosterOptions = useMemo(
    () => ({ seed, motif, palette: paletteById(paletteId), density }),
    [seed, motif, paletteId, density],
  )

  // Mirror the current composition back into the URL (replace, so the back
  // button is not spammed with every slider nudge).
  const sync = useCallback(
    (next: Partial<{ seed: number; motif: PosterMotif; palette: string; d: number }>) => {
      const merged = {
        seed: next.seed ?? seed,
        motif: next.motif ?? motif,
        palette: next.palette ?? paletteId,
        d: next.d ?? density,
      }
      setParams(
        {
          seed: String(merged.seed),
          motif: merged.motif,
          palette: merged.palette,
          d: merged.d.toFixed(2),
        },
        { replace: true },
      )
    },
    [seed, motif, paletteId, density, setParams],
  )

  const onMotif = (v: string) => {
    if (!isMotif(v)) return
    setMotif(v)
    sync({ motif: v })
  }
  const onPalette = (v: string) => {
    setPaletteId(v)
    sync({ palette: v })
  }
  const onDensity = (v: number) => {
    const d = clampDensity(v / 100)
    setDensity(d)
    sync({ d })
  }
  const randomize = () => {
    const s = freshSeed()
    setSeed(s)
    sync({ seed: s })
  }

  // The export: paint the identical composition onto a large offscreen canvas
  // and hand it over as a PNG. Not a screenshot of the preview — the same pure
  // function, run at print resolution, so it is crisp however big it is opened.
  const download = () => {
    const W = 1600
    const H = 2000
    const off = document.createElement('canvas')
    off.width = W
    off.height = H
    const ctx = off.getContext('2d')
    if (!ctx) {
      toast('Could not open a canvas to export.', { tone: 'error' })
      return
    }
    paintPoster(ctx, W, H, options)
    off.toBlob((blob) => {
      if (!blob) {
        toast('The export did not produce an image.', { tone: 'error' })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `arseniy-studio-${motif}-${seed}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoke on the next tick so the download has started.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast('Poster saved as a PNG.', { tone: 'success' })
    }, 'image/png')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast('Link copied — it reopens this exact poster.', { tone: 'success' })
    } catch {
      toast('Could not reach the clipboard.', { tone: 'error' })
    }
  }

  const activeMotif = POSTER_MOTIFS.find((m) => m.id === motif) ?? POSTER_MOTIFS[0]

  return (
    <>
      <Seo
        title="Studio"
        description="A generative poster studio — pick a motif, a palette, and a seed, and take away a one-of-a-kind PNG. Drawn in the browser from seeded canvas code, no libraries underneath."
      />

      {/* INTRO */}
      <header className="mx-auto w-full max-w-5xl px-6 pb-10 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Studio</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Make one, <GradientText>take it with you.</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
          className="mt-6 max-w-xl text-lg leading-relaxed text-white/55"
        >
          A generative poster, drawn in the browser from the same seeded canvas craft the
          Playground runs on. Turn the dials, land on one you like, and download it — the
          whole composition lives in the address bar, so the link reopens your exact poster.
        </motion.p>
      </header>

      {/* THE STUDIO — poster left, controls right (stacked on small screens) */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* PREVIEW */}
          <Reveal>
            <figure className="m-0">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
                {/* 4:5 poster frame. The canvas fills it and repaints on resize. */}
                <div className="aspect-[4/5] w-full">
                  <GenerativePoster options={options} className="h-full w-full" />
                </div>
              </div>
              <figcaption className="sr-only">
                A generative poster with the {activeMotif.label} motif in the {options.palette.label} palette,
                grown from seed {seed}.
              </figcaption>
            </figure>
          </Reveal>

          {/* CONTROLS */}
          <Reveal delay={0.08}>
            <div className="flex flex-col gap-8">
              {/* Motif */}
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Motif</span>
                </div>
                <SegmentedControl
                  className="mt-3"
                  label="Motif"
                  value={motif}
                  onChange={onMotif}
                  options={POSTER_MOTIFS.map((m) => ({ value: m.id, label: m.label }))}
                />
                <p className="mt-3 text-sm leading-relaxed text-white/45">{activeMotif.note}</p>
              </div>

              {/* Palette */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Palette</span>
                <div className="mt-3 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Palette">
                  {POSTER_PALETTES.map((p) => {
                    const active = p.id === paletteId
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onPalette(p.id)}
                        className={`flex items-center gap-2.5 rounded-full border px-3 py-2 text-sm transition-colors ${
                          active
                            ? 'border-[#DCF87C]/50 bg-white/[0.06] text-white'
                            : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/25 hover:text-white/85'
                        }`}
                      >
                        <span className="flex -space-x-1" aria-hidden>
                          {p.inks.map((ink) => (
                            <span
                              key={ink}
                              className="h-3.5 w-3.5 rounded-full ring-1 ring-black/60"
                              style={{ backgroundColor: ink }}
                            />
                          ))}
                        </span>
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Density */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Density</span>
                <ElasticSlider
                  className="mt-3"
                  label="Density"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(density * 100)}
                  onChange={onDensity}
                  format={(v) => `${Math.round(v)}%`}
                />
              </div>

              {/* Seed + randomize */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">Seed</span>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <code className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm tabular-nums text-white/80">
                    {seed}
                  </code>
                  <button
                    type="button"
                    onClick={randomize}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 2v6h-6" />
                      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                      <path d="M3 22v-6h6" />
                      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                    </svg>
                    Randomize
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <MagneticButton
                  onClick={download}
                  className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black"
                >
                  Download PNG
                </MagneticButton>
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.06]"
                >
                  Copy link
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* HOW IT IS MADE — an honest footnote */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-28">
        <Reveal>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-7 sm:p-9">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#DCF87C]">How it is made</span>
            <p className="mt-4 leading-relaxed text-white/60">
              Every poster is a pure function of four values — the motif, the palette, the
              density, and the seed. There is no image library and no server: the picture is
              drawn straight onto a canvas, and the seed feeds a small deterministic generator
              (a <span className="text-white/80">mulberry32</span>), so the same settings paint
              the same poster every time.
            </p>
            <p className="mt-4 leading-relaxed text-white/60">
              The download is not a screenshot of the preview — it runs the identical drawing
              code onto a large offscreen canvas and hands you that as a PNG, so it stays crisp
              at whatever size you open it.
            </p>
          </div>
        </Reveal>
      </section>
    </>
  )
}
