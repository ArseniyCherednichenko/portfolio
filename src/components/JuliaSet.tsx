import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// A Julia set explorer — the other famous escape-time fractal, and a companion
// to the strange Attractor already on the shelf. Where the Attractor grows a
// shape by iterating one point forward forever, this iterates EVERY point of
// the plane and asks a yes/no question of each: feed the complex number z into
//   z' = z*z + c
// over and over — does the orbit fly off to infinity, or stay bounded forever?
// Colour the plane by how fast the ones that escape do escape, and the boundary
// between "stays" and "flees" draws itself: an infinitely crinkled coastline of
// self-similar detail that is different for every value of the constant c.
//
// That single constant c is the whole instrument. Nudge it and the entire set
// re-forms — from a fat connected blob, through spiralling seahorse valleys, to
// a scatter of disconnected dust — so the piece hands c to the cursor: move
// across the field and the point under the pointer becomes c, and the fractal
// it defines is drawn live underneath. Leave, and c falls back to an idle orbit
// that sweeps the classic c = r*e^(i*theta) family, so the coastline keeps
// breathing whether or not you touch it. No wall clock and no randomness (the
// drift is an eased frame phase); it is stable across resizes and never trips
// the environment's guards.
//
// The maths runs off the React render path: each frame iterates the grid into a
// raw pixel buffer with smooth (fractional) escape colouring, mapped through a
// precomputed lime-on-ink palette LUT. It draws into a small internal buffer
// (softly upscaled by CSS) and idle repaints are throttled, so the per-frame
// cost stays honest on a laptop. Under reduced motion the loop never starts: one
// crisp, fixed Julia set is drawn once and held. Decorative, so aria-hidden.

// The idle family: c = R * e^(i*theta). At this radius the sweep runs through
// dendrites, spirals, and seahorse valleys without ever falling into dust.
const IDLE_R = 0.7885
// A fixed, handsome member of the family for the reduced-motion still.
const STILL_C = { re: -0.70176, im: -0.3842 }
// Half-width of the plane shown, in complex units. The interesting sets all
// live inside roughly |z| < 2, so this frames them with a little air.
const HALF_X = 1.55

