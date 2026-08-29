import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A word that assembles itself out of a swarm of particles, then holds — and
// scatters under the cursor before pulling itself back together.
//
// The mechanic: the text is rendered once into a grid-resolution offscreen
// buffer (the same coverage trick ASCIIText uses), and every cell the letters
// fill becomes a *target* point. A cloud of particles is scattered across the
// field on mount and each is bound to one target by a spring, so the word
// precipitates out of noise as the springs pull every particle home. Once
// settled they warm to lime and keep a faint idle drift so the type is alive at
// rest; the pointer is a repulsor — particles near it are pushed outward and
// cool, then spring back the instant it leaves, so sweeping across the word
// blows a hole in it that heals behind you.
//
// Distinct from the type family's other canvas pieces: ASCIIText paints a fixed
// glyph grid, Particles webs a drifting constellation with no word in it, and
// the glitch/decrypt effects keep the real letters and corrupt them — here the
// letters have no substance of their own, they are only ever the shape a free
// swarm is settling into. One canvas, one rAF loop, no per-particle React
// state; a text-seeded PRNG places every particle so the same swarm assembles
// the same way each load (no Math.random, no wall clock). DPR-clamped,
// ResizeObserver-driven. Honest to AT via role="img" + aria-label. Reduced
// motion paints the settled word once as a still field of lime points — the
// whole meaning, none of the motion.
export function ParticleText({
  text,
  className = '',
  // spacing between sampled target points, in px; smaller = denser, more particles
  gap = 6,
  // where the cursor is read from: the canvas itself, or the whole window
  listen = 'canvas',
  // radius of the cursor's push field, in px
  repel = 90,
}: {
  text: string
  className?: string
  gap?: number
  listen?: 'canvas' | 'window'
  repel?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // offscreen buffer sampled at one pixel per target cell
    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d', { willReadFrequently: true })
    if (!bctx) return

    const LIME: [number, number, number] = [220, 248, 124]
    const DIM: [number, number, number] = [96, 100, 110]
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // A deterministic PRNG seeded from the word, so the same swarm assembles the
    // same way every load — no Math.random anywhere on the hot path or at build.
    let seed = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
      seed ^= text.charCodeAt(i)
      seed = Math.imul(seed, 0x01000193) >>> 0
    }
    function rng() {
      // mulberry32
      seed = (seed + 0x6d2b79f5) >>> 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    let w = 0
    let h = 0
    // particle state, structure-of-arrays so the hot loop touches flat memory
    let n = 0
    let x = new Float32Array(0)
    let y = new Float32Array(0)
    let vx = new Float32Array(0)
    let vy = new Float32Array(0)
    let tx = new Float32Array(0)
    let ty = new Float32Array(0)
    let ph = new Float32Array(0) // idle-drift phase, per particle
    let raf = 0
    let last = 0

    // pointer in canvas space; parked off-field until it moves
    let px = -1e4
    let py = -1e4

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      if (w === 0 || h === 0) return
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      // render the word into a buffer at target-grid resolution, fitted to width
      const cols = Math.max(1, Math.floor(w / gap))
      const rows = Math.max(1, Math.floor(h / gap))
      buf.width = cols
      buf.height = rows
      bctx!.clearRect(0, 0, cols, rows)
      bctx!.fillStyle = '#fff'
      bctx!.textAlign = 'center'
      bctx!.textBaseline = 'middle'
      let fs = rows
      bctx!.font = `900 ${fs}px Inter, system-ui, sans-serif`
      const margin = cols * 0.05
      const target = cols - margin * 2
      const measure = () => bctx!.measureText(text).width
      let guard = 0
      while (measure() > target && fs > 2 && guard++ < 400) {
        fs -= 1
        bctx!.font = `900 ${fs}px Inter, system-ui, sans-serif`
      }
      while (fs > rows * 0.9 && fs > 2) fs -= 1
      bctx!.font = `900 ${fs}px Inter, system-ui, sans-serif`
      bctx!.fillText(text, cols / 2, rows / 2)

      // collect the filled cells as target points, in canvas px, centred
      const data = bctx!.getImageData(0, 0, cols, rows).data
      const txs: number[] = []
      const tys: number[] = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (data[(r * cols + c) * 4 + 3] > 130) {
            txs.push((c + 0.5) * gap)
            tys.push((r + 0.5) * gap)
          }
        }
      }

      n = txs.length
      x = new Float32Array(n)
      y = new Float32Array(n)
      vx = new Float32Array(n)
      vy = new Float32Array(n)
      tx = new Float32Array(n)
      ty = new Float32Array(n)
      ph = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        tx[i] = txs[i]
        ty[i] = tys[i]
        // scatter each particle from a seeded start somewhere across the field,
        // so the word visibly precipitates in from noise
        x[i] = rng() * w
        y[i] = rng() * h
        vx[i] = 0
        vy[i] = 0
        ph[i] = rng() * Math.PI * 2
      }
    }

    // draw the settled targets once, as a still lime field (reduced motion)
    function paintStill() {
      ctx!.clearRect(0, 0, w, h)
      const s = Math.max(1.4, gap * 0.34)
      for (let i = 0; i < n; i++) {
        ctx!.fillStyle = 'rgba(220,248,124,0.9)'
        ctx!.fillRect(tx[i] - s / 2, ty[i] - s / 2, s, s)
      }
    }

    const R = repel
    const R2 = R * R

    function step(dt: number, time: number) {
      ctx!.clearRect(0, 0, w, h)
      const s = Math.max(1.4, gap * 0.34)
      // spring + damping tuned in per-frame units, dt in ~1 = one 60fps frame
      const k = 0.11
      const damp = Math.pow(0.86, dt)
      for (let i = 0; i < n; i++) {
        let ax = (tx[i] - x[i]) * k
        let ay = (ty[i] - y[i]) * k

        // cursor repulsion — a soft push out of the pointer's field
        const dx = x[i] - px
        const dy = y[i] - py
        const d2 = dx * dx + dy * dy
        let disturbed = 0
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const f = (1 - d / R) * 5.2
          ax += (dx / d) * f
          ay += (dy / d) * f
          disturbed = 1 - d / R
        }

        vx[i] = (vx[i] + ax * dt) * damp
        vy[i] = (vy[i] + ay * dt) * damp
        x[i] += vx[i] * dt
        y[i] += vy[i] * dt

        // faint idle drift so the settled word keeps breathing
        const idle = 0.35
        x[i] += Math.sin(time * 0.0011 + ph[i]) * idle * dt
        y[i] += Math.cos(time * 0.0013 + ph[i]) * idle * dt

        // heat: warm to lime when home, cool + dim when far from target or shoved
        const ex = tx[i] - x[i]
        const ey = ty[i] - y[i]
        const err = Math.sqrt(ex * ex + ey * ey)
        const heat = Math.max(0, 1 - err / 26) * (1 - disturbed * 0.85)
        const rr = (DIM[0] + (LIME[0] - DIM[0]) * heat) | 0
        const gg = (DIM[1] + (LIME[1] - DIM[1]) * heat) | 0
        const bb = (DIM[2] + (LIME[2] - DIM[2]) * heat) | 0
        const alpha = 0.4 + 0.55 * heat
        ctx!.fillStyle = `rgba(${rr},${gg},${bb},${alpha.toFixed(3)})`
        ctx!.fillRect(x[i] - s / 2, y[i] - s / 2, s, s)
      }
    }

    function frame(t: number) {
      if (!last) last = t
      // clamp dt so a backgrounded tab never explodes the springs
      const dt = Math.min(2.5, (t - last) / 16.6667)
      last = t
      step(dt, t)
      raf = requestAnimationFrame(frame)
    }

    const targetEl = listen === 'window' ? window : canvas
    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      px = e.clientX - rect.left
      py = e.clientY - rect.top
    }
    function onLeave() {
      px = -1e4
      py = -1e4
    }

    build()

    if (reduce) {
      if (n) paintStill()
      const ro = new ResizeObserver(() => {
        build()
        if (n) paintStill()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    ;(targetEl as HTMLElement | Window).addEventListener('pointermove', onMove as EventListener)
    canvas.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => {
      build()
      last = 0
    })
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      ;(targetEl as HTMLElement | Window).removeEventListener('pointermove', onMove as EventListener)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, text, gap, listen, repel])

  return <canvas ref={ref} className={`h-full w-full ${className}`} role="img" aria-label={text} />
}
