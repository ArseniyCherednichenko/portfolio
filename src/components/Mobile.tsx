import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Mobile — a hanging kinetic sculpture in the spirit of Calder: a cascade of
// balanced rods, each one pivoting from a string, each carrying smaller rods or
// shapes from its two ends. The quiet marvel of a real mobile is that it
// *balances* — a heavy shape close to the pivot holds a light shape far out,
// because what a rod weighs on each side is mass times its distance from the
// pivot, and the two torques are equal. This one honours that: every rod's
// pivot is placed from the real masses hanging below it (left arm × left mass =
// right arm × right mass), computed once from a fixed, hand-composed tree, so
// the sculpture hangs level at rest the way Calder's bent wire did.
//
// Then it breathes. Each rod is a lightly damped pendulum about its own pivot,
// nudged by a slow ambient 'breeze' — a low sine detuned per rod — so the whole
// piece drifts in and out of phase and never repeats or settles. A rod's tilt
// swings the string-ends it carries, which carry the rods below them, so motion
// ripples down the tree the way it does on a ceiling. Nothing accumulates
// rotation: a child's own string always hangs from gravity, straight down from
// the moving end above it, so the shapes stay upright however the arms lean —
// the honest behaviour of weights on strings, not a rigid armature.
//
// Distinct from its Objects-&-toys neighbours: the Lanyard is a single weight on
// a string, the Turntable a wheel with momentum, the Harmonograph a plotter
// tracing a seeded figure — this is a *structure in balance*, a tree of torques
// you can stir. The cursor is a breeze: sweep near a shape and it warms toward
// the site's lime while its rod takes a gentle push, so the sculpture answers
// the pointer the way the rest of the page's fields do. A 'Breeze' gust gives
// the whole tree a shove and you watch it ring down and recompose.
//
// One canvas, one rAF loop, physics in refs (no React state on the hot path),
// DPR-capped and ResizeObserver-driven; the layout is fixed in model units and
// fit to the box once per resize. The canvas is decorative and aria-hidden with
// an sr-only account. Under reduced motion there is no loop and no pointer: the
// balanced sculpture is painted once, level and still.

interface MobileProps {
  className?: string
}

const DPR_CAP = 2
const G = 120 // stylised gravity that sets how fast a rod of given drop swings
const ZETA = 0.05 // light damping — the sway bleeds off slowly, never dead
const MAX_TILT = 0.34 // rad: a soft cap so arms lean, never cartwheel
const WARM_R = 54 // model units: how near the pointer warms a shape toward lime

type Shape = 'disc' | 'ring' | 'triangle' | 'bar'

interface LeafNode {
  kind: 'leaf'
  shape: Shape
  r: number
  color: string
  mass: number
}
interface ArmNode {
  kind: 'arm'
  width: number // total rod length in model units
  dropL: number // string length from the left end down to the left child
  dropR: number
  left: MNode
  right: MNode
}
type MNode = LeafNode | ArmNode

const LIME = '#DCF87C'
const TEAL = '#5BD8C4'
const CHALK = '#ECECEA'
const SLATE = '#8D98A6'

// A fixed, hand-composed sculpture — not random, because a mobile is designed,
// not scattered. Masses roughly track each shape's visual weight so the balance
// the physics computes reads as honest.
const leaf = (shape: Shape, r: number, color: string, mass: number): LeafNode => ({
  kind: 'leaf',
  shape,
  r,
  color,
  mass,
})
const TREE: ArmNode = {
  kind: 'arm',
  width: 224,
  dropL: 64,
  dropR: 58,
  left: {
    kind: 'arm',
    width: 118,
    dropL: 44,
    dropR: 48,
    left: leaf('disc', 15, TEAL, 16),
    right: leaf('triangle', 17, LIME, 13),
  },
  right: {
    kind: 'arm',
    width: 150,
    dropL: 52,
    dropR: 66,
    left: leaf('ring', 19, CHALK, 11),
    right: {
      kind: 'arm',
      width: 92,
      dropL: 40,
      dropR: 40,
      left: leaf('disc', 10, LIME, 8),
      right: leaf('bar', 13, SLATE, 10),
    },
  },
}

