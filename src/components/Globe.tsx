import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// A hand-built globe on a single 2D canvas — no WebGL, no texture, no map data.
// A sphere of evenly-spread dots (a Fibonacci lattice) is rotated in 3D each
// frame and drawn with an orthographic projection: dots on the near face are
// bright, dots on the far face fade to a faint glass haze, so the ball reads as
// a solid, turning sphere. Real places sit on it as lime pins at their true
// latitude/longitude, each with a pulsing ring and a label that fades out as it
// rotates around the back — so the globe says, honestly, "here is where I am"
// rather than decorating with an abstract orbit.
//
// It spins on its own and you can grab it: dragging steers yaw and pitch, and a
// flick carries an inertial spin that decays back into the idle drift. One RAF
// loop keyed off the frame timestamp (no Date.now), DPR-clamped, ResizeObserver
// -driven, no React state on the hot path.
//
// Under reduced motion it paints a single still frame — the sphere fixed so the
// first marker faces the viewer, pins drawn without a pulse, no loop, no drag.
// The place is always legible; only the movement is gated behind motion.

export interface GlobeMarker {
  /** Latitude in degrees, north positive. */
  lat: number
  /** Longitude in degrees, east positive. */
  lon: number
  /** Short label drawn beside the pin (e.g. a city). */
  label?: string
}

const DEG = Math.PI / 180

// Convert a lat/lon (degrees) to a point on the unit sphere. Longitude 0,
// latitude 0 sits at (0, 0, 1) — dead centre of the near face — so a marker's
// default rotation can bring it straight to the front.
function toSphere(lat: number, lon: number): [number, number, number] {
  const phi = lat * DEG
  const lambda = lon * DEG
  const cp = Math.cos(phi)
  return [cp * Math.sin(lambda), Math.sin(phi), cp * Math.cos(lambda)]
}

