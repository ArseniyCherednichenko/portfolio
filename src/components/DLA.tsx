import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// DLA: Diffusion-Limited Aggregation — the way frost grows on a window, a
// mineral dendrite crystallises in rock, and soot clusters in the air. The
// recipe is almost nothing: plant one frozen seed, then release particles far
// away that wander at random (a drunkard's walk, the discrete face of
// diffusion). A walker drifts with no plan until it touches something already
// frozen, and the instant it does it freezes too, where it stuck. Repeat, and
// the cluster that assembles is not a blob but a branching, self-similar coral
// — because the arms that stick out a little catch wandering walkers first and
// so grow faster, starving the hollows behind them. The fractal is a pure
// consequence of the rule; nothing about the shape is drawn by hand.
//
// It is the chaos-and-emergence cousin of this family's Slime mould: both grow
// a vein-like network out of thousands of mindless agents, but where the slime
// steers up a scent gradient, a DLA walker has no sense at all — only the raw
// statistics of the random walk decide where the frost reaches.
//
// Mechanics. The field is a coarse grid of cells; one Uint8 array marks which
// are frozen. Walkers spawn on a circle just outside the cluster's current
// reach and are killed and respawned if they stray too far, the standard trick
// that keeps the walk cheap as the cluster grows. A fixed budget of freezes
// and of steps runs per frame so a dense tip never stalls the loop. Each cell
// is coloured the moment it freezes by its distance from the core — a cool
// teal heart warming out to a bright lime rim, the growing tips brightest —
// and drawn once, incrementally, never re-cleared, so the frame cost is only
// the handful of new cells. When the frost reaches the edge it holds a beat,
// fades, and reseeds, so the window keeps re-freezing.
//
// The pointer is a cold draft: walkers drift a little toward the cursor, so the
// coral reaches for your hand, and a press plants a fresh nucleus under it that
// grows its own competing frost. One canvas, one RAF loop, DPR-capped,
// ResizeObserver-driven, no React state on the hot path and no Math.random on
// the geometry that matters for frame cost. Purely decorative (aria-hidden).
// Reduced motion never starts the loop: a full cluster is grown in one pass and
// drawn still, and simply regrown on resize.

const CELL = 3 // CSS px per grid cell — fine enough to read as frost, coarse enough to stay cheap
const MAX_DPR = 2
const BG = '#060606'

// Per-frame budgets, so growth is lively but a frame is never held hostage by a
// dense, hard-to-reach tip late in the cluster's life.
const FREEZES_PER_FRAME = 9
const STEP_BUDGET = 5200
const MAX_WALK = 1400 // steps before a stuck walker is abandoned and respawned

const SPAWN_GAP = 6 // cells beyond the cluster reach that walkers are released
const KILL_GAP = 46 // cells beyond the spawn ring that a strayed walker is recycled
const POINTER_BIAS = 0.34 // chance a step drifts toward the cursor rather than at random

const HOLD_FRAMES = 150 // beats to admire a finished frost before it melts
const FADE_FRAMES = 48 // frames of translucent wash that clear it

// The four axes of the walk and the freeze test. A 4-neighbour stick grows crisp,
// clearly branched dendrites rather than a woolly blob.
const DX = [1, -1, 0, 0] as const
const DY = [0, 0, 1, -1] as const

type Phase = 'grow' | 'hold' | 'fade'

interface Walker {
  x: number
  y: number
}

