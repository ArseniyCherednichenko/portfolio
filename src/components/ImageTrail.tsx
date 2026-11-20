import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// ImageTrail: a comet-tail of discrete tiles stamped along the pointer's recent
// path. Each tile pops in where the cursor passed, then is LEFT BEHIND — it
// shrinks, rotates a little, and fades on its own clock while newer tiles stamp
// on ahead, so the trail reads as a string of marks the pointer dropped rather
// than anything chasing it. That is the whole point of distinguishing it from
// the site's other pointer fields: PixelTrail heats a fixed grid, Ribbons whip a
// tapered chain after the cursor, BlobCursor and MetaBalls fuse gooey discs that
// follow it. Here the marks are standalone objects with their own life, spin and
// scale, and they persist for a beat exactly where they were made.
//
// The React Bits "image trail" pattern, but with no images to ship: each tile
// carries one of a few procedural motifs (a plain gradient, diagonal rule,
// ring, cross, or quartet of dots), picked in rotation so the trail has the
// variety a real image set would give without any assets or network.
//
// One canvas, one RAF loop driven off the frame clock so the tiles keep their
// real lifetimes at any refresh rate. Tiles live in a flat array capped at a few
// dozen; the pointer spawns them along the segment it travelled between events
// (interpolated so a fast sweep leaves an even trail, not clumps), the loop ages
// every tile, draws the live ones, and drops the dead from the front. No
// per-tile React state on the hot path. DPR-capped at 2, ResizeObserver-driven,
// cleaned up on unmount. Under reduced motion it stamps a single calm arc of
// still tiles with no loop or listeners. aria-hidden, decorative.
export function ImageTrail({
  className = '',
  size = 56,
  spacing = 40,
  life = 900,
  color = '220,248,124',
  max = 48,
  listen = 'self',
}: {
  className?: string
  /** Side length of each tile at full scale, px. */
  size?: number
  /** Distance the pointer must travel before it stamps the next tile, px. */
  spacing?: number
  /** How long a tile takes to shrink and fade out, ms. */
  life?: number
  /** Tile accent colour as an "r,g,b" string. */
  color?: string
  /** Hard cap on live tiles, so a frantic sweep can never run the array away. */
  max?: number
  /**
   * Where to read the pointer. `'self'` listens on the canvas (an interactive
   * panel). `'window'` listens globally, so the canvas can sit
   * `pointer-events-none` behind selectable copy as an ambient layer.
   */
  listen?: 'self' | 'window'
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    interface Tile {
      x: number
      y: number
      born: number
      rot: number
      spin: number
      motif: number
    }
    const tiles: Tile[] = []
    // Rotating motif index, so consecutive stamps differ the way a real image
    // set would, and a cursor held still never repeats the same mark.
    let nextMotif = 0

    const pointer = { x: -9999, y: -9999, has: false }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Draw one tile centred at the origin (caller sets the transform). `k` is the
    // tile's live scale 0..1; motifs are drawn in a brighter accent so they read
    // over the tile's own dark gradient on the near-black ground.
    function roundRect(x: number, y: number, s: number, r: number) {
      ctx!.beginPath()
      ctx!.moveTo(x + r, y)
      ctx!.arcTo(x + s, y, x + s, y + s, r)
      ctx!.arcTo(x + s, y + s, x, y + s, r)
      ctx!.arcTo(x, y + s, x, y, r)
      ctx!.arcTo(x, y, x + s, y, r)
      ctx!.closePath()
    }

    function drawTile(s: number, alpha: number, motif: number) {
      const half = s / 2
      // Body: a dark tile with a lime-tinted top sheen and a thin accent edge.
      const grad = ctx!.createLinearGradient(-half, -half, half, half)
      grad.addColorStop(0, `rgba(${color},${0.22 * alpha})`)
      grad.addColorStop(0.5, `rgba(16,16,16,${0.9 * alpha})`)
      grad.addColorStop(1, `rgba(8,8,8,${0.9 * alpha})`)
      ctx!.fillStyle = grad
      roundRect(-half, -half, s, Math.max(4, s * 0.16))
      ctx!.fill()
      ctx!.lineWidth = 1
      ctx!.strokeStyle = `rgba(${color},${0.55 * alpha})`
      ctx!.stroke()

      // Motif, clipped to the tile so a rule or ring never bleeds past the edge.
      ctx!.save()
      ctx!.clip()
      ctx!.strokeStyle = `rgba(${color},${0.85 * alpha})`
      ctx!.fillStyle = `rgba(${color},${0.85 * alpha})`
      ctx!.lineWidth = Math.max(1.5, s * 0.045)
      const m = ((motif % 5) + 5) % 5
      if (m === 1) {
        // Diagonal rules.
        for (let o = -s; o < s; o += s * 0.28) {
          ctx!.beginPath()
          ctx!.moveTo(-half + o, half)
          ctx!.lineTo(-half + o + s, -half)
          ctx!.stroke()
        }
      } else if (m === 2) {
        // Concentric rings.
        for (let rr = s * 0.14; rr < half; rr += s * 0.16) {
          ctx!.beginPath()
          ctx!.arc(0, 0, rr, 0, Math.PI * 2)
          ctx!.stroke()
        }
      } else if (m === 3) {
        // Cross.
        ctx!.beginPath()
        ctx!.moveTo(0, -half * 0.7)
        ctx!.lineTo(0, half * 0.7)
        ctx!.moveTo(-half * 0.7, 0)
        ctx!.lineTo(half * 0.7, 0)
        ctx!.stroke()
      } else if (m === 4) {
        // Quartet of dots.
        const d = s * 0.2
        const rr = s * 0.07
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            ctx!.beginPath()
            ctx!.arc(sx * d, sy * d, rr, 0, Math.PI * 2)
            ctx!.fill()
          }
        }
      } else {
        // Plain: a single centred glint, so the gradient reads as the subject.
        ctx!.beginPath()
        ctx!.arc(0, 0, s * 0.1, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.restore()
    }

    function spawn(x: number, y: number) {
      tiles.push({
        x,
        y,
        born: performance.now(),
        rot: (Math.random() - 0.5) * 0.5,
        spin: (Math.random() - 0.5) * 0.9,
        motif: nextMotif++,
      })
      if (tiles.length > max) tiles.shift()
    }

    // Ease a tile's scale: a quick pop to full, then a long shrink to nothing.
    function scaleAt(t: number) {
      if (t < 0.16) return 0.55 + (t / 0.16) * 0.45
      const u = (t - 0.16) / 0.84
      return 1 - u * u
    }

    function drawStatic() {
      ctx!.clearRect(0, 0, w, h)
      // A calm arc of a handful of still tiles across the panel.
      const n = 6
      const cx = w / 2
      const cy = h / 2
      const span = Math.min(w, h) * 0.34
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1) - 0.5) * Math.PI * 0.7
        const x = cx + Math.sin(a) * span * 1.6
        const y = cy - Math.cos(a) * span * 0.5 + span * 0.2
        const k = 0.6 + (i / (n - 1)) * 0.4
        ctx!.save()
        ctx!.translate(x, y)
        ctx!.rotate((i - n / 2) * 0.12)
        drawTile(size * k, 0.4 + 0.5 * (i / (n - 1)), i)
        ctx!.restore()
      }
    }

    function frame(now: number) {
      ctx!.clearRect(0, 0, w, h)
      // Oldest first, so newer tiles stamp over the ones they overtook.
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        const t = (now - tile.born) / life
        if (t >= 1) continue
        const k = scaleAt(t)
        const alpha = t < 0.16 ? t / 0.16 : 1 - (t - 0.16) / 0.84
        ctx!.save()
        ctx!.translate(tile.x, tile.y)
        ctx!.rotate(tile.rot + tile.spin * t)
        drawTile(size * k, Math.max(0, alpha), tile.motif)
        ctx!.restore()
      }
      // Drop dead tiles from the front (they are the oldest).
      while (tiles.length && now - tiles[0].born >= life) tiles.shift()
      raf = requestAnimationFrame(frame)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (pointer.has) {
        const dx = x - pointer.x
        const dy = y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (dist < spacing) return
        // Stamp an even trail along the segment the pointer just crossed.
        const steps = Math.floor(dist / spacing)
        for (let s = 1; s <= steps; s++) {
          spawn(pointer.x + (dx * s * spacing) / dist, pointer.y + (dy * s * spacing) / dist)
        }
        // Advance the anchor by the whole stamped steps, keeping the remainder.
        const used = (steps * spacing) / dist
        pointer.x += dx * used
        pointer.y += dy * used
      } else {
        spawn(x, y)
        pointer.x = x
        pointer.y = y
        pointer.has = true
      }
    }
    function onLeave() {
      pointer.has = false
    }

    resize()

    if (reduce) {
      drawStatic()
      const ro = new ResizeObserver(() => {
        resize()
        drawStatic()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const target: Window | HTMLCanvasElement = listen === 'window' ? window : canvas
    target.addEventListener('pointermove', onMove as EventListener)
    target.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      target.removeEventListener('pointermove', onMove as EventListener)
      target.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, size, spacing, life, color, max, listen])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
