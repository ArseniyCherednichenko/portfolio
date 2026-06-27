import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Site-wide click feedback: a small burst of lime sparks plus a quick ring
// shockwave wherever the pointer presses. Pure canvas + a single RAF loop that
// only runs while sparks are alive, so it costs nothing at rest. Honest, brand
// micro-motion — never blocks the UI (pointer-events: none) and disables itself
// entirely under reduced motion.

const ACCENT = '220, 248, 124' // lime, as rgb triplet for rgba()
const SPARKS = 9 // line sparks per burst
const SPARK_LIFE = 460 // ms a spark lives
const RING_LIFE = 420 // ms the shockwave lives
const SPARK_LEN = 12 // px length of a spark streak
const SPARK_DIST = 46 // px a spark travels over its life
const RING_RADIUS = 26 // px the shockwave grows to

type Spark = {
  x: number
  y: number
  angle: number
  born: number
}
type Ring = {
  x: number
  y: number
  born: number
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function ClickSpark() {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (reduce) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const sparks: Spark[] = []
    const rings: Ring[] = []
    let raf = 0
    let running = false

    const frame = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Sparks: short streaks flung outward, easing to a stop and fading.
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        const t = (now - s.born) / SPARK_LIFE
        if (t >= 1) {
          sparks.splice(i, 1)
          continue
        }
        const e = easeOut(t)
        const cx = s.x + Math.cos(s.angle) * SPARK_DIST * e
        const cy = s.y + Math.sin(s.angle) * SPARK_DIST * e
        const tailLen = SPARK_LEN * (1 - t)
        const tx = cx - Math.cos(s.angle) * tailLen
        const ty = cy - Math.sin(s.angle) * tailLen
        ctx.strokeStyle = `rgba(${ACCENT}, ${1 - t})`
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(cx, cy)
        ctx.stroke()
      }

      // Rings: a thin shockwave that expands and dims.
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]
        const t = (now - r.born) / RING_LIFE
        if (t >= 1) {
          rings.splice(i, 1)
          continue
        }
        const e = easeOut(t)
        ctx.strokeStyle = `rgba(${ACCENT}, ${0.5 * (1 - t)})`
        ctx.lineWidth = 1.5 * (1 - t)
        ctx.beginPath()
        ctx.arc(r.x, r.y, 4 + RING_RADIUS * e, 0, Math.PI * 2)
        ctx.stroke()
      }

      if (sparks.length || rings.length) {
        raf = requestAnimationFrame(frame)
      } else {
        running = false
      }
    }

    const burst = (x: number, y: number) => {
      const now = performance.now()
      const offset = Math.random() * Math.PI * 2
      for (let i = 0; i < SPARKS; i++) {
        const angle = offset + (i / SPARKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
        sparks.push({ x, y, angle, born: now })
      }
      rings.push({ x, y, born: now })
      if (!running) {
        running = true
        raf = requestAnimationFrame(frame)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      // Skip the synthetic 0,0 events and any non-primary button presses.
      if (e.button !== 0) return
      burst(e.clientX, e.clientY)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [reduce])

  if (reduce) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9998]"
    />
  )
}
