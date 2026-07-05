import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A field of tilted "light shafts" — long, soft, vertical gradient beams drawn
// with additive blending, so where they overlap they glow, and the whole canvas
// is rotated a touch to read as diagonal light through blinds. Each beam sways
// slowly and, where the pointer comes near, the nearest beams brighten and warm
// toward lime. Deliberately distinct from the site's other canvas fields (the
// horizontal waves of `Threads`, the needles of `MagnetLines`, the dots of
// `DotGrid`): here it's soft shafts of light, not lines or points.
//
// One RAF loop, DPR-aware, ResizeObserver-driven, cleaned up on unmount. Under
// reduced motion it paints a single calm static frame with no loop or listeners.
// Purely decorative, so `aria-hidden`.

// Deterministic per-beam jitter (no Math.random, so it stays stable across
// renders and never breaks resume). A tiny hash of the index.
function seed(i: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

export function Beams({
  className = '',
  count = 16,
  /** Tilt of the whole field, in degrees. */
  angle = -18,
  /** Highlight colour as an "r,g,b" string. */
  accent = '220,248,124',
}: {
  className?: string
  count?: number
  angle?: number
  accent?: string
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
    const rad = (angle * Math.PI) / 180
    const pointer = { x: -9999, active: false }

    // Cool, near-white resting tint; warms to `accent` under the pointer.
    const REST = '198,208,190'

    // Per-beam constants, seeded deterministically off the index so the field
    // looks organic without any per-frame randomness.
    const beams = Array.from({ length: count }, (_, i) => {
      const r = seed(i)
      return {
        p: (i + 0.5) / count, // base column position (fraction of overscan width)
        speed: 0.12 + r * 0.22, // sway rate
        phase: i * 0.9, // sway offset
        sway: 16 + (i % 3) * 16, // sway amplitude, px
        width: 44 + (i % 4) * 26, // beam width, px
        base: 0.1 + (i % 5) * 0.03, // resting opacity multiplier
      }
    })

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function render(t: number) {
      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = 'lighter'
      ctx!.save()
      // Tilt the whole field about its centre.
      ctx!.translate(w / 2, h / 2)
      ctx!.rotate(rad)
      ctx!.translate(-w / 2, -h / 2)

      // Overscan so the tilted, swaying beams still cover every corner.
      const margin = h * 0.6
      const spanW = w + h * Math.abs(Math.sin(rad)) + 160

      for (let i = 0; i < count; i++) {
        const b = beams[i]
        const x = b.p * spanW - (spanW - w) / 2 + Math.sin(t * b.speed + b.phase) * b.sway

        // Pointer proximity in (roughly) screen-x space — the tilt is gentle,
        // so column-x is a good enough proxy and stays cheap.
        let lit = 0
        if (pointer.active) {
          const d = pointer.x - x
          lit = Math.exp(-(d * d) / (150 * 150))
        }

        const col = lit > 0.02 ? accent : REST
        const a = b.base * (0.5 + 0.5 * Math.sin(t * 0.4 + i)) * 0.5 + b.base * 0.5 + lit * 0.55
        const grad = ctx!.createLinearGradient(0, -margin, 0, h + margin)
        grad.addColorStop(0, `rgba(${col},0)`)
        grad.addColorStop(0.5, `rgba(${col},${a.toFixed(3)})`)
        grad.addColorStop(1, `rgba(${col},0)`)
        ctx!.fillStyle = grad
        const width = b.width * (1 + lit * 0.5)
        ctx!.fillRect(x - width / 2, -margin, width, h + margin * 2)
      }

      ctx!.restore()
      ctx!.globalCompositeOperation = 'source-over'
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.active = true
    }
    function onLeave() {
      pointer.active = false
      pointer.x = -9999
    }

    resize()

    if (reduce) {
      render(0)
      const ro = new ResizeObserver(() => {
        resize()
        render(0)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    const start = performance.now()
    function frame(now: number) {
      render((now - start) / 1000)
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
  }, [reduce, count, angle, accent])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