export function Globe({
  className = '',
  markers = [{ lat: 52.52, lon: 13.405, label: 'Berlin' }],
  dots = 760,
  spin = 0.16,
  accent = '220,248,124',
}: {
  className?: string
  /** Places to pin, at their real coordinates. The first sets the resting facing. */
  markers?: GlobeMarker[]
  /** Number of surface dots on the Fibonacci lattice. */
  dots?: number
  /** Idle spin speed in radians per second. */
  spin?: number
  /** Pin / highlight colour as an "r,g,b" string. */
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

    // Even spread of unit-sphere points via the golden-angle spiral — fully
    // deterministic, so it never needs Math.random and looks identical each run.
    const GOLDEN = Math.PI * (3 - Math.sqrt(5))
    const points = Array.from({ length: dots }, (_, i) => {
      const y = 1 - (i / (dots - 1)) * 2
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = i * GOLDEN
      return [Math.cos(theta) * r, y, Math.sin(theta) * r] as [number, number, number]
    })

    const pins = markers.map((m) => ({ ...m, v: toSphere(m.lat, m.lon) }))

    // Rest so the first marker faces the viewer, with a gentle editorial tilt.
    const first = markers[0]
    let yaw = first ? -first.lon * DEG : 0
    const basePitch = first ? Math.min(0.5, first.lat * DEG * 0.5) : 0.3
    let pitch = basePitch
    let vyaw = 0 // inertial spin carried after a flick
    let dragging = false
    let lastX = 0
    let lastY = 0

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Rotate a unit point by the current yaw (around Y) then pitch (around X)
    // and project orthographically. Returns screen x/y, depth z (>0 = near
    // face), and the projected radius scale.
    function project(p: readonly [number, number, number], cx: number, cy: number, R: number) {
      const [bx, by, bz] = p
      const cyaw = Math.cos(yaw)
      const syaw = Math.sin(yaw)
      const x1 = bx * cyaw + bz * syaw
      const z1 = -bx * syaw + bz * cyaw
      const cp = Math.cos(pitch)
      const sp = Math.sin(pitch)
      const y2 = by * cp - z1 * sp
      const z2 = by * sp + z1 * cp
      return { x: cx + x1 * R, y: cy - y2 * R, z: z2 }
    }

    function render(now: number) {
      ctx!.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const R = (Math.min(w, h) / 2) * 0.9

      // A soft inner glow gives the ball volume before a single dot is drawn.
      const glow = ctx!.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
      glow.addColorStop(0, `rgba(${accent},0.10)`)
      glow.addColorStop(0.6, 'rgba(255,255,255,0.03)')
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx!.fillStyle = glow
      ctx!.beginPath()
      ctx!.arc(cx, cy, R, 0, Math.PI * 2)
      ctx!.fill()

      // Surface dots. Near-face dots are brighter and larger; the far face is
      // kept as a faint haze so the sphere reads as glass, not a flat disc.
      for (const p of points) {
        const s = project(p, cx, cy, R)
        const near = (s.z + 1) / 2 // 0 (far) .. 1 (near)
        if (s.z > -0.2) {
          const size = 0.5 + near * 1.4
          const alpha = s.z > 0 ? 0.12 + near * 0.5 : 0.05
          ctx!.fillStyle = `rgba(255,255,255,${alpha})`
          ctx!.beginPath()
          ctx!.arc(s.x, s.y, size, 0, Math.PI * 2)
          ctx!.fill()
        }
      }

      // The silhouette rim, faintly lime, seals the edge of the ball.
      ctx!.strokeStyle = `rgba(${accent},0.18)`
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.arc(cx, cy, R, 0, Math.PI * 2)
      ctx!.stroke()

      // Pins for real places. Only the near-face ones light up; the label fades
      // with depth so it never floats over the back of the globe.
      const pulse = reduce ? 0 : (now % 2600) / 2600
      for (const pin of pins) {
        const s = project(pin.v, cx, cy, R)
        if (s.z <= 0) continue
        const near = s.z
        // Pulsing ring — expands and fades, held still under reduced motion.
        if (!reduce) {
          const rr = 4 + pulse * 16
          ctx!.strokeStyle = `rgba(${accent},${(1 - pulse) * 0.5 * near})`
          ctx!.lineWidth = 1.5
          ctx!.beginPath()
          ctx!.arc(s.x, s.y, rr, 0, Math.PI * 2)
          ctx!.stroke()
        }
        // The pin itself: a lime core with a soft halo.
        const halo = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9)
        halo.addColorStop(0, `rgba(${accent},${0.9 * near})`)
        halo.addColorStop(1, `rgba(${accent},0)`)
        ctx!.fillStyle = halo
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, 9, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.fillStyle = `rgba(${accent},${near})`
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, 2.6, 0, Math.PI * 2)
        ctx!.fill()
        // Label, riding to the right of the pin, fading as it turns away.
        if (pin.label) {
          ctx!.font = '600 12px Inter, ui-sans-serif, system-ui, sans-serif'
          ctx!.textBaseline = 'middle'
          ctx!.fillStyle = `rgba(255,255,255,${0.75 * near})`
          ctx!.fillText(pin.label, s.x + 12, s.y)
        }
      }
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

    let last = 0
    function frame(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      if (!dragging) {
        yaw += spin * dt + vyaw
        vyaw *= 0.92
        // Ease the pitch back toward its resting tilt after a drag.
        pitch += (basePitch - pitch) * 0.02
      }
      render(now)
      raf = requestAnimationFrame(frame)
    }

    function onDown(e: PointerEvent) {
      dragging = true
      vyaw = 0
      lastX = e.clientX
      lastY = e.clientY
      canvas!.setPointerCapture(e.pointerId)
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      yaw += dx * 0.006
      vyaw = dx * 0.006
      pitch = Math.max(-1.2, Math.min(1.2, pitch + dy * 0.006))
    }
    function onUp(e: PointerEvent) {
      dragging = false
      if (canvas!.hasPointerCapture(e.pointerId)) canvas!.releasePointerCapture(e.pointerId)
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      ro.disconnect()
    }
  }, [reduce, markers, dots, spin, accent])

  return (
    <canvas
      ref={ref}
      className={`h-full w-full touch-pan-y select-none ${reduce ? '' : 'cursor-grab active:cursor-grabbing'} ${className}`}
      aria-hidden="true"
    />
  )
}