export function JuliaSet({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  // The live constant, surfaced as a small readout so the abstraction is legible.
  const [readout, setReadout] = useState(STILL_C)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))

    // A 256-entry palette LUT: deep ink -> a cool teal shadow -> the lime accent
    // -> near-white at the escape rim. Escape-time colouring indexes into this,
    // so the hot, fast-escaping fringe blooms toward white while the slow
    // near-boundary points sit dark. Interior points (never escape) get index 0.
    const LUT = new Uint8ClampedArray(256 * 3)
    const stops: Array<[number, [number, number, number]]> = [
      [0.0, [8, 10, 9]],
      [0.35, [14, 40, 46]],
      [0.62, [ar, ag, ab]],
      [1.0, [245, 255, 235]],
    ]
    for (let i = 0; i < 256; i++) {
      const t = i / 255
      let s = 0
      while (s < stops.length - 2 && t > stops[s + 1][0]) s++
      const [t0, c0] = stops[s]
      const [t1, c1] = stops[s + 1]
      const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0)
      LUT[i * 3] = c0[0] + (c1[0] - c0[0]) * f
      LUT[i * 3 + 1] = c0[1] + (c1[1] - c0[1]) * f
      LUT[i * 3 + 2] = c0[2] + (c1[2] - c0[2]) * f
    }

    let bw = 0
    let bh = 0
    let img: ImageData | null = null
    let raf = 0
    let t = 0 // frame phase; no Date.now, so resize-stable and safe
    let tick = 0 // frame counter, for throttling idle repaints
    let dirty = true // force a repaint (pointer moved / just resized)

    // Eased cursor influence, exactly like the Attractor: c leans toward the
    // pointer while it is over the field and settles back to the idle orbit when
    // it leaves.
    const cur = { re: 0, im: 0, tre: 0, tim: 0, amp: 0, tamp: 0 }
    const LOG2 = Math.log(2)
    const MAX = reduce ? 220 : 130

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      const cssW = Math.max(1, rect.width)
      const cssH = Math.max(1, rect.height)
      // Render into a modest internal buffer and let CSS upscale it — a fractal
      // reads fine slightly soft, and this keeps the per-pixel maths affordable.
      // Reduced motion, drawn once, can afford a crisper grid.
      const cap = reduce ? 720 : 460
      bw = Math.max(1, Math.min(cap, Math.round(cssW)))
      bh = Math.max(1, Math.round(bw * (cssH / cssW)))
      canvas!.width = bw
      canvas!.height = bh
      img = ctx!.createImageData(bw, bh)
      dirty = true
    }

    // Iterate the whole grid for a given c and write the pixel buffer.
    function render(cre: number, cim: number) {
      if (!img) return
      const data = img.data
      const halfY = HALF_X * (bh / bw)
      const dx = (HALF_X * 2) / bw
      const dy = (halfY * 2) / bh
      let p = 0
      for (let j = 0; j < bh; j++) {
        const y0 = halfY - j * dy
        for (let i = 0; i < bw; i++) {
          let zx = -HALF_X + i * dx
          let zy = y0
          let n = 0
          let zx2 = zx * zx
          let zy2 = zy * zy
          // Escape radius 4 (squared) — generous, so the smooth-colouring log
          // term is well behaved.
          while (zx2 + zy2 < 16 && n < MAX) {
            zy = 2 * zx * zy + cim
            zx = zx2 - zy2 + cre
            zx2 = zx * zx
            zy2 = zy * zy
            n++
          }
          let idx = 0
          if (n < MAX) {
            // Smooth (fractional) escape count, gamma-shaped for contrast.
            const mag = zx2 + zy2
            const mu = n + 1 - Math.log(0.5 * Math.log(mag)) / LOG2
            let s = mu / MAX
            if (s < 0) s = 0
            else if (s > 1) s = 1
            idx = (Math.pow(s, 0.5) * 255) | 0
          }
          const q = idx * 3
          data[p] = LUT[q]
          data[p + 1] = LUT[q + 1]
          data[p + 2] = LUT[q + 2]
          data[p + 3] = 255
          p += 4
        }
      }
      ctx!.putImageData(img, 0, 0)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width
      const ny = (e.clientY - rect.top) / rect.height
      // Map the pointer to a rectangle of c-space where the sets stay rich and
      // connected rather than collapsing to dust.
      cur.tre = -0.9 + nx * 1.3
      cur.tim = 0.75 - ny * 1.5
      cur.tamp = 1
    }
    function onLeave() {
      cur.tamp = 0
    }

    resize()

    if (reduce) {
      render(STILL_C.re, STILL_C.im)
      const ro = new ResizeObserver(() => {
        resize()
        render(STILL_C.re, STILL_C.im)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    let lastRe = NaN
    let lastIm = NaN
    function frame() {
      t += 0.006
      tick++
      cur.re += (cur.tre - cur.re) * 0.12
      cur.im += (cur.tim - cur.im) * 0.12
      cur.amp += (cur.tamp - cur.amp) * 0.06

      // Idle orbit around the classic family, blended toward the pointer by its
      // eased influence.
      const ire = IDLE_R * Math.cos(t)
      const iim = IDLE_R * Math.sin(t)
      const cre = ire + (cur.re - ire) * cur.amp
      const cim = iim + (cur.im - iim) * cur.amp

      // Throttle: when the pointer is engaged, repaint every frame so it feels
      // live; when idle, repaint every third frame — the drift is slow enough
      // that ~20fps reads as perfectly smooth and the maths cost stays low.
      const engaged = cur.amp > 0.02
      const due = dirty || engaged || tick % 3 === 0
      if (due) {
        // Skip identical repaints (the idle constant barely moves between throttled
        // frames only when truly at rest).
        if (dirty || cre !== lastRe || cim !== lastIm) {
          render(cre, cim)
          lastRe = cre
          lastIm = cim
          dirty = false
        }
      }
      raf = requestAnimationFrame(frame)
    }

    // Reflect the live constant in the readout, but only a few times a second so
    // React is never asked to re-render at animation rate.
    const readoutTimer = window.setInterval(() => {
      setReadout({ re: lastRe, im: lastIm })
    }, 220)

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.clearInterval(readoutTimer)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, accent])

  const fmt = (n: number) => (Number.isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(3) : '—')

  return (
    <div className={`relative ${className}`}>
      <canvas ref={ref} className="h-full w-full" aria-hidden="true" />
      {/* A quiet readout of the live constant, so the maths behind the picture
          stays legible. tabular-nums keeps it from twitching as digits change. */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 font-mono text-[0.7rem] tabular-nums text-white/60 backdrop-blur-sm">
        c = {fmt(readout.re)} {fmt(readout.im)}i
      </div>
    </div>
  )
}
