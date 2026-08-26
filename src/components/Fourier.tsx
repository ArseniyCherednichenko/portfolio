import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Fourier — a shape taken apart into rotating circles, then put back together.
// The Bézier beside it shows the curve every easing on the site is built from;
// this shows the other half of the same idea, that any closed outline is a sum
// of circular motions. Draw a shape with the pointer and its discrete Fourier
// transform is computed on release: a chain of epicycles, each a circle turning
// at a whole-number frequency, mounted tip to tip. Turn them all at once and the
// end of the last one traces the exact path you drew.
//
// The maths is done the honest way and nothing here samples a path from a
// library. The drawn stroke is resampled to N points around the closed loop and
// read as complex numbers z_k = x_k + i·y_k; the DFT is the plain double sum
// X_m = (1/N) Σ z_k e^{-i·2π·m·k/N}, computed once per redraw. Each coefficient
// becomes one epicycle — radius |X_m|, starting phase arg(X_m), frequency the
// signed harmonic m — and the reconstruction is the same sum run forward in
// time, Σ X_m e^{i·2π·m·t}. The zero-frequency term is the centroid, so the
// chain is simply rooted there and the rest nest outward largest-first.
//
// No Date.now and no Math.random: the animation runs off the rAF timestamp and
// the default outline is a fixed five-point star, so the field is identical on
// every load. Decorative, so aria-hidden. Under prefers-reduced-motion the
// circles never turn — the epicycle chain is drawn once at its start angle with
// the whole reconstructed outline behind it — and drawing a new shape still
// recomputes and repaints that still.

const N = 256 // samples the drawn loop is resampled to before the transform
const K = 56 // epicycles kept (largest coefficients); bounds the per-frame cost
const PERIOD = 7200 // ms for one full trace of the outline
const MIN_STEP = 3 // px between recorded stroke points, so a drag is not dense

type Pt = { x: number; y: number }
type Coeff = { freq: number; amp: number; phase: number }

// A five-point star, closed — sharp corners so the reconstruction needs real
// high harmonics to find them, which makes the outer circles worth watching.
// Returned in a unit-ish space centred on the origin; scaled to the canvas when
// it is loaded as the default path.
function starPath(): Pt[] {
  const pts: Pt[] = []
  const points = 5
  const outer = 1
  const inner = 0.42
  const segs = 14 // points sampled along each spoke edge, for a clean loop
  const verts: Pt[] = []
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    // Start at the top (-90deg) so the star sits upright.
    const a = (Math.PI * i) / points - Math.PI / 2
    verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  }
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]
    const b = verts[(i + 1) % verts.length]
    for (let s = 0; s < segs; s++) {
      const t = s / segs
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return pts
}

