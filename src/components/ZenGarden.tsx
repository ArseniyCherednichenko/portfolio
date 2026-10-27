import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A karesansui — a dry rock garden — rebuilt as a real surface you rake rather
// than a picture of one. Drag across the sand and a seven-tooth rake carves a
// band of parallel grooves that follows your hand, curving where you curve;
// release and the furrows stay exactly where you left them. It opens already
// raked into the long straight lines a gardener leaves, with two stones set in
// the field; the stones sit on their own layer above the sand, so the grooves
// you draw pass behind them and a furrow never runs across a rock.
//
// It is the calm member of the Objects & toys family, and its own thing there.
// The Dice is a throw that settles, the Fidget spinner an rpm winding down, the
// Magic 8-ball a reply that rises — each resolves when you press it. This one
// resolves nothing: there is no score, no win, no settling, only the slow,
// repetitive gesture of raking, the point of the real thing. It is the one toy
// here you cannot finish, only tend.
//
// Honest about how it is drawn. Two stacked canvases: the back one holds the
// sand and every groove — the fresh pattern and whatever you carve over it —
// and the front one holds the stones and their soft shadows and never changes,
// so a groove drawn beneath a stone really is drawn beneath it. A groove is a
// dark line with a thin warm highlight laid just beside it, the way a furrow in
// sand catches light on one wall and shadow in the trough; strokes build up as
// you pass, so raking the same spot twice deepens it. No image, no texture
// file — the sand is a painted warm gradient with a faint vignette, and the
// rake is maths: the pointer's travel gives a direction, the perpendicular
// gives the seven offsets, and each tooth draws one groove.
//
// Reduced-motion-safe by nature: nothing here animates on a clock. The whole
// thing only ever moves under your pointer, so there is no ambient motion to
// suppress; raking, smoothing and re-raking behave identically either way. The
// canvases are decorative and hidden from assistive tech, so the garden is
// described in text beside it and the two controls — rake the pattern back, or
// smooth the sand flat — are real labelled buttons that announce through a live
// region, giving a keyboard or screen-reader visitor the same two honest states
// the drawing surface offers.

interface ZenGardenProps {
  className?: string
}

// The sand. A warm graphite that sits in the dark theme rather than a bright
// beach tone that would fight it; grooves read as lighter troughs cut into it.
const SAND_TOP = '#242019'
const SAND_BOTTOM = '#1a1611'
// A groove: a shadowed trough and a warm highlight on its near wall.
const GROOVE_SHADOW = 'rgba(0,0,0,0.34)'
const GROOVE_HILITE = 'rgba(247,238,214,0.07)'

// The rake. Seven teeth over a ~56px band, so a pass lays a recognisable set of
// parallel furrows at a calm density.
const TEETH = 7
const TOOTH_GAP = 9 // px between adjacent grooves

// Stones, placed as fractions of the field so they survive a resize. Each has a
// radius in fractions of the smaller dimension.
const STONES: { x: number; y: number; r: number }[] = [
  { x: 0.28, y: 0.6, r: 0.14 },
  { x: 0.7, y: 0.36, r: 0.1 },
]

type Pt = { x: number; y: number }

