import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A pin screen — the desk toy that is a dense bed of sliding pins. Press a hand
// (here, the cursor) against the back and the pins that were pushed stand proud
// on the front, holding the relief of whatever touched them. That holding is
// the whole point, and it is what sets this apart from every pointer field
// already on the site: the metaballs, the magnetic needle grid, the heat-trail
// all follow the cursor and then relax the moment it leaves. This one does not
// relax. A pin you raise stays raised until you clear the board, so moving the
// cursor draws a permanent relief rather than a fading wake. The toy is the
// memory, not the motion.
//
// It is drawn, not simulated. Each pin is a little extruded column: a dim base
// dot on the board, and — once raised — a shaft and a bright head offset up and
// to the left, as if the pin had slid toward a top-left light. Taller pins sit
// larger, brighter, and warmer (the house lime), so a raised region reads as a
// glowing 3D relief catching the light, while the flat bed stays a cool, even
// grid of dark dots. Heads are painted top-to-bottom, left-to-right, so a pin
// nearer the bottom-right is laid over its up-left neighbour and the board reads
// as a forest of pins with real overlap instead of a flat heightmap.
//
// One canvas, one rAF loop off the frame delta, DPR-capped at 2, rebuilt on
// resize (ResizeObserver). The loop only repaints when something is moving —
// pins ease to their target height on a spring, and once every pin has settled
// and the pointer is quiet the loop idles without touching the canvas, so a
// finished drawing costs nothing. Canvas is aria-hidden; the live board is a
// focusable region whose label says how to use it.
//
// Reduced motion: no spring and no idle loop. A press sets the pins it touches
// to full height at once and repaints a single frame; Clear flattens and
// repaints once. The relief is identical, it simply arrives without the ease.

export type PinScreenProps = {
  className?: string
  style?: React.CSSProperties
  /** Spacing between pins in CSS pixels. Clamped to a sensible range. */
  spacing?: number
}

