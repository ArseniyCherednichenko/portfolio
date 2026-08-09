import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A living sunflower head, grown by geometry rather than mechanics or chemistry.
// Where the Morphogen grows a pattern out of reacting chemicals and the
// Murmuration pushes birds around, this one places nothing but points — and lets
// a single irrational number do all the work. It is phyllotaxis: the packing a
// sunflower, a pinecone, or a daisy uses to fit the most seeds into a disc with
// no gaps and no seams.
//
// The rule is Vogel's model (1979). Seed i sits at angle theta = i * G and
// radius r = c * sqrt(i), where G is the GOLDEN ANGLE — 360 degrees divided by
// the golden ratio squared, about 137.507 degrees. That one angle is the whole
// trick: because the golden ratio is the "most irrational" number (its continued
// fraction is all ones, so it resists any rational approximation longer than any
// other value), consecutive seeds never line up into spokes and the florets pack
// evenly all the way out. The eye then reads the packing as two interleaved
// families of spirals — the parastichies — and their counts are always adjacent
// Fibonacci numbers (21 one way, 34 the other, and so on).
//
// To make the geometry legible rather than static, the divergence angle breathes
// a hair around the golden angle. Nudge it a few thousandths of a radian off and
// the spiral arms visibly re-thread — winding one way, unwinding, snapping to a
// new Fibonacci family — which is exactly the demonstration that the golden angle
// is special: only there do the seeds stop clumping into arms at all. The whole
// head also turns slowly, and the pointer is a lens: florets near the cursor
// swell and warm toward the accent, brightest at the centre and falling off with
// distance. Everything is drawn on one canvas in a single RAF loop; the seed
// index, angle, and radius are pure math with no per-floret state and no
// randomness (the shimmer comes from an eased time phase, not an RNG, so it never
// trips the environment's guards). Under reduced motion the head is drawn once at
// the exact golden angle, fully grown and still. Decorative, so aria-hidden.

// The golden angle in radians: 2*pi * (1 - 1/phi), phi = (1+sqrt5)/2.
const GOLDEN = Math.PI * (3 - Math.sqrt(5)) // ~2.399963 rad ~ 137.5 deg

export function Phyllotaxis({
  className = '',
  accent = '220,248,124',
  /** Radial spacing constant c in r = c*sqrt(i). Larger spreads the head out. */
  spacing = 6.2,
}: {
  className?: string
  accent?: string
  spacing?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
    // Cool resting ink each floret sits at before the lens or its radius warms it.
    const cr = 120
    const cg = 128
    const cb = 150

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let count = 0 // number of florets, scaled to the card area
    let raf = 0
    let t = 0 // frame-driven time phase; no Date.now, so resize-stable and safe

    // The pointer lens: eases toward the cursor and swells while it is over the
    // head, so nearby florets bloom in its wake and settle when it leaves.
    const cur = { x: -1, y: -1, tx: -1, ty: -1, amp: 0, tamp: 0 }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h / 2
      // Fill the smaller dimension with the head; count follows from the packing
      // radius so density stays even across card sizes. Bounded for a calm budget.
      const room = Math.min(w, h) * 0.46
      count = Math.max(300, Math.min(1900, Math.round((room / spacing) ** 2)))
    }

    // Draw the whole head once for a given divergence angle and rotation. Florets
    // are laid inner-to-outer so the denser centre paints over the sparser rim.
    function draw(angle: number, rot: number) {
      ctx!.clearRect(0, 0, w, h)
      const lensR = Math.min(w, h) * 0.34
      const lx = cur.x
      const ly = cur.y
      const amp = cur.amp
      for (let i = 0; i < count; i++) {
        const r = spacing * Math.sqrt(i)
        const th = i * angle + rot
        const x = cx + r * Math.cos(th)
        const y = cy + r * Math.sin(th)
        // Base radius grows gently outward so the rim reads coarser than the core.
        const rr = i / count
        let dot = 0.9 + rr * 2.1

        // Radial warmth: the outer florets lean toward the accent a little, the
        // way a real capitulum ripens from the rim inward.
        let lit = 0.12 + rr * 0.5

        // The pointer lens: swell and brighten florets near the cursor, softly.
        if (amp > 0.01 && lx >= 0) {
          const dx = x - lx
          const dy = y - ly
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < lensR) {
            const f = (1 - d / lensR) * amp
            dot += f * 3.4
            lit += f * 0.9
          }
        }
        if (lit > 1) lit = 1

        const red = Math.round(cr + (ar - cr) * lit)
        const grn = Math.round(cg + (ag - cg) * lit)
        const blu = Math.round(cb + (ab - cb) * lit)
        const alpha = 0.35 + lit * 0.6
        ctx!.beginPath()
        ctx!.fillStyle = `rgba(${red},${grn},${blu},${alpha})`
        ctx!.arc(x, y, dot, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      cur.tx = e.clientX - rect.left
      cur.ty = e.clientY - rect.top
      cur.tamp = 1
    }
    function onLeave() {
      cur.tamp = 0
    }

    resize()

    if (reduce) {
      // A single fully-grown head at the exact golden angle. No loop, no pointer.
      cur.x = -1
      cur.amp = 0
      draw(GOLDEN, 0)
      const ro = new ResizeObserver(() => {
        resize()
        draw(GOLDEN, 0)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    function frame() {
      t += 0.01
      cur.x += (cur.tx - cur.x) * 0.2
      cur.y += (cur.ty - cur.y) * 0.2
      cur.amp += (cur.tamp - cur.amp) * 0.08
      // Breathe the divergence a few thousandths of a radian around the golden
      // angle: enough to re-thread the parastichies, small enough that the head
      // never loses its even packing.
      const angle = GOLDEN + Math.sin(t * 0.5) * 0.006
      // Turn the whole head slowly, so the light and the spirals drift together.
      const rot = t * 0.05
      draw(angle, rot)
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
  }, [reduce, accent, spacing])

  return <canvas ref={ref} className={`h-full w-full ${className}`} aria-hidden="true" />
}
