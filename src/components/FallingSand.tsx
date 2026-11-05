import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// FallingSand: a falling-sand automaton — the oldest, most tactile kind of
// grid simulation, where thousands of grains each obey one dumb rule and a
// whole material behaviour falls out of the pile. It is the physical,
// element-by-element cousin of the other grid pieces in this family: the
// Sandpile next door is the *abelian* sandpile, a piece of exact mathematics
// where a grain topples only when a cell holds four and the final heap is the
// same whatever order you add them; this one is the opposite spirit — ordinary,
// messy, order-dependent granular flow, the toy a browser tab has been able to
// run since the 1990s. It shares the DLA's one-rule-per-cell honesty but drops
// the randomness: here the grains simply fall.
//
// Two materials, told apart entirely by how they move. SAND falls straight down
// while it can, and when it is blocked it tries the two down-diagonals, so it
// can never stand in a column — it slumps sideways and builds a heap at its
// natural angle of repose, exactly the cone a stream of real sand makes.
// WATER falls the same way but, when it cannot fall or slide down, it also
// spreads *level* — one step left or right into any gap — so it seeks its own
// surface and pools flat in a basin rather than heaping. Sand is denser than
// water: a grain landing on a water cell sinks through it (they swap) and the
// water bubbles up past it, so a poured-in heap settles under the pool it
// displaces. Stone is fixed and moves for nothing; a few stone ledges are set
// into the field so the falling material has something to pile on, pour off,
// and pool against.
//
// It runs on its own: a source drifts across the top like a hand tipping a
// scoop, trickling mostly sand with the odd pulse of water, so the ledges are
// always cascading even before you touch it. The pointer is a second source —
// move it to paint a stream of sand under the cursor, press to pour water — and
// the very bottom row is a drain, so grains that reach the floor fall away and
// the field stays lively instead of silting up.
//
// Mechanics. The field is a coarse grid; one Uint8Array holds each cell's
// material and a second holds a fixed shade index so a heap reads as countless
// grains, not a flat colour. The update runs once per frame from the bottom row
// up (so a grain that drops never gets processed twice in the same pass) with
// the horizontal scan direction flipped each frame (so a symmetric pile does
// not drift one way). A per-frame `moved` flag stops a grain sliding across the
// whole row in a single tick. Only the occupied cells are painted over a single
// cleared background, so an empty field costs almost nothing. One canvas, one
// RAF loop, DPR-capped, ResizeObserver-driven, no React state on the hot path.
// Purely decorative (aria-hidden). Reduced motion never starts the loop: the
// scene is settled in one bounded synchronous pass and drawn still, and simply
// re-settled on resize.

const CELL = 5 // CSS px per grid cell — chunky enough that a grain reads, cheap enough to flow
const MAX_DPR = 2
const BG = '#060606'

// Materials.
const EMPTY = 0
const SAND = 1
const WATER = 2
const STONE = 3

// Per-frame work is bounded by the grid size alone (one cheap pass), so there
// is no explicit budget; the drain and the modest cell count keep it honest.

// Sand grains: warm amber tones with the lightest lifted toward the site's lime,
// so a fresh fall catches the accent without the whole heap going gold.
const SAND_SHADES = ['#b98f3c', '#c8a24a', '#d4b05a', '#dcbf6c', '#d8e07a'] as const
// Water: cool teal, a few depths so a pool reads with a little surface light —
// the same teal-to-lime family the DLA and Slime draw from.
const WATER_SHADES = ['#2f6f73', '#357f84', '#3f9196', '#52acaf'] as const
const STONE_COLOR = '#49535f'

