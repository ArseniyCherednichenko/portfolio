import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Buffon's needle — the 1733 problem, run as a live experiment. Rule a floor
// with parallel lines one needle-length apart, then drop needles on it at
// random; the fraction that come to rest crossing a line is, in the long run,
// 2L / (pi·t) — so counting crossings hands you an estimate of pi out of pure
// chance. That is the whole trick and the whole point: this is the one toy in
// the family that COMPUTES A SPECIFIC NUMBER out of randomness. Where the
// Galton board beside it lets a shape (the bell curve) precipitate out of many
// coin-flips, this lets a constant precipitate out of them — the estimate
// crawling toward 3.14159 as the needles pile up, noisy at first and settling
// as the law of large numbers does its slow work. Nothing is asserted; the
// number is derived in front of you and you can watch it earn each digit.
//
// The maths is exact, only the drawing is tuned. A needle of length L dropped
// with its centre a distance d from the nearest line and lying at angle theta
// crosses that line exactly when (L/2)·|sin theta| >= d; with the lines spaced
// GAP = L apart a needle can straddle at most one, so the estimate is simply
// pi_hat = 2·L·N / (GAP·C) for N needles and C crossings. Crossing needles are
// drawn in the accent, misses in a cool grey, laid onto a persistent canvas
// that is never cleared between frames, so a frame costs only the few fresh
// needles — the floor fills like a real pile of dropped matchsticks.
//
// No Math.random on the hot path: the drop sequence is a seeded mulberry32, so
// the same experiment plays out identically every load and the estimate
// converges the same way; Reset advances the seed for a fresh run, Rain pours a
// burst by hand, and pressing the floor does the same so you can hurry the
// digits in. The canvas is decorative and aria-hidden; the live tally (needles,
// crossings, and the estimate against pi) is real text in a polite live region,
// and the two controls are real labelled buttons. Reduced motion never starts
// the loop — it drops one fixed, bounded batch synchronously and holds the
// floor and the number still, re-dropped on resize.

const MISS = '150,160,172' // cool grey for a needle that lands clear of a line
const DROP_PER_FRAME = 4 // needles rained each frame while running
const BURST = 240 // needles poured by Rain or a press
const MAX_NEEDLES = 6000 // cap, after which the loop idles — the estimate is set
const STILL_BATCH = 1400 // needles dropped at once under reduced motion

// mulberry32 — a tiny, fast, deterministic PRNG so a run is reproducible.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BuffonTally {
  needles: number
  crossings: number
  estimate: number
}

