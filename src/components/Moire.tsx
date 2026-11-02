import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Two fine gratings laid over one another, and the pattern that lives in neither
// of them. Moiré is pure interference: superimpose two regular rulings that
// differ by a hair — in spacing, in angle, or in centre — and a third, much
// coarser pattern precipitates out of the overlap, the slow beat between two
// fast carriers. Nudge one grating a few degrees and the fringes swing across
// the whole field; it is the most motion you can wring out of the least change,
// which is exactly why it reads as alive.
//
// There is no image and no texture here, only arithmetic done once per pixel on
// a small offscreen buffer the canvas smooths up. Each grating is a smooth
// cosine — value 0.5 + 0.5*cos(phase) — so the rulings are soft rather than
// jagged, and the two are multiplied the way two real transparencies multiply
// their transmission: dark where either is dark, bright only where both are
// clear. Multiplying two cosines is what makes the beat visible — cos(a)·cos(b)
// carries a cos(a−b) term, and that difference term is the coarse moiré you see.
//
//   Rings  — two circular gratings. One sits at the centre; the other rides the
//            pointer. As the second centre slides, families of ellipses and
//            hyperbolae sweep through the field — the classic two-stone-in-a-pond
//            interference.
//   Lines  — two straight rulings. The first is fixed; the pointer's horizontal
//            position rotates the second by a few degrees, and that tiny angle
//            opens a broad fan of fringes that pivots as you move.
//
// The field is redrawn only when something changes — a pointer move, a control,
// a resize — each draw coalesced into a single animation frame, so there is no
// idling loop burning cycles. When the pointer is away and motion is allowed,
// one slow drift loop breathes the second grating so the piece is never wholly
// still; the moment the pointer arrives it takes over, and it hands control back
// when the pointer leaves. Under reduced motion there is no drift and no eased
// follow — the pointer moves the fringes directly, and at rest the field holds a
// composed, off-centre still. Decorative, so aria-hidden; the controls are not.

type Mode = 'rings' | 'lines'

