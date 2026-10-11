import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A domino run — a line of standing tiles, each pivoting about its base. Tip
// the first and the fall carries down the row: every tile topples forward,
// strikes the next, and comes to rest leaning on it. It is the deliberate
// counterpart to the Newton's cradle beside it. The cradle is *elastic* and
// *reversible* — a single blow bounces back and forth down a line of equal
// masses that spring straight back up, so the toy never ends. The dominoes are
// the opposite on both counts: the cascade is *one-way* and it *finishes*.
// Gravity tips each tile past the point of no return and it stays down, the way
// the Pin screen holds its relief — the lesson here is the irreversibility, not
// the bounce.
//
// The physics is honest. Each tile is a rigid rod pivoting about its base, with
// an angle θ from vertical and angular velocity ω, integrated by semi-implicit
// Euler at a fixed substep (α = k·sinθ — gravity's torque about the base, zero
// while a tile stands perfectly upright, which is exactly why a standing row is
// a line of unstable equilibria that does nothing until something tips it). A
// falling tile hands momentum to its neighbour the moment its face reaches it —
// the contact angle falls straight out of the spacing, asin(spacing/height) —
// and each tile comes to rest at acos(thickness/spacing), the angle at which a
// leaning tile's face lies flush against the parallel back of the next, so the
// toppled row stacks like fallen books rather than clipping through itself. The
// last tile, with nothing to lean on, falls flat.
//
// One canvas, one rAF loop off the frame delta (no wall clock, resize-stable),
// DPR-capped at 2, and the loop idles the instant every tile has settled — a
// finished run costs nothing until the next tip. Tap the row to topple it; tap
// again (or press Reset) to stand it back up. Under reduced motion the loop
// never starts: the run is painted frozen mid-cascade so it reads at a glance,
// and a tap toggles between the standing and toppled stills in a single repaint.
// Decorative, so aria-hidden.

const COUNT = 9 // tiles in the line
const GRAV = 12 // angular-accel scale, 1/s² — tuned to the card, not earth
const SUBSTEPS = 4 // integration substeps per frame, for a crisp handoff
const START_PUSH = 3.2 // ω handed to the first tile on a tip, rad/s
const TRANSFER = 0.58 // fraction of ω passed on at each contact
const MIN_KICK = 1.4 // floor on the handoff so the cascade never stalls