export function ZenGarden({ className = '' }: ZenGardenProps) {
  // The two canvases are paired on purpose — see the top note.
  const sandRef = useRef<HTMLCanvasElement>(null)
  const stoneRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // CSS-pixel size of the field, kept in a ref so the pointer maths and the
  // draw helpers share one source without re-rendering on every move.
  const sizeRef = useRef({ w: 0, h: 0 })
  const drawing = useRef(false)
  const last = useRef<Pt | null>(null)
  const [grabbing, setGrabbing] = useState(false)
  const [status, setStatus] = useState('Raked into fresh lines, two stones set.')
  useReducedMotion() // nothing animates on a clock here; see the note.

  // Paint the sand base: a vertical warm gradient with a soft centre lift and a
  // faint vignette, so the empty field already reads as a lit surface.
  const paintSand = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, SAND_TOP)
    g.addColorStop(1, SAND_BOTTOM)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const v = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75)
    v.addColorStop(0, 'rgba(255,245,222,0.05)')
    v.addColorStop(0.6, 'rgba(255,245,222,0)')
    v.addColorStop(1, 'rgba(0,0,0,0.26)')
    ctx.fillStyle = v
    ctx.fillRect(0, 0, w, h)
  }, [])

  // One groove: shadow trough plus a highlight laid just to its lit side.
  const groove = useCallback(
    (ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax
      const dy = by - ay
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len
      const ny = dx / len
      ctx.lineCap = 'round'
      ctx.strokeStyle = GROOVE_SHADOW
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.stroke()
      ctx.strokeStyle = GROOVE_HILITE
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(ax + nx * 1.3, ay + ny * 1.3)
      ctx.lineTo(bx + nx * 1.3, by + ny * 1.3)
      ctx.stroke()
    },
    [],
  )

  // One rake pass: the band of TEETH grooves from one pointer point to the next,
  // offset along the perpendicular of travel so the furrows stay parallel.
  const rakePass = useCallback(
    (ctx: CanvasRenderingContext2D, from: Pt, to: Pt) => {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len
      const ny = dx / len
      for (let i = 0; i < TEETH; i++) {
        const o = (i - (TEETH - 1) / 2) * TOOTH_GAP
        groove(ctx, from.x + nx * o, from.y + ny * o, to.x + nx * o, to.y + ny * o)
      }
    },
    [groove],
  )

  // The fresh pattern a gardener leaves: long straight grooves across the whole
  // field, one tooth-gap apart.
  const rakeFresh = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      for (let y = TOOTH_GAP; y < h; y += TOOTH_GAP) {
        groove(ctx, 0, y, w, y)
      }
    },
    [groove],
  )

  // Draw the stones once onto the front canvas: a soft cast shadow, a pebble
  // body lit from the upper-left, and a faint rim light.
  const paintStones = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.clearRect(0, 0, w, h)
    const unit = Math.min(w, h)
    for (const s of STONES) {
      const cx = s.x * w
      const cy = s.y * h
      const r = s.r * unit
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.beginPath()
      ctx.ellipse(cx + r * 0.16, cy + r * 0.22, r * 1.04, r * 0.82, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.1, cx, cy, r * 1.15)
      g.addColorStop(0, '#767b84')
      g.addColorStop(0.5, '#4c5158')
      g.addColorStop(1, '#2c2f34')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(cx, cy, r, r * 0.82, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(cx, cy - r * 0.02, r * 0.97, r * 0.79, 0, Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()
    }
  }, [])

  // Size both canvases to the wrapper at device resolution, then repaint the
  // sand with the fresh pattern and the stones. Called on mount and resize;
  // carved grooves do not survive a resize, which the copy does not promise.
  const layout = useCallback(() => {
    const wrap = wrapRef.current
    const sand = sandRef.current
    const stone = stoneRef.current
    if (!wrap || !sand || !stone) return
    const rect = wrap.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    sizeRef.current = { w, h }
    for (const c of [sand, stone]) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      const ctx = c.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const sctx = sand.getContext('2d')
    const tctx = stone.getContext('2d')
    if (sctx) {
      paintSand(sctx, w, h)
      rakeFresh(sctx, w, h)
    }
    if (tctx) paintStones(tctx, w, h)
  }, [paintSand, rakeFresh, paintStones])

  useEffect(() => {
    layout()
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => layout())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [layout])

  const toPoint = useCallback((e: React.PointerEvent): Pt => {
    const wrap = wrapRef.current
    if (!wrap) return { x: 0, y: 0 }
    const rect = wrap.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      const sand = sandRef.current
      if (!sand) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drawing.current = true
      setGrabbing(true)
      const p = toPoint(e)
      last.current = p
      // A press with no drag still leaves a short mark, so a tap is honest.
      const ctx = sand.getContext('2d')
      if (ctx) rakePass(ctx, { x: p.x - 0.5, y: p.y }, { x: p.x + 0.5, y: p.y })
    },
    [toPoint, rakePass],
  )

  const onMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing.current) return
      const sand = sandRef.current
      if (!sand) return
      const ctx = sand.getContext('2d')
      if (!ctx) return
      const p = toPoint(e)
      const prev = last.current
      if (prev) {
        // Guard against the occasional zero-length move.
        if (Math.hypot(p.x - prev.x, p.y - prev.y) >= 0.5) {
          rakePass(ctx, prev, p)
          last.current = p
        }
      } else {
        last.current = p
      }
    },
    [toPoint, rakePass],
  )

  const onUp = useCallback((e: React.PointerEvent) => {
    drawing.current = false
    last.current = null
    setGrabbing(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* capture may already be gone */
    }
    setStatus('Grooves left where you raked them.')
  }, [])

  const fresh = useCallback(() => {
    const sand = sandRef.current
    if (!sand) return
    const ctx = sand.getContext('2d')
    const { w, h } = sizeRef.current
    if (!ctx) return
    paintSand(ctx, w, h)
    rakeFresh(ctx, w, h)
    setStatus('Raked back into fresh straight lines.')
  }, [paintSand, rakeFresh])

  const smooth = useCallback(() => {
    const sand = sandRef.current
    if (!sand) return
    const ctx = sand.getContext('2d')
    const { w, h } = sizeRef.current
    if (!ctx) return
    paintSand(ctx, w, h)
    setStatus('Sand smoothed flat, ready to rake.')
  }, [paintSand])

  return (
    <div className={`mx-auto w-full max-w-2xl ${className}`}>
      <div
        ref={wrapRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative aspect-[3/2] w-full touch-none select-none overflow-hidden rounded-2xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
      >
        <canvas ref={sandRef} aria-hidden className="absolute inset-0 block h-full w-full" />
        <canvas
          ref={stoneRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 block h-full w-full"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={fresh}
          className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white"
        >
          Rake fresh lines
        </button>
        <button
          type="button"
          onClick={smooth}
          className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white"
        >
          Smooth the sand
        </button>
      </div>
      <p className="mt-4 text-center text-sm text-white/40">Drag across the sand to rake it. Nothing to finish — just tend it.</p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
