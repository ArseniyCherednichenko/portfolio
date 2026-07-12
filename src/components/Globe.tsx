import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

export interface GlobeMarker {
  /** Latitude in degrees, -90 (south) .. 90 (north). */
  lat: number
  /** Longitude in degrees, -180 .. 180 (east positive). */
  lon: number
  /** Small label drawn beside the marker when it faces the viewer. */
  label?: string
}

export interface GlobeProps {
  /** Radius fraction of the smaller container side. Default 0.42. */
  fill?: number
  /** Spin rate about the vertical axis, radians per second. Default 0.16. */
  spinSpeed?: number
  /** Points highlighted on the surface (default: Berlin). */
  markers?: readonly GlobeMarker[]
  /** Accent colour as an "r,g,b" string. Default lime. */
  accent?: string
  className?: string
}

const DEFAULT_MARKERS: GlobeMarker[] = [
  // Where Arseniy is. Honest single point, not a claim about anything else.
  { lat: 52.52, lon: 13.405, label: 'Berlin' },
]

/** Unit-sphere point for a latitude/longitude, with lon=0 facing the viewer (+z). */
function unit(latDeg: number, lonDeg: number): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180
  const lon = (lonDeg * Math.PI) / 180
  const cl = Math.cos(lat)
  return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)]
}

/**
 * A latitude/longitude grid of surface dots, spaced so each ring carries about
 * the same arc-length between points (count scales with cos(lat)), which reads
 * clearly as a sphere with visible bands rather than a flat scatter.
 */
function gridDots(): [number, number, number][] {
  const pts: [number, number, number][] = []
  const LAT_STEP = 12 // degrees between rings
  const BASE = 48 // dots around the equator
  for (let lat = -78; lat <= 78; lat += LAT_STEP) {
    const ring = Math.max(1, Math.round(BASE * Math.cos((lat * Math.PI) / 180)))
    for (let j = 0; j < ring; j++) {
      pts.push(unit(lat, -180 + (360 * j) / ring))
    }
  }
  // Cap the poles with a single dot each so the sphere closes.
  pts.push(unit(90, 0), unit(-90, 0))
  return pts
}

/**
 * Globe — a dotted world that turns on its own and can be grabbed and spun.
 * A kind of object the set was missing: not a canvas field, card, or text
 * effect, but a real sphere of surface dots, depth-shaded and projected each
 * frame, with location markers that light up as they rotate into view. It
 * drifts on a slow auto-spin; a pointer drag turns it 1:1 (horizontal spins,
 * vertical tilts within a clamp) and the release carries the throw as inertia
 * that eases back into the drift. One canvas, one RAF loop, no per-frame React
 * state; DPR-aware and ResizeObserver-driven. Under reduced motion it paints a
 * single still frame with the first marker facing the viewer — fully legible,
 * no loop or listeners.
 */
