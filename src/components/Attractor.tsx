import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A strange attractor — deterministic chaos drawn as light. Where the other
// generative fields on the site each grow from a different principle (the
// Phyllotaxis packs points by the golden angle, the Morphogen reacts two
// chemicals, the Murmuration steers a hundred birds, the Harmonograph plots a
// pair of decaying sinusoids), this one grows from a single idea: iterate one
// simple nonlinear map over and over and watch where its orbit lands.
//
// The map here is the CLIFFORD attractor:
//   x' = sin(a * y) + c * cos(a * x)
//   y' = sin(b * x) + d * cos(b * y)
// Feed a point in, get a point out, feed that back in, forever. Any single step
// is unremarkable, but the orbit never settles and never repeats — it wanders a
// fractal set of infinite detail, folding the plane over on itself so densely
// that where the orbit lingers reads as light and where it rarely visits stays
// dark. That is the whole trick of a strange attractor: a bounded region that a
// deterministic rule fills without ever closing into a loop.
//
// It is drawn by plotting thousands of orbit steps a frame with ADDITIVE
// compositing, so overlapping visits sum into brightness — a real density map,
// dense arms blooming from lime toward white while the faint rim stays cool.
// The four parameters (a, b, c, d) are what pick which attractor you get, and
// small changes redraw the whole shape; so the pointer morphs the family (the
// cursor's x nudges a, its y nudges b) while an idle drift keeps all four
// breathing on slow, out-of-phase sines — the shape endlessly re-forms whether
// or not you touch it. The orbit starts from a fixed seed and the first steps of
// transient are discarded each frame; there is no randomness anywhere (the drift
// is an eased time phase, not an RNG), so it is stable across resizes and never
// trips the environment's guards. Under reduced motion the loop never starts: a
// single, crisper attractor is plotted once at rest. Decorative, so aria-hidden.

export function Attractor({
  className = '',
  accent = '220,248,124',
}: {
  className?: string
  accent?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let scale = 1
    let count = 0 // orbit steps plotted per frame, scaled to the card area
    let raf = 0
    let t = 0 // frame-driven time phase; no Date.now, so resize-stable and safe

    // The pointer eases toward the cursor and its influence swells while it is
    // over the field, so the shape morphs in the cursor's wake and settles when
    // it leaves.
    const cur = { nx: 0, ny: 0, tnx: 0, tny: 0, amp: 0, tamp: 0 }

    // Base parameters: a Clifford that reads as a pair of interleaved wings. The
    // idle drift and the pointer both ride on top of these.
    const A = -1.7
    const B = 1.7
    const C = -0.9
    const D = -0.6
    // Half the plotted range, in attractor units. The Clifford stays inside
    // roughly [-(1+|c|), 1+|c|]; this comfortably contains it at every drift.
    const HALF = 2.4

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h / 2
      scale = (Math.min(w, h) * 0.44) / HALF
      // More steps for a bigger canvas so the density stays even, bounded so the
      // per-frame budget never runs away. Reduced motion gets a crisper still.
      const area = w * h
      const live = Math.max(9000, Math.min(24000, Math.round(area * 0.12)))
      count = reduce ? Math.min(70000, live * 4) : live
    }

    // Plot one full attractor for a given parameter set. The orbit is warm-started
    // from a fixed seed and the first steps of transient are dropped so only the
    // settled set is drawn.
    function draw(a: number, b: number, c: number, d: number) {
      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = 'lighter'
      // One flat colour; the additive overlap is what turns density into light,
      // dense arms summing past lime toward white while the rim stays faint.
      ctx!.fillStyle = `rgba(${ar},${ag},${ab},${reduce ? 0.09 : 0.075})`

      let x = 0.1
      let y = 0.1
      const warm = 30
      const total = count + warm
      for (let i = 0; i < total; i++) {
        const nx = Math.sin(a * y) + c * Math.cos(a * x)
        const ny = Math.sin(b * x) + d * Math.cos(b * y)
        x = nx
        y = ny
        if (i < warm) continue
        // Guard against a degenerate parameter set ever producing a non-finite
        // orbit; a strange attractor is bounded, but never draw NaN.
        if (!Number.isFinite(x) || !Number.isFinite(y)) break
        const px = cx + x * scale
        const py = cy + y * scale
        ctx!.fillRect(px, py, 1, 1)
      }
      ctx!.globalCompositeOperation = 'source-over'
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cur.tnx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      cur.tny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      cur.tamp = 1
    }
    function onLeave() {
      cur.tamp = 0
    }

    resize()

    if (reduce) {
      // A single crisp attractor at the base parameters, plotted once and held.
      draw(A, B, C, D)
      const ro = new ResizeObserver(() => {
        resize()
        draw(A, B, C, D)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame() {
      t += 0.01
      cur.nx += (cur.tnx - cur.nx) * 0.12
      cur.ny += (cur.tny - cur.ny) * 0.12
      cur.amp += (cur.tamp - cur.amp) * 0.06

      // Idle drift: each parameter breathes on its own slow, out-of-phase sine so
      // the family endlessly re-forms even with no cursor. The pointer then leans
      // a and b by how far it sits from centre, blended in by its eased influence.
      const a = A + Math.sin(t * 0.7) * 0.22 + cur.nx * 0.42 * cur.amp
      const b = B + Math.sin(t * 0.53 + 1.3) * 0.22 + cur.ny * 0.42 * cur.amp
      const c = C + Math.sin(t * 0.31 + 2.1) * 0.34
      const d = D + Math.sin(t * 0.41 + 0.5) * 0.34
      draw(a, b, c, d)
      raf = requestAnimationFrame(frame)
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, accent])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
