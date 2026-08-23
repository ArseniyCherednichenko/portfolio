import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A tasteful, physics-based confetti burst — the celebratory sibling of the
// site-wide ClickSpark. Where ClickSpark answers every press with a quick lime
// flick, this is a fountain of fluttering paper for the rare, *earned* moment
// (a form sent, the whole site wandered). It stays in the site's family — lime,
// white, and muted tones, not a rainbow party — so the flourish still reads as
// restraint rather than confetti-cannon kitsch.
//
// Imperative by design: mount one <Confetti ref={ref}/> inside a positioned
// container and call ref.current.fire() at the moment worth marking, optionally
// from a point. The canvas fills its nearest positioned ancestor, is
// pointer-events:none so it never blocks the UI, and the single RAF loop only
// runs while paper is still in the air, so it costs nothing at rest.
//
// Honest to the "respect the still" ethos: under prefers-reduced-motion fire()
// is a no-op — there is no calm way to throw confetti, so the calm answer is to
// not. Randomness lives only inside fire() (a user gesture, app runtime like the
// Wander shuffle), never at module or render scope, so it never trips the
// environment's guards.

export interface ConfettiHandle {
  /** Throw a burst. Origin is CSS px relative to the canvas top-left; defaults
   *  to the bottom-centre of the canvas (a fountain rising from below). */
  fire: (origin?: { x: number; y: number }) => void
}

interface ConfettiProps {
  /** Paper pieces per burst. */
  count?: number
  /** Fill colours, cycled across the burst. Keep them in the site's family. */
  colors?: string[]
  className?: string
}

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  color: string
  rot: number
  rotSpeed: number
  flip: number
  flipSpeed: number
  wobble: number
  wobbleSpeed: number
  age: number
  life: number
}

// Lime accent, off-white, and two muted tones — the burst reads as the site's
// own palette caught in the light, not a birthday poster.
const DEFAULT_COLORS = ['#DCF87C', '#EEF6D6', '#FFFFFF', '#A9C46C', '#5B6B3A']

const GRAVITY = 1150 // px/s² pulling paper back down
const DRAG = 0.86 // air resistance, applied per second as a dt-scaled decay
const SWAY = 22 // px/s² horizontal flutter acceleration

export const Confetti = forwardRef<ConfettiHandle, ConfettiProps>(function Confetti(
  { count = 90, colors = DEFAULT_COLORS, className },
  ref,
) {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const piecesRef = useRef<Piece[]>([])
  const rafRef = useRef(0)
  const runningRef = useRef(false)
  const lastRef = useRef(0)
  const sizeRef = useRef({ w: 0, h: 0 })
  // The live loop closure (owns ctx/canvas), set up once in the effect. The
  // imperative fire() and the rAF scheduler both go through this ref, so no
  // forward reference and no stale-closure ctx.
  const loopRef = useRef<((now: number) => void) | null>(null)

  useImperativeHandle(
    ref,
    () => ({
      fire(origin) {
        if (reduce) return
        const { w, h } = sizeRef.current
        if (!w || !h) return
        const ox = origin ? origin.x : w / 2
        const oy = origin ? origin.y : h + 8
        for (let i = 0; i < count; i++) {
          // Aim into an upward cone (-90deg is straight up; y grows downward),
          // so the paper fountains up and then rains back through the frame.
          const angle = (-90 + (Math.random() - 0.5) * 96) * (Math.PI / 180)
          const speed = 360 + Math.random() * 460
          const size = 5 + Math.random() * 8
          piecesRef.current.push({
            x: ox + (Math.random() - 0.5) * 24,
            y: oy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            w: size,
            h: size * (0.4 + Math.random() * 0.5),
            color: colors[i % colors.length],
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 14,
            flip: Math.random() * Math.PI * 2,
            flipSpeed: 6 + Math.random() * 8,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 3 + Math.random() * 4,
            age: 0,
            life: 2.2 + Math.random() * 1.4,
          })
        }
        if (!runningRef.current && loopRef.current) {
          runningRef.current = true
          lastRef.current = 0
          rafRef.current = requestAnimationFrame(loopRef.current)
        }
      },
    }),
    [reduce, count, colors],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const parent = canvas.parentElement
    if (!parent) return

    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = parent.getBoundingClientRect()
      sizeRef.current = { w: rect.width, h: rect.height }
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)

    loopRef.current = (now: number) => {
      const { h } = sizeRef.current
      if (!lastRef.current) lastRef.current = now
      let dt = (now - lastRef.current) / 1000
      lastRef.current = now
      if (dt > 0.05) dt = 0.05 // clamp after a tab-switch stall

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const pieces = piecesRef.current
      const drag = Math.pow(DRAG, dt)
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i]
        p.age += dt
        p.vy += GRAVITY * dt
        p.vx *= drag
        p.vy *= drag
        p.vx += Math.sin(p.wobble) * SWAY * dt // gentle horizontal flutter
        p.wobble += p.wobbleSpeed * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.rotSpeed * dt
        p.flip += p.flipSpeed * dt

        if (p.age >= p.life || p.y > h + 40) {
          pieces.splice(i, 1)
          continue
        }

        // Fade out over the final third of life so nothing pops out of view.
        const alpha = Math.min(1, (1 - p.age / p.life) * 3)
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(1, Math.cos(p.flip)) // the paper turning edge-on and back
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (pieces.length > 0) {
        rafRef.current = requestAnimationFrame(loopRef.current!)
      } else {
        runningRef.current = false
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }

    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
      runningRef.current = false
      piecesRef.current = []
      loopRef.current = null
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className ?? ''}`}
    />
  )
})
