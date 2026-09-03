import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Times table — the single most surprising picture in elementary arithmetic,
// drawn as thread wound between pins. Space N points evenly around a circle and
// number them 0, 1, 2, … N-1. Then, for a chosen multiplier k, run a thread from
// every point i straight across to point i·k (wrapping past N, i.e. modulo N).
// That is the whole recipe: no curve is ever drawn, only straight chords — and
// yet the thread does not pile up into a mess. It leaves a bright edge, an
// envelope, and that envelope is a cardioid at k = 2, a nephroid at k = 3, and
// a chain of (k-1) cusps for every whole k after, the same epicycloids a coin
// rolling round a coin would trace. Slide k off the whole numbers and the cusps
// unstitch and re-stitch, so the figure is alive between the shapes as much as
// on them.
//
// It reads as string art because that is exactly what it is: nails round a ring,
// one length of thread, a rule for where it goes next — the hand-built,
// almost-free way people have drawn caustics on board for a century. Here the
// thread is tinted cool teal near point zero and warms to the site's lime as it
// travels round, so the winding order stays legible, and the chords are laid in
// 'lighter' so where many cross they burn brighter and the envelope glows on its
// own. Left alone the multiplier breathes slowly upward, blooming one cusp then
// two then a whole rosette; drag across to drive the multiplier by hand and up
// and down to add or thin the pins, and the caustic re-stitches under your
// finger, easing back to its own slow climb when you let go.
//
// Kin to the Spirograph, Harmonograph and Superformula in this family — all of
// them one closed rule sampled densely — but where those solve a smooth path,
// this draws nothing but line segments and lets their crossings do the drawing.
// One canvas, one rAF loop, DPR-capped and resize-driven; a couple of hundred
// chords a frame, no per-chord React state and no wall clock beyond a smooth
// frame counter. The canvas is decorative and aria-hidden with an sr-only
// account of what it is. Under reduced motion nothing animates: one settled
// figure is computed at a pleasing multiplier and painted still, and the pointer
// does not drive it.

interface TimesTableProps {
  className?: string
}

const DPR_CAP = 2
const EASE = 0.06 // how fast live params chase their target

// The multiplier is the shape: k = 2 is a cardioid, and each whole step adds a
// cusp. Sweep a good range so the envelope keeps blooming new lobes.
const K_MIN = 2
const K_MAX = 26
// Pins set the density of the thread, not the shape. Enough to read as a smooth
// caustic, few enough that a low k still shows its clean single edge.
const N_MIN = 80
const N_MAX = 320

// Tint by winding position: the thread starts cool teal at point zero and warms
// to the site's lime as it travels the ring.
function tint(t: number, alpha: number): string {
  const hue = 176 - t * 104 // 176 (teal) -> 72 (lime)
  const light = 52 + t * 16
  return `hsla(${hue}, 82%, ${light}%, ${alpha})`
}

export function TimesTable({ className }: TimesTableProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

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

    // Live parameters, eased toward a target every frame.
    const live = { k: 2, n: 220 }
    const pointer = { x: 0, y: 0, active: false }

    // Point p on the numbered ring, in canvas coordinates. Number 0 sits at the
    // top and the ring runs clockwise; a fractional index is allowed so the
    // thread can slide smoothly between pins as k moves off the whole numbers.
    function ringPoint(cx: number, cy: number, radius: number, index: number, n: number, spin: number) {
      const a = (index / n) * Math.PI * 2 - Math.PI / 2 + spin
      return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius }
    }

    function paint() {
      const g = ctx!
      g.clearRect(0, 0, width, height)
      g.fillStyle = '#040404'
      g.fillRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) * 0.42
      const k = live.k
      const n = Math.round(live.n)
      // A slow overall turn so the figure is never mechanically fixed.
      const spin = reduce ? 0 : t * 0.0016

      g.lineCap = 'round'
      g.lineWidth = 1
      g.globalCompositeOperation = 'lighter'

      for (let i = 0; i < n; i++) {
        const ratio = i / n
        const a = ringPoint(cx, cy, radius, i, n, spin)
        // The thread's other end: i times k, wrapped round the ring. Kept
        // fractional so the caustic re-stitches smoothly as k eases.
        const target = (i * k) % n
        const b = ringPoint(cx, cy, radius, target, n, spin)
        g.strokeStyle = tint(ratio, 0.16)
        g.beginPath()
        g.moveTo(a.x, a.y)
        g.lineTo(b.x, b.y)
        g.stroke()
      }

      g.globalCompositeOperation = 'source-over'

      // The pins themselves, a faint ring of dots so the board reads as strung.
      g.fillStyle = 'rgba(220, 248, 124, 0.22)'
      const dots = Math.min(n, 160)
      for (let i = 0; i < dots; i++) {
        const p = ringPoint(cx, cy, radius, (i / dots) * n, n, spin)
        g.beginPath()
        g.arc(p.x, p.y, 0.9, 0, Math.PI * 2)
        g.fill()
      }

      // A soft lime core anchors the centre of the caustic.
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.7)
      glow.addColorStop(0, 'rgba(220, 248, 124, 0.05)')
      glow.addColorStop(1, 'rgba(220, 248, 124, 0)')
      g.fillStyle = glow
      g.fillRect(0, 0, width, height)
    }

    function step() {
      t += 1
      let kTarget: number
      let nTarget: number
      if (pointer.active) {
        const fx = Math.min(1, Math.max(0, pointer.x / Math.max(1, width)))
        const fy = Math.min(1, Math.max(0, pointer.y / Math.max(1, height)))
        kTarget = K_MIN + fx * (K_MAX - K_MIN)
        nTarget = N_MAX - fy * (N_MAX - N_MIN) // up = more pins
      } else {
        // The multiplier climbs slowly through the whole numbers and back, so
        // the envelope keeps gaining and shedding cusps on its own.
        kTarget = K_MIN + (K_MAX - K_MIN) * (0.5 - 0.5 * Math.cos(t * 0.0034))
        nTarget = 220 + 40 * Math.sin(t * 0.0021)
      }
      live.k += (kTarget - live.k) * EASE
      live.n += (nTarget - live.n) * EASE
    }

    function frame() {
      step()
      paint()
      raf = requestAnimationFrame(frame)
    }

    // For reduced motion: settle on a pleasing multiplier and paint one still
    // figure. k = 5 gives a clean four-cusped rosette, richer than a bare heart.
    function settle() {
      live.k = 5
      live.n = 240
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
      }
      const onDown = (e: PointerEvent) => {
        toLocal(e)
        pointer.active = true
      }
      const onMove = (e: PointerEvent) => {
        if (!pointer.active && e.pressure === 0) return
        toLocal(e)
        pointer.active = true
      }
      const onUp = () => {
        pointer.active = false
      }
      const onLeave = () => {
        pointer.active = false
      }
      canvas.addEventListener('pointerdown', onDown)
      canvas.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      canvas.addEventListener('pointerleave', onLeave)
      canvas.style.touchAction = 'none'

      raf = requestAnimationFrame(frame)

      return () => {
        cancelAnimationFrame(raf)
        ro.disconnect()
        canvas.removeEventListener('pointerdown', onDown)
        canvas.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
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
        A live times-table caustic: straight threads wound between numbered pins on a circle, from each point i to point
        i times k, whose crossings trace a cardioid and higher rosettes as the multiplier eases.
      </span>
    </div>
  )
}
