import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// ElementaryCA — the elementary (Wolfram) cellular automaton, the one-dimensional
// root of the whole emergence family. Where the Game of Life, the Cyclic space,
// and the Sandpile beside it all run a rule across a two-dimensional plane and
// let you watch it change *in place*, this runs the simplest rule there is on a
// single line of cells and stacks each new generation under the last, so the
// second dimension on screen is not space but *time*. The picture is the whole
// history of the line, oldest at the top, and the shapes in it are what one plain
// law drew as it ran.
//
// The rule is as small as a rule gets. Every cell is a 0 or a 1, and its next
// value is decided only by itself and its two immediate neighbours — three bits,
// eight possible neighbourhoods. A "rule" is just the eight-bit table saying what
// each of those eight neighbourhoods becomes, so there are exactly 256 of them,
// and Wolfram numbered them 0..255 by reading that table as a binary number. That
// is the entire program: read left, centre, right; index the byte; write the bit.
//
// The astonishing part, and the reason this belongs at the head of the family, is
// how much falls out of so little. Rule 90 XORs its two neighbours and draws the
// Sierpinski triangle — a fractal — from a single lit cell. Rule 30 is so
// thoroughly unpredictable it was used as a random-number generator. Rule 110 was
// proved *Turing-complete*: that trivial three-bit lookup can, given the right
// starting line, compute anything any computer can. None of that is put in; it is
// only where the rule went. The field cycles a curated handful so you watch the
// character change — a fractal, then chaos, then the gliders of 110 — under the
// same machine.
//
// The look matches the phosphor screens of the Life and Cyclic fields so the
// family reads as one. A live cell leaves teal "ink" that stays as the row scrolls
// up into history, and the newest few rows — the generation being computed *now* —
// glow lime-white, so what you see is a bright advancing front laying down a teal
// record above it. The seed is a single lit cell in the centre, the textbook start
// that makes each rule's signature figure. Press or drag anywhere to inject live
// cells straight into the advancing edge and watch your own signal cascade up and
// evolve under the current rule.
//
// No Date.now and no Math.random on the hot path: a single line evolves by integer
// lookups, the history is scrolled with copyWithin, and the render reads a
// grid-sized buffer the GPU smooths up, so the loop touches a few thousand cells,
// not a million pixels. Decorative, so the canvas is aria-hidden and the wrapper
// carries the label. Under prefers-reduced-motion the loop never starts — one
// rule's full triangle is computed top-to-bottom and painted once.

const CELL = 5 // target px per grid cell before smoothing
const MAX_CELLS = 26000 // clamp the grid so a generation stays cheap
const STEP_EVERY = 2 // frames between generations (~30 gen/s at 60fps)
const GLOW_ROWS = 7 // how many rows near the front carry the lime glow

// A cool teal for the settled ink; the accent lime rides the advancing front.
const TEAL = [54, 178, 170]

// The curated tour — each rule chosen because its character is its own. The
// label names the rule and, where there is one, the one-line reason it is famous.
const RULES: { n: number; label: string }[] = [
  { n: 90, label: 'Rule 90 — Sierpinski' },
  { n: 30, label: 'Rule 30 — chaos' },
  { n: 110, label: 'Rule 110 — Turing-complete' },
  { n: 150, label: 'Rule 150 — XOR of three' },
  { n: 54, label: 'Rule 54' },
  { n: 60, label: 'Rule 60 — Pascal mod 2' },
  { n: 22, label: 'Rule 22' },
  { n: 45, label: 'Rule 45' },
  { n: 73, label: 'Rule 73' },
]