export function PinScreen({ className, style, spacing = 15 }: PinScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const reduce = useReducedMotion()
  // Exposed to the keyboard handler and the Clear button without re-running the
  // effect: both drive the same board the pointer does.
  const pressRef = useRef<(x: number, y: number) => void>(() => {})
  const clearRef = useRef<() => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const gap = Math.max(10, Math.min(26, spacing))

    let width = 0
    let height = 0
    let dpr = 1
    let cols = 0
    let rows = 0
    let originX = 0
    let originY = 0
    // Height of every pin (0 flush .. 1 proud) and the target it eases toward.
    let h = new Float32Array(0)
    let target = new Float32Array(0)

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      cols = Math.max(2, Math.floor((width - gap) / gap))
      rows = Math.max(2, Math.floor((height - gap) / gap))
      // Centre the grid in the box so the margins stay even on any size.
      originX = (width - (cols - 1) * gap) / 2
      originY = (height - (rows - 1) * gap) / 2
      const next = new Float32Array(cols * rows)
      const nextT = new Float32Array(cols * rows)
      // Preserve the drawing across a resize where the grid is unchanged.
      if (h.length === next.length) {
        next.set(h)
        nextT.set(target)
      }
      h = next
      target = nextT
    }
    build()

    // The press brush: raise the target of every pin within a soft radius of
    // (px, py) toward full, with a smooth falloff, and never lower it — that is
    // what makes the relief hold. Returns whether anything changed.
    const RADIUS = gap * 2.4
    const press = (px: number, py: number): boolean => {
      let touched = false
      // Only scan the pins near the brush, not the whole bed.
      const cMin = Math.max(0, Math.floor((px - RADIUS - originX) / gap))
      const cMax = Math.min(cols - 1, Math.ceil((px + RADIUS - originX) / gap))
      const rMin = Math.max(0, Math.floor((py - RADIUS - originY) / gap))
      const rMax = Math.min(rows - 1, Math.ceil((py + RADIUS - originY) / gap))
      for (let r = rMin; r <= rMax; r++) {
        for (let c = cMin; c <= cMax; c++) {
          const bx = originX + c * gap
          const by = originY + r * gap
          const d = Math.hypot(bx - px, by - py)
          if (d > RADIUS) continue
          // Smoothstep falloff: full at the centre of the brush, 0 at the edge.
          const t = 1 - d / RADIUS
          const amt = t * t * (3 - 2 * t)
          const i = r * cols + c
          if (amt > target[i]) {
            target[i] = amt
            touched = true
          }
        }
      }
      return touched
    }

    const clearBoard = () => {
      target.fill(0)
      if (reduce) {
        h.fill(0)
        paint()
      } else {
        dirty = true
        ensureLoop()
      }
    }

    // --- Paint. Back-to-front so raised heads overlap correctly. ---
    const EXTRUDE = gap * 0.95 // how far a full pin slides up-left off the bed
    const paint = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const ph = h[i]
          const bx = originX + c * gap
          const by = originY + r * gap
          if (ph < 0.02) {
            // A flat pin: just the dim recessed dot of the bed.
            ctx.fillStyle = 'rgba(150,160,180,0.16)'
            ctx.beginPath()
            ctx.arc(bx, by, gap * 0.12, 0, Math.PI * 2)
            ctx.fill()
            continue
          }
          const hx = bx - ph * EXTRUDE
          const hy = by - ph * EXTRUDE
          // Shaft from the bed hole to the raised head.
          ctx.strokeStyle = `rgba(120,130,150,${0.18 + ph * 0.22})`
          ctx.lineWidth = gap * 0.14
          ctx.beginPath()
          ctx.moveTo(bx, by)
          ctx.lineTo(hx, hy)
          ctx.stroke()
          // A faint shadow the head casts back onto the bed, down-right.
          ctx.fillStyle = `rgba(0,0,0,${0.12 + ph * 0.14})`
          ctx.beginPath()
          ctx.arc(bx + gap * 0.1, by + gap * 0.1, gap * (0.16 + ph * 0.14), 0, Math.PI * 2)
          ctx.fill()
          // The head: larger, brighter, and warmer the prouder it stands.
          const rad = gap * (0.2 + ph * 0.2)
          // Cool grey when barely raised, warming to the house lime at full.
          const rr = Math.round(150 + ph * 100)
          const gg = Math.round(160 + ph * 88)
          const bb = Math.round(185 - ph * 60)
          const grad = ctx.createRadialGradient(hx - rad * 0.35, hy - rad * 0.35, rad * 0.1, hx, hy, rad)
          grad.addColorStop(0, `rgba(${Math.min(255, rr + 60)},${Math.min(255, gg + 60)},${Math.min(255, bb + 40)},1)`)
          grad.addColorStop(1, `rgba(${rr - 40},${gg - 40},${Math.max(0, bb - 40)},1)`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(hx, hy, rad, 0, Math.PI * 2)
          ctx.fill()
          // A crisp specular glint, upper-left, on the prouder pins.
          if (ph > 0.3) {
            ctx.fillStyle = `rgba(255,255,255,${(ph - 0.3) * 0.5})`
            ctx.beginPath()
            ctx.arc(hx - rad * 0.3, hy - rad * 0.3, rad * 0.28, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    // --- Spring the heights toward their targets. Returns whether still busy. ---
    const step = (dt: number): boolean => {
      const k = Math.min(1, dt * 13)
      let busy = false
      for (let i = 0; i < h.length; i++) {
        const diff = target[i] - h[i]
        if (Math.abs(diff) > 0.001) {
          h[i] += diff * k
          busy = true
        } else if (h[i] !== target[i]) {
          h[i] = target[i]
        }
      }
      return busy
    }

    let raf = 0
    let running = false
    let dirty = false
    let last = 0
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const busy = step(dt)
      if (busy || dirty) {
        paint()
        dirty = false
      }
      if (busy) {
        raf = requestAnimationFrame(loop)
      } else {
        running = false // settled — idle until the next input
      }
    }
    const ensureLoop = () => {
      if (running || reduce) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }

    // Pointer: moving anywhere over the bed presses it. No button needed — the
    // whole surface is the back of the pin screen.
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onMove = (e: PointerEvent) => {
      const { x, y } = toLocal(e)
      if (press(x, y)) {
        if (reduce) {
          // No spring: set touched pins to their target at once and repaint.
          for (let i = 0; i < h.length; i++) if (target[i] > h[i]) h[i] = target[i]
          paint()
        } else {
          ensureLoop()
        }
      }
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onMove)

    // Expose press (in local coords) and clear to the keyboard + button.
    pressRef.current = (x, y) => {
      if (press(x, y)) {
        if (reduce) {
          for (let i = 0; i < h.length; i++) if (target[i] > h[i]) h[i] = target[i]
          paint()
        } else {
          ensureLoop()
        }
      }
    }
    clearRef.current = clearBoard

    const ro = new ResizeObserver(() => {
      build()
      if (reduce) paint()
      else {
        dirty = true
        ensureLoop()
      }
    })
    ro.observe(canvas)

    paint() // first frame: the flat bed

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onMove)
    }
  }, [reduce, spacing])

  // Keyboard: a virtual presser the arrow keys walk across the bed, so the toy
  // is drawable without a pointer. Delete/Backspace clears it.
  const kbRef = useRef({ x: 0.5, y: 0.5 })
  const onKeyDown = (e: React.KeyboardEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const stepFrac = 0.04
    const k = kbRef.current
    let handled = true
    switch (e.key) {
      case 'ArrowUp':
        k.y = Math.max(0, k.y - stepFrac)
        break
      case 'ArrowDown':
        k.y = Math.min(1, k.y + stepFrac)
        break
      case 'ArrowLeft':
        k.x = Math.max(0, k.x - stepFrac)
        break
      case 'ArrowRight':
        k.x = Math.min(1, k.x + stepFrac)
        break
      case 'Delete':
      case 'Backspace':
        clearRef.current()
        return
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      pressRef.current(k.x * rect.width, k.y * rect.height)
    }
  }

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', ...style }}>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
      />
      {/* Focusable, labelled drawing surface over the aria-hidden canvas. */}
      <div
        role="application"
        aria-label="Pin screen. Move the pointer across it to press the pins into a relief that holds. With the keyboard, arrow keys press and Delete clears."
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="absolute inset-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <button
          type="button"
          onClick={() => clearRef.current()}
          className="pointer-events-auto rounded-full border border-[#DCF87C]/40 bg-[#DCF87C]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#DCF87C] transition hover:bg-[#DCF87C]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
