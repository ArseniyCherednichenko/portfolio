import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Cyclic — a cyclic cellular automaton (Griffeath's "cyclic space"), rebuilt as
// a phosphor pointer field. Where the Game of Life beside it makes gliders and
// still-lifes out of birth-and-death, and the Gray-Scott Morphogen grows coral
// out of chemistry, this is the automaton that makes *spirals* — and it makes
// them out of one of the shortest rules there is.
//
// Every cell holds a state, a number from 0 to N-1, and the states are wired in
// a loop: N advances back to 0. On each generation a cell looks at its eight
// Moore neighbours and asks a single question — is any one of you the colour
// that comes right after mine? If yes, it advances to that next colour; if no,
// it waits. That is the entire program. A cell can only ever be eaten by the
// state one step ahead of it, so colour k chases colour k-1 chases k-2 around
// the ring, and the chase never ends because the ring never ends.
//
// Out of that one rule comes a textbook cascade of self-organisation. From pure
// random noise the field first boils as local skirmishes break out everywhere;
// then defects — points where all N colours meet — pin themselves in place and
// begin to wind, because the colours around a defect are forced to advance in
// order, sweeping round it like a hand round a clock. Each defect throws off a
// rotating spiral wave, the waves collide and annihilate along shock fronts,
// the tighter spirals overrun the looser ones, and the whole plane locks into a
// lattice of interlocking pinwheels that turn forever. Nothing here is a solid
// that settles: every cell keeps advancing on its turn, so the field is a
// living clockwork, not a frozen pattern.
//
// The look is the same phosphor screen the Life and Ripple fields use, so the
// family reads as one. A cool teal band tints each cell by its phase in the
// cycle, so the concentric colour rings of every spiral are always faintly
// there; on top of that a `heat` field flares to full the instant a cell
// advances and bleeds off over the next few steps, so the leading edge of each
// wave — the cells changing *now* — glows lime-white, and what you actually see
// is bright spiral arms sweeping over dim rings. Press anywhere to stamp a fresh
// pinwheel: a little disc of all N phases wound round a point, a defect placed
// by hand that immediately unfurls into a new spiral and starts eating its
// neighbours. Drag to stir raw noise into the field and watch new cores
// nucleate out of it.
//
// No Date.now, no Math.random on the hot path: the opening noise, the seeded
// pinwheels, and the idle drops are placed by a seeded PRNG, and timing runs off
// the frame counter, so the field is deterministic and stable across resizes. It
// is pure integer arithmetic — no floats in the rule, so nothing can drift or
// blow up. The states live one byte per cell and render to a grid-sized buffer
// the GPU smooths up, so the hot loop touches ~14k cells, not a million pixels.
// Decorative, so aria-hidden. Under prefers-reduced-motion the loop never
// starts — a seeded field is stepped until the spirals lock in and painted once.

const CELL = 7 // target px per grid cell before smoothing
const MAX_CELLS = 15000 // clamp the grid so the step stays cheap
const STATES = 10 // colours in the cycle; the wavelength of a spiral arm
const STEP_EVERY = 3 // frames between generations (~20 gen/s at 60fps)
const DECAY = 0.55 // per-generation heat bleed → thin, bright wave fronts
const SETTLE = 260 // reduced-motion generations to lock the spirals in
const IDLE_EVERY = 140 // frames between idle pinwheel drops

// A cool teal for the phase bands; the accent lime rides on the moving front.
const TEAL = [54, 178, 170]

// mulberry32 — a tiny deterministic PRNG so the noise and idle drops wander
// without Math.random on the hot path.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Cyclic({
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
    const [tr, tg, tb] = TEAL

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // Offscreen grid-sized buffer: the field renders here at 1px/cell, then the
    // main canvas scales it up with smoothing on, so the wave fronts bloom.
    const grid = document.createElement('canvas')
    const gctx = grid.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0 // grid columns
    let gh = 0 // grid rows
    let state = new Uint8Array(0)
    let next = new Uint8Array(0)
    let heat = new Float32Array(0)
    let img: ImageData | null = null
    let raf = 0
    let frame = 0
    const rand = mulberry32(0x9e3779b1) // fixed seed → deterministic field

    // Pointer trail so a fast drag lays down a continuous smear, not a dotted one.
    let px = -1
    let py = -1
    let touching = false

    // Stamp a pinwheel at grid (cx, cy): a disc whose cells are set to the phase
    // of their angle around the centre, so all N colours meet at the middle. That
    // is a topological defect — the automaton is forced to wind it into a spiral.
    function stampPinwheel(cx: number, cy: number, r: number) {
      const r2 = r * r
      const x0 = Math.floor(cx - r)
      const x1 = Math.ceil(cx + r)
      const y0 = Math.floor(cy - r)
      const y1 = Math.ceil(cy + r)
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx
          const dy = y - cy
          if (dx * dx + dy * dy > r2) continue
          const ang = Math.atan2(dy, dx) + Math.PI // 0..2π
          const gx = ((x % gw) + gw) % gw
          const gy = ((y % gh) + gh) % gh
          const i = gy * gw + gx
          state[i] = Math.floor((ang / (Math.PI * 2)) * STATES) % STATES
          heat[i] = 1
        }
      }
    }

    // Stir raw noise into a patch — new defects, and so new spirals, nucleate
    // out of it as the rule finds all-colours-meet points.
    function stir(cx: number, cy: number, r: number) {
      const r2 = r * r
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r2) continue
          const gx = ((Math.round(cx) + dx) % gw + gw) % gw
          const gy = ((Math.round(cy) + dy) % gh + gh) % gh
          const i = gy * gw + gx
          state[i] = (rand() * STATES) | 0
          heat[i] = 1
        }
      }
    }

    // Canvas px → grid cell.
    function stirAt(x: number, y: number, r: number) {
      stir((x / w) * gw, (y / h) * gh, r)
    }

    // Stir along the segment from (ax,ay) to (bx,by) in canvas px.
    function stirLine(ax: number, ay: number, bx: number, by: number, r: number) {
      const dist = Math.hypot(bx - ax, by - ay)
      const steps = Math.max(1, Math.round((dist / w) * gw))
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        stirAt(ax + (bx - ax) * t, ay + (by - ay) * t, r)
      }
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      let cols = Math.max(32, Math.round(w / CELL))
      let rows = Math.max(32, Math.round(h / CELL))
      if (cols * rows > MAX_CELLS) {
        const s = Math.sqrt(MAX_CELLS / (cols * rows))
        cols = Math.max(32, Math.round(cols * s))
        rows = Math.max(32, Math.round(rows * s))
      }
      gw = cols
      gh = rows
      grid.width = gw
      grid.height = gh
      state = new Uint8Array(gw * gh)
      next = new Uint8Array(gw * gh)
      heat = new Float32Array(gw * gh)
      img = gctx.createImageData(gw, gh)
    }

    // One generation of the cyclic rule on a torus. A cell advances to the next
    // colour in the ring iff any Moore neighbour already wears that colour, so
    // colour k perpetually chases colour k-1 around the loop. Edges wrap, so
    // spiral waves travel off one side and back in the other.
    function step() {
      for (let y = 0; y < gh; y++) {
        const yUp = ((y - 1 + gh) % gh) * gw
        const yDn = ((y + 1) % gh) * gw
        const yMid = y * gw
        for (let x = 0; x < gw; x++) {
          const xl = (x - 1 + gw) % gw
          const xr = (x + 1) % gw
          const i = yMid + x
          const s = state[i]
          const target = s + 1 === STATES ? 0 : s + 1
          if (
            state[yUp + xl] === target ||
            state[yUp + x] === target ||
            state[yUp + xr] === target ||
            state[yMid + xl] === target ||
            state[yMid + xr] === target ||
            state[yDn + xl] === target ||
            state[yDn + x] === target ||
            state[yDn + xr] === target
          ) {
            next[i] = target
            heat[i] = 1
          } else {
            next[i] = s
            heat[i] *= DECAY
          }
        }
      }
      const tmp = state
      state = next
      next = tmp
    }

    const TWO_PI = Math.PI * 2
    function render() {
      const data = img!.data
      for (let i = 0; i < gw * gh; i++) {
        const p = i * 4
        // A cool teal band tints the cell by its phase in the cycle, so the
        // concentric rings of each spiral are always faintly present.
        const ph = state[i] / STATES
        const band = 0.5 + 0.5 * Math.cos(ph * TWO_PI)
        const baseA = 0.14 + band * 0.2
        const bandR = tr * baseA
        const bandG = tg * baseA
        const bandB = tb * baseA
        // The moving front: a cell that just advanced flares to full and cools,
        // so the leading edge of every wave glows lime-white over the rings.
        const e = heat[i]
        const s = e * e * (3 - 2 * e)
        const white = s * s * 0.4
        data[p] = Math.min(255, bandR + ar * s * 0.9 + 255 * white)
        data[p + 1] = Math.min(255, bandG + ag * s * 0.9 + 255 * white)
        data[p + 2] = Math.min(255, bandB + ab * s * 0.9 + 255 * white)
        data[p + 3] = Math.round(Math.min(1, baseA + s * 0.95) * 255)
      }
      gctx.putImageData(img!, 0, 0)
      ctx!.imageSmoothingEnabled = true
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(grid, 0, 0, gw, gh, 0, 0, w, h)
    }

    // Lay down an opening field: uniform noise, plus a handful of hand-placed
    // pinwheels so strong spiral cores are present from the very first frame and
    // spread out to consume the boiling noise between them.
    function seedField() {
      for (let i = 0; i < state.length; i++) state[i] = (rand() * STATES) | 0
      heat.fill(0)
      const r = Math.min(gw, gh) * 0.11
      stampPinwheel(gw * 0.28, gh * 0.32, r)
      stampPinwheel(gw * 0.72, gh * 0.34, r)
      stampPinwheel(gw * 0.5, gh * 0.68, r)
      stampPinwheel(gw * 0.16, gh * 0.78, r * 0.8)
      stampPinwheel(gw * 0.84, gh * 0.76, r * 0.8)
    }

    layout()
    seedField()

    if (reduce) {
      // A settled still: step until the spirals lock into their lattice, paint
      // once, and re-settle on resize. The loop never runs.
      for (let s = 0; s < SETTLE; s++) step()
      render()
      const ro = new ResizeObserver(() => {
        layout()
        seedField()
        for (let s = 0; s < SETTLE; s++) step()
        render()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    let idlePhase = 0
    function tick() {
      frame++
      // Advance on a slow interval so the waves are watchable; render every frame
      // so the heat fronts cool smoothly between generations.
      if (frame % STEP_EVERY === 0) step()

      // Idle life: the automaton never dies, but drop a fresh pinwheel now and
      // then so new spirals keep being born and overrun the settled ones, and
      // the field never simply repeats.
      if (!touching && frame % IDLE_EVERY === 0) {
        idlePhase++
        const gx = gw * (0.15 + rand() * 0.7)
        const gy = gh * (0.15 + rand() * 0.7)
        stampPinwheel(gx, gy, Math.min(gw, gh) * (idlePhase % 2 ? 0.09 : 0.13))
      }

      render()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    function toLocal(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function onMove(e: PointerEvent) {
      const { x, y } = toLocal(e)
      if (touching && px >= 0) stirLine(px, py, x, y, 2)
      px = x
      py = y
    }
    function onDown(e: PointerEvent) {
      const { x, y } = toLocal(e)
      touching = true
      px = x
      py = y
      stampPinwheel((x / w) * gw, (y / h) * gh, Math.min(gw, gh) * 0.1)
    }
    function onUp() {
      touching = false
    }
    function onLeave() {
      px = -1
      py = -1
      touching = false
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onLeave)

    const ro = new ResizeObserver(() => layout())
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [reduce, accent])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full cursor-pointer touch-none ${className}`}
    />
  )
}