export function Moire({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<Mode>('rings')
  // Density 1..10 maps to the grating period in CSS px (coarse to fine).
  const [density, setDensity] = useState(5)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))

    // Internal buffer resolution. Moiré is smooth, so we compute at a fraction of
    // the device pixels and let the canvas scale it up — this both caps the
    // per-pixel budget and softens the carrier into a clean anti-aliased wash.
    const SCALE = 0.55
    let bw = 0 // buffer width in px
    let bh = 0 // buffer height in px
    let cssW = 0
    let cssH = 0
    let img: ImageData | null = null
    let buf: Uint8ClampedArray | null = null

    // The two grating centres / the pointer state, in buffer space. `tx/ty` is the
    // eased target, `x/y` the smoothed value the draw reads. `over` is whether the
    // pointer is on the field; `amp` eases the drift in and out at the edges.
    const p = { x: 0, y: 0, tx: 0, ty: 0, over: false }
    let drift = 0 // phase for the idle breathing of the second grating

    let drawPending = 0
    let driftRaf = 0

    function period() {
      // density 1 -> ~26px, density 10 -> ~7px, in BUFFER px.
      return (26 - (density - 1) * 2.1) * SCALE
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      cssW = Math.max(1, rect.width)
      cssH = Math.max(1, rect.height)
      bw = Math.max(1, Math.round(cssW * SCALE))
      bh = Math.max(1, Math.round(cssH * SCALE))
      // The visible canvas stays at CSS size (no DPR buffer — the upscale from the
      // small internal grid is what we want, and it keeps the cost bounded).
      canvas!.width = bw
      canvas!.height = bh
      canvas!.style.imageRendering = 'auto'
      img = ctx!.createImageData(bw, bh)
      buf = img.data
      // Default resting position: second centre off to the upper-right of middle,
      // a composed still that reads well before any interaction.
      p.tx = bw * 0.62
      p.ty = bh * 0.4
      if (!p.over) {
        p.x = p.tx
        p.y = p.ty
      }
    }

    function render() {
      if (!img || !buf) return
      const T = period()
      const k = (Math.PI * 2) / T
      const data = buf

      // Fixed first grating: centre of the field (rings) / horizontal ruling (lines).
      const ax = bw / 2
      const ay = bh / 2

      // Second grating, driven by the pointer or the idle drift.
      const bx = p.x
      const by = p.y

      if (mode === 'rings') {
        for (let y = 0; y < bh; y++) {
          const dya = y - ay
          const dyb = y - by
          let o = y * bw * 4
          for (let x = 0; x < bw; x++, o += 4) {
            const dxa = x - ax
            const dxb = x - bx
            const dA = Math.sqrt(dxa * dxa + dya * dya)
            const dB = Math.sqrt(dxb * dxb + dyb * dyb)
            const gA = 0.5 + 0.5 * Math.cos(dA * k)
            const gB = 0.5 + 0.5 * Math.cos(dB * k)
            let v = gA * gB
            v = v * v * (3 - 2 * v) // smoothstep: deepen the darks, crisp the fringes
            data[o] = 6 + (ar - 6) * v
            data[o + 1] = 6 + (ag - 6) * v
            data[o + 2] = 8 + (ab - 8) * v
            data[o + 3] = 255
          }
        }
      } else {
        // Lines: first ruling fixed horizontal; pointer x rotates the second a few
        // degrees about the field centre. The tiny angle is what opens the fan.
        const frac = bw > 0 ? bx / bw : 0.5
        const ang = (frac - 0.5) * 0.52 // ~ +/-15 degrees across the width
        const ca = Math.cos(ang)
        const sa = Math.sin(ang)
        for (let y = 0; y < bh; y++) {
          const ry = y - ay
          let o = y * bw * 4
          for (let x = 0; x < bw; x++, o += 4) {
            const rx = x - ax
            const pA = ry // first ruling runs along x, phase varies with y
            const pB = rx * sa + ry * ca // second ruling, rotated by `ang`
            const gA = 0.5 + 0.5 * Math.cos(pA * k)
            const gB = 0.5 + 0.5 * Math.cos(pB * k)
            let v = gA * gB
            v = v * v * (3 - 2 * v)
            data[o] = 6 + (ar - 6) * v
            data[o + 1] = 6 + (ag - 6) * v
            data[o + 2] = 8 + (ab - 8) * v
            data[o + 3] = 255
          }
        }
      }
      ctx!.putImageData(img, 0, 0)
    }

    function scheduleDraw() {
      if (drawPending) return
      drawPending = requestAnimationFrame(() => {
        drawPending = 0
        render()
      })
    }

    function toBuffer(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / Math.max(1, rect.width)
      const ny = (e.clientY - rect.top) / Math.max(1, rect.height)
      return { x: nx * bw, y: ny * bh }
    }

    function onMove(e: PointerEvent) {
      const b = toBuffer(e)
      p.over = true
      p.tx = b.x
      p.ty = b.y
      if (reduce) {
        // No eased follow under reduced motion — the fringes track the pointer
        // directly, which is honest and still fully interactive.
        p.x = b.x
        p.y = b.y
        scheduleDraw()
      }
      // When motion is allowed the drift loop does the easing and the drawing.
    }
    function onEnter() {
      p.over = true
    }
    function onLeave() {
      p.over = false
      if (reduce) scheduleDraw()
    }

    resize()
    render()

    const ro = new ResizeObserver(() => {
      resize()
      scheduleDraw()
    })
    ro.observe(canvas)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerenter', onEnter)
    canvas.addEventListener('pointerleave', onLeave)

    if (!reduce) {
      // One loop handles both the eased follow and the idle breathing. It always
      // runs, but it is cheap: it only repaints when the second centre actually
      // moved enough to matter, so a still field with the pointer parked costs
      // almost nothing.
      let px = p.x
      let py = p.y
      const driftLoop = () => {
        drift += 0.006
        let targetX: number
        let targetY: number
        if (p.over) {
          targetX = p.tx
          targetY = p.ty
        } else {
          // Breathe the second centre on a slow Lissajous around its resting spot.
          targetX = bw * (0.5 + Math.cos(drift) * 0.16)
          targetY = bh * (0.5 + Math.sin(drift * 0.8) * 0.16)
        }
        p.x += (targetX - p.x) * 0.12
        p.y += (targetY - p.y) * 0.12
        if (Math.abs(p.x - px) > 0.15 || Math.abs(p.y - py) > 0.15) {
          px = p.x
          py = p.y
          render()
        }
        driftRaf = requestAnimationFrame(driftLoop)
      }
      driftRaf = requestAnimationFrame(driftLoop)
    }

    return () => {
      if (drawPending) cancelAnimationFrame(drawPending)
      if (driftRaf) cancelAnimationFrame(driftRaf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerenter', onEnter)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, accent, mode, density])

  return (
    <div className={`relative ${className}`}>
      <canvas ref={ref} className="h-full w-full" aria-hidden="true" />

      {/* Controls — a mode toggle and a density slider, low in the frame so the
          field reads first. Keyboard-operable and labelled; not aria-hidden. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div
          role="radiogroup"
          aria-label="Grating type"
          className="pointer-events-auto flex gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur"
        >
          {(['rings', 'lines'] as Mode[]).map((m) => {
            const active = mode === m
            return (
              <button
                key={m}
                role="radio"
                aria-checked={active}
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  active ? 'bg-[#DCF87C] text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                {m}
              </button>
            )
          })}
        </div>

        <label className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/60 backdrop-blur">
          <span className="uppercase tracking-[0.2em]">Density</span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
            aria-label="Grating density"
            className="h-1 w-24 cursor-pointer accent-[#DCF87C]"
          />
        </label>
      </div>
    </div>
  )
}