export function Globe({
  fill = 0.42,
  spinSpeed = 0.16,
  markers = DEFAULT_MARKERS,
  accent = '220,248,124',
  className = '',
}: GlobeProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const dots = gridDots()
    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let R = 0
    let raf = 0

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      cx = w / 2
      cy = h / 2
      R = Math.min(w, h) * fill
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Rotation state. `ry` spins about the vertical axis; `tilt` is the axial
    // lean (north pole toward the viewer for a three-quarter view).
    let ry = -0.5 // start so the first marker rotates into view shortly
    let tilt = -0.38
    const autoV = spinSpeed
    let vy = autoV // rad/sec about the vertical axis

    // Project a unit point through the current rotation. Returns screen x/y and
    // depth (z after rotation; > 0 faces the viewer).
    function project(p: readonly [number, number, number]) {
      const cosY = Math.cos(ry)
      const sinY = Math.sin(ry)
      const x1 = p[0] * cosY + p[2] * sinY
      const z1 = -p[0] * sinY + p[2] * cosY
      const y1 = p[1]
      const cosT = Math.cos(tilt)
      const sinT = Math.sin(tilt)
      const y2 = y1 * cosT - z1 * sinT
      const z2 = y1 * sinT + z1 * cosT
      return { x: cx + x1 * R, y: cy - y2 * R, z: z2 }
    }

    function render(t: number) {
      ctx!.clearRect(0, 0, w, h)

      // Soft inner glow so the sphere reads as a lit volume, not a flat disc.
      const glow = ctx!.createRadialGradient(cx, cy - R * 0.2, R * 0.1, cx, cy, R * 1.05)
      glow.addColorStop(0, `rgba(${accent},0.10)`)
      glow.addColorStop(0.6, 'rgba(255,255,255,0.02)')
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx!.fillStyle = glow
      ctx!.beginPath()
      ctx!.arc(cx, cy, R * 1.05, 0, Math.PI * 2)
      ctx!.fill()

      // Faint rim to close the silhouette.
      ctx!.beginPath()
      ctx!.arc(cx, cy, R, 0, Math.PI * 2)
      ctx!.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx!.lineWidth = 1
      ctx!.stroke()

      // Surface dots. Back-face dots stay faint (seen through the sphere) so the
      // near face reads sharp and bright.
      for (let i = 0; i < dots.length; i++) {
        const s = project(dots[i])
        const front = s.z > 0
        const d = (s.z + 1) / 2 // 0 (far) .. 1 (near)
        const r = 0.5 + d * 1.4
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx!.fillStyle = front
          ? `rgba(255,255,255,${(0.12 + d * 0.5).toFixed(3)})`
          : `rgba(255,255,255,${(0.04 + d * 0.05).toFixed(3)})`
        ctx!.fill()
      }

      // Markers, drawn last so they sit above the surface.
      for (const m of markers) {
        const s = project(unit(m.lat, m.lon))
        if (s.z <= -0.05) continue // hidden round the back
        const face = Math.max(0, s.z) // 0 at the limb .. 1 dead-centre
        const alpha = 0.35 + face * 0.65

        // Pulsing ring (a fixed ring under reduced motion).
        const pulse = reduce ? 0.5 : (Math.sin(t * 2.2) + 1) / 2
        const ringR = 4 + pulse * 7
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, ringR, 0, Math.PI * 2)
        ctx!.strokeStyle = `rgba(${accent},${(alpha * (1 - pulse * 0.7)).toFixed(3)})`
        ctx!.lineWidth = 1.2
        ctx!.stroke()

        // Glow + core dot.
        const halo = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9)
        halo.addColorStop(0, `rgba(${accent},${(alpha * 0.5).toFixed(3)})`)
        halo.addColorStop(1, `rgba(${accent},0)`)
        ctx!.fillStyle = halo
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, 9, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, 2.6, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${accent},${alpha.toFixed(3)})`
        ctx!.fill()

        // Label, only when the marker clearly faces the viewer.
        if (m.label && s.z > 0.25) {
          ctx!.font =
            '600 12px Inter, ui-sans-serif, system-ui, sans-serif'
          ctx!.textBaseline = 'middle'
          ctx!.fillStyle = `rgba(${accent},${Math.min(1, alpha + 0.1).toFixed(3)})`
          ctx!.fillText(m.label, s.x + 12, s.y)
        }
      }
    }

    resize()

    if (reduce) {
      // Turn the first marker to face the viewer, then hold still.
      ry = markers.length ? -(markers[0].lon * Math.PI) / 180 : 0
      render(0)
      const ro = new ResizeObserver(() => {
        resize()
        render(0)
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Drag to spin, release to fling.
    let dragging = false
    let lastX = 0
    let lastY = 0
    let pointerId: number | null = null

    function onDown(e: PointerEvent) {
      dragging = true
      pointerId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      canvas!.setPointerCapture(e.pointerId)
      canvas!.style.cursor = 'grabbing'
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      ry += dx * 0.006
      tilt = Math.max(-1.1, Math.min(1.1, tilt - dy * 0.005))
      vy = dx * 0.36 // carry the drag speed into the fling on release
    }
    function onUp() {
      if (!dragging) return
      dragging = false
      if (pointerId !== null && canvas!.hasPointerCapture(pointerId)) {
        canvas!.releasePointerCapture(pointerId)
      }
      pointerId = null
      canvas!.style.cursor = 'grab'
    }

    let prev = performance.now()
    function frame(now: number) {
      const dt = Math.min(0.05, (now - prev) / 1000)
      prev = now
      if (!dragging) {
        vy += (autoV - vy) * 0.04 // ease the fling back toward the drift
        ry += vy * dt
      }
      render(now / 1000)
      raf = requestAnimationFrame(frame)
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
  }, [reduce, fill, spinSpeed, markers, accent])

  const labels = markers.map((m) => m.label).filter(Boolean).join(', ')

  return (
    <canvas
      ref={ref}
      className={`h-full w-full touch-none select-none ${reduce ? '' : '[cursor:grab]'} ${className}`}
      role="img"
      aria-label={
        labels
          ? `A slowly rotating globe marking ${labels}.`
          : 'A slowly rotating globe of dots.'
      }
    />
  )
}

export default Globe
