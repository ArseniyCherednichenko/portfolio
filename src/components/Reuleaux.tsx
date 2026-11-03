import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// The Reuleaux triangle — the shape that drills a square hole. It belongs on the
// mechanism shelf beside the linkages because it *is* a mechanism: the working
// heart of the Watts square-hole drill, a real bit patented by Harry Watts in
// 1914 and still sold today. The toy here is the paradox you can watch resolve.
//
// A Reuleaux triangle is a curve of CONSTANT WIDTH. Take an equilateral triangle
// and replace each straight edge with a circular arc centred on the opposite
// vertex, radius equal to the side; the result is a bulged triangle that is
// exactly as wide in every direction, the way a circle is. Set two parallel
// callipers on it and turn it between them and the gap never changes — so it
// rolls like a disc even though it is plainly not round, and a square of side
// equal to that width is the tightest box it fits in at EVERY angle.
//
// That last fact is the mechanism. Because the rotor's horizontal span and its
// vertical span are both forever equal to the width w, a w×w square always holds
// it with all four sides kissed at once. Spin the rotor and its three corners
// sweep right into the square's four corners, scrubbing out the whole area bar
// four hair-thin rounded nicks — a square hole, drilled by a triangle. The only
// price of constant width is that the centre cannot stay still: it wanders a tiny
// looping path (four arcs of an ellipse, about 2% of w across), which is why the
// real drill floats its bit in a full-floating chuck. That wobble is traced here
// as a faint lime loop, and the live centre rides it.
//
// Honest about the maths and the drawing. The boundary is built once as a dense
// polyline — three 60° arcs, each centred on a vertex — and only rotated each
// frame. The square fit is not faked: the rotor is rotated by φ, its rotated
// bounding box is measured, and it is translated so that box is centred, which is
// exactly the constant-width constraint of touching all four sides. One canvas,
// one rAF loop, a frame-driven clock (no wall time), DPR-capped, finite-safe. The
// pointer takes the wheel while it is over the field — sweep to drive the turn —
// easing back to a slow idle spin when it leaves. Under reduced motion the loop
// never starts: the rotor is drawn still at a composed angle with the centre
// path and the swept hole already complete. Decorative, so aria-hidden.