// Resample a polyline to exactly `count` points spaced evenly by arc length,
// treated as a closed loop (the last point joins back to the first). This is
// what makes the samples a clean periodic signal for the transform.
function resampleClosed(src: Pt[], count: number): Pt[] {
  if (src.length < 2) return []
  const loop = [...src, src[0]]
  const seg: number[] = []
  let total = 0
  for (let i = 0; i < loop.length - 1; i++) {
    const d = Math.hypot(loop[i + 1].x - loop[i].x, loop[i + 1].y - loop[i].y)
    seg.push(d)
    total += d
  }
  if (total === 0) return []
  const out: Pt[] = []
  const stepLen = total / count
  let segIdx = 0
  let segStart = 0 // arc length at the start of the current segment
  for (let k = 0; k < count; k++) {
    const target = k * stepLen
    while (segIdx < seg.length - 1 && segStart + seg[segIdx] < target) {
      segStart += seg[segIdx]
      segIdx++
    }
    const segLen = seg[segIdx] || 1e-6
    const t = Math.min(1, Math.max(0, (target - segStart) / segLen))
    const a = loop[segIdx]
    const b = loop[segIdx + 1]
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return out
}

// The discrete Fourier transform of the resampled loop. Returns the centroid
// (the zero-frequency term, where the chain is rooted) and the K largest
// epicycles by radius, each with its signed harmonic, radius and start phase.
function transform(samples: Pt[]): { centroid: Pt; coeffs: Coeff[] } {
  const n = samples.length
  let allCoeffs: Coeff[] = []
  let centroid: Pt = { x: 0, y: 0 }
  for (let m = 0; m < n; m++) {
    let re = 0
    let im = 0
    for (let k = 0; k < n; k++) {
      const angle = (-2 * Math.PI * m * k) / n
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      // (x + i·y)(cos + i·sin) accumulated
      re += samples[k].x * cos - samples[k].y * sin
      im += samples[k].x * sin + samples[k].y * cos
    }
    re /= n
    im /= n
    if (m === 0) {
      centroid = { x: re, y: im }
      continue
    }
    // Map the bin index to a signed harmonic so the circles turn both ways.
    const freq = m <= n / 2 ? m : m - n
    allCoeffs.push({ freq, amp: Math.hypot(re, im), phase: Math.atan2(im, re) })
  }
  allCoeffs.sort((a, b) => b.amp - a.amp)
  return { centroid, coeffs: allCoeffs.slice(0, K) }
}

export function Fourier({
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

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0

    // The current transform, and the outline it reconstructs (one full trace,
    // precomputed so the finished shape can sit faint behind the moving chain).
    let centroid: Pt = { x: 0, y: 0 }
    let coeffs: Coeff[] = []
    let outline: Pt[] = []

    // Pointer drawing state.
    let drawing = false
    let stroke: Pt[] = []

    // Load a set of samples: compute its transform and the reconstructed outline.
    function load(samples: Pt[]) {
      const clean = resampleClosed(samples, N)
      if (clean.length < 8) return
      const t = transform(clean)
      centroid = t.centroid
      coeffs = t.coeffs
      outline = []
      for (let i = 0; i <= N; i++) outline.push(evaluate(i / N))
    }

    // The reconstruction at time t in [0,1): the centroid plus every epicycle,
    // each turned by its frequency. This is the DFT summed forward in time.
    function evaluate(t: number): Pt {
      let x = centroid.x
      let y = centroid.y
      for (let i = 0; i < coeffs.length; i++) {
        const c = coeffs[i]
        const a = c.phase + 2 * Math.PI * c.freq * t
        x += c.amp * Math.cos(a)
        y += c.amp * Math.sin(a)
      }
      return { x, y }
    }

    // The default star, scaled and centred into the current canvas.
    function defaultStroke(): Pt[] {
      const s = Math.min(w, h) * 0.34
      const cx = w / 2
      const cy = h / 2
      return starPath().map((p) => ({ x: cx + p.x * s, y: cy + p.y * s }))
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    const lime = `rgb(${ar},${ag},${ab})`

    // Draw the epicycle chain at time t, the growing traced path up to t, and
    // the full outline faint underneath. `showChain` hides the circles while the
    // user is mid-draw (only their raw stroke shows then).
    function draw(t: number, showChain: boolean) {
      ctx!.clearRect(0, 0, w, h)

      // The finished outline, faint, so there is always a shape to read.
      if (outline.length > 1) {
        ctx!.beginPath()
        ctx!.moveTo(outline[0].x, outline[0].y)
        for (let i = 1; i < outline.length; i++) ctx!.lineTo(outline[i].x, outline[i].y)
        ctx!.strokeStyle = 'rgba(255,255,255,0.14)'
        ctx!.lineWidth = 1
        ctx!.stroke()
      }

      // The mid-draw stroke, if any — the user's raw pointer path.
      if (stroke.length > 1) {
        ctx!.beginPath()
        ctx!.moveTo(stroke[0].x, stroke[0].y)
        for (let i = 1; i < stroke.length; i++) ctx!.lineTo(stroke[i].x, stroke[i].y)
        ctx!.strokeStyle = `rgba(${ar},${ag},${ab},0.85)`
        ctx!.lineWidth = 2
        ctx!.lineJoin = 'round'
        ctx!.lineCap = 'round'
        ctx!.stroke()
      }

      if (showChain && coeffs.length > 0) {
        // The epicycle chain, rooted at the centroid.
        let x = centroid.x
        let y = centroid.y
        ctx!.lineWidth = 1
        for (let i = 0; i < coeffs.length; i++) {
          const c = coeffs[i]
          const a = c.phase + 2 * Math.PI * c.freq * t
          const nx = x + c.amp * Math.cos(a)
          const ny = y + c.amp * Math.sin(a)
          // Only the larger circles are worth outlining; the rest would be a
          // haze of tiny rings, so past a threshold just draw the arm.
          if (c.amp > 1.4) {
            ctx!.beginPath()
            ctx!.arc(x, y, c.amp, 0, Math.PI * 2)
            ctx!.strokeStyle = 'rgba(255,255,255,0.10)'
            ctx!.stroke()
          }
          ctx!.beginPath()
          ctx!.moveTo(x, y)
          ctx!.lineTo(nx, ny)
          ctx!.strokeStyle = 'rgba(255,255,255,0.28)'
          ctx!.stroke()
          x = nx
          y = ny
        }

        // The traced path, drawn up to t — the sum putting the shape back.
        const upto = Math.max(2, Math.floor(t * (outline.length - 1)) + 1)
        ctx!.beginPath()
        ctx!.moveTo(outline[0].x, outline[0].y)
        for (let i = 1; i < upto; i++) ctx!.lineTo(outline[i].x, outline[i].y)
        ctx!.strokeStyle = lime
        ctx!.lineWidth = 2
        ctx!.lineJoin = 'round'
        ctx!.lineCap = 'round'
        ctx!.stroke()

        // The tip — the end of the last arm, where the pen actually is.
        ctx!.beginPath()
        ctx!.arc(x, y, 4.5, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${ar},${ag},${ab},0.2)`
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(x, y, 2.4, 0, Math.PI * 2)
        ctx!.fillStyle = lime
        ctx!.fill()
      }
    }

    layout()
    load(defaultStroke())

    let raf = 0

    if (reduce) {
      // A still: the chain at its start angle over the finished outline.
      draw(0, true)
    } else {
      const tick = (ts: number) => {
        const t = (ts % PERIOD) / PERIOD
        draw(t, !drawing)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    function toLocal(e: PointerEvent): Pt {
      const rect = canvas!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function onDown(e: PointerEvent) {
      e.preventDefault()
      canvas!.setPointerCapture(e.pointerId)
      drawing = true
      stroke = [toLocal(e)]
      // While drawing, blank the old reconstruction so only the new stroke shows.
      outline = []
      coeffs = []
      if (reduce) draw(0, false)
    }
    function onMove(e: PointerEvent) {
      if (!drawing) return
      const p = toLocal(e)
      const last = stroke[stroke.length - 1]
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_STEP) {
        stroke.push(p)
        if (reduce) draw(0, false)
      }
    }
    function onUp() {
      if (!drawing) return
      drawing = false
      if (stroke.length >= 8) {
        load(stroke)
      } else {
        // Too short to be a shape — fall back to the default so it never empties.
        load(defaultStroke())
      }
      stroke = []
      if (reduce) draw(0, true)
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onUp)
    canvas.addEventListener('pointercancel', onUp)

    const ro = new ResizeObserver(() => {
      layout()
      // A custom stroke lives in canvas px and would no longer fit, so a resize
      // resets to the default star (rare in practice — the card is fixed height).
      load(defaultStroke())
      if (reduce) draw(0, true)
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [reduce, accent])

  return (
    <canvas
      ref={ref}
      className={`h-full w-full touch-none select-none ${className}`}
      aria-hidden
    />
  )
}

export default Fourier
