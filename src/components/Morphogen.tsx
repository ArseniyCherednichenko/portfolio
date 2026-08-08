import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A living Turing pattern, grown by chemistry rather than mechanics. Where the
// site's other canvases push mass around — the Cloth's Verlet nodes, the
// Murmuration's boids, the Truchet's tiles — this one grows a pattern out of a
// pair of reacting, diffusing chemicals and nothing else. It is the Gray-Scott
// reaction-diffusion system, the modern form of the mechanism Alan Turing set
// out in his 1952 paper "The Chemical Basis of Morphogenesis" to explain how a
// featureless egg decides where a leopard's spots or a fish's stripes go.
//
// Two virtual chemicals share the grid: A, everywhere at rest, and B, the
// catalyst. B consumes A wherever they meet (A + 2B -> 3B), A is fed back in at
// rate f, and B decays at rate k. Both spread by diffusion — a weighted 3x3
// Laplacian, B slower than A. That tiny imbalance is the whole trick: left to
// run, the field self-organises into coral, worms, and mitosing cells, a stable
// pattern that never quite settles. The simulation runs on a downscaled float
// grid wrapped toroidally (so the pattern is seamless), several reaction steps
// per frame, double-buffered in flat Float32Arrays with no per-cell React
// state; it is drawn once into a small ImageData and let the browser scale up,
// which gives the soft biological edges for free. The pointer is a pipette —
// it injects B under the cursor, so fresh growth blooms in your wake and heals
// back into the field. One canvas, one RAF loop, DPR-agnostic (the sim grid is
// resolution-independent by design). Under reduced motion the reaction is run
// forward once to a mature pattern and drawn a single time — no loop, no
// pointer, just the finished morphogenesis. Decorative, so aria-hidden.

