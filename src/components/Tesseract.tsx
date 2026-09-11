import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Tesseract — the four-dimensional cube, tumbling through a rotation you cannot
// picture and shown the only way it can be: cast down, dimension by dimension,
// until it lands as a line drawing on the page. It is the geometry family's
// honest oddity, next to the Spirograph and the Gear train — where those trace a
// closed curve or hold a rigid ratio in a plane you can see, this one holds a
// shape from a plane you cannot, and the whole point is to watch a 4-cube's
// shadow fold through itself.
//
// The object is exact, not evoked. A tesseract has 16 vertices — every choice of
// ±1 across four axes (x, y, z, w) — and 32 edges: two vertices are joined when
// they differ in exactly one coordinate, so each vertex has four edges, one per
// axis. Those 16 points and 32 edges are built once and never change; all that
// moves is the frame they are read in.
//
// Rotation in 4D happens in a plane, not about an axis, and there are six of
// them. This turns three at once — the XW and ZW planes, the two that reach into
// the fourth dimension and make the inner cube appear to swell out through the
// outer one and back, plus a gentle XY spin so the whole figure also turns the
// familiar way. Each is a plain 2×2 rotation applied to its pair of coordinates.
//
// Then the casting down. A 4D point is projected to 3D through a perspective
// divide by its distance in w (points nearer in the fourth dimension loom
// larger), and that 3D point is projected to 2D by the same divide in z. Two
// perspective projections stacked, so nearness in either hidden dimension reads
// as size and brightness: near edges are thick and near-white, far edges thin
// and dim, and the "cube inside a cube" you always see in a tesseract diagram is
// just the far cell shrunk by that first divide.
//
// The pointer leans the tumble: move across it and the horizontal push speeds
// the XY spin while the vertical push drives an XZ tilt, both easing back to a
// slow idle drift when the cursor leaves, so it is calm on its own and steerable
// under your hand. One canvas, one requestAnimationFrame loop off the frame
// delta (no wall clock, so a tab-away can't jump it), DPR-capped and cleaned up
// on unmount. Decorative, so aria-hidden. Under prefers-reduced-motion the loop
// never runs: the figure is projected once at a flattering angle and held still,
// and the pointer does nothing.

const ACCENT: readonly [number, number, number] = [220, 248, 124]

// The 16 vertices of the 4-cube: every sign combination of (x, y, z, w) = ±1.
function buildVertices(): number[][] {
  const v: number[][] = []
  for (let i = 0; i < 16; i++) {
    v.push([
      i & 1 ? 1 : -1,
      i & 2 ? 1 : -1,
      i & 4 ? 1 : -1,
      i & 8 ? 1 : -1,
    ])
  }
  return v
}

// Two vertices share an edge when they differ in exactly one coordinate — i.e.
// their indices differ by a single bit.
function buildEdges(): [number, number][] {
  const e: [number, number][] = []
  for (let a = 0; a < 16; a++) {
    for (let b = a + 1; b < 16; b++) {
      const diff = a ^ b
      if (diff && (diff & (diff - 1)) === 0) e.push([a, b]) // one bit set
    }
  }
  return e
}

// Rotate a 4-vector in the plane spanned by axes i and j, in place.
function rotate(p: number[], i: number, j: number, ang: number) {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const pi = p[i]
  const pj = p[j]
  p[i] = pi * c - pj * s
  p[j] = pi * s + pj * c
}