export function ElementaryCA({
  className = '',
  accent = '220,248,124',
  onRule,
}: {
  className?: string
  accent?: string
  /** Called with the human label whenever the live rule changes, so a parent
   *  can caption which rule is on show. */
  onRule?: (label: string) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  const onRuleRef = useRef(onRule)
  onRuleRef.current = onRule

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    const [tr, tg, tb] = TEAL

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    // Offscreen grid-sized buffer: the field renders here at 1px/cell, then the
    // main canvas scales it up with smoothing on, so the front blooms softly.
    const grid = document.createElement('canvas')
    const gctx = grid.getContext('2d')!

    let w = 0
    let h = 0
    let gw = 0 // grid columns
    let gh = 0 // grid rows
    let bit = new Uint8Array(0) // the full spacetime history, one byte per cell
    let row = new Uint8Array(0) // the current (newest) generation
    let nextRow = new Uint8Array(0)
    let img: ImageData | null = null
    let raf = 0
    let frame = 0
    let ruleIdx = 0
    let table = 0 // the active 8-bit rule table
    let gensThisRule = 0 // generations since the last reseed
    let spanForRule = 0 // generations to hold a rule before switching

    let px = -1 // last pointer column, for a continuous drag smear
    let touching = false

    function setRule(idx: number) {
      ruleIdx = ((idx % RULES.length) + RULES.length) % RULES.length
      table = RULES[ruleIdx].n
      onRuleRef.current?.(RULES[ruleIdx].label)
    }

    // Plant the textbook seed — a single lit cell in the centre — into the live
    // row, so the next generations draw this rule's signature figure. The history
    // above is left to scroll out on its own, which reads as a clean handover.
    function seedRow() {
      row.fill(0)
      row[gw >> 1] = 1
      gensThisRule = 0
    }

    function layout() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, Math.floor(rect.width))
      h = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(w * dpr)
      canvas!.height = Math.floor(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      let cols = Math.max(48, Math.round(w / CELL))
      let rows = Math.max(48, Math.round(h / CELL))
      if (cols * rows > MAX_CELLS) {
        const s = Math.sqrt(MAX_CELLS / (cols * rows))
        cols = Math.max(48, Math.round(cols * s))
        rows = Math.max(48, Math.round(rows * s))
      }
      gw = cols
      gh = rows
      grid.width = gw
      grid.height = gh
      bit = new Uint8Array(gw * gh)
      row = new Uint8Array(gw)
      nextRow = new Uint8Array(gw)
      img = gctx.createImageData(gw, gh)
      // Long enough that the figure fills the height and scrolls a little before
      // the next rule takes over.
      spanForRule = gh + 48
    }

    // One generation of the elementary rule on a torus. Each cell's next value is
    // the rule-table bit indexed by (left<<2 | centre<<1 | right); edges wrap so
    // the line is seamless across the full width.
    function step() {
      for (let x = 0; x < gw; x++) {
        const l = row[x === 0 ? gw - 1 : x - 1]
        const c = row[x]
        const r = row[x === gw - 1 ? 0 : x + 1]
        const idx = (l << 2) | (c << 1) | r
        nextRow[x] = (table >> idx) & 1
      }
      const tmp = row
      row = nextRow
      nextRow = tmp

      // Scroll the whole history up one row and write the new generation into the
      // bottom row. copyWithin moves the block [gw, end) to the start in one shot.
      bit.copyWithin(0, gw, gw * gh)
      bit.set(row, (gh - 1) * gw)

      gensThisRule++
      if (gensThisRule >= spanForRule) {
        setRule(ruleIdx + 1)
        seedRow()
      }
    }

    function render() {
      const data = img!.data
      const bottom = gh - 1
      for (let r = 0; r < gh; r++) {
        // Distance up from the advancing front, normalised — only the nearest
        // GLOW_ROWS rows carry the lime front, older ink is pure teal.
        const dist = bottom - r
        const g = dist < GLOW_ROWS ? 1 - dist / GLOW_ROWS : 0
        const gs = g * g // ease the glow falloff
        const rowOff = r * gw
        for (let x = 0; x < gw; x++) {
          const p = (rowOff + x) * 4
          if (!bit[rowOff + x]) {
            data[p] = 0
            data[p + 1] = 0
            data[p + 2] = 0
            data[p + 3] = 0
            continue
          }
          const white = gs * gs * 0.6
          data[p] = Math.min(255, tr * 0.85 + ar * gs * 0.9 + 255 * white)
          data[p + 1] = Math.min(255, tg * 0.85 + ag * gs * 0.9 + 255 * white)
          data[p + 2] = Math.min(255, tb * 0.85 + ab * gs * 0.9 + 255 * white)
          data[p + 3] = Math.round(Math.min(1, 0.42 + gs * 0.55) * 255)
        }
      }
      gctx.putImageData(img!, 0, 0)
      ctx!.imageSmoothingEnabled = true
      ctx!.clearRect(0, 0, w, h)
      ctx!.drawImage(grid, 0, 0, gw, gh, 0, 0, w, h)
    }

    // Paint live cells straight into the advancing edge under the pointer, so an
    // injected signal cascades up and evolves under the current rule.
    function inject(col: number) {
      const c = Math.round(col)
      for (let d = -1; d <= 1; d++) {
        const x = ((c + d) % gw + gw) % gw
        row[x] = 1
      }
    }
    function injectLine(a: number, b: number) {
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      for (let x = lo; x <= hi; x++) inject(x)
    }

    setRule(0)
    layout()
    seedRow()

    if (reduce) {
      // A settled still: build one rule's full triangle top-to-bottom into the
      // history and paint it once. No scroll, no cycle, no pointer.
      const still = () => {
        bit.fill(0)
        row.fill(0)
        row[gw >> 1] = 1
        bit.set(row, 0)
        for (let r = 1; r < gh; r++) {
          for (let x = 0; x < gw; x++) {
            const l = row[x === 0 ? gw - 1 : x - 1]
            const c = row[x]
            const rr = row[x === gw - 1 ? 0 : x + 1]
            nextRow[x] = (table >> ((l << 2) | (c << 1) | rr)) & 1
          }
          const tmp = row
          row = nextRow
          nextRow = tmp
          bit.set(row, r * gw)
        }
        // Reuse the render, but with the glow at the top (the growth edge) — flip
        // by painting a flat teal field: cheapest is to render with no front.
        const data = img!.data
        for (let i = 0; i < gw * gh; i++) {
          const p = i * 4
          if (!bit[i]) {
            data[p + 3] = 0
            continue
          }
          data[p] = tr * 0.85
          data[p + 1] = tg * 0.85
          data[p + 2] = tb * 0.85
          data[p + 3] = Math.round(0.55 * 255)
        }
        gctx.putImageData(img!, 0, 0)
        ctx!.imageSmoothingEnabled = true
        ctx!.clearRect(0, 0, w, h)
        ctx!.drawImage(grid, 0, 0, gw, gh, 0, 0, w, h)
      }
      still()
      const ro = new ResizeObserver(() => {
        layout()
        still()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function tick() {
      frame++
      if (frame % STEP_EVERY === 0) step()
      render()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    function toCol(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      return ((e.clientX - rect.left) / w) * gw
    }
    function onDown(e: PointerEvent) {
      touching = true
      const col = toCol(e)
      px = col
      inject(col)
    }
    function onMove(e: PointerEvent) {
      if (!touching) return
      const col = toCol(e)
      if (px >= 0) injectLine(Math.round(px), Math.round(col))
      px = col
    }
    function onUp() {
      touching = false
      px = -1
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointerleave', onUp)

    const ro = new ResizeObserver(() => {
      layout()
      seedRow()
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointerleave', onUp)
    }
  }, [reduce, accent])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`h-full w-full cursor-crosshair touch-none ${className}`}
    />
  )
}
