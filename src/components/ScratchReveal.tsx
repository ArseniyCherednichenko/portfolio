import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// ScratchReveal: a tactile scratch-off panel. The real content sits underneath
// as a normal child; a canvas foil is painted on top, and dragging the pointer
// (or finger) erases it with a soft round brush, uncovering what is below. Once
// enough is cleared the foil fades away on its own and the panel unlocks.
//
// Deliberately distinct from the site's other reveals: PixelTransition swaps a
// face behind a grid flash, SpotlightReveal lights words under the cursor, this
// one is a physical scratch you have to work at. The content underneath is
// always in the DOM (so it is selectable and screen-reader legible); the canvas
// is aria-hidden and decorative.
//
// One canvas, no RAF loop — the foil is a static paint and erasing is
// destination-out arcs drawn on pointer move, interpolated between events so a
// fast swipe leaves no gaps. Cleared area is tracked on a coarse occupancy grid
// (no getImageData on the hot path). DPR-capped at 2, ResizeObserver-driven,
// cleaned up on unmount. Under reduced motion the foil is skipped entirely and
// the content shows plainly, so nothing is ever gated behind motion.
export function ScratchReveal({
  children,
  className = '',
  hint = 'Scratch to reveal',
  subhint = 'Drag across the panel',
  brush = 26,
  threshold = 0.55,
  onReveal,
}: {
  /** The content uncovered underneath the foil. Always present in the DOM. */
  children: React.ReactNode
  className?: string
  /** Large label painted on the foil. */
  hint?: string
  /** Smaller label under the hint. */
  subhint?: string
  /** Brush radius in px. */
  brush?: number
  /** Fraction cleared (0..1) at which the foil auto-completes. */
  threshold?: number
  /** Fires once, when the panel first unlocks. */
  onReveal?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()
  // `revealed` fades the foil out and lifts pointer-events; under reduced motion
  // it starts true so the content is simply visible.
  const [revealed, setRevealed] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const reset = useCallback(() => {
    setRevealed(false)
    setResetKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (reduce) {
      setRevealed(true)
      return
    }
    setRevealed(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setRevealed(true)
      return
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    // Coarse occupancy grid: one flag per ~10px cell, so we can measure how much
    // has been cleared without ever reading back pixels.
    const CELL = 10
    let cols = 0
    let rows = 0
    let cleared: Uint8Array = new Uint8Array(0)
    let clearedCount = 0
    let done = false
    const pointer = { x: 0, y: 0, has: false, down: false }

    // Paint the foil: a dark lime-tinted brushed panel with a couple of soft
    // sheen streaks, a grain wash, and the two hint labels centred.
    function paintFoil() {
      ctx!.globalCompositeOperation = 'source-over'
      ctx!.clearRect(0, 0, w, h)

      const g = ctx!.createLinearGradient(0, 0, w, h)
      g.addColorStop(0, '#1b1e12')
      g.addColorStop(0.5, '#23271a')
      g.addColorStop(1, '#16180f')
      ctx!.fillStyle = g
      ctx!.fillRect(0, 0, w, h)

      // Two diagonal sheen streaks for a foil-like catch of light.
      ctx!.save()
      ctx!.translate(w / 2, h / 2)
      ctx!.rotate(-0.5)
      ctx!.translate(-w / 2, -h / 2)
      for (const [x, a] of [
        [w * 0.28, 0.06],
        [w * 0.62, 0.04],
      ] as const) {
        const s = ctx!.createLinearGradient(x - 40, 0, x + 40, 0)
        s.addColorStop(0, 'rgba(220,248,124,0)')
        s.addColorStop(0.5, `rgba(220,248,124,${a})`)
        s.addColorStop(1, 'rgba(220,248,124,0)')
        ctx!.fillStyle = s
        ctx!.fillRect(x - 60, -h, 120, h * 3)
      }
      ctx!.restore()

      // Grain: a scatter of faint specks, seeded off geometry so it is stable
      // across repaints without needing Math.random on the hot path.
      ctx!.fillStyle = 'rgba(255,255,255,0.03)'
      for (let i = 0; i < 220; i++) {
        const px = (i * 97.13) % w
        const py = (i * 53.71 + (i % 7) * 11) % h
        ctx!.fillRect(px, py, 1.4, 1.4)
      }

      // Labels.
      ctx!.textAlign = 'center'
      ctx!.textBaseline = 'middle'
      ctx!.fillStyle = 'rgba(220,248,124,0.92)'
      ctx!.font = '600 15px ui-sans-serif, system-ui, sans-serif'
      ctx!.fillText(hint.toUpperCase(), w / 2, h / 2 - 8)
      ctx!.fillStyle = 'rgba(255,255,255,0.4)'
      ctx!.font = '400 12px ui-sans-serif, system-ui, sans-serif'
      ctx!.fillText(subhint, w / 2, h / 2 + 14)
    }

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.max(1, Math.ceil(w / CELL))
      rows = Math.max(1, Math.ceil(h / CELL))
      cleared = new Uint8Array(cols * rows)
      clearedCount = 0
      paintFoil()
    }

    // Erase a round brush stamp and mark the cells it touches as cleared.
    function scratch(x: number, y: number) {
      ctx!.globalCompositeOperation = 'destination-out'
      ctx!.beginPath()
      ctx!.arc(x, y, brush, 0, Math.PI * 2)
      ctx!.fill()

      const reach = Math.ceil(brush / CELL)
      const cx = Math.floor(x / CELL)
      const cy = Math.floor(y / CELL)
      for (let r = cy - reach; r <= cy + reach; r++) {
        if (r < 0 || r >= rows) continue
        for (let c = cx - reach; c <= cx + reach; c++) {
          if (c < 0 || c >= cols) continue
          const i = r * cols + c
          if (cleared[i]) continue
          const dx = c * CELL + CELL / 2 - x
          const dy = r * CELL + CELL / 2 - y
          if (dx * dx + dy * dy > brush * brush) continue
          cleared[i] = 1
          clearedCount++
        }
      }

      if (!done && clearedCount / (cols * rows) >= threshold) {
        done = true
        setRevealed(true)
        onReveal?.()
      }
    }

    function pointFrom(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    function onDown(e: PointerEvent) {
      if (done) return
      pointer.down = true
      const p = pointFrom(e)
      pointer.x = p.x
      pointer.y = p.y
      pointer.has = true
      scratch(p.x, p.y)
      canvas!.setPointerCapture?.(e.pointerId)
    }

    function onMove(e: PointerEvent) {
      if (!pointer.down || done) return
      const p = pointFrom(e)
      if (pointer.has) {
        // Interpolate along the travelled segment so fast drags stay solid.
        const dx = p.x - pointer.x
        const dy = p.y - pointer.y
        const dist = Math.hypot(dx, dy)
        const steps = Math.max(1, Math.round(dist / (brush * 0.5)))
        for (let s = 1; s <= steps; s++) {
          scratch(pointer.x + (dx * s) / steps, pointer.y + (dy * s) / steps)
        }
      } else {
        scratch(p.x, p.y)
      }
      pointer.x = p.x
      pointer.y = p.y
      pointer.has = true
    }

    function onUp() {
      pointer.down = false
      pointer.has = false
    }

    build()
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    const ro = new ResizeObserver(() => build())
    ro.observe(canvas)

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      ro.disconnect()
    }
  }, [reduce, brush, threshold, hint, subhint, onReveal, resetKey])

  return (
    <div className={`relative isolate overflow-hidden rounded-3xl ${className}`}>
      {children}
      {!reduce && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full touch-none transition-opacity duration-700 ease-out"
          style={{
            opacity: revealed ? 0 : 1,
            cursor: revealed ? 'default' : 'grab',
            pointerEvents: revealed ? 'none' : 'auto',
          }}
        />
      )}
      {!reduce && revealed && (
        <button
          type="button"
          onClick={reset}
          className="absolute bottom-3 right-3 z-10 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs font-semibold text-white/70 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
        >
          Scratch again
        </button>
      )}
    </div>
  )
}