export function Tesseract({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = ACCENT
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const vertices = buildVertices()
    const edges = buildEdges()

    let w = 0
    let h = 0
    let scale = 1

    // Rotation angles, one per active plane, advanced by the loop.
    let axw = 0.6
    let azw = 0.2
    let axy = 0.3
    let axz = 0.0

    // Eased pointer lean, in [-1, 1]; falls back to 0 when the cursor is away.
    let leanX = 0
    let leanY = 0
    let targetX = 0
    let targetY = 0

    // Scratch buffers reused each frame — no per-frame allocation on the hot path.
    const proj = vertices.map(() => ({ x: 0, y: 0, depth: 0 }))

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      scale = Math.min(w, h) * 0.3
    }

    // Project all 16 vertices through the current frame and record each one's
    // screen position and a 0..1 nearness used for brightness and weight.
    function project() {
      const dist4 = 2.6 // viewer distance along w
      const dist3 = 3.4 // viewer distance along z
      let minD = Infinity
      let maxD = -Infinity
      for (let k = 0; k < 16; k++) {
        const p = vertices[k].slice()
        rotate(p, 0, 3, axw) // XW — reaches into the fourth dimension
        rotate(p, 2, 3, azw) // ZW — the other fold through w
        rotate(p, 0, 1, axy) // XY — the familiar in-plane spin
        rotate(p, 0, 2, axz) // XZ — the pointer's vertical tilt
        const f4 = 1 / (dist4 - p[3])
        const x3 = p[0] * f4
        const y3 = p[1] * f4
        const z3 = p[2] * f4
        const f3 = 1 / (dist3 - z3)
        proj[k].x = x3 * f3 * scale + w / 2
        proj[k].y = y3 * f3 * scale + h / 2
        const d = f4 * f3
        proj[k].depth = d
        if (d < minD) minD = d
        if (d > maxD) maxD = d
      }
      return { minD, maxD }
    }

    function paint() {
      const { minD, maxD } = project()
      const span = maxD - minD || 1
      ctx!.clearRect(0, 0, w, h)
      ctx!.lineCap = 'round'

      // Edges, painted far-to-near so nearer lines sit brightest on top.
      const order = edges
        .map((e, i) => ({ i, d: (proj[e[0]].depth + proj[e[1]].depth) / 2 }))
        .sort((a, b) => a.d - b.d)

      for (const { i } of order) {
        const [a, b] = edges[i]
        const pa = proj[a]
        const pb = proj[b]
        const t = ((pa.depth + pb.depth) / 2 - minD) / span // 0 far … 1 near
        const alpha = 0.14 + t * 0.66
        // Ramp the lime toward white as an edge nears the viewer.
        const r = Math.round(ar + (255 - ar) * t * 0.7)
        const g = Math.round(ag + (255 - ag) * t * 0.5)
        const bl = Math.round(ab * (0.55 + t * 0.45))
        ctx!.strokeStyle = `rgba(${r},${g},${bl},${alpha.toFixed(3)})`
        ctx!.lineWidth = 0.6 + t * 2.1
        ctx!.beginPath()
        ctx!.moveTo(pa.x, pa.y)
        ctx!.lineTo(pb.x, pb.y)
        ctx!.stroke()
      }

      // Vertices, the same near-to-far weighting, drawn as small warm points.
      for (let k = 0; k < 16; k++) {
        const t = (proj[k].depth - minD) / span
        const rad = 1.2 + t * 2.6
        ctx!.fillStyle = `rgba(${Math.round(ar + (255 - ar) * t)},${Math.round(
          ag + (255 - ag) * t * 0.7,
        )},${Math.round(ab)},${(0.35 + t * 0.6).toFixed(3)})`
        ctx!.beginPath()
        ctx!.arc(proj[k].x, proj[k].y, rad, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    layout()

    if (reduce) {
      // A flattering, static angle — no loop, no pointer.
      axw = 0.62
      azw = 0.32
      axy = 0.5
      axz = 0.16
      paint()
      const ro = new ResizeObserver(() => {
        layout()
        paint()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    let raf = 0
    let last = performance.now()

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      // Ease the pointer lean home so the figure is calm when untouched.
      leanX += (targetX - leanX) * Math.min(1, dt * 4)
      leanY += (targetY - leanY) * Math.min(1, dt * 4)

      // Idle drift, leaned by the pointer: horizontal speeds the spin, vertical
      // drives the tilt.
      axw += 0.30 * dt
      azw += 0.14 * dt
      axy += (0.16 + leanX * 0.9) * dt
      axz += leanY * 0.7 * dt

      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    }
    function onLeave() {
      targetX = 0
      targetY = 0
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full touch-none ${className}`}
    />
  )
}
