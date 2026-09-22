import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'

// Polaroid — the one gesture the "Cards & surfaces" family was still missing:
// a picture that is not there yet. Where the flip card turns, the scratch card
// is rubbed away, the sticker peels and the ticket tears, this one *develops* —
// it mounts as a near-blank, over-exposed square and, over a few seconds, the
// image swims up out of the emulsion the way a real instant photo does: the
// contrast climbs, the colour floods back, the fog burns off, and the print
// settles. Nothing about the picture is faked in post — the whole develop is a
// single number `d` from 0 to 1 driving CSS filters over one canvas the scene
// is drawn to exactly once, so it costs a filter recompute per frame, not a
// repaint.
//
// The photo itself is honest: a *seeded generative* dusk — a graded sky, a soft
// low sun, layered hills and a wash of film grain — drawn from a mulberry32
// PRNG off the `seed` prop, so it is abstract art that redraws identically each
// load, never a claim to be a photograph of a real place. Re-expose it (click,
// or Enter/Space) and it reseeds to a brand-new one-of-a-kind frame and develops
// again.
//
// And it carries the instant-film gesture people actually reach for: grab the
// print and *shake* it. Drag the card and every hard reversal of direction
// agitates the emulsion — a burst of develop plus a physical wobble of the whole
// frame — so an impatient shake genuinely brings the picture up faster (the myth
// is that shaking helps; here, by hand, it does). Keyboard users get the same:
// while it is still developing, Enter/Space agitates instead of re-exposing.
//
// The frame tilts a few degrees toward the cursor under a soft gloss, the way a
// print catches the light as you turn it. Reduced motion drops all of it — no
// develop, no tilt, no shake, no wobble: the finished photo is simply there, and
// the caption reads as it always would.

export interface PolaroidProps {
  /** Deterministic scene seed. Same seed → same generated frame. */
  seed?: number
  /** The handwritten caption on the white lower border. Keep it honest. */
  caption?: string
  /** Seconds for an untouched print to fully develop. */
  duration?: number
  className?: string
}

