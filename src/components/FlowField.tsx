import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A flow field: a few hundred motes advected through a smooth, slowly evolving
// vector field, each leaving a fading trail so the canvas reads as streaming
// current rather than scattered dots. The field angle is a cheap sum of sines
// of position and time — no noise library, one RAF loop, DPR-aware and
// ResizeObserver-driven. The pointer is a swirl: motes inside its reach curl
// tangentially around it and warm from cool white to lime, dragging a brighter
// eddy behind the cursor. Under reduced motion there is no loop — a single pass
// traces static streamlines through the frozen field, so the topology is legible
// without any movement.
export function FlowField({
  className = '',
  accent = '220,248,124',
  count = 520,
}: {
  className?: string
  /** Highlight colour as an "r,g,b" string. */
  accent?: string
  /** Number of motes streaming through the field. */
  count?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pointer = { x: -9999, y: -9999, active: false }

    // The field angle at a point in space and time — a smooth wrap of sines so
    // the current bends organically and never repeats on a short cycle.
    function angleAt(x: number, y: number, t: number) {
      const a =
        Math.sin(x * 0.0016 + t) +
        Math.cos(y * 0.0019 - t * 0.8) +
        Math.sin((x + y) * 0.0011 + t * 0.35)
      return a * Math.PI
    }

    interface Mote {
      x: number
      y: number
      life: number
      max: number
    }
    let motes: Mote[] = []

    function spawn(m: Mote) {
      m.x = Math.floor((((m.x * 9301 + 49297) % 233280) / 233280) * w) // deterministic scatter
      m.y = Math.floor(((((m.y + 1) * 4517 + 12345) % 233280) / 233280) * h)
      m.life = 0
      m.max = 90 + ((m.x + m.y) % 120)
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Seed motes on a scattered grid so the first frame already fills the field.
      motes = Array.from({ length: count }, (_, i) => {
        const gx = (i * 73) % 997
        const gy = (i * 179) % 991
        return { x: (gx / 997) * w, y: (gy / 991) * h, life: (i * 37) % 90, max: 90 + ((i * 53) % 120) }
      })
    }

    // Advance one mote, returning its previous point so the caller can stroke a
    // segment. Applies the field plus, near the pointer, a tangential swirl.
    function step(m: Mote, t: number) {
      const px = m.x
      const py = m.y
      let ang = angleAt(m.x, m.y, t)
      let heat = 0

      if (pointer.active) {
        const dx = m.x - pointer.x
        const dy = m.y - pointer.y
        const dist = Math.hypot(dx, dy)
        const R = 150
        if (dist < R) {
          const falloff = 1 - dist / R
          heat = falloff
          // Blend the field angle toward the tangent around the pointer so the
          // current curls into an eddy instead of flowing straight through.
          const tangent = Math.atan2(dy, dx) + Math.PI / 2
          ang = ang + (tangent - ang) * falloff * 0.8
        }
      }

      const speed = 1.1 + heat * 0.9
      m.x += Math.cos(ang) * speed
      m.y += Math.sin(ang) * speed
      m.life++

      // Recycle motes that age out or drift off-frame.
      if (m.life > m.max || m.x < -4 || m.x > w + 4 || m.y < -4 || m.y > h + 4) {
        spawn(m)
        return null
      }
      return { px, py, heat }
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
      pointer.x = -9999
      pointer.y = -9999
    }

    resize()

    // Reduced motion: no loop. Trace each streamline forward through the frozen
    // field once so the current's shape is visible while nothing moves.
    if (reduce) {
      ctx.fillStyle = 'rgba(9,9,11,1)'
      ctx.fillRect(0, 0, w, h)
      ctx.lineWidth = 1
      for (const m of motes) {
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        let x = m.x
        let y = m.y
        for (let s = 0; s < 26; s++) {
          const ang = angleAt(x, y, 0)
          x += Math.cos(ang) * 3
          y += Math.sin(ang) * 3
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.10)'
        ctx.stroke()
      }
      const ro = new ResizeObserver(() => {
        resize()
        // redraw static frame
        ctx.fillStyle = 'rgba(9,9,11,1)'
        ctx.fillRect(0, 0, w, h)
        for (const m of motes) {
          ctx.beginPath()
          ctx.moveTo(m.x, m.y)
          let x = m.x
          let y = m.y
          for (let s = 0; s < 26; s++) {
            const ang = angleAt(x, y, 0)
            x += Math.cos(ang) * 3
            y += Math.sin(ang) * 3
            ctx.lineTo(x, y)
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.10)'
          ctx.stroke()
        }
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const start = performance.now()
    function frame(now: number) {
      const t = (now - start) / 6000
      // Fade the previous frame toward the backdrop so trails decay smoothly.
      ctx!.fillStyle = 'rgba(9,9,11,0.12)'
      ctx!.fillRect(0, 0, w, h)

      ctx!.lineWidth = 1.1
      for (const m of motes) {
        const seg = step(m, t)
        if (!seg) continue
        ctx!.beginPath()
        ctx!.moveTo(seg.px, seg.py)
        ctx!.lineTo(m.x, m.y)
        if (seg.heat > 0.02) {
          ctx!.strokeStyle = `rgba(${accent},${0.18 + seg.heat * 0.6})`
          ctx!.lineWidth = 1.1 + seg.heat * 1.4
        } else {
          ctx!.strokeStyle = 'rgba(255,255,255,0.10)'
          ctx!.lineWidth = 1.1
        }
        ctx!.stroke()
      }
      raf = requestAnimationFrame(frame)
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [reduce, accent, count])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
