import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A fractal tree — a thing grown rather than drawn, and the Objects & toys
// family's quiet answer to all the physics beside it. Every other piece there
// is a crowd of bodies pushing on one another; this is one rule, applied to
// itself, all the way down. A branch is a line; at its tip it forks into two
// shorter branches turned a little to either side, and each of those does the
// same, and the same again — nine times over — until a whole crown falls out of
// a single instruction. It is recursion made visible: the motif a programmer
// reaches for a dozen times a day, standing here as a tree.
//
// Nothing about the shape is placed by hand. The fork angles and the length of
// each child are jittered per branch by a fixed integer hash of that branch's
// position in the tree, so the crown is asymmetric and organic yet perfectly
// deterministic — the same tree every load, at every size. It grows on arrival:
// a growth clock opens the trunk first and each deeper ring of branches a beat
// later, so the tree unfurls from the ground up, then settles and breathes.
//
// The breathing is honest wind. Each branch sways on its own sine, and because
// every child is drawn from its parent's already-swayed direction, the sway
// compounds down the tree the way it does in a real one — the trunk barely
// stirs while the outermost twigs whip. It is live under the pointer: move
// across it and the whole crown leans the way you push, harder the further out;
// press to send a gust through it. The buds at the tips warm to lime and pulse.
//
// No Date.now and no Math.random anywhere — the growth and sway run off the
// rAF delta, every jitter comes from the seeded hash — so it is resize-stable
// and never trips the environment's guards. One canvas, one loop, the whole
// tree recomputed each frame from its single rule. Under prefers-reduced-motion
// the loop never starts: the finished tree is laid out once with a gentle fixed
// lean and held perfectly still, every branch and bud in place. Decorative, so
// aria-hidden.

const MAX_DEPTH = 9 // fork this many times → a full crown
const LEN_RATIO = 0.76 // each child is this fraction of its parent
const SPREAD = 0.4 // base half-angle of a fork, radians (~23°)
const GROW_MS = 2600 // time for the whole tree to unfurl
const TAU = Math.PI * 2