// Total mass hanging below a node — the sum of every shape under it.
function massOf(n: MNode): number {
  return n.kind === 'leaf' ? n.mass : massOf(n.left) + massOf(n.right)
}

// Per-rod simulation state, keyed by the id assigned in a pre-order walk.
interface Arm {
  id: number
  node: ArmNode
  aL: number // distance pivot -> left end (balances the torques)
  aR: number // distance pivot -> right end
  theta: number
  omega: number
  omega0: number // natural angular frequency
  breezeAmp: number
  breezeFreq: number
  phase: number
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
const LIME_RGB = hexToRgb(LIME)
// Mix a shape's base colour toward lime by `warm` (0..1) where the pointer is near.
function warmColor(base: string, warm: number): string {
  const [r, g, b] = hexToRgb(base)
  const [lr, lg, lb] = LIME_RGB
  const m = (a: number, bb: number) => Math.round(a + (bb - a) * warm)
  return `rgb(${m(r, lr)}, ${m(g, lg)}, ${m(b, lb)})`
}

export function Mobile({ className }: MobileProps) {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gustRef = useRef<() => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    let raf = 0
    let last = 0

    // Flatten the tree's rods into a sim array, computing each pivot from the
    // real masses below its two ends so the sculpture hangs level.
    const arms: Arm[] = []
    let nextId = 0
    function build(n: MNode): void {
      if (n.kind !== 'arm') return
      const mL = massOf(n.left)
      const mR = massOf(n.right)
      const aL = (n.width * mR) / (mL + mR) // heavier side sits closer to the pivot
      const aR = n.width - aL
      // A rod's swing rate comes from how far its load hangs: longer strings,
      // slower sway. Detuned per rod so the tree drifts out of phase.
      const drop = (n.dropL + n.dropR) / 2 + 18
      const omega0 = Math.sqrt(G / drop)
      arms.push({
        id: nextId++,
        node: n,
        aL,
        aR,
        theta: 0,
        omega: 0,
        omega0,
        breezeAmp: 0.9 * omega0 * omega0,
        breezeFreq: omega0 * (0.34 + 0.12 * ((nextId * 7) % 5)),
        phase: (nextId * 1.618) % (Math.PI * 2),
      })
      build(n.left)
      build(n.right)
    }
    build(TREE)
    const armById = new Map(arms.map((a) => [a.node, a]))

    // Pointer, in model coordinates (filled after the fit transform is known).
    const pointer = { x: 0, y: 0, active: false }
    // Each frame records where every shape landed, so pointer warmth and the
    // nudge it gives a rod are measured against the real, swaying positions.
    interface Placed {
      leaf: LeafNode
      x: number
      y: number
      parent: Arm | null
      side: 1 | -1 // which end of the parent rod this shape hangs from
      warm: number
    }
    let placed: Placed[] = []

    // Fit transform: model units -> device, computed once per resize from the
    // sculpture's resting bounds (plus slack for the sway and the shapes).
    let fit = { s: 1, tx: 0, ty: 0 }
    function computeFit() {
      // Resting bounds: walk the tree with every rod level.
      let minX = 0
      let maxX = 0
      let maxY = 0
      function rest(n: MNode, px: number, py: number): void {
        if (n.kind === 'leaf') {
          minX = Math.min(minX, px - n.r)
          maxX = Math.max(maxX, px + n.r)
          maxY = Math.max(maxY, py + n.r)
          return
        }
        const a = armById.get(n)!
        const lx = px - a.aL
        const rx = px + a.aR
        minX = Math.min(minX, lx, rx)
        maxX = Math.max(maxX, lx, rx)
        rest(n.left, lx, py + n.dropL)
        rest(n.right, rx, py + n.dropR)
      }
      const topDrop = 34
      rest(TREE, 0, topDrop)
      const padX = 54 // room for arms to lean
      const bw = maxX - minX + padX * 2
      const bh = maxY + 24
      const s = Math.min(width / bw, height / bh)
      fit = {
        s,
        tx: width / 2 - ((minX + maxX) / 2) * s,
        ty: 18,
      }
    }

    function stepPhysics(t: number, dt: number) {
      for (const a of arms) {
        const breeze = a.breezeAmp * Math.sin(t * a.breezeFreq + a.phase)
        // Damped driven pendulum: restoring pull to level, light damping, breeze.
        const acc = -a.omega0 * a.omega0 * a.theta - 2 * ZETA * a.omega0 * a.omega + breeze
        a.omega += acc * dt
        a.theta += a.omega * dt
        if (a.theta > MAX_TILT) {
          a.theta = MAX_TILT
          a.omega *= -0.4
        } else if (a.theta < -MAX_TILT) {
          a.theta = -MAX_TILT
          a.omega *= -0.4
        }
      }
    }

    // Walk the tree with current tilts, collecting draw records. Rotation does
    // not accumulate — every child's string hangs straight down from the moving
    // end above it, so shapes stay upright however the arms lean.
    interface Seg {
      x1: number
      y1: number
      x2: number
      y2: number
      kind: 'rod' | 'string'
    }
    function place() {
      const segs: Seg[] = []
      placed = []
      const topDrop = 34
      function walk(n: MNode, px: number, py: number, parent: Arm | null, side: 1 | -1) {
        if (n.kind === 'leaf') {
          placed.push({ leaf: n, x: px, y: py, parent, side, warm: 0 })
          return
        }
        const a = armById.get(n)!
        const c = Math.cos(a.theta)
        const s = Math.sin(a.theta)
        const lx = px - a.aL * c
        const ly = py - a.aL * s
        const rx = px + a.aR * c
        const ry = py + a.aR * s
        segs.push({ x1: lx, y1: ly, x2: rx, y2: ry, kind: 'rod' })
        const lcx = lx
        const lcy = ly + n.dropL
        const rcx = rx
        const rcy = ry + n.dropR
        segs.push({ x1: lx, y1: ly, x2: lcx, y2: lcy, kind: 'string' })
        segs.push({ x1: rx, y1: ry, x2: rcx, y2: rcy, kind: 'string' })
        walk(n.left, lcx, lcy, a, -1)
        walk(n.right, rcx, rcy, a, 1)
      }
      // Top suspension string from the anchor down to the root pivot.
      segs.push({ x1: 0, y1: 0, x2: 0, y2: topDrop, kind: 'string' })
      walk(TREE, 0, topDrop, null, 1)
      return segs
    }

    function applyPointer(dt: number) {
      if (!pointer.active) return
      for (const p of placed) {
        const d = Math.hypot(p.x - pointer.x, p.y - pointer.y)
        if (d < WARM_R) {
          p.warm = Math.max(p.warm, (1 - d / WARM_R) ** 2)
          // A breeze on the shape nudges the rod it hangs from — the near side
          // dips, so sweeping the cursor stirs the sculpture.
          if (p.parent) p.parent.omega += p.side * p.warm * 2.6 * dt
        }
      }
    }

    function draw(segs: Seg[]) {
      const g = ctx!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, width, height)
      g.fillStyle = '#050505'
      g.fillRect(0, 0, width, height)
      g.translate(fit.tx, fit.ty)
      g.scale(fit.s, fit.s)
      g.lineCap = 'round'

      // Strings first (hairline), then rods (a touch heavier), then shapes.
      for (const seg of segs) {
        if (seg.kind !== 'string') continue
        g.strokeStyle = 'rgba(236, 236, 234, 0.16)'
        g.lineWidth = 1 / fit.s
        g.beginPath()
        g.moveTo(seg.x1, seg.y1)
        g.lineTo(seg.x2, seg.y2)
        g.stroke()
      }
      for (const seg of segs) {
        if (seg.kind !== 'rod') continue
        g.strokeStyle = 'rgba(236, 236, 234, 0.42)'
        g.lineWidth = 2.1 / fit.s
        g.beginPath()
        g.moveTo(seg.x1, seg.y1)
        g.lineTo(seg.x2, seg.y2)
        g.stroke()
      }
      // The anchor cap and each rod pivot, as small bright dots.
      g.fillStyle = 'rgba(236, 236, 234, 0.55)'
      g.beginPath()
      g.arc(0, 0, 2.4 / fit.s, 0, Math.PI * 2)
      g.fill()

      for (const p of placed) {
        const col = p.warm > 0 ? warmColor(p.leaf.color, p.warm) : p.leaf.color
        drawShape(g, p.leaf, p.x, p.y, col, p.warm)
      }
    }

