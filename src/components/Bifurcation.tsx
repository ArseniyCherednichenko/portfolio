import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Bifurcation — the logistic map's road to chaos, drawn in parameter space, and
// the one shape in this family that plots not a trajectory but a *destiny*: for
// every growth rate r along the horizontal, the set of values the system finally
// settles into, stacked up the vertical. Where the Attractor traces one orbit
// wandering in its own phase space and the Double pendulum lives out a single
// chaotic run, this asks a different question — not "where does it go?" but "how
// many places does it end up?" — and the answer, swept across r, is the most
// famous picture in dynamics.
//
// The rule is a single line: x -> r * x * (1 - x), the logistic map, a toy model
// of a population that grows on what is free and is culled by its own crowding.
// Fix r, start anywhere in (0, 1), and iterate. For small r the population dies
// or settles to one steady value — a single point above that r. Past r = 3 that
// fixed point loses its footing and the population starts to alternate between
// two values (period 2), then four, then eight — the period-doubling cascade,
// each split arriving faster than the last by Feigenbaum's constant (~4.669),
// until near r = 3.5699 the doublings pile up into a continuum: chaos, an
// infinitely fine spray of values with no period at all. And threaded through the
// chaos are sudden clear WINDOWS — the widest at r ~ 3.83, where order snaps back
// as a clean period-3 orbit before doubling to chaos all over again.
//
// Nothing here is drawn by hand. Each pixel column is one value of r; the map is
// iterated from x = 0.5, the first few hundred steps thrown away so the transient
// dies, and the values it then keeps returning to are plotted as it lands on
// them, brightest where it dwells longest — so the bright lines are the stable
// orbits and the haze is genuine chaos. The payoff is self-similarity: zoom the
// range into the period-3 window and a whole miniature copy of the diagram — its
// own cascade, its own chaos — appears inside it, the same structure at every
// scale. Hovering reports the growth rate under the pointer and how many values
// the population settles into there: the period you can read straight off the
// column, or "chaotic" where it never repeats.
//
// Two stacked canvases, the way the Hilbert curve and the Chaos game are drawn: a
// base that accumulates the diagram column by column as the sweep reveals it
// (never cleared while it draws), and an overlay cleared each frame for the guide
// line and the settled-orbit marks under the pointer. No Math.random on the hot
// path — the map is a deterministic recurrence, so a range always draws the same
// picture. Canvases are aria-hidden, the wrapper carries a live label. Under
// prefers-reduced-motion the sweep never runs: the whole diagram is painted at
// once and held, and the hover readout still works because it is interaction.

interface RangePreset {
  key: string
  label: string
  rMin: number
  rMax: number
  note: string
}

// Three windows onto the same recurrence. Full shows the whole story from the
// single settled value through the cascade into chaos; Cascade zooms the
// period-doubling ladder so the 2 -> 4 -> 8 splits read cleanly; Window drops
// into the period-3 band where a miniature of the entire diagram reappears.
const PRESETS: RangePreset[] = [
  { key: 'full', label: 'Full range', rMin: 2.5, rMax: 4.0, note: 'One value, then the doublings, then chaos.' },
  { key: 'cascade', label: 'The cascade', rMin: 3.4, rMax: 3.6, note: 'The period-doubling ladder: 2, 4, 8, 16 ...' },
  { key: 'window', label: 'Period-3 window', rMin: 3.82, rMax: 3.857, note: 'Order returns as a clean 3-cycle — with a whole copy of the diagram inside it.' },
]

// The onset of chaos (Feigenbaum point) for the logistic map, marked on the full
// view so the eye has the landmark where the doublings run out.
const CHAOS_ONSET = 3.5699456

const TRANSIENT = 320 // iterations discarded so the settling transient dies out
const PLOT = 360 // iterations then plotted per column
const PERIOD_MAX = 64 // largest period the readout will name before calling it chaos
const PERIOD_TOL = 1e-4 // how close two iterates must be to count as the same value

const LIME_DEEP = [150, 196, 60]
const LIME_PALE = [236, 255, 224]

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// One column's worth of settled values, mapped to css-pixel y positions. Returns
// the y of every plotted iterate (with duplicates, so dwelt-on values stack up
// and read bright). x = 0 (dead) sits at the bottom, x = 1 at the top.
function settledYs(r: number, h: number): number[] {
  let x = 0.5
  for (let i = 0; i < TRANSIENT; i++) x = r * x * (1 - x)
  const ys: number[] = []
  for (let i = 0; i < PLOT; i++) {
    x = r * x * (1 - x)
    ys.push((1 - x) * h)
  }
  return ys
}