export function Domino({ className = '', accent = '220,248,124' }: { className?: string; accent?: string }) {
    const ref = useRef<HTMLCanvasElement>(null)
    const reduce = useReducedMotion()

    useEffect(() => {
      const canvas = ref.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const [ar, ag, ab] = accent.split(',').map((n) => parseInt(n, 10))
      const dpr = Math.min(2, window.devicePixelRatio || 1)

      let w = 0
      let h = 0
      let groundY = 0
      let startX = 0
      let spacing = 0
      let tileH = 0
      let tileT = 0
      let contactAngle = 0 // θ at which a faller's face reaches the next base
      let restAngle = 0 // θ at which a leaner lies flush on its neighbour
      let raf = 0
      let last = -1
      let running = false

      // State per tile: angle from vertical (θ, + = fallen forward/right),
      // angular velocity, whether it has already kicked its neighbour, and a
      // decaying flash lit on the strike so the eye can follow the blow.
      const theta = new Array<number>(COUNT).fill(0)
      const omega = new Array<number>(COUNT).fill(0)
      const hit = new Array<boolean>(COUNT).fill(false)
      const flash = new Array<number>(COUNT).fill(0)

      function baseX(i: number) {
        return startX + spacing * i
      }

      function layout() {
        const rect = canvas!.getBoundingClientRect()
        w = Math.max(1, Math.floor(rect.width))
        h = Math.max(1, Math.floor(rect.height))
        canvas!.width = Math.floor(w * dpr)
        canvas!.height = Math.floor(h * dpr)
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

        groundY = Math.round(h * 0.84)
        const topPad = h * 0.14
        const availH = groundY - topPad
        const availW = w * 0.82
        // Fit the row both ways: tile height ≈ 1.7·spacing must clear availH, and
        // the span plus the last tile's flat reach must clear availW. Take the
        // tighter of the two so the whole run always fits the card.
        const sByH = availH / 1.7
        const sByW = availW / (COUNT - 1 + 1.7)
        spacing = Math.max(8, Math.min(sByH, sByW, 72))
        tileH = spacing * 1.7
        tileT = spacing * 0.36
        contactAngle = Math.asin(Math.min(0.999, spacing / tileH))
        restAngle = Math.acos(Math.min(0.999, tileT / spacing))
        const span = spacing * (COUNT - 1)
        // Bias left so the last tile has room to lie flat to the right.
        startX = (w - span - tileH * 0.5) / 2 + tileH * 0.1
      }

      function restOf(i: number) {
        // The last tile has nothing to lean on, so it falls nearly flat.
        return i === COUNT - 1 ? Math.PI / 2 - 0.04 : restAngle
      }

      function allSettled() {
        for (let i = 0; i < COUNT; i++) {
          if (theta[i] < restOf(i) - 1e-3) return false
        }
        return true
      }

      function allUpright() {
        for (let i = 0; i < COUNT; i++) {
          if (theta[i] > 1e-3 || Math.abs(omega[i]) > 1e-3) return false
        }
        return true
      }

      function integrate(dt: number) {
        const sub = dt / SUBSTEPS
        for (let s = 0; s < SUBSTEPS; s++) {
          for (let i = 0; i < COUNT; i++) {
            const rest = restOf(i)
            if (theta[i] >= rest) {
              theta[i] = rest
              omega[i] = 0
              continue
            }
            omega[i] += GRAV * Math.sin(theta[i]) * sub
            theta[i] += omega[i] * sub
            if (theta[i] < 0) {
              theta[i] = 0
              omega[i] = 0
            }
            if (theta[i] > rest) {
              theta[i] = rest
              omega[i] = 0
            }
            // The moment this tile's face reaches the next base, it hands the
            // blow on — once — and lights both tiles so the strike is visible.
            if (!hit[i] && i < COUNT - 1 && theta[i] >= contactAngle) {
              hit[i] = true
              omega[i + 1] = Math.max(omega[i + 1], omega[i] * TRANSFER, MIN_KICK)
              const spark = Math.min(1, omega[i] * 0.18 + 0.3)
              flash[i] = Math.max(flash[i], spark)
              flash[i + 1] = Math.max(flash[i + 1], spark)
            }
          }
        }
      }

      function roundRect(x: number, y: number, rw: number, rh: number, r: number) {
        const rr = Math.min(r, rw / 2, rh / 2)
        ctx!.beginPath()
        ctx!.moveTo(x + rr, y)
        ctx!.arcTo(x + rw, y, x + rw, y + rh, rr)
        ctx!.arcTo(x + rw, y + rh, x, y + rh, rr)
        ctx!.arcTo(x, y + rh, x, y, rr)
        ctx!.arcTo(x, y, x + rw, y, rr)
        ctx!.closePath()
      }

      function draw() {
        ctx!.clearRect(0, 0, w, h)

        // The surface the row stands on — a faint rule with a soft fade beneath.
        const shade = ctx!.createLinearGradient(0, groundY, 0, groundY + 40)
        shade.addColorStop(0, 'rgba(255,255,255,0.05)')
        shade.addColorStop(1, 'rgba(255,255,255,0)')
        ctx!.fillStyle = shade
        ctx!.fillRect(0, groundY, w, 40)
        ctx!.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.moveTo(baseX(0) - spacing * 0.6, groundY + 0.5)
        ctx!.lineTo(baseX(COUNT - 1) + tileH, groundY + 0.5)
        ctx!.stroke()

        // Draw right-to-left so a tile leaning forward is painted over the one
        // it rests on, never behind it.
        for (let i = COUNT - 1; i >= 0; i--) {
          const bx = baseX(i)
          const lean = Math.min(1, theta[i] / (Math.PI / 2))
          ctx!.save()
          ctx!.translate(bx, groundY)
          ctx!.rotate(theta[i]) // + rotates the top toward +x (forward)

          // Contact shadow that grows as the tile goes down.
          ctx!.save()
          ctx!.rotate(-theta[i])
          ctx!.fillStyle = `rgba(0,0,0,${0.22 + lean * 0.16})`
          ctx!.beginPath()
          ctx!.ellipse(tileH * lean * 0.5, 2, tileT * 0.6 + tileH * lean * 0.5, 3, 0, 0, Math.PI * 2)
          ctx!.fill()
          ctx!.restore()

          // The tile: a tall rounded slab rising from the pivot, shaded by a
          // top-left light and edged in the house lime, brightening on a strike.
          const body = ctx!.createLinearGradient(-tileT / 2, -tileH, tileT / 2, 0)
          body.addColorStop(0, 'rgba(26,27,24,0.98)')
          body.addColorStop(1, 'rgba(12,13,11,0.98)')
          ctx!.fillStyle = body
          roundRect(-tileT / 2, -tileH, tileT, tileH, Math.min(4, tileT * 0.25))
          ctx!.fill()

          const edge = Math.min(0.9, 0.3 + flash[i] * 0.6)
          ctx!.strokeStyle = `rgba(${ar},${ag},${ab},${edge})`
          ctx!.lineWidth = 1.2
          ctx!.stroke()

          // Two pips, centred on the upper and lower halves of the face.
          ctx!.fillStyle = `rgba(${ar},${ag},${ab},${0.45 + flash[i] * 0.45})`
          const pipR = Math.max(1.2, tileT * 0.14)
          ctx!.beginPath()
          ctx!.arc(0, -tileH * 0.68, pipR, 0, Math.PI * 2)
          ctx!.arc(0, -tileH * 0.32, pipR, 0, Math.PI * 2)
          ctx!.fill()

          // A thin glass highlight down the lit edge.
          ctx!.strokeStyle = 'rgba(255,255,255,0.1)'
          ctx!.lineWidth = 1
          ctx!.beginPath()
          ctx!.moveTo(-tileT / 2 + 1.5, -tileH + 3)
          ctx!.lineTo(-tileT / 2 + 1.5, -3)
          ctx!.stroke()

          ctx!.restore()

          // A soft bloom on a freshly struck tile, in the site's accent.
          if (flash[i] > 0.02) {
            const tipx = bx + Math.sin(theta[i]) * tileH
            const tipy = groundY - Math.cos(theta[i]) * tileH
            ctx!.save()
            ctx!.globalCompositeOperation = 'lighter'
            const g = ctx!.createRadialGradient(tipx, tipy, 0, tipx, tipy, tileH * 0.8)
            g.addColorStop(0, `rgba(${ar},${ag},${ab},${flash[i] * 0.5})`)
            g.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
            ctx!.fillStyle = g
            ctx!.beginPath()
            ctx!.arc(tipx, tipy, tileH * 0.8, 0, Math.PI * 2)
            ctx!.fill()
            ctx!.restore()
          }
        }
      }

      function stop() {
        running = false
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        last = -1
      }

      function frame(now: number) {
        if (last < 0) last = now
        let dt = (now - last) / 1000
        last = now
        if (dt > 0.05) dt = 0.05 // clamp after a tab-away so it never jumps

        integrate(dt)
        for (let i = 0; i < COUNT; i++) {
          flash[i] *= 0.9
          if (flash[i] < 0.01) flash[i] = 0
        }
        draw()

        // Idle the loop once the run has finished and the strikes have faded.
        const anyFlash = flash.some((f) => f > 0)
        if (allSettled() && !anyFlash) {
          stop()
          return
        }
        raf = requestAnimationFrame(frame)
      }

      function run() {
        if (running || reduce) return
        running = true
        last = -1
        raf = requestAnimationFrame(frame)
      }

      function topple() {
        if (reduce) {
          // Freeze the fully toppled still in one repaint.
          for (let i = 0; i < COUNT; i++) {
            theta[i] = restOf(i)
            omega[i] = 0
            hit[i] = true
            flash[i] = 0
          }
          draw()
          return
        }
        // Only tip a standing row; a mid-run tap does nothing surprising.
        if (theta[0] > 1e-3) return
        omega[0] = START_PUSH
        run()
      }

      function reset() {
        stop()
        for (let i = 0; i < COUNT; i++) {
          theta[i] = 0
          omega[i] = 0
          hit[i] = false
          flash[i] = 0
        }
        draw()
      }

      layout()

      if (reduce) {
        // A frozen mid-cascade still: the opening tiles down, one caught mid-
        // fall, the rest still standing — the whole idea at a glance.
        for (let i = 0; i < COUNT; i++) {
          if (i < 3) theta[i] = restOf(i)
          else if (i === 3) theta[i] = contactAngle * 1.1
          else theta[i] = 0
        }
        draw()
        const ro = new ResizeObserver(() => {
          layout()
          // Re-clamp the frozen leaners to the new geometry, then repaint.
          for (let i = 0; i < COUNT; i++) {
            if (i < 3) theta[i] = restOf(i)
          }
          draw()
        })
        ro.observe(canvas)
        return () => ro.disconnect()
      }

      draw()

      // A tap toggles the run: tip a standing row, stand a toppled one back up.
      function onDown() {
        if (allSettled()) reset()
        else if (allUpright()) topple()
      }
      canvas.addEventListener('pointerdown', onDown)

      const ro = new ResizeObserver(() => {
        const wasToppled = allSettled()
        layout()
        if (wasToppled) for (let i = 0; i < COUNT; i++) theta[i] = restOf(i)
        draw()
      })
      ro.observe(canvas)

      return () => {
        stop()
        canvas.removeEventListener('pointerdown', onDown)
        ro.disconnect()
      }
    }, [reduce, accent])

    return (
      <canvas
        ref={ref}
        aria-hidden
        className={`h-full w-full cursor-pointer touch-none ${className}`}
      />
    )
}
