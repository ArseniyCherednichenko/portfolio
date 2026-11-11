import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Tunnel — the demoscene's other signature trick, and the one thing its three
// flat fields never do. The Plasma folds a travelling scalar field into soft
// lime light, the Dither quantises that field to a hard stipple, the Caustics
// sharpen it into focused filaments; all three paint a surface you look *at*.
// This one opens a hole in the surface and falls *through* it — perspective,
// not texture. An endless textured tube rushing past a dark vanishing point is
// the effect every 1990s intro reached for once it had a palette, and it is
// built the exact way those were: not per-pixel trigonometry every frame, but
// two lookup tables computed once and read millions of times.
//
// The whole idea is that a tunnel has only two coordinates — how far down it a
// point sits, and how far around the wall — and both are fixed functions of the
// pixel's position relative to the centre. So for every pixel of a coarse
// offscreen buffer we precompute, once, its DEPTH (a constant over its radius,
// so the value races toward infinity at the centre and crawls at the rim — that
// one-over-r is the entire sense of distance) and its ANGLE around the bore.
// A frame then costs no atan2 and no sqrt at all: it only adds a scrolling
// offset to those stored coordinates and reads a woven wall pattern and a depth
// fog out of them. That is why a 486 could run it, and why it is near free here.
//
// The wall is a plain interference weave — rings down the bore crossed with
// staves around it — carried in the site's single accent, and the fog darkens
// everything toward the centre so the bore falls to a true black vanishing
// point rather than a bright hole. A 256-entry colour lookup maps the lit wall
// from deep tube ink through teal to lime and a specular crest, so the inner
// loop never interpolates a stop. The pointer leans you into the tube: moving
// across it twists the walls toward the cursor and pulls you faster down the
// bore, easing back to a steady fall when it leaves.
//
// Coarse buffer upscaled smooth, so DPR is irrelevant by design; one RAF loop,
// ResizeObserver-driven, cancelled on unmount; the canvas is decorative and
// hidden from assistive tech. Under prefers-reduced-motion there is no loop and
// no pointer — one still frame is painted at t = 0 and only redrawn on resize.
export function Tunnel({
  className = '',
  speed = 1,
  scale = 5,
  /** Rings down the bore — bigger packs the wall tighter along the length. */
  rings = 6,
  /** Staves around the wall — bigger cuts more segments around the tube. */
  staves = 9,
  accent = '220,248,124',
  interactive = true,
}: {
  className?: string
  speed?: number
  scale?: number
  rings?: number
  staves?: number
  accent?: string
  interactive?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10) || 0)

    // Ramp: deep tube ink -> cool teal shadow -> lime wall -> specular crest.
    // Kept in the single-accent language so the bore never reads rainbow.
    const STOPS: [number, number, number, number][] = [
      [0.0, 5, 8, 12],
      [0.4, 12, 28, 32],
      [0.64, Math.round(ar * 0.42), Math.round(ag * 0.56), Math.round(ab * 0.4)],
      [0.86, ar, ag, ab],
      [1.0, 244, 255, 218],
    ]
    const LUT = new Uint8ClampedArray(256 * 3)
    for (let i = 0; i < 256; i++) {
      const v = i / 255
      let s = 0
      while (s < STOPS.length - 1 && v > STOPS[s + 1][0]) s++
      const [t0, r0, g0, b0] = STOPS[s]
      const [t1, r1, g1, b1] = STOPS[Math.min(s + 1, STOPS.length - 1)]
      const f = t1 === t0 ? 0 : (v - t0) / (t1 - t0)
      LUT[i * 3] = r0 + (r1 - r0) * f
      LUT[i * 3 + 1] = g0 + (g1 - g0) * f
      LUT[i * 3 + 2] = b0 + (b1 - b0) * f
    }

    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d')
    if (!bctx) return

    let w = 0
    let h = 0
    let bw = 0
    let bh = 0
    let img: ImageData | null = null
    // The two precomputed tables that make it a demoscene tunnel rather than a
    // per-frame maths loop: depth (1/r) and angle for every buffer pixel, plus
    // a fog weight that darkens toward the bore. Rebuilt only on resize.
    let depthTab: Float32Array | null = null
    let angleTab: Float32Array | null = null
    let fogTab: Float32Array | null = null
    let raf = 0
    // Pointer lean, eased toward its target so taking the cursor off the field
    // coasts back to a steady fall rather than snapping.
    const lean = { tx: 0, ty: 0, x: 0, y: 0 }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      canvas!.width = w
      canvas!.height = h
      bw = Math.max(1, Math.ceil(w / scale))
      bh = Math.max(1, Math.ceil(h / scale))
      buf.width = bw
      buf.height = bh
      img = bctx!.createImageData(bw, bh)
      ctx!.imageSmoothingEnabled = true

      // Build the tables against the panel centre. DEPTH is a constant over the
      // radius so it blows up toward the middle (far away) and settles at the
      // rim (close); ANGLE walks once around the bore. FOG fades the lit wall to
      // black near the centre so the vanishing point is a true hole, not a glow.
      const n = bw * bh
      depthTab = new Float32Array(n)
      angleTab = new Float32Array(n)
      fogTab = new Float32Array(n)
      const cx = bw / 2
      const cy = bh / 2
      const k = Math.max(bw, bh) * 0.5 // sets how fast depth scrolls through
      let i = 0
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const dx = x - cx
          const dy = y - cy
          const r = Math.hypot(dx, dy) + 1e-4
          depthTab[i] = k / r
          angleTab[i] = Math.atan2(dy, dx) / Math.PI // [-1,1]
          // Darken the deep centre; hold the rim bright. Smooth, not a hard ring.
          const fog = r / (k * 0.9)
          fogTab[i] = fog > 1 ? 1 : fog * fog * (3 - 2 * fog)
          i++
        }
      }
    }

    function render(t: number) {
      if (!img || !depthTab || !angleTab || !fogTab) return
      const data = img.data
      // Scroll down the bore and twist around it; the pointer lean adds to both,
      // so moving the cursor rushes the fall and rotates the walls toward it.
      const travel = t + lean.y * 2.2
      const twist = t * 0.15 + lean.x * 1.8
      let p = 0
      for (let q = 0; q < depthTab.length; q++) {
        const d = depthTab[q] * rings + travel
        const a = angleTab[q] * staves + twist
        // Woven wall: rings down the length crossed with staves around it, lifted
        // by a slow diagonal so the weave drifts rather than sitting dead still.
        let wall =
          0.5 +
          0.5 * Math.sin(d) * Math.sin(a * Math.PI) +
          0.18 * Math.sin(d * 0.5 + a * Math.PI + t * 0.6)
        wall = wall < 0 ? 0 : wall > 1 ? 1 : wall
        const lit = wall * fogTab[q]
        const idx = ((lit * 255) | 0) * 3
        data[p] = LUT[idx]
        data[p + 1] = LUT[idx + 1]
        data[p + 2] = LUT[idx + 2]
        data[p + 3] = 255
        p += 4
      }
      bctx!.putImageData(img, 0, 0)
      ctx!.drawImage(buf, 0, 0, bw, bh, 0, 0, w, h)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      // Lean in [-1,1] from the centre of the panel.
      lean.tx = ((e.clientX - rect.left) / w) * 2 - 1
      lean.ty = ((e.clientY - rect.top) / h) * 2 - 1
    }
    function onLeave() {
      lean.tx = 0
      lean.ty = 0
    }

    resize()

    if (reduce) {
      render(0)
      const ro = new ResizeObserver(() => {
        resize()
        render(0)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const start = performance.now()
    function frame(now: number) {
      // Ease the lean toward its target so the tube coasts, never snaps.
      lean.x += (lean.tx - lean.x) * 0.06
      lean.y += (lean.ty - lean.y) * 0.06
      render(((now - start) / 1000) * speed)
      raf = requestAnimationFrame(frame)
    }
    if (interactive) {
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerleave', onLeave)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, speed, scale, rings, staves, accent, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