    function drawShape(
      g: CanvasRenderingContext2D,
      l: LeafNode,
      x: number,
      y: number,
      col: string,
      warm: number,
    ) {
      // A soft bloom under a warmed shape, so the cursor's touch reads as light.
      if (warm > 0.02) {
        const glow = g.createRadialGradient(x, y, 0, x, y, l.r * 2.4)
        glow.addColorStop(0, `rgba(220, 248, 124, ${0.22 * warm})`)
        glow.addColorStop(1, 'rgba(220, 248, 124, 0)')
        g.fillStyle = glow
        g.beginPath()
        g.arc(x, y, l.r * 2.4, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = col
      g.strokeStyle = col
      switch (l.shape) {
        case 'disc':
          g.beginPath()
          g.arc(x, y, l.r, 0, Math.PI * 2)
          g.fill()
          break
        case 'ring':
          g.lineWidth = Math.max(2.4, l.r * 0.3)
          g.beginPath()
          g.arc(x, y, l.r - g.lineWidth / 2, 0, Math.PI * 2)
          g.stroke()
          break
        case 'triangle':
          g.beginPath()
          g.moveTo(x, y - l.r)
          g.lineTo(x + l.r * 0.92, y + l.r * 0.72)
          g.lineTo(x - l.r * 0.92, y + l.r * 0.72)
          g.closePath()
          g.fill()
          break
        case 'bar': {
          const w = l.r * 2
          const h = l.r * 0.8
          const rr = h / 2
          g.beginPath()
          g.moveTo(x - w / 2 + rr, y - h / 2)
          g.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, rr)
          g.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, rr)
          g.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, rr)
          g.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, rr)
          g.closePath()
          g.fill()
          break
        }
      }
    }

    function frame(now: number) {
      if (!last) last = now
      const dt = Math.min((now - last) / 1000, 0.032)
      last = now
      const t = now / 1000
      stepPhysics(t, dt)
      const segs = place()
      applyPointer(dt)
      draw(segs)
      raf = requestAnimationFrame(frame)
    }

    function settle() {
      // Reduced motion: level the whole tree and paint one still frame.
      for (const a of arms) {
        a.theta = 0
        a.omega = 0
      }
      draw(place())
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(width * dpr)
      canvas!.height = Math.floor(height * dpr)
      computeFit()
      if (reduce) settle()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    gustRef.current = () => {
      // A gust: shove every rod, alternating sign so the whole tree rings.
      for (const a of arms) a.omega += (a.id % 2 ? 1 : -1) * (2.4 + a.omega0 * 0.6)
    }

    if (reduce) {
      return () => ro.disconnect()
    }

    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      // Screen -> model: undo the fit translate/scale.
      pointer.x = (e.clientX - rect.left - fit.tx) / fit.s
      pointer.y = (e.clientY - rect.top - fit.ty) / fit.s
      pointer.active = true
    }
    const onLeave = () => {
      pointer.active = false
    }
    canvas.addEventListener('pointermove', toLocal)
    canvas.addEventListener('pointerdown', toLocal)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.style.touchAction = 'none'

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', toLocal)
      canvas.removeEventListener('pointerdown', toLocal)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce])

  return (
    <div className={className} style={{ position: 'relative' }}>
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" style={{ display: 'block' }} />
      <button
        type="button"
        onClick={() => gustRef.current()}
        className="absolute bottom-4 right-4 z-10 rounded-full border border-white/15 bg-black/30 px-4 py-1.5 text-sm font-semibold text-white/80 backdrop-blur transition-colors hover:border-[#DCF87C]/50 hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      >
        Breeze
      </button>
      <span className="sr-only">
        A hanging kinetic mobile: a cascade of rods, each balanced on its pivot by the real masses of the shapes below it,
        swaying as lightly damped pendulums in a slow ambient breeze. Moving the cursor near a shape warms it and stirs
        the rod it hangs from; the Breeze button shoves the whole sculpture and it rings back into balance. Under reduced
        motion it hangs level and still.
      </span>
    </div>
  )
}
