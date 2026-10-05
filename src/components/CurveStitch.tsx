import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Curve stitching — the oldest proof that a curve can be made of nothing but
// straight lines. Take a corner: two rays meeting at a point. Mark the same
// number of evenly spaced points up each ray, then thread the nearest point on
// one ray to the farthest on the other — first to last, second to second-last,
// and so on. Every thread is dead straight, yet their crossings leave a bright
// edge, an envelope, and that envelope is a parabola tangent to both rays. No
// curve is ever drawn; the eye assembles it from the gaps the straight threads
// leave. It is the "curve of pursuit" a child stitches through holes in card,
// and the same trick that squares off the corner of a modernist building into a
// swoop. Here the corner is multiplied: the vertices of a regular polygon each
// stitch the two edges that meet there, so a ring of parabolas blooms inward
// and the whole figure reads as a rose window strung on a loom. Slide the
// symmetry up and the rose gains petals; the polygon approaches a circle and
// its parabolas close into a caustic.
//
// Distinct from the TimesTable beside it — that is modular chords on one ring,
// a cardioid from arithmetic — where this is the linear corner construction,
// the straight-line parabola, repeated with rotational symmetry. Kin in family
// (both are string art: pins, one rule, thread), opposite in method.
//
// Threads are tinted cool teal at the vertex and warm to the site's lime toward
// the rim, so the stitching order stays legible, and are laid in the 'lighter'
// blend so crossings burn brighter and the envelope glows on its own. The
// pointer warms the threads it passes near toward lime — the shared 'fields
// warm toward the cursor' language of the page. One canvas, one rAF loop,
// DPR-capped and resize-driven; the thread count per frame stays modest, no
// per-thread React state and no wall clock beyond a smooth frame counter. The
// `sides` prop is read live through a ref so a control can morph the symmetry
// without tearing down the loop. The canvas is decorative and aria-hidden with
// an sr-only account of what it is. Under reduced motion nothing animates: one
// settled rose is computed at a pleasing symmetry and painted still, and the
// pointer does not drive it.

interface CurveStitchProps {
  className?: string
  /** Symmetry — the number of polygon vertices, each a stitched corner. 3..14. */
  sides?: number
  /** Threads stitched across each corner. More reads as a smoother envelope. */
  threads?: number
}

const DPR_CAP = 2
const EASE = 0.07 // how fast the live symmetry chases its target
const WARM_R = 130 // px: how near the pointer a thread must pass to warm

// Tint by position along the stitch: cool teal at the vertex, warming to the
// site's lime toward the rim. `warm` (0..1) pulls the whole thread toward lime
// where the pointer passes near it.
function tint(t: number, warm: number, alpha: number): string {
  const hue = 176 - t * 104 - warm * (176 - 72 - t * 104) // -> 72 (lime) when warm
  const light = 52 + t * 14 + warm * 18
  return `hsla(${hue}, 84%, ${light}%, ${alpha + warm * 0.3})`
}