// mulberry32 — the tiny seeded PRNG used across the field toys here, so a given
// seed paints the identical frame every mount with no Math.random.
function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Draw a seeded dusk into the canvas once, at device resolution. Abstract on
// purpose — a graded sky, a low sun bloom, a few hill bands and grain — so it
// reads as generative art rather than a photograph of anywhere real.
function paintScene(canvas: HTMLCanvasElement, seed: number) {
  const rnd = mulberry32(seed)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = canvas.getBoundingClientRect()
  const w = Math.max(1, Math.round(rect.width))
  const h = Math.max(1, Math.round(rect.height))
  canvas.width = w * dpr
  canvas.height = h * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // Sky: two graded stops, hue nudged by the seed so no two frames match.
  const hueTop = 200 + rnd() * 60 // teal → indigo
  const hueLow = 20 + rnd() * 40 // amber → rose
  const horizon = h * (0.52 + rnd() * 0.16)
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, `hsl(${hueTop} 55% 20%)`)
  sky.addColorStop(1, `hsl(${hueLow} 70% 62%)`)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, horizon)

  // The low sun — a soft radial bloom sitting on or above the horizon.
  const sx = w * (0.2 + rnd() * 0.6)
  const sy = horizon - h * (0.02 + rnd() * 0.14)
  const sr = h * (0.16 + rnd() * 0.12)
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr)
  sun.addColorStop(0, 'rgba(255,246,224,0.95)')
  sun.addColorStop(0.5, `hsla(${hueLow} 90% 70% / 0.6)`)
  sun.addColorStop(1, 'hsla(40 90% 70% / 0)')
  ctx.fillStyle = sun
  ctx.beginPath()
  ctx.arc(sx, sy, sr, 0, Math.PI * 2)
  ctx.fill()

  // Foreground: layered hill silhouettes, each darker and lower than the last.
  const bands = 3 + Math.floor(rnd() * 2)
  for (let b = 0; b < bands; b++) {
    const base = horizon + (h - horizon) * (b / bands)
    const amp = h * (0.03 + rnd() * 0.05)
    const step = 12 + rnd() * 10
    const phase = rnd() * Math.PI * 2
    const shade = 30 - b * 7
    ctx.fillStyle = `hsl(${hueTop - 10} 30% ${shade}%)`
    ctx.beginPath()
    ctx.moveTo(0, h)
    ctx.lineTo(0, base)
    for (let x = 0; x <= w; x += step) {
      const y = base + Math.sin(x * 0.012 + phase + b) * amp
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w, h)
    ctx.closePath()
    ctx.fill()
  }

  // Film grain — a scatter of faint light and dark specks over the whole frame.
  const grains = Math.floor(w * h * 0.03)
  for (let i = 0; i < grains; i++) {
    const gx = rnd() * w
    const gy = rnd() * h
    const light = rnd() > 0.5
    ctx.fillStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    ctx.fillRect(gx, gy, 1, 1)
  }

  // A soft vignette so the print reads as film, not a flat fill.
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function Polaroid({
  seed = 7,
  caption = 'One of a kind — redrawn on load',
  duration = 4.5,
  className = '',
}: PolaroidProps) {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [activeSeed, setActiveSeed] = useState(seed)
  const [status, setStatus] = useState<'developing' | 'developed'>(
    reduce ? 'developed' : 'developing',
  )

  // develop: 0 = blank exposure, 1 = fully brought up. Every visual below reads
  // from this one value, so the whole develop is a single interpolation.
  const develop = useMotionValue(reduce ? 1 : 0)

  // Undeveloped → developed film look, all off `develop`. The blank print is
  // near-transparent, foggy, low-contrast, desaturated and warm-fogged (sepia);
  // by the end it is a clean, faintly punchy image.
  const opacity = useTransform(develop, [0, 0.25, 1], [0.08, 0.5, 1])
  const brightness = useTransform(develop, (d) => lerp(0.35, 1, d))
  const contrast = useTransform(develop, (d) => lerp(0.5, 1.06, d))
  const saturate = useTransform(develop, (d) => lerp(0.12, 1.05, d))
  const sepia = useTransform(develop, (d) => lerp(0.65, 0, d))
  const blur = useTransform(develop, (d) => lerp(1.6, 0, d))
  const filter = useMotionTemplate`brightness(${brightness}) contrast(${contrast}) saturate(${saturate}) sepia(${sepia}) blur(${blur}px)`

  // Tilt toward the cursor and a shake wobble share the same transform, so a
  // print being agitated still leans the way it is turned.
  const rotX = useSpring(0, { stiffness: 220, damping: 18 })
  const rotY = useSpring(0, { stiffness: 220, damping: 18 })
  const wobble = useMotionValue(0) // extra roll injected by shakes, self-decaying
  const rotZ = useTransform(wobble, (v) => v)

  // Gloss sweep position tracks the tilt so the sheen slides as the card turns.
  const glossX = useTransform(rotY, [-12, 12], ['20%', '80%'])
  const glossBg = useMotionTemplate`linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.5) ${glossX}, transparent 70%)`
  // Chemical fog over the print that clears as it develops.
  const fogOpacity = useTransform(develop, [0, 1], [0.55, 0])

  // --- The develop loop: advances `develop` each frame, plus any pending
  // agitation from a shake. Runs only while developing and motion is allowed.
  const agitation = useRef(0)
  useEffect(() => {
    if (reduce || status !== 'developing') return
    let raf = 0
    let prev = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      // Base develop rate, plus a boost proportional to current agitation.
      const boost = agitation.current
      agitation.current *= 0.9 // agitation cools every frame
      const next = Math.min(1, develop.get() + (dt / duration) * (1 + boost * 6))
      develop.set(next)
      // Bleed the wobble back toward rest so the frame settles between shakes.
      wobble.set(wobble.get() * 0.86)
      if (next >= 1) {
        wobble.set(0)
        setStatus('developed')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduce, status, duration, develop, wobble])

  // Repaint the scene whenever the seed changes (and on first mount / resize).
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    paintScene(c, activeSeed)
    const ro = new ResizeObserver(() => paintScene(c, activeSeed))
    ro.observe(c)
    return () => ro.disconnect()
  }, [activeSeed])

  // Re-expose: a fresh seed and a fresh develop. Under reduced motion it swaps
  // straight to the finished new frame.
  const reExpose = useCallback(() => {
    setActiveSeed((s) => (s * 1664525 + 1013904223) >>> 0)
    if (reduce) {
      develop.set(1)
      setStatus('developed')
      return
    }
    agitation.current = 0
    wobble.set(0)
    develop.set(0)
    setStatus('developing')
  }, [reduce, develop, wobble])

  // --- Shake / tilt handling ------------------------------------------------
  const last = useRef<{ x: number; t: number; dir: number } | null>(null)
  const dragging = useRef(false)

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce) return
    const el = frameRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    rotY.set(px * 16)
    rotX.set(-py * 14)

    // Shake detection while grabbed: a hard, fast reversal of horizontal travel
    // agitates the emulsion and kicks the wobble.
    if (!dragging.current) return
    const now = performance.now()
    const prev = last.current
    if (prev) {
      const dx = e.clientX - prev.x
      const dt = now - prev.t
      const speed = Math.abs(dx) / Math.max(1, dt)
      const dir = Math.sign(dx) || prev.dir
      if (dir !== 0 && dir !== prev.dir && speed > 0.4) {
        // A reversal — the top of a shake. Add develop and throw a wobble the
        // way the hand just went.
        agitation.current = Math.min(1.5, agitation.current + speed * 0.5)
        wobble.set(Math.max(-2.5, Math.min(2.5, -dir * 2.2)))
      }
      last.current = { x: e.clientX, t: now, dir }
    } else {
      last.current = { x: e.clientX, t: now, dir: 0 }
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (reduce) return
    dragging.current = true
    last.current = { x: e.clientX, t: performance.now(), dir: 0 }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture unavailable — shake still works via move deltas */
    }
  }

  function endDrag() {
    dragging.current = false
    last.current = null
  }

  function onPointerLeave() {
    endDrag()
    rotX.set(0)
    rotY.set(0)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (status === 'developing') {
      // Keyboard parity for the shake: agitate the print instead of re-exposing.
      agitation.current = Math.min(1.5, agitation.current + 0.8)
      wobble.set(wobble.get() >= 0 ? -2 : 2)
    } else {
      reExpose()
    }
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <motion.div
        ref={frameRef}
        role="button"
        tabIndex={0}
        aria-label={
          status === 'developing'
            ? 'Instant photo, developing. Shake it, or press Enter to agitate.'
            : 'Instant photo, developed. Press Enter to take a new one.'
        }
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={endDrag}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        className="group relative w-[16rem] max-w-full cursor-pointer touch-none select-none rounded-[4px] bg-[#f6f4ee] p-3 pb-14 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.7)] outline-none ring-[#DCF87C]/60 focus-visible:ring-2"
        style={{
          rotateX: reduce ? 0 : rotX,
          rotateY: reduce ? 0 : rotY,
          rotateZ: reduce ? 0 : rotZ,
          transformPerspective: 900,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* The exposure window — the canvas the scene is drawn to, developed by
            filters over `develop`. A dark base shows through while the print is
            still blank. */}
        <div className="relative aspect-square w-full overflow-hidden rounded-[2px] bg-[#0a0e14]">
          <motion.canvas
            ref={canvasRef}
            className="h-full w-full"
            style={reduce ? undefined : { opacity, filter }}
            aria-hidden
          />
          {/* Chemical fog that clears as the print develops. */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[#e9e4d6] mix-blend-screen"
              style={{ opacity: fogOpacity }}
            />
          )}
          {/* Gloss sweep that slides with the tilt. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={reduce ? undefined : { background: glossBg }}
          />
        </div>

        {/* Caption on the wide lower border, in the display serif for a written
            feel. */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <span className="font-display text-[0.95rem] italic leading-tight text-[#2b2b2b]">
            {caption}
          </span>
          <span className="shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-black/30">
            #{(activeSeed % 1000).toString().padStart(3, '0')}
          </span>
        </div>
      </motion.div>

      {/* Live status + hint, read to assistive tech and shown as a quiet caption. */}
      <p className="mt-5 h-4 text-center text-xs text-white/40" aria-live="polite">
        {reduce
          ? 'Developed'
          : status === 'developing'
            ? 'Developing — shake it to bring it up faster'
            : 'Click or press Enter for a new frame'}
      </p>
    </div>
  )
}