export function FallingSand({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let raf = 0
    let gw = 0
    let gh = 0
    let cellPx = CELL
    let grid = new Uint8Array(0)
    let shade = new Uint8Array(0)
    let moved = new Uint8Array(0)
    let frame = 0
    let sourceX = 0

    // Pointer, in grid cells. Inactive until the cursor enters the field; a
    // press switches the painted material from sand to water.
    const pointer = { x: 0, y: 0, active: false, down: false }

    const idx = (x: number, y: number) => y * gw + x
    const rand = () => Math.random()

    function setCell(i: number, t: number) {
      grid[i] = t
      if (t === SAND) shade[i] = (rand() * SAND_SHADES.length) | 0
      else if (t === WATER) shade[i] = (rand() * WATER_SHADES.length) | 0
    }

    // Move the material at i into the (in-bounds) target j. If j is empty it is
    // a plain move; if j holds water and i holds sand it is a swap (the denser
    // grain sinks and the water rises). Both cells are flagged for the frame.
    function into(i: number, j: number) {
      if (grid[j] === EMPTY) {
        grid[j] = grid[i]
        shade[j] = shade[i]
        grid[i] = EMPTY
      } else {
        // sand sinking through water — swap the two
        const gt = grid[j]
        const gs = shade[j]
        grid[j] = grid[i]
        shade[j] = shade[i]
        grid[i] = gt
        shade[i] = gs
      }
      moved[i] = 1
      moved[j] = 1
    }

    function step() {
      moved.fill(0)
      const dir = (frame & 1) === 0 ? 1 : -1
      for (let y = gh - 1; y >= 0; y--) {
        for (let k = 0; k < gw; k++) {
          const x = dir === 1 ? k : gw - 1 - k
          const i = idx(x, y)
          const t = grid[i]
          if (t === EMPTY || t === STONE || moved[i]) continue

          // The floor is a drain: whatever reaches the last row falls away.
          if (y === gh - 1) {
            grid[i] = EMPTY
            continue
          }

          const belowRow = (y + 1) * gw
          const below = belowRow + x
          const bt = grid[below]

          if (t === SAND) {
            // Straight down through empty or water (sinking).
            if (bt === EMPTY || bt === WATER) {
              into(i, below)
              continue
            }
            // Blocked below — slump to a down-diagonal, so a column cannot stand.
            const tryLeftFirst = rand() < 0.5
            const dirs = tryLeftFirst ? [-1, 1] : [1, -1]
            let done = false
            for (let d = 0; d < 2; d++) {
              const nx = x + dirs[d]
              if (nx < 0 || nx >= gw) continue
              const j = belowRow + nx
              if (grid[j] === EMPTY || grid[j] === WATER) {
                into(i, j)
                done = true
                break
              }
            }
            if (done) continue
          } else if (t === WATER) {
            // Water falls into empty only (it will not shove sand aside).
            if (bt === EMPTY) {
              into(i, below)
              continue
            }
            // Then a down-diagonal into empty.
            const tryLeftFirst = rand() < 0.5
            const dd = tryLeftFirst ? [-1, 1] : [1, -1]
            let done = false
            for (let d = 0; d < 2; d++) {
              const nx = x + dd[d]
              if (nx < 0 || nx >= gw) continue
              if (grid[belowRow + nx] === EMPTY) {
                into(i, belowRow + nx)
                done = true
                break
              }
            }
            if (done) continue
            // Finally spread level — one step sideways into a gap — so water
            // seeks its own surface and pools flat instead of heaping.
            const sd = tryLeftFirst ? [-1, 1] : [1, -1]
            for (let d = 0; d < 2; d++) {
              const nx = x + sd[d]
              if (nx < 0 || nx >= gw) continue
              const j = idx(nx, y)
              if (grid[j] === EMPTY && !moved[j]) {
                into(i, j)
                break
              }
            }
          }
        }
      }
    }

    // A brush of a material painted around a grid cell, only into empty space.
    function paint(cx: number, cy: number, r: number, t: number) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue
          const x = cx + dx
          const y = cy + dy
          if (x < 0 || y < 0 || x >= gw || y >= gh) continue
          const i = idx(x, y)
          if (grid[i] === EMPTY) setCell(i, t)
        }
      }
    }

    // The ambient source: a point that drifts across the top on a slow sine,
    // trickling mostly sand with an occasional pulse of water, plus the pointer
    // stream when the cursor is over the field.
    function feed() {
      sourceX = (Math.sin(frame * 0.012) * 0.5 + 0.5) * (gw - 6) + 3
      const sx = sourceX | 0
      const pouringWater = Math.floor(frame / 110) % 5 === 4
      const mat = pouringWater ? WATER : SAND
      for (let dx = -1; dx <= 1; dx++) {
        const x = sx + dx
        if (x < 0 || x >= gw) continue
        if (grid[idx(x, 1)] === EMPTY && rand() < 0.75) setCell(idx(x, 1), mat)
      }
      if (pointer.active) {
        paint(pointer.x, pointer.y, pointer.down ? 3 : 2, pointer.down ? WATER : SAND)
      }
    }

    function draw() {
      ctx!.fillStyle = BG
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const i = idx(x, y)
          const t = grid[i]
          if (t === EMPTY) continue
          ctx!.fillStyle =
            t === STONE
              ? STONE_COLOR
              : t === SAND
                ? SAND_SHADES[shade[i]]
                : WATER_SHADES[shade[i]]
          ctx!.fillRect(x * cellPx, y * cellPx, cellPx, cellPx)
        }
      }
    }

    function loop() {
      feed()
      step()
      draw()
      frame++
      raf = requestAnimationFrame(loop)
    }

    // Lay the fixed stone ledges: an upper shelf the source cascades off, and a
    // lower tray with short end-walls so water collects and overflows while sand
    // heaps. Fractions of the grid, so the scene holds at any width.
    function buildScene() {
      const stone = (x: number, y: number) => {
        if (x >= 0 && y >= 0 && x < gw && y < gh) grid[idx(x, y)] = STONE
      }
      const aY = (gh * 0.4) | 0
      const aX0 = (gw * 0.1) | 0
      const aX1 = (gw * 0.52) | 0
      for (let x = aX0; x <= aX1; x++) {
        stone(x, aY)
        stone(x, aY + 1)
      }
      const bY = (gh * 0.68) | 0
      const bX0 = (gw * 0.44) | 0
      const bX1 = (gw * 0.9) | 0
      for (let x = bX0; x <= bX1; x++) {
        stone(x, bY)
        stone(x, bY + 1)
      }
      // Short walls at each end of the lower tray so it can hold a pool.
      const wallH = Math.max(3, (gh * 0.1) | 0)
      for (let h = 1; h <= wallH; h++) {
        stone(bX0, bY - h)
        stone(bX1, bY - h)
      }
    }

    // Settle the scene in one bounded synchronous pass, for the reduced-motion
    // still. Hard-capped so it can never spin on a large canvas.
    function settleStatic() {
      const passes = Math.min(900, gh * 6)
      for (let p = 0; p < passes; p++) {
        feed()
        step()
        frame++
      }
      draw()
    }

    function build() {
      const rect = canvas!.getBoundingClientRect()
      const cssW = Math.max(1, rect.width)
      const cssH = Math.max(1, rect.height)
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas!.width = Math.round(cssW * dpr)
      canvas!.height = Math.round(cssH * dpr)
      cellPx = CELL * dpr
      gw = Math.max(16, Math.floor(canvas!.width / cellPx))
      gh = Math.max(16, Math.floor(canvas!.height / cellPx))
      grid = new Uint8Array(gw * gh)
      shade = new Uint8Array(gw * gh)
      moved = new Uint8Array(gw * gh)
      frame = 0
      pointer.active = false
      pointer.down = false
      buildScene()
      cancelAnimationFrame(raf)
      if (reduce) {
        settleStatic()
      } else {
        raf = requestAnimationFrame(loop)
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
      pointer.down = false
    }
    function onDown(e: PointerEvent) {
      onMove(e)
      pointer.down = true
    }
    function onUp() {
      pointer.down = false
    }

    build()

    const ro = new ResizeObserver(() => build())
    ro.observe(canvas)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
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