// A fast, deterministic integer hash → a number in [0, 1). Stands in for a PRNG
// so every branch's jitter is fixed by its id, never rolled at runtime.
function hash(n: number): number {
  let x = n | 0
  x = (x ^ 61) ^ (x >>> 16)
  x = x + (x << 3)
  x = x ^ (x >>> 4)
  x = Math.imul(x, 0x27d4eb2d)
  x = x ^ (x >>> 15)
  return (x >>> 0) / 4294967296
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function FractalTree({
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
    let baseX = 0
    let baseY = 0
    let trunkLen = 0
    let trunkWidth = 0

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      baseX = w / 2
      baseY = h * 0.96
      trunkLen = Math.min(h * 0.28, w * 0.2)
      trunkWidth = Math.max(4, Math.min(w, h) * 0.02)
    }
    layout()

    // The whole tree, from its single rule. `g` is the growth clock (0..1) and
    // `t` the wind clock (seconds); `lean` is the steady pointer bias and `amp`
    // the sway strength, both eased toward their targets in the loop.
    function drawBranch(
      x: number,
      y: number,
      angle: number,
      len: number,
      width: number,
      depth: number,
      id: number,
      g: number,
      t: number,
      lean: number,
      amp: number,
    ) {
      // Each deeper ring opens a beat after the one above it, so the tree
      // unfurls from the trunk out. A branch is invisible until its beat.
      const reveal = Math.max(0, Math.min(1, g * (MAX_DEPTH + 1) - depth))
      if (reveal <= 0) return
      const grown = easeOut(reveal)

      // Sway: thin far branches move most; the trunk barely stirs. Because the
      // child is drawn from this swayed angle, the motion compounds outward.
      const df = Math.pow(depth / MAX_DEPTH, 1.3)
      const phase = hash(id) * TAU
      const sway = (amp * Math.sin(t * 1.1 + phase + depth * 0.5) + lean) * df
      const a = angle + sway

      const ex = x + Math.cos(a) * len * grown
      const ey = y + Math.sin(a) * len * grown

      // Colour walks from graphite at the trunk to a soft warm light at the
      // tips, so the crown reads brighter than the bark.
      const k = depth / MAX_DEPTH
      const cr = Math.round(120 + k * 96)
      const cg = Math.round(120 + k * 104)
      const cb = Math.round(128 + k * 70)
      ctx!.strokeStyle = `rgba(${cr},${cg},${cb},${0.5 + 0.45 * grown})`
      ctx!.lineWidth = Math.max(0.6, width * grown)
      ctx!.lineCap = 'round'
      ctx!.beginPath()
      ctx!.moveTo(x, y)
      ctx!.lineTo(ex, ey)
      ctx!.stroke()

      if (depth >= MAX_DEPTH) {
        // A bud at the tip — lime, softly glowing, pulsing on its own phase.
        const pulse = 0.6 + 0.4 * Math.sin(t * 1.6 + phase * 3)
        const blossom = hash(id * 7 + 3) > 0.62 // some tips flower brighter
        const r = (blossom ? 3.4 : 2.2) * grown
        ctx!.beginPath()
        ctx!.fillStyle = `rgba(${ar},${ag},${ab},${(blossom ? 0.9 : 0.55) * grown * pulse})`
        ctx!.shadowColor = `rgba(${ar},${ag},${ab},0.8)`
        ctx!.shadowBlur = (blossom ? 10 : 5) * grown
        ctx!.arc(ex, ey, r, 0, TAU)
        ctx!.fill()
        ctx!.shadowBlur = 0
        return
      }

      // Fork. The two children are jittered off this branch's id, so the crown
      // is asymmetric but fixed.
      const sL = SPREAD * (0.72 + 0.56 * hash(id * 2 + 7))
      const sR = SPREAD * (0.72 + 0.56 * hash(id * 2 + 11))
      const lc = len * LEN_RATIO * (0.9 + 0.2 * hash(id + 5))
      const wc = width * 0.72
      drawBranch(ex, ey, a - sL, lc, wc, depth + 1, id * 2, g, t, lean, amp)
      drawBranch(ex, ey, a + sR, lc, wc, depth + 1, id * 2 + 1, g, t, lean, amp)
    }

    function paint(g: number, t: number, lean: number, amp: number) {
      ctx!.clearRect(0, 0, w, h)

      // A soft pool of light on the ground the tree rises from.
      const glow = ctx!.createRadialGradient(baseX, baseY, 0, baseX, baseY, trunkLen * 1.6)
      glow.addColorStop(0, `rgba(${ar},${ag},${ab},${0.1 * g})`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.fillStyle = glow
      ctx!.fillRect(0, 0, w, h)

      // The trunk points straight up (−90°); the whole tree grows from here.
      drawBranch(baseX, baseY, -Math.PI / 2, trunkLen, trunkWidth, 0, 1, g, t, lean, amp)
    }

    if (reduce) {
      // A finished tree, laid out once with a gentle fixed lean, held still.
      paint(1, 0.6, 0.12, 0.16)
      const ro = new ResizeObserver(() => {
        layout()
        paint(1, 0.6, 0.12, 0.16)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Wind and steering. A gentle default breeze; the pointer sets a steady
    // lean and, while held, sends a gust that decays away.
    const idleAmp = 0.16
    let amp = idleAmp
    let tgtAmp = idleAmp
    let lean = 0
    let tgtLean = 0
    let gust = 0

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const nx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
      tgtLean = nx * 0.34
      tgtAmp = idleAmp + Math.min(0.22, Math.abs(nx) * 0.22)
    }
    function onLeave() {
      tgtLean = 0
      tgtAmp = idleAmp
    }
    function onDown() {
      gust = 0.5
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)

    let raf = 0
    let last = -1
    let elapsed = 0 // ms since mount, for the growth clock
    let t = 0 // seconds, for the wind clock

    function frame(now: number) {
      if (last < 0) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-away
      elapsed += dt * 1000
      t += dt

      const g = Math.min(1, elapsed / GROW_MS)
      lean += (tgtLean - lean) * Math.min(1, dt * 3)
      amp += (tgtAmp - amp) * Math.min(1, dt * 3)
      gust *= Math.pow(0.14, dt) // decays toward zero in ~1s

      paint(g, t, lean, amp + gust)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [reduce, accent])

  return <canvas ref={ref} aria-hidden className={`block touch-none select-none ${className}`} />
}