export function Morphogen({
  className = '',
  accent = '220,248,124',
  scale = 5,
  feed = 0.0545,
  kill = 0.062,
}: {
  className?: string
  /** High-concentration colour as an "r,g,b" string. */
  accent?: string
  /** CSS pixels per simulation cell — larger is coarser and much cheaper. */
  scale?: number
  /** Gray-Scott feed rate f. Together with kill, picks the pattern family. */
  feed?: number
  /** Gray-Scott kill rate k. ~0.062 with f~0.0545 gives the classic coral. */
  kill?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    // Base ink the resting field sits at, warming toward the accent as B builds.
    const br = 12
    const bg = 14
    const bb = 20
    // Diffusion rates — A spreads faster than B; that asymmetry is what patterns.
    const dA = 1.0
    const dB = 0.5
    const dt = 1.0
    // Reaction steps advanced per animation frame. More is faster-growing but
    // heavier; a handful keeps a comfortable frame budget on the modest grid.
    const STEPS = 8

    // Clamp the working grid so the cost stays bounded on very wide cards. The
    // ImageData is drawn at grid resolution and scaled up by the canvas box.
    const MAXW = 240
    const MAXH = 150

    let cols = 0
    let rows = 0
    let a = new Float32Array(0)
    let b = new Float32Array(0)
    let a2 = new Float32Array(0)
    let b2 = new Float32Array(0)
    let image: ImageData | null = null
    let raf = 0

    // The pointer pipette: eases under the cursor and swells while it is over
    // the field, injecting B in a small soft disc so growth blooms there.
    const cur = { x: -1, y: -1, tx: -1, ty: -1, amp: 0, tamp: 0, active: false }

    function seed() {
      const n = cols * rows
      a = new Float32Array(n).fill(1)
      b = new Float32Array(n)
      a2 = new Float32Array(n)
      b2 = new Float32Array(n)
      // A scatter of B blobs to break symmetry — the pattern grows out of these.
      // Deterministic hashing (no Math.random) so it is stable across resizes and
      // never triggers the environment's RNG guards.
      const blobs = Math.max(5, Math.round((cols * rows) / 2600))
      for (let s = 0; s < blobs; s++) {
        const h1 = ((s * 2654435761) >>> 0) / 4294967295
        const h2 = ((s * 40503 + 0x9e3779b9) >>> 0) / 4294967295
        const bx = Math.floor(h1 * cols)
        const by = Math.floor(h2 * rows)
        const rad = 3 + ((s * 7) % 4)
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (dx * dx + dy * dy > rad * rad) continue
            const x = (bx + dx + cols) % cols
            const y = (by + dy + rows) % rows
            b[y * cols + x] = 1
          }
        }
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      cols = Math.min(MAXW, Math.max(24, Math.round(w / scale)))
      rows = Math.min(MAXH, Math.max(16, Math.round(h / scale)))
      // Draw the grid 1:1 into its own backing store and let CSS scale the box.
      canvas!.width = cols
      canvas!.height = rows
      ctx!.imageSmoothingEnabled = true
      image = ctx!.createImageData(cols, rows)
      seed()
    }

    // One Gray-Scott step over the whole grid, reading a/b and writing a2/b2,
    // then swapping. Toroidal neighbours keep the pattern seamless at the edges.
    function step() {
      const w = cols
      const hh = rows
      for (let y = 0; y < hh; y++) {
        const yUp = (y === 0 ? hh - 1 : y - 1) * w
        const yDn = (y === hh - 1 ? 0 : y + 1) * w
        const yC = y * w
        for (let x = 0; x < w; x++) {
          const xL = x === 0 ? w - 1 : x - 1
          const xR = x === w - 1 ? 0 : x + 1
          const i = yC + x
          const av = a[i]
          const bv = b[i]
          // Weighted 3x3 Laplacian: orthogonal 0.2, diagonal 0.05, centre -1.
          const lapA =
            a[yC + xL] * 0.2 +
            a[yC + xR] * 0.2 +
            a[yUp + x] * 0.2 +
            a[yDn + x] * 0.2 +
            a[yUp + xL] * 0.05 +
            a[yUp + xR] * 0.05 +
            a[yDn + xL] * 0.05 +
            a[yDn + xR] * 0.05 -
            av
          const lapB =
            b[yC + xL] * 0.2 +
            b[yC + xR] * 0.2 +
            b[yUp + x] * 0.2 +
            b[yDn + x] * 0.2 +
            b[yUp + xL] * 0.05 +
            b[yUp + xR] * 0.05 +
            b[yDn + xL] * 0.05 +
            b[yDn + xR] * 0.05 -
            bv
          const reaction = av * bv * bv
          let na = av + (dA * lapA - reaction + feed * (1 - av)) * dt
          let nb = bv + (dB * lapB + reaction - (kill + feed) * bv) * dt
          // Guard against numerical drift outside the physical [0,1] range.
          a2[i] = na < 0 ? 0 : na > 1 ? 1 : na
          b2[i] = nb < 0 ? 0 : nb > 1 ? 1 : nb
        }
      }
      let t = a
      a = a2
      a2 = t
      t = b
      b = b2
      b2 = t
    }

    // Paint B into a soft disc under the pointer — the pipette dose.
    function inject() {
      if (cur.amp < 0.01 || cur.x < 0) return
      const px = (cur.x / canvas!.getBoundingClientRect().width) * cols
      const py = (cur.y / canvas!.getBoundingClientRect().height) * rows
      const rad = 4
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const d2 = dx * dx + dy * dy
          if (d2 > rad * rad) continue
          const x = (Math.round(px) + dx + cols) % cols
          const y = (Math.round(py) + dy + rows) % rows
          const g = cur.amp * (1 - d2 / (rad * rad))
          const i = y * cols + x
          b[i] = Math.min(1, b[i] + 0.5 * g)
        }
      }
    }

    // Map the B field to a warm three-stop ramp over the dark ink and blit it.
    function draw() {
      if (!image) return
      const data = image.data
      const n = cols * rows
      for (let i = 0; i < n; i++) {
        // Contrast the two chemicals so pattern boundaries read crisply.
        let v = a[i] - b[i]
        v = v < 0 ? 0 : v > 1 ? 1 : v
        // Invert so dense B (low v) glows: t is 0 at rest, 1 in full growth.
        const tg = 1 - v
        // Ease the ramp toward the accent only in the upper band, so most of the
        // field stays inky and the pattern edges are what light up.
        const lit = tg * tg
        const j = i * 4
        data[j] = Math.round(br + (ar - br) * lit)
        data[j + 1] = Math.round(bg + (ag - bg) * lit)
        data[j + 2] = Math.round(bb + (ab - bb) * lit)
        data[j + 3] = 255
      }
      ctx!.putImageData(image, 0, 0)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cur.tx = e.clientX - rect.left
      cur.ty = e.clientY - rect.top
      cur.active = true
      cur.tamp = 1
    }
    function onLeave() {
      cur.active = false
      cur.tamp = 0
    }

    resize()

    if (reduce) {
      // Run the reaction forward to a mature pattern, then draw once. Bounded so
      // even a large grid resolves quickly; no loop and no pointer thereafter.
      const develop = () => {
        const iterations = 900
        for (let s = 0; s < iterations; s++) step()
        draw()
      }
      develop()
      const ro = new ResizeObserver(() => {
        resize()
        develop()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame() {
      cur.x += (cur.tx - cur.x) * 0.25
      cur.y += (cur.ty - cur.y) * 0.25
      cur.amp += (cur.tamp - cur.amp) * 0.1
      inject()
      for (let s = 0; s < STEPS; s++) step()
      draw()
      raf = requestAnimationFrame(frame)
    }

    // Give the pattern a running start so the card is already alive on arrival,
    // rather than opening on a blank field that takes seconds to bloom.
    for (let s = 0; s < 240; s++) step()

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
  }, [reduce, accent, scale, feed, kill])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