export function CurveStitch({ className, sides = 6, threads = 22 }: CurveStitchProps) {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sidesRef = useRef(sides)
  sidesRef.current = sides
  const threadsRef = useRef(threads)
  threadsRef.current = threads

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    let raf = 0
    let t = 0 // smooth frame counter, not a wall clock

    const live = { sides: Math.max(3, sidesRef.current) }
    const pointer = { x: 0, y: 0, active: false }

    // Linear interpolation between two points.
    const lerp = (ax: number, ay: number, bx: number, by: number, u: number) => ({
      x: ax + (bx - ax) * u,
      y: ay + (by - ay) * u,
    })

    function paint() {
      const g = ctx!
      g.clearRect(0, 0, width, height)
      g.fillStyle = '#040404'
      g.fillRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) * 0.44
      // A continuous symmetry: the ring is drawn with the rounded vertex count,
      // but the eased `live.sides` still times the slow bloom between integers.
      const n = Math.max(3, Math.round(live.sides))
      const N = Math.max(4, Math.round(threadsRef.current))
      const spin = reduce ? 0 : t * 0.0022

      // The polygon's vertices, number zero at the top, running clockwise.
      const verts: { x: number; y: number }[] = []
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 - Math.PI / 2 + spin
        verts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius })
      }

      g.lineCap = 'round'
      g.lineWidth = 1
      g.globalCompositeOperation = 'lighter'

      // Each vertex stitches the two edges meeting there: points march up edge
      // v->prev and up edge v->next, and thread i joins the i-th point on one to
      // the (N-i)-th on the other. Straight segments only; the parabola is their
      // envelope.
      for (let k = 0; k < n; k++) {
        const v = verts[k]
        const a = verts[(k - 1 + n) % n]
        const b = verts[(k + 1) % n]
        // Stitch only partway along each edge so adjacent corners interleave
        // into a rose rather than overdrawing the polygon's whole interior.
        const reach = 0.5
        for (let i = 0; i <= N; i++) {
          const u = (i / N) * reach
          const w = ((N - i) / N) * reach
          const p = lerp(v.x, v.y, a.x, a.y, u)
          const q = lerp(v.x, v.y, b.x, b.y, w)
          // Warmth from the pointer, measured at the thread's midpoint.
          let warm = 0
          if (pointer.active) {
            const mx = (p.x + q.x) / 2
            const my = (p.y + q.y) / 2
            const d = Math.hypot(mx - pointer.x, my - pointer.y)
            if (d < WARM_R) warm = (1 - d / WARM_R) ** 2
          }
          g.strokeStyle = tint(i / N, warm, 0.14)
          g.beginPath()
          g.moveTo(p.x, p.y)
          g.lineTo(q.x, q.y)
          g.stroke()
        }
      }

      g.globalCompositeOperation = 'source-over'

      // The pins: faint dots marching up every edge, so the figure reads strung.
      g.fillStyle = 'rgba(220, 248, 124, 0.20)'
      for (let k = 0; k < n; k++) {
        const v = verts[k]
        const b = verts[(k + 1) % n]
        for (let i = 0; i <= N; i += 2) {
          const u = (i / N) * 0.5
          const p = lerp(v.x, v.y, b.x, b.y, u)
          g.beginPath()
          g.arc(p.x, p.y, 0.9, 0, Math.PI * 2)
          g.fill()
        }
      }

      // A soft lime core anchors the centre of the rose.
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.8)
      glow.addColorStop(0, 'rgba(220, 248, 124, 0.05)')
      glow.addColorStop(1, 'rgba(220, 248, 124, 0)')
      g.fillStyle = glow
      g.fillRect(0, 0, width, height)
    }

    function step() {
      t += 1
      live.sides += (Math.max(3, sidesRef.current) - live.sides) * EASE
    }

    function frame() {
      step()
      paint()
      raf = requestAnimationFrame(frame)
    }

    // Reduced motion: settle on the requested symmetry and paint one still rose.
    function settle() {
      live.sides = Math.max(3, sidesRef.current)
      paint()
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      canvas!.width = Math.floor(width * dpr)
      canvas!.height = Math.floor(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduce) settle()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    if (!reduce) {
      const toLocal = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect()
        pointer.x = e.clientX - rect.left
        pointer.y = e.clientY - rect.top
        pointer.active = true
      }
      const onLeave = () => {
        pointer.active = false
      }
      canvas.addEventListener('pointermove', toLocal)
      canvas.addEventListener('pointerdown', toLocal)
      canvas.addEventListener('pointerleave', onLeave)
      canvas.style.touchAction = 'none'

      raf = requestAnimationFrame(frame)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        canvas.removeEventListener('pointermove', toLocal)
        canvas.removeEventListener('pointerdown', toLocal)
        canvas.removeEventListener('pointerleave', onLeave)
      }
    }

    return () => {
      ro.disconnect()
    }
  }, [reduce])

  return (
    <div className={className} style={{ position: 'relative' }}>
      <canvas ref={canvasRef} aria-hidden="true" className="h-full w-full" style={{ display: 'block' }} />
      <span className="sr-only">
        A curve-stitching rose: the vertices of a regular polygon each stitch the two edges meeting there with straight
        threads, nearest point to farthest, so a ring of parabolas blooms inward — every line straight, the curves only
        the envelopes their crossings leave.
      </span>
    </div>
  )
}
