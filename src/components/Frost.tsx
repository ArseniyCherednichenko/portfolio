import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Frost — diffusion-limited aggregation (Witten & Sander, 1981), the growth
// model none of the site's other generative fields is. The Morphogen grows a
// pattern out of two reacting chemicals, the Slime out of agents laying and
// reading a trail, the Sandpile out of toppling grains; this one grows out of
// pure chance. A wall of seed sits along the bottom edge, and single walkers
// drift down from above on a random walk. A walker that never touches the wall
// wanders off and is forgotten; one that brushes a frozen cell freezes where it
// stands. Nothing chooses the shape — it is only where the random walks happened
// to land — yet the result is the spiky, self-similar frost that actually climbs
// a cold window, because a tip that pokes up is far likelier to catch the next
// walker than a valley between two tips, so tips race ahead and branch. That
// self-shadowing is the whole mechanism, and it needs no rule beyond "stick on
// contact".
//
// Cheap by the same discipline as the fractals beside it: the aggregation lives
// on a coarse occupancy grid (one cell per SCALE screen pixels), walkers spawn
// just above the current front rather than at the top so their walks stay short,
// and the plane wraps horizontally so the frost is continuous across the full
// width. Each frozen cell keeps the ORDER it froze in, so the plane is painted
// ink at the old base up through lime to a near-white spark at the newest tips —
// the growth edge reads as glowing. The pointer leans the walkers' drift toward
// the cursor, so the frost reaches a little taller under your hand. When the
// front nears the top it holds a beat, then thaws and begins again. Under
// reduced motion there is no loop and no pointer: one full crystal is grown
// synchronously off a seeded PRNG (identical every mount) and painted once,
// re-grown only on resize.
export function Frost({
  className = '',
  speed = 1,
  scale = 4,
  interactive = true,
}: {
  className?: string
  /** Walkers launched per frame — higher grows faster. */
  speed?: number
  /** Screen pixels per grid cell — bigger is coarser and faster. */
  scale?: number
  /** Let the pointer lean the frost toward the cursor. */
  interactive?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const buf = document.createElement('canvas')
    const bctx = buf.getContext('2d')
    if (!bctx) return

    let w = 0
    let h = 0
    let bw = 0
    let bh = 0
    let img: ImageData | null = null
    // occ[i] = 0 for open air, else the 1-based order in which the cell froze,
    // so the newest tips carry the highest numbers and can be painted brightest.
    let occ: Uint32Array = new Uint32Array(0)
    let count = 0 // cells frozen so far
    let topY = 0 // smallest y (highest row) the frost has reached
    let full = false
    let holdUntil = 0
    let raf = 0
    let lastDraw = 0
    // Pointer drift, in grid columns, eased toward its target so it never jumps.
    let lean = 0
    let leanTarget = 0

    // Deterministic PRNG so the reduced-motion crystal is identical every mount.
    function mulberry32(a: number) {
      return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }
    let rng = mulberry32(0x5eed)

    function reseed() {
      occ = new Uint32Array(bw * bh)
      count = 0
      // Seed the whole bottom row: the cold sill the frost climbs from.
      const base = (bh - 1) * bw
      for (let x = 0; x < bw; x++) occ[base + x] = ++count
      topY = bh - 1
      full = false
    }

    // One walker: drop in just above the front, drift down (leaning toward the
    // pointer), and freeze on first contact with the frost. Returns nothing —
    // it mutates the grid. A walk that strays off the top is abandoned.
    function walk() {
      // Spawn a few rows above the current front so walks stay short.
      const gap = 2 + ((rng() * 5) | 0)
      let y = Math.max(0, topY - gap)
      let x = (rng() * bw) | 0
      const maxSteps = 260
      // Bias the sideways step toward the pointer's column when it is set.
      const drift = lean // -1..1 columns of pull per biased step
      for (let s = 0; s < maxSteps; s++) {
        // Freeze if any of the 8 neighbours is already frozen.
        const up = y > 0 ? y - 1 : -1
        const dn = y < bh - 1 ? y + 1 : -1
        const lx = x > 0 ? x - 1 : bw - 1 // wrap horizontally
        const rx = x < bw - 1 ? x + 1 : 0
        const row = y * bw
        let touch = false
        if (occ[row + lx] || occ[row + rx]) touch = true
        else if (up >= 0 && (occ[up * bw + x] || occ[up * bw + lx] || occ[up * bw + rx])) touch = true
        else if (dn >= 0 && (occ[dn * bw + x] || occ[dn * bw + lx] || occ[dn * bw + rx])) touch = true
        if (touch) {
          occ[row + x] = ++count
          if (y < topY) topY = y
          return
        }
        // Random walk with a downward bias (the frost catches falling motes) and
        // a gentle horizontal lean toward the cursor.
        const r = rng()
        if (r < 0.5) y += 1 // gravity toward the sill
        else if (r < 0.62) y -= 1
        else if (r < 0.81) x += 1
        else x += -1
        if (drift !== 0 && rng() < Math.abs(drift) * 0.5) x += drift > 0 ? 1 : -1
        // Wrap sideways; abandon if it climbs off the top.
        if (x < 0) x += bw
        else if (x >= bw) x -= bw
        if (y < 0) return
        if (y >= bh) y = bh - 1
      }
    }

    function render() {
      if (!img) return
      const data = img.data
      const denom = Math.max(1, count)
      let i = 0
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const o = occ[y * bw + x]
          let r: number
          let g: number
          let b: number
          if (o === 0) {
            // Open air — the cold near-ink the frost grows on.
            r = 8
            g = 10
            b = 12
          } else {
            // Newer cells froze later, so a higher order = a growth tip = brighter.
            const norm = o / denom
            const s = Math.max(0.14, norm) // a floor so the old base still reads
            // ink -> lime
            let rr = 8 + (220 - 8) * s
            let gg = 10 + (248 - 10) * s
            let bb = 12 + (124 - 12) * s
            // the very newest tips spark toward white
            const hot = s > 0.78 ? (s - 0.78) / 0.22 : 0
            rr += (255 - rr) * hot * 0.7
            gg += (255 - gg) * hot * 0.7
            bb += (255 - bb) * hot * 0.7
            r = rr
            g = gg
            b = bb
          }
          data[i] = r
          data[i + 1] = g
          data[i + 2] = b
          data[i + 3] = 255
          i += 4
        }
      }
      bctx!.putImageData(img, 0, 0)
      ctx!.drawImage(buf, 0, 0, bw, bh, 0, 0, w, h)
    }

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
      rng = mulberry32(0x5eed)
      reseed()
    }

    // The front has reached this fraction of the way up before it thaws.
    const CEILING = 0.14

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      leanTarget = nx * 2 // pull toward the cursor's side
    }
    function onLeave() {
      leanTarget = 0
    }

    resize()

    if (reduce) {
      // Grow a full crystal synchronously off the seeded PRNG, then hold it still.
      let guard = 0
      while (topY > bh * CEILING && guard < 400000) {
        walk()
        guard++
      }
      render()
      const ro = new ResizeObserver(() => {
        resize()
        guard = 0
        while (topY > bh * CEILING && guard < 400000) {
          walk()
          guard++
        }
        render()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const batch = Math.max(1, Math.round(28 * speed))
    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (now - lastDraw < 33) return // ~30fps
      lastDraw = now
      lean += (leanTarget - lean) * 0.07
      if (full) {
        if (now >= holdUntil) reseed()
      } else {
        for (let k = 0; k < batch; k++) walk()
        if (topY <= bh * CEILING) {
          full = true
          holdUntil = now + 1400 // hold the finished crystal a beat, then thaw
        }
      }
      render()
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
  }, [reduce, speed, scale, interactive])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
