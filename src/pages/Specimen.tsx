import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { Seo } from '../components/Seo'
import { TYPE_SCALE } from '../data/design'

const EASE = [0.16, 1, 0.3, 1] as const

// The two variable axes the self-hosted Fraunces actually carries. Both are
// real — the site's headlines ride opsz automatically via font-optical-sizing.
// Here you drive them by hand.
const WGHT = { min: 300, max: 700, def: 600 } as const
const OPSZ = { min: 9, max: 144, def: 96 } as const

// A few honest sample lines to set in the tester. The last is editable.
const SAMPLES = [
  'Motion that earns its place',
  'Type is the interface',
  'Berlin, still building',
  'Handset, not templated',
] as const

// Best-effort clipboard copy, matching the Design page's helper.
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Short-lived "Copied" flag after a successful copy.
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
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  return [done, fire]
}

// One labelled axis slider. Native range, lime accent, live numeric readout.
function AxisSlider({
  id,
  label,
  unit,
  min,
  max,
  value,
  onChange,
}: {
  id: string
  label: string
  unit: string
  min: number
  max: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          {label}
        </label>
        <span className="font-mono text-sm tabular-nums text-white/70">
          {value}
          <span className="text-white/35">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1.5 w-full cursor-ew-resize appearance-none rounded-full bg-white/12 accent-[#DCF87C] outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
        aria-valuetext={`${value}${unit}`}
      />
      <div className="mt-1.5 flex justify-between font-mono text-[0.65rem] text-white/25">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}

// The centrepiece: drive Fraunces' weight and optical-size axes by hand and
// watch the letterforms redraw. font-optical-sizing is switched off here so the
// opsz slider takes over from the automatic tracking the rest of the site uses.
function AxisTester() {
  const reduce = useReducedMotion()
  const [wght, setWght] = useState<number>(WGHT.def)
  const [opsz, setOpsz] = useState<number>(OPSZ.def)
  const [sampleIndex, setSampleIndex] = useState(0)
  const [custom, setCustom] = useState('Set your own words')
  const [done, fire] = useCopied()

  const isCustom = sampleIndex === SAMPLES.length
  const text = isCustom ? custom || 'Set your own words' : SAMPLES[sampleIndex]
  const settings = `"opsz" ${opsz}, "wght" ${wght}`
  const css = `font-variation-settings: ${settings};`

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
      {/* Live specimen stage */}
      <div className="flex min-h-[220px] items-center justify-center px-6 py-14 sm:min-h-[300px] sm:py-20">
        <p
          className="text-center leading-[0.98] tracking-tight text-white"
          style={{
            fontFamily: '"Fraunces", ui-serif, Georgia, serif',
            fontOpticalSizing: 'none',
            fontVariationSettings: settings,
            fontSize: 'clamp(2.75rem, 9vw, 6.5rem)',
            // A soft transition as the axes move, unless motion is reduced.
            transition: reduce ? undefined : 'font-variation-settings 120ms linear',
          }}
        >
          {text}
        </p>
      </div>

      {/* Controls */}
      <div className="border-t border-white/10 bg-black/20 px-6 py-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <AxisSlider
            id="axis-wght"
            label="Weight"
            unit=""
            min={WGHT.min}
            max={WGHT.max}
            value={wght}
            onChange={setWght}
          />
          <AxisSlider
            id="axis-opsz"
            label="Optical size"
            unit="pt"
            min={OPSZ.min}
            max={OPSZ.max}
            value={opsz}
            onChange={setOpsz}
          />
        </div>

        {/* Sample switcher */}
        <div className="mt-7 flex flex-wrap gap-2">
          {SAMPLES.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setSampleIndex(i)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                sampleIndex === i
                  ? 'border-[#DCF87C]/60 bg-[#DCF87C]/10 text-[#DCF87C]'
                  : 'border-white/10 text-white/55 hover:border-white/25 hover:text-white/80'
              }`}
            >
              {s}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSampleIndex(SAMPLES.length)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              isCustom
                ? 'border-[#DCF87C]/60 bg-[#DCF87C]/10 text-[#DCF87C]'
                : 'border-white/10 text-white/55 hover:border-white/25 hover:text-white/80'
            }`}
          >
            Custom
          </button>
        </div>

        {isCustom && (
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={40}
            aria-label="Custom specimen text"
            className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/85 outline-none placeholder:text-white/30 focus:border-[#DCF87C]/50"
            placeholder="Set your own words"
          />
        )}

        {/* Copyable CSS readout */}
        <button
          type="button"
          onClick={() => fire(css)}
          className="group mt-6 flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left transition-colors hover:border-white/20"
          aria-label="Copy the font-variation-settings value"
        >
          <code className="truncate font-mono text-xs text-white/70 sm:text-sm">{css}</code>
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.15em] text-white/40 transition-colors group-hover:text-[#DCF87C]">
            {done ? 'Copied' : 'Copy'}
          </span>
        </button>
      </div>
    </div>
  )
}

// The alphabet and figures, set large in Fraunces at full display contrast. A
// classic specimen block — the whole character set, nothing invented.
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('')
const FIGURES = '0123456789&.,;:!?“”—'.split('')

function GlyphRow({ glyphs, label }: { glyphs: string[]; label: string }) {
  const reduce = useReducedMotion()
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">{label}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {glyphs.map((g, i) => (
          <motion.span
            key={`${g}-${i}`}
            whileHover={reduce ? undefined : { y: -4, color: '#DCF87C' }}
            transition={{ duration: 0.2, ease: EASE }}
            className="font-display text-4xl leading-none text-white/85 sm:text-5xl"
          >
            {g}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

export default function Specimen() {
  const reduce = useReducedMotion()

  return (
    <div className="mx-auto w-full max-w-4xl px-6 pb-28 pt-32">
      <Seo
        title="Type specimen"
        description="An interactive specimen of the type this site is set in — drive the variable Fraunces axes by hand, test your own words, and read the scale. Built by Arseniy Cherednichenko."
      />

      {/* Header */}
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <Eyebrow>Type specimen</Eyebrow>
        <h1 className="mt-5 font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl">
          <GradientText>The letters</GradientText>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/60">
          The site sets its headlines in <span className="text-white/85">Fraunces</span>, a self-hosted
          variable serif, and its body in <span className="text-white/85">Inter</span>. This is that type,
          up close and in your hands — move the axes, set your own words, and read the scale the pages
          actually step through.
        </p>
      </motion.header>

      {/* The variable axis tester */}
      <Reveal className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <Eyebrow>Drive the axes</Eyebrow>
          <span className="hidden font-mono text-xs text-white/30 sm:inline">Fraunces · opsz 9–144 · wght 300–700</span>
        </div>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50">
          Weight is the axis you know. Optical size is the quieter one: it redraws the letterforms as type
          grows, sharpening contrast for display and softening it for small text. On the rest of the site it
          tracks the font size on its own — here it is yours to push.
        </p>
        <div className="mt-6">
          <AxisTester />
        </div>
      </Reveal>

      {/* The scale */}
      <Reveal className="mt-20">
        <Eyebrow>The scale</Eyebrow>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50">
          Seven steps, in rem, exactly as the pages step through them. The display sizes are set in Fraunces;
          the reading sizes in Inter.
        </p>
        <ul className="mt-8 space-y-4">
          {TYPE_SCALE.map((step, i) => (
            <motion.li
              key={step.token}
              initial={reduce ? false : { opacity: 0, x: -16 }}
              whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : Math.min(i * 0.05, 0.3) }}
              className="flex items-baseline gap-5 border-b border-white/[0.06] pb-4"
            >
              <span className="w-24 shrink-0 font-mono text-xs text-white/30">
                {step.rem}rem
              </span>
              <span
                className={`min-w-0 flex-1 truncate leading-tight text-white/85 ${
                  step.display ? 'font-display font-semibold' : 'font-sans'
                }`}
                style={{ fontSize: `min(${step.rem}rem, 12vw)` }}
              >
                {step.label}
              </span>
              <span className="hidden shrink-0 font-mono text-xs text-white/25 sm:inline">{step.token}</span>
            </motion.li>
          ))}
        </ul>
      </Reveal>

      {/* Glyphs */}
      <Reveal className="mt-20">
        <Eyebrow>The character set</Eyebrow>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50">
          Fraunces at display contrast. Hover a glyph to lift it.
        </p>
        <div className="mt-8 space-y-8 rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-8 sm:px-8">
          <GlyphRow glyphs={UPPER} label="Uppercase" />
          <GlyphRow glyphs={LOWER} label="Lowercase" />
          <GlyphRow glyphs={FIGURES} label="Figures & marks" />
        </div>
      </Reveal>

      {/* The pairing */}
      <Reveal className="mt-20">
        <Eyebrow>The pairing</Eyebrow>
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-10 sm:px-10 sm:py-12">
          <h2 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl">
            A serif to say it, a sans to carry it.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
            The display face does the talking — it sets the tone the moment a page paints. The body face
            stays out of the way, neutral and legible at the sizes people actually read. One face for voice,
            one for clarity. Set together, they keep the site editorial without ever feeling loud.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/40">
            Fraunces is self-hosted and preloaded, so headlines paint without a flash. Inter falls back to the
            system UI stack. Nothing here is a webfont request to a third party.
          </p>
        </div>
      </Reveal>

      {/* Onward */}
      <Reveal className="mt-20">
        <div className="flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/45">Type is one piece of the system.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <Link to="/design" className="text-[#DCF87C] transition-opacity hover:opacity-80">
              Design language <span aria-hidden>-&gt;</span>
            </Link>
            <Link to="/colophon" className="text-white/70 transition-colors hover:text-white">
              Colophon <span aria-hidden>-&gt;</span>
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