export function DLA({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let raf = 0
    let dpr = 1
    let gw = 0
    let gh = 0
    let cx = 0
    let cy = 0
    let maxR = 0
    let occupied = new Uint8Array(0)
    let clusterR = 0
    let phase: Phase = 'grow'
    let timer = 0
    let cellPx = CELL

    // Pointer, in grid cells. Inactive until the cursor enters the field.
    const pointer = { x: 0, y: 0, active: false }

    // A tiny deterministic PRNG for the few places a repeatable wander is nicer
    // than Math.random; the walk itself can use Math.random freely since it
    // affects only which frames do work, never the frame cost or a cached seed.
    const rand = () => Math.random()

    function idx(x: number, y: number) {
      return y * gw + x
    }

    // Colour a cell by how far it froze from the core: a cool teal heart, a
    // bright lime rim, the outermost tips lifted toward white so new growth
    // reads as the live edge.
    function colorAt(r: number): string {
      const t = maxR > 0 ? Math.min(1, r / maxR) : 0
      let cr = 40 + (220 - 40) * t
      let cg = 92 + (248 - 92) * t
      let cb = 86 + (124 - 86) * t
      if (t > 0.78) {
        const k = (t - 0.78) / 0.22
        cr += (255 - cr) * k * 0.6
        cg += (255 - cg) * k * 0.5
        cb += (214 - cb) * k * 0.55
      }
      return `rgb(${cr | 0}, ${cg | 0}, ${cb | 0})`
    }

    function paintCell(x: number, y: number, r: number) {
      ctx!.fillStyle = colorAt(r)
      ctx!.fillRect(x * cellPx, y * cellPx, cellPx, cellPx)
    }

    // Freeze a cell: mark it, extend the cluster reach, and draw it once.
    function freeze(x: number, y: number) {
      occupied[idx(x, y)] = 1
      const r = Math.hypot(x - cx, y - cy)
      if (r > clusterR) clusterR = r
      paintCell(x, y, r)
    }

    function seedCenter() {
      occupied.fill(0)
      clusterR = 0
      ctx!.fillStyle = BG
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)
      // A small seed crystal at the centre so the first branches have something
      // to catch on from every side.
      freeze(cx, cy)
      freeze(cx + 1, cy)
      freeze(cx - 1, cy)
      freeze(cx, cy + 1)
      freeze(cx, cy - 1)
    }

    function hasFrozenNeighbour(x: number, y: number): boolean {
      for (let i = 0; i < 4; i++) {
        const nx = x + DX[i]
        const ny = y + DY[i]
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue
        if (occupied[idx(nx, ny)]) return true
      }
      return false
    }

    function spawnWalker(w: Walker) {
      const ring = Math.min(clusterR + SPAWN_GAP, maxR)
      const a = rand() * Math.PI * 2
      w.x = Math.round(cx + Math.cos(a) * ring)
      w.y = Math.round(cy + Math.sin(a) * ring)
      if (w.x < 1) w.x = 1
      if (w.y < 1) w.y = 1
      if (w.x > gw - 2) w.x = gw - 2
      if (w.y > gh - 2) w.y = gh - 2
    }

    // One walk from the spawn ring until it sticks (returns true) or is
    // abandoned for straying or dawdling (returns false). `budget` is the
    // remaining step allowance for the frame, decremented as we go.
    const walker: Walker = { x: 0, y: 0 }
    function walkOnce(stepsLeft: { v: number }): boolean {
      spawnWalker(walker)
      const killR = Math.min(clusterR + SPAWN_GAP + KILL_GAP, Math.max(gw, gh))
      for (let s = 0; s < MAX_WALK; s++) {
        if (stepsLeft.v-- <= 0) return false
        // Drift toward the cursor now and then, so the frost reaches for it.
        if (pointer.active && rand() < POINTER_BIAS) {
          const ddx = pointer.x - walker.x
          const ddy = pointer.y - walker.y
          if (Math.abs(ddx) >= Math.abs(ddy)) walker.x += ddx >= 0 ? 1 : -1
          else walker.y += ddy >= 0 ? 1 : -1
        } else {
          const d = (rand() * 4) | 0
          walker.x += DX[d]
          walker.y += DY[d]
        }
        // Off the grid or strayed past the kill ring — recycle.
        if (
          walker.x < 1 ||
          walker.y < 1 ||
          walker.x >= gw - 1 ||
          walker.y >= gh - 1 ||
          Math.hypot(walker.x - cx, walker.y - cy) > killR
        ) {
          return false
        }
        if (hasFrozenNeighbour(walker.x, walker.y) && !occupied[idx(walker.x, walker.y)]) {
          freeze(walker.x, walker.y)
          return true
        }
      }
      return false
    }

    function grow(freezeBudget: number, stepBudget: number) {
      const stepsLeft = { v: stepBudget }
      let frozen = 0
      while (frozen < freezeBudget && stepsLeft.v > 0) {
        if (walkOnce(stepsLeft)) frozen++
      }
    }

    function frame() {
      if (phase === 'grow') {
        grow(FREEZES_PER_FRAME, STEP_BUDGET)
        if (clusterR >= maxR - 1) {
          phase = 'hold'
          timer = HOLD_FRAMES
        }
      } else if (phase === 'hold') {
        if (--timer <= 0) {
          phase = 'fade'
          timer = FADE_FRAMES
        }
      } else {
        // Melt the frost with a translucent wash, then reseed.
        ctx!.fillStyle = 'rgba(6, 6, 6, 0.09)'
        ctx!.fillRect(0, 0, canvas!.width, canvas!.height)
        if (--timer <= 0) {
          seedCenter()
          phase = 'grow'
        }
      }
      raf = requestAnimationFrame(frame)
    }

    // Grow a whole cluster in one synchronous pass, for the still frame under
    // reduced motion. Bounded hard so it can never spin.
    function growStatic() {
      let guard = 260000
      while (clusterR < maxR - 1 && guard-- > 0) {
        const stepsLeft = { v: MAX_WALK }
        walkOnce(stepsLeft)
      }
    }

    function build() {
      const rect = canvas!.getBoundingClientRect()
      const cssW = Math.max(1, rect.width)
      const cssH = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas!.width = Math.round(cssW * dpr)
      canvas!.height = Math.round(cssH * dpr)
      cellPx = CELL * dpr
      gw = Math.max(8, Math.floor(canvas!.width / cellPx))
      gh = Math.max(8, Math.floor(canvas!.height / cellPx))
      cx = gw >> 1
      cy = gh >> 1
      maxR = Math.min(gw, gh) * 0.5 - 2
      occupied = new Uint8Array(gw * gh)
      pointer.active = false
      seedCenter()
      cancelAnimationFrame(raf)
      if (reduce) {
        growStatic()
      } else {
        phase = 'grow'
        raf = requestAnimationFrame(frame)
      }
    }

    function toCell(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect()
      const x = Math.floor(((clientX - rect.left) / rect.width) * gw)
      const y = Math.floor(((clientY - rect.top) / rect.height) * gh)
      return { x, y }
    }

    function onMove(e: PointerEvent) {
      const { x, y } = toCell(e.clientX, e.clientY)
      pointer.x = Math.max(0, Math.min(gw - 1, x))
      pointer.y = Math.max(0, Math.min(gh - 1, y))
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
    }
    // A press plants a fresh nucleus under the cursor, a competing crystal that
    // grows its own frost — so the field can carry several corals at once.
    function onDown(e: PointerEvent) {
      if (reduce) return
      const { x, y } = toCell(e.clientX, e.clientY)
      if (x < 1 || y < 1 || x >= gw - 1 || y >= gh - 1) return
      for (let i = 0; i < 4; i++) {
        const nx = x + DX[i]
        const ny = y + DY[i]
        if (nx < 1 || ny < 1 || nx >= gw - 1 || ny >= gh - 1) continue
        if (!occupied[idx(nx, ny)]) freeze(nx, ny)
      }
      if (!occupied[idx(x, y)]) freeze(x, y)
      // If the field had already melted to a hold, a press wakes it back up.
      if (phase !== 'grow') phase = 'grow'
    }

    build()

    const ro = new ResizeObserver(() => build())
    ro.observe(canvas)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [reduce])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
    />
  )
}