export function BuffonNeedle({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const [tally, setTally] = useState<BuffonTally>({ needles: 0, crossings: 0, estimate: 0 })
  const burstRef = useRef<(() => void) | null>(null)
  const resetRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    const [mr, mg, mb] = MISS.split(',').map((n) => parseInt(n, 10))
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    let w = 0
    let h = 0
    let gap = 0 // line spacing = needle length
    let needleLen = 0
    let topY = 0 // first ruled line
    const lines: number[] = [] // y of each ruled line
    let seed = 0x9e3779b1
    let rng = mulberry32(seed)

    let needles = 0
    let crossings = 0
    let raf = 0
    let pending = 0 // needles queued by a burst/press, rained in over frames

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Six to nine ruled lines across the height, needle length == spacing.
      const want = Math.max(5, Math.min(9, Math.round(h / 86)))
      gap = h / (want + 1)
      needleLen = gap
      topY = gap
      lines.length = 0
      for (let y = topY; y <= h - gap * 0.5; y += gap) lines.push(y)
    }

    function drawFloor() {
      ctx!.clearRect(0, 0, w, h)
      ctx!.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx!.lineWidth = 1
      for (const y of lines) {
        ctx!.beginPath()
        ctx!.moveTo(0, y + 0.5)
        ctx!.lineTo(w, y + 0.5)
        ctx!.stroke()
      }
    }

    // Drop one needle: uniform centre and uniform angle from the seeded stream,
    // decide the crossing exactly, draw it, and update the tallies.
    function dropOne() {
      const cx = rng() * w
      const cy = topY * 0.5 + rng() * (h - topY)
      const theta = rng() * Math.PI
      const half = needleLen / 2
      const dx = Math.cos(theta) * half
      const dy = Math.sin(theta) * half

      // Nearest ruled line to the centre, and whether the needle reaches it.
      let nearest = lines[0]
      let best = Math.abs(cy - lines[0])
      for (let i = 1; i < lines.length; i++) {
        const d = Math.abs(cy - lines[i])
        if (d < best) {
          best = d
          nearest = lines[i]
        }
      }
      const crosses = best <= Math.abs(dy) && nearest >= topY - 0.001
      needles++
      if (crosses) crossings++

      ctx!.strokeStyle = crosses
        ? `rgba(${ar},${ag},${ab},0.6)`
        : `rgba(${mr},${mg},${mb},0.32)`
      ctx!.lineWidth = crosses ? 1.6 : 1.2
      ctx!.beginPath()
      ctx!.moveTo(cx - dx, cy - dy)
      ctx!.lineTo(cx + dx, cy + dy)
      ctx!.stroke()
    }

    function estimate() {
      return crossings > 0 ? (2 * needleLen * needles) / (gap * crossings) : 0
    }

    function publish() {
      setTally({ needles, crossings, estimate: estimate() })
    }

    function reset() {
      seed = (seed + 0x6d2b79f5) | 0
      rng = mulberry32(seed)
      needles = 0
      crossings = 0
      pending = 0
      drawFloor()
      if (reduce) runStill()
      else publish()
    }

    function burst() {
      if (reduce) {
        // Under reduced motion a press just drops another still batch.
        for (let i = 0; i < BURST && needles < MAX_NEEDLES; i++) dropOne()
        publish()
        return
      }
      pending += BURST
    }

    // Reduced motion: one bounded synchronous batch, held still.
    function runStill() {
      for (let i = 0; i < STILL_BATCH; i++) dropOne()
      publish()
    }

    layout()
    drawFloor()
    resetRef.current = reset
    burstRef.current = burst

    if (reduce) {
      runStill()
      const roStill = new ResizeObserver(() => {
        layout()
        needles = 0
        crossings = 0
        rng = mulberry32(seed)
        drawFloor()
        runStill()
      })
      roStill.observe(canvas)
      return () => {
        roStill.disconnect()
        resetRef.current = null
        burstRef.current = null
      }
    }

    let acc = 0 // frames since the last state publish, to throttle React
    function frame() {
      let n = DROP_PER_FRAME
      if (pending > 0) {
        const extra = Math.min(pending, 40)
        n += extra
        pending -= extra
      }
      for (let i = 0; i < n && needles < MAX_NEEDLES; i++) dropOne()

      acc++
      if (acc >= 4) {
        acc = 0
        publish()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    function onDown(e: PointerEvent) {
      e.preventDefault()
      burst()
    }
    canvas.addEventListener('pointerdown', onDown)

    const ro = new ResizeObserver(() => {
      layout()
      needles = 0
      crossings = 0
      pending = 0
      rng = mulberry32(seed)
      drawFloor()
      publish()
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      resetRef.current = null
      burstRef.current = null
    }
  }, [reduce, accent])

  const piError = tally.estimate > 0 ? Math.abs(tally.estimate - Math.PI) : 0

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={ref}
        aria-hidden
        className="absolute inset-0 h-full w-full cursor-pointer touch-none"
      />

      {/* Live readout — real text, politely announced. */}
      <div className="pointer-events-none absolute left-5 top-5 z-10">
        <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-sm">
          <div className="font-mono text-3xl font-semibold tabular-nums text-[#DCF87C] sm:text-4xl">
            {tally.estimate > 0 ? tally.estimate.toFixed(5) : '—'}
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-white/40">
            estimate of pi
          </div>
          <div
            aria-live="polite"
            className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1 font-mono text-xs tabular-nums text-white/55"
          >
            <span>needles</span>
            <span className="text-right text-white/80">{tally.needles.toLocaleString()}</span>
            <span>crossings</span>
            <span className="text-right text-white/80">{tally.crossings.toLocaleString()}</span>
            <span>off by</span>
            <span className="text-right text-white/80">
              {piError > 0 ? piError.toFixed(5) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls. */}
      <div className="absolute bottom-5 right-5 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => burstRef.current?.()}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white"
        >
          Rain
        </button>
        <button
          type="button"
          onClick={() => resetRef.current?.()}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