export function Reuleaux({
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
    let side = 1 // the square's side = the rotor's constant width, in px
    let raf = 0
    let t = 0 // frame-driven phase; no Date.now, so resize-stable

    // Build the Reuleaux boundary once, in a unit frame (width = 1), centred on
    // the triangle's centroid. Three vertices of an equilateral triangle pointing
    // up; each edge is a 60° arc centred on the opposite vertex, radius = side.
    const R = 1 / Math.sqrt(3) // circumradius for width/side = 1
    const V = [
      { x: Math.cos(Math.PI / 2) * R, y: Math.sin(Math.PI / 2) * R },
      { x: Math.cos((Math.PI * 7) / 6) * R, y: Math.sin((Math.PI * 7) / 6) * R },
      { x: Math.cos((Math.PI * 11) / 6) * R, y: Math.sin((Math.PI * 11) / 6) * R },
    ]
    // Arc order B→C (centre A), C→A (centre B), A→B (centre C): a closed loop.
    const seq = [
      { c: 0, from: 1, to: 2 },
      { c: 1, from: 2, to: 0 },
      { c: 2, from: 0, to: 1 },
    ]
    const PER = 48
    const base: { x: number; y: number }[] = []
    for (const { c, from, to } of seq) {
      const O = V[c]
      let a0 = Math.atan2(V[from].y - O.y, V[from].x - O.x)
      let a1 = Math.atan2(V[to].y - O.y, V[to].x - O.x)
      // Sweep the short way (the 60° arc).
      let d = a1 - a0
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      for (let i = 0; i < PER; i++) {
        const a = a0 + (d * i) / PER
        base.push({ x: O.x + Math.cos(a), y: O.y + Math.sin(a) })
      }
    }
    const N = base.length
    const rx = new Float32Array(N)
    const ry = new Float32Array(N)

    // The pointer eases toward the cursor; its influence swells while over the
    // field, so it takes the wheel and lets go gently (same idiom as the others).
    const cur = { nx: 0, tnx: 0, amp: 0, tamp: 0 }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h / 2
      side = Math.min(w, h) * 0.6
    }

    // Rotate the boundary by φ into rx/ry (still width 1), then return the
    // translation that centres its bounding box — the constant-width fit that
    // lands all four corners on the square's sides. Returns the centre offset too.
    function place(phi: number) {
      const cos = Math.cos(phi)
      const sin = Math.sin(phi)
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (let i = 0; i < N; i++) {
        const x = base[i].x * cos - base[i].y * sin
        const y = base[i].x * sin + base[i].y * cos
        rx[i] = x
        ry[i] = y
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      const tx = -(minX + maxX) / 2
      const ty = -(minY + maxY) / 2
      return { tx, ty }
    }

    // Trace the wobble of the rotor centre across a full turn, in screen space.
    const TRACE = 120
    const trace: { x: number; y: number }[] = []
    function buildTrace() {
      trace.length = 0
      for (let i = 0; i <= TRACE; i++) {
        const { tx, ty } = place((i / TRACE) * Math.PI * 2)
        trace.push({ x: cx + tx * side, y: cy + ty * side })
      }
      // Re-measure for the live frame below (place mutates rx/ry).
    }

    function roundedSquare(x: number, y: number, s: number, r: number) {
      const half = s / 2
      ctx!.beginPath()
      ctx!.moveTo(x - half + r, y - half)
      ctx!.arcTo(x + half, y - half, x + half, y + half, r)
      ctx!.arcTo(x + half, y + half, x - half, y + half, r)
      ctx!.arcTo(x - half, y + half, x - half, y - half, r)
      ctx!.arcTo(x - half, y - half, x + half, y - half, r)
      ctx!.closePath()
    }

    function render(phi: number) {
      ctx!.clearRect(0, 0, w, h)
      const accentStr = `${ar},${ag},${ab}`

      // The square hole, with the tiny rounded corners the rotor can actually
      // reach — the drilled result, drawn as the frame the rotor turns inside.
      roundedSquare(cx, cy, side, side * 0.03)
      ctx!.lineWidth = 1.5
      ctx!.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx!.stroke()
      ctx!.fillStyle = 'rgba(255,255,255,0.015)'
      ctx!.fill()

      // The centre's wobble loop.
      if (trace.length > 1) {
        ctx!.beginPath()
        ctx!.moveTo(trace[0].x, trace[0].y)
        for (let i = 1; i < trace.length; i++) ctx!.lineTo(trace[i].x, trace[i].y)
        ctx!.closePath()
        ctx!.lineWidth = 1
        ctx!.strokeStyle = `rgba(${accentStr},0.22)`
        ctx!.stroke()
      }

      const { tx, ty } = place(phi)

      // The rotor itself — a soft lime body with a brighter rim.
      ctx!.beginPath()
      for (let i = 0; i < N; i++) {
        const sx = cx + (rx[i] + tx) * side
        const sy = cy + (ry[i] + ty) * side
        if (i === 0) ctx!.moveTo(sx, sy)
        else ctx!.lineTo(sx, sy)
      }
      ctx!.closePath()
      ctx!.fillStyle = `rgba(${accentStr},0.1)`
      ctx!.fill()
      ctx!.lineWidth = 1.5
      ctx!.strokeStyle = `rgba(${accentStr},0.85)`
      ctx!.stroke()

      // The three corners that do the cutting — mark them as they kiss the sides.
      ctx!.fillStyle = `rgba(${accentStr},0.95)`
      for (let k = 0; k < 3; k++) {
        const idx = ((k * N) / 3) | 0
        const sx = cx + (rx[idx] + tx) * side
        const sy = cy + (ry[idx] + ty) * side
        ctx!.beginPath()
        ctx!.arc(sx, sy, 2.4, 0, Math.PI * 2)
        ctx!.fill()
      }

      // The floating centre, riding the wobble.
      const ccx = cx + tx * side
      const ccy = cy + ty * side
      ctx!.beginPath()
      ctx!.arc(ccx, ccy, 3, 0, Math.PI * 2)
      ctx!.fillStyle = `rgba(${accentStr},0.9)`
      ctx!.fill()
      ctx!.beginPath()
      ctx!.arc(ccx, ccy, 6, 0, Math.PI * 2)
      ctx!.lineWidth = 1
      ctx!.strokeStyle = `rgba(${accentStr},0.4)`
      ctx!.stroke()
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cur.tnx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      cur.tamp = 1
    }
    function onLeave() {
      cur.tamp = 0
    }

    resize()
    buildTrace()

    if (reduce) {
      render(-0.5)
      const ro = new ResizeObserver(() => {
        resize()
        buildTrace()
        render(-0.5)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // A rolling drive angle so the pointer adds turn rather than snapping to it.
    let phi = 0
    function frame() {
      t += 0.016
      cur.nx += (cur.tnx - cur.nx) * 0.12
      cur.amp += (cur.tamp - cur.amp) * 0.06
      // Idle spin, plus the pointer's horizontal position driving extra turn.
      phi += 0.01 + cur.nx * 0.05 * cur.amp
      if (!Number.isFinite(phi)) phi = 0
      render(phi)
      raf = requestAnimationFrame(frame)
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => {
      resize()
      buildTrace()
    })
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
