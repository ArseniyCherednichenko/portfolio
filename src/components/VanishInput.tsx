import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// VanishInput — a text field whose own contents dissolve into pixels on submit.
//
// The well-known "placeholders and vanish input" micro-interaction, rebuilt by
// hand. It is deliberately a *product primitive* rather than another toy: the
// search box / subscribe field / prompt bar every app has, with two pieces of
// craft a plain <input> never carries.
//
// 1. Cycling placeholders. While the field is empty it rotates through a list of
//    prompts, each rising in and the last one leaving upward, so the box always
//    suggests what it is for without ever claiming the user typed anything.
//
// 2. The vanish. On submit the real text is rasterised onto an overlay canvas at
//    the input's own font, broken into one particle per lit pixel, and those
//    particles jitter and shrink away from a dissolve front that sweeps across
//    the word — so the entry does not just clear, it comes apart. The live
//    <input> text is hidden for that window so the pixels are the only copy.
//
// Honest and reachable: a real <form> with a real labelled <input> and a real
// submit <button>, so Enter and the button both submit and a screen reader hears
// a field, not an effect. The canvas is purely decorative (aria-hidden). Under
// reduced motion there is no dissolve and no placeholder travel — the field
// clears instantly on submit and shows a single steady placeholder — so it stays
// a calm, usable control with nothing moving.

interface Particle {
  x: number
  y: number
  r: number
  color: string
}

interface VanishInputProps {
  /** The prompts cycled through while the field is empty. First is shown first. */
  placeholders: string[]
  /** Called with the submitted value the instant submit fires (before it clears). */
  onSubmit?: (value: string) => void
  /** Accessible name for the field. */
  label?: string
  className?: string
}

export function VanishInput({
  placeholders,
  onSubmit,
  label = 'Type something',
  className = '',
}: VanishInputProps) {
  const reduce = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const dprRef = useRef(1)

  const [value, setValue] = useState('')
  const [animating, setAnimating] = useState(false)
  const [index, setIndex] = useState(0)

  // Rotate the empty-field placeholders. Content change only, so it is paused
  // under reduced motion (shows the first prompt, steady) and while a tab is
  // hidden, and it never runs while the user is mid-entry.
  useEffect(() => {
    if (reduce || placeholders.length <= 1) return
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (timer) return
      timer = setInterval(() => setIndex((i) => (i + 1) % placeholders.length), 3000)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
    const onVisibility = () => (document.hidden ? stop() : start())
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduce, placeholders.length])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Rasterise the current value into the overlay canvas at the input's own font,
  // then read the pixels back into one small particle per lit dot. All geometry
  // is in device pixels so the dissolve stays crisp on high-DPR screens.
  const rasterise = useCallback(() => {
    const input = inputRef.current
    const canvas = canvasRef.current
    if (!input || !canvas) return false
    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    const rect = input.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    dprRef.current = dpr
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    canvas.width = w * dpr
    canvas.height = h * dpr

    const cs = getComputedStyle(input)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`
    ctx.fillStyle = cs.color
    ctx.textBaseline = 'middle'
    ctx.fillText(value, parseFloat(cs.paddingLeft) || 0, h / 2)

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const particles: Particle[] = []
    const step = Math.max(1, Math.round(dpr))
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const i = (y * canvas.width + x) * 4
        const a = data[i + 3]
        if (a > 0) {
          particles.push({
            x,
            y,
            r: step,
            color: `rgba(${data[i]},${data[i + 1]},${data[i + 2]},${a / 255})`,
          })
        }
      }
    }
    particlesRef.current = particles
    return particles.length > 0
  }, [value])

  // Sweep a dissolve front leftward across the word; particles behind the front
  // hold, particles it has passed jitter outward and shrink until gone.
  const runVanish = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      setValue('')
      setAnimating(false)
      return
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const stepPx = 8 * dprRef.current

    const frame = (pos: number) => {
      const next: Particle[] = []
      for (const p of particlesRef.current) {
        if (p.x < pos) {
          next.push(p)
          continue
        }
        if (p.r <= 0) continue
        p.x += Math.random() > 0.5 ? 1 : -1
        p.y += Math.random() > 0.5 ? 1 : -1
        p.r -= 0.05 * Math.random() * dprRef.current
        next.push(p)
      }
      particlesRef.current = next

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of next) {
        if (p.x > pos && p.r > 0) {
          ctx.fillStyle = p.color
          ctx.fillRect(p.x, p.y, p.r, p.r)
        }
      }

      if (next.length > 0) {
        rafRef.current = requestAnimationFrame(() => frame(pos - stepPx))
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setValue('')
        setAnimating(false)
      }
    }

    rafRef.current = requestAnimationFrame(() => frame(canvas.width))
  }, [])

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (animating) return
      const v = value.trim()
      if (!v) return
      onSubmit?.(value)
      if (reduce) {
        setValue('')
        return
      }
      if (rasterise()) {
        setAnimating(true)
        runVanish()
      } else {
        setValue('')
      }
    },
    [animating, value, onSubmit, reduce, rasterise, runVanish],
  )

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative h-14 w-full max-w-xl overflow-hidden rounded-full border border-white/12 bg-white/[0.04] shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] transition-colors focus-within:border-[#DCF87C]/50 focus-within:bg-white/[0.06] ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute left-0 top-0 h-full w-full ${
          animating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => !animating && setValue(e.target.value)}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        className={`relative z-10 h-full w-full rounded-full bg-transparent pl-6 pr-14 text-base text-white/90 outline-none placeholder:text-transparent sm:text-lg ${
          animating ? 'text-transparent caret-transparent' : ''
        }`}
      />

      {/* Cycling placeholder overlay — shown only while the field is empty. */}
      {value === '' && !animating && (
        <div className="pointer-events-none absolute inset-y-0 left-6 right-14 z-0 flex items-center">
          {reduce ? (
            <span className="truncate text-base text-white/35 sm:text-lg">
              {placeholders[0]}
            </span>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={index}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="truncate text-base text-white/35 sm:text-lg"
              >
                {placeholders[index]}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
      )}

      <button
        type="submit"
        aria-label="Submit"
        disabled={animating}
        className="absolute right-2 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[#DCF87C] text-black transition-[transform,opacity] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-60 motion-reduce:hover:scale-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  )
}