// The distinct values the map lands on at this r, plus the detected period. The
// period is the smallest p for which the orbit closes on itself within tolerance;
// if none up to PERIOD_MAX, it is reported as chaotic (period 0).
function orbit(r: number): { values: number[]; period: number } {
  let x = 0.5
  for (let i = 0; i < TRANSIENT; i++) x = r * x * (1 - x)
  const ref = x
  const seq: number[] = [x]
  let period = 0
  for (let i = 1; i <= PERIOD_MAX; i++) {
    x = r * x * (1 - x)
    if (Math.abs(x - ref) < PERIOD_TOL) {
      period = i
      break
    }
    seq.push(x)
  }
  const values = period > 0 ? seq.slice(0, period) : seq
  return { values, period }
}

export function Bifurcation({ className = '' }: { className?: string }) {
  const [presetKey, setPresetKey] = useState('full')
  const [replay, setReplay] = useState(0)
  const [hover, setHover] = useState<{ r: number; period: number } | null>(null)
  const reduce = useReducedMotion()

  const baseRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0]
  const { rMin, rMax } = preset

  useEffect(() => {
    const base = baseRef.current
    const overlay = overlayRef.current
    const wrap = wrapRef.current
    if (!base || !overlay || !wrap) return
    const bctx = base.getContext('2d')
    const octx = overlay.getContext('2d')
    if (!bctx || !octx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)

    let w = 0
    let h = 0
    let raf = 0
    let startTs = 0
    let drawnCols = 0 // how many pixel columns the base canvas has painted
    let hoverX = -1

    const duration = 2400

    // Per-iterate alpha: with PLOT points sprayed down each 1px column, a low
    // alpha lets stable lines saturate to bright lime while chaotic haze stays
    // faint — the density *is* the picture.
    const dotAlpha = 0.05

    function lerpColor(t: number, a: number): string {
      const r = Math.round(LIME_DEEP[0] + (LIME_PALE[0] - LIME_DEEP[0]) * t)
      const g = Math.round(LIME_DEEP[1] + (LIME_PALE[1] - LIME_DEEP[1]) * t)
      const b = Math.round(LIME_DEEP[2] + (LIME_PALE[2] - LIME_DEEP[2]) * t)
      return `rgba(${r},${g},${b},${a})`
    }

    // Paint the pixel columns [from, to) of the diagram onto the base canvas.
    // Each column is one growth rate; its settled values are stamped as faint
    // 1px marks, coloured by position across the range so the sweep reads.
    function drawBase(from: number, to: number) {
      bctx!.globalCompositeOperation = 'lighter'
      for (let px = from; px < to; px++) {
        const r = rMin + (px / (w - 1 || 1)) * (rMax - rMin)
        bctx!.fillStyle = lerpColor(px / (w - 1 || 1), dotAlpha)
        const ys = settledYs(r, h)
        for (let k = 0; k < ys.length; k++) {
          bctx!.fillRect(px, ys[k], 1, 1)
        }
      }
      bctx!.globalCompositeOperation = 'source-over'
    }

    // The chaos-onset landmark, drawn once onto the base after the sweep passes
    // it — a faint dashed vertical only where it falls inside the current range.
    function drawOnset() {
      if (CHAOS_ONSET < rMin || CHAOS_ONSET > rMax) return
      const x = ((CHAOS_ONSET - rMin) / (rMax - rMin)) * w
      if (x > drawnCols) return
      bctx!.save()
      bctx!.strokeStyle = 'rgba(255,255,255,0.14)'
      bctx!.lineWidth = 1
      bctx!.setLineDash([3, 5])
      bctx!.beginPath()
      bctx!.moveTo(x, 0)
      bctx!.lineTo(x, h)
      bctx!.stroke()
      bctx!.restore()
    }

    // The overlay carries only transient marks: the guide line at the hovered
    // growth rate and a bright ring on each value the population settles into
    // there. Cleared and repainted, never accumulated.
    function drawOverlay() {
      octx!.clearRect(0, 0, w, h)
      if (hoverX < 0 || hoverX >= w) return
      const r = rMin + (hoverX / (w - 1 || 1)) * (rMax - rMin)
      octx!.save()
      octx!.strokeStyle = 'rgba(220,248,124,0.4)'
      octx!.lineWidth = 1
      octx!.beginPath()
      octx!.moveTo(hoverX + 0.5, 0)
      octx!.lineTo(hoverX + 0.5, h)
      octx!.stroke()
      const { values } = orbit(r)
      // Only ring a clean, finite orbit; a chaotic column has no handful of
      // points to mark, and a cloud of rings would just be noise.
      if (values.length > 0 && values.length <= 16) {
        for (const v of values) {
          const y = (1 - v) * h
          octx!.fillStyle = '#f4ffdf'
          octx!.shadowColor = 'rgba(220,248,124,0.9)'
          octx!.shadowBlur = 6
          octx!.beginPath()
          octx!.arc(hoverX + 0.5, y, 2.6, 0, Math.PI * 2)
          octx!.fill()
        }
      }
      octx!.restore()
    }

    function tick(ts: number) {
      if (!startTs) startTs = ts
      const p = Math.min(1, (ts - startTs) / duration)
      const target = Math.max(1, Math.round(easeInOut(p) * w))
      if (target > drawnCols) {
        drawBase(drawnCols, target)
        drawnCols = target
        drawOnset()
      }
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    function restart() {
      cancelAnimationFrame(raf)
      bctx!.clearRect(0, 0, w, h)
      octx!.clearRect(0, 0, w, h)
      drawnCols = 0
      startTs = 0
      if (reduce) {
        drawBase(0, w)
        drawnCols = w
        drawOnset()
        drawOverlay()
      } else {
        raf = requestAnimationFrame(tick)
      }
    }

    function layout() {
      const rect = wrap!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      for (const c of [base!, overlay!]) {
        c.width = Math.floor(w * dpr)
        c.height = Math.floor(h * dpr)
        c.style.width = `${w}px`
        c.style.height = `${h}px`
      }
      bctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      octx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      restart()
    }

    function onMove(e: PointerEvent) {
      const rect = base!.getBoundingClientRect()
      const x = Math.round(e.clientX - rect.left)
      if (x < 0 || x >= w) {
        if (hoverX !== -1) {
          hoverX = -1
          setHover(null)
          drawOverlay()
        }
        return
      }
      if (x === hoverX) return
      hoverX = x
      const r = rMin + (x / (w - 1 || 1)) * (rMax - rMin)
      const { period } = orbit(r)
      setHover({ r, period })
      drawOverlay()
    }

    function onLeave() {
      if (hoverX === -1) return
      hoverX = -1
      setHover(null)
      drawOverlay()
    }

    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(wrap)
    wrap.addEventListener('pointermove', onMove)
    wrap.addEventListener('pointerleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      wrap.removeEventListener('pointermove', onMove)
      wrap.removeEventListener('pointerleave', onLeave)
    }
  }, [presetKey, replay, reduce, rMin, rMax])

  const periodLabel =
    hover == null
      ? null
      : hover.period === 0
        ? 'chaotic — it never repeats'
        : hover.period === 1
          ? 'one settled value'
          : `a ${hover.period}-cycle — ${hover.period} values, forever`

  return (
    <div className={`flex w-full flex-col gap-4 ${className}`}>
      <div
        ref={wrapRef}
        role="img"
        aria-label={`Bifurcation diagram of the logistic map for growth rate from ${rMin} to ${rMax}: the values the population settles into at each rate, from a single steady value through the period-doubling cascade into chaos.`}
        className="relative h-[clamp(280px,58vw,520px)] w-full touch-none overflow-hidden rounded-2xl border border-white/10 bg-[#070807]"
      >
        <canvas ref={baseRef} aria-hidden className="absolute inset-0" />
        <canvas ref={overlayRef} aria-hidden className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-3 pb-2 font-mono text-[10px] text-white/30">
          <span>r = {rMin.toFixed(rMax - rMin < 0.2 ? 3 : 2)}</span>
          <span>growth rate r &rarr;</span>
          <span>r = {rMax.toFixed(rMax - rMin < 0.2 ? 3 : 2)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
          {PRESETS.map((p) => {
            const active = p.key === presetKey
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setPresetKey(p.key)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                  active ? 'bg-[#DCF87C] text-black' : 'text-white/55 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setReplay((r) => r + 1)}
          className="rounded-full border border-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/55 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
        >
          Redraw
        </button>
      </div>

      <p className="text-xs leading-relaxed text-white/35">{preset.note}</p>

      {/* The period readout: the growth rate under the pointer and how many
          values the population settles into there — order or chaos, read
          straight off the column. */}
      <p className="min-h-[1.25rem] text-sm text-white/45" aria-live="polite">
        {hover ? (
          <>
            At growth rate{' '}
            <span className="font-mono text-[#DCF87C]">r = {hover.r.toFixed(4)}</span> the population
            settles into{' '}
            <span className="text-white/65">{periodLabel}</span>.
          </>
        ) : (
          'Hover across the diagram to read the growth rate and the period it settles into — one value, a clean cycle, or chaos.'
        )}
      </p>
    </div>
  )
}
