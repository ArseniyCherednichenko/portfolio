import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// Euler's disk — a spinning coin settling on a table, and the one toy in this
// corner whose whole drama is a *singularity*. Set a coin spinning on its edge
// and it does something that looks, the first time, like a mistake: as it loses
// energy it leans flatter and flatter, yet the point where its rim touches the
// table races around *faster and faster*, the hum rising to a whirr, until in a
// last blur it slaps flat and stops dead. The spin slows to nothing while the
// roll runs away to infinity. That is the real thing — a toy sold as "Euler's
// disk" — and the mathematics behind the rush is genuinely delicate.
//
// The honest picture: the disk is a circle tilted from the table by an
// inclination angle a (a = 90 degrees is a coin stood on its edge, a = 0 is a
// coin lying flat). Its centre rides at height R*sin(a); the point of contact
// is the lowest point of the rim, sitting on the table at radius R*cos(a) from
// below the centre, and that contact point precesses around at a rate that the
// physics sends to infinity as the disk goes flat — the contact angular speed
// grows like 1/sqrt(a). So two clocks run at once and in opposite directions:
// the lean a bleeds away toward zero, and the precession rate it drives climbs
// without bound. This piece integrates both: the lean decays as da/dt is
// proportional to -1/sqrt(a) (a finite-time collapse, slow then suddenly very
// fast), and the contact precession advances at OMEGA proportional to
// 1/sqrt(a), so the moment the disk visibly flattens is exactly the moment the
// bright contact point blurs into a ring. Then it lands flat, holds a beat, and
// re-releases to spin again.
//
// It is drawn in true perspective, not faked with a flat ellipse. The disk is a
// real circle of rim points in 3-D (centre at height R*sin(a), normal leaning
// at azimuth psi), projected to the screen through one orthographic camera
// pitched down over the table, so the coin's outline is the honest projection
// of a tilted circle and the contact point is wherever the rim projection dips
// to the table line. The coin has thickness — a milled edge of shaded quads —
// and a brushed-metal face with a specular glint, and it throws a soft contact
// shadow that spreads as it lies down. One canvas, one fixed-timestep loop
// (1/240 s substeps off an accumulator, so it reads the same on any monitor and
// time is the rAF delta alone, never Date.now), DPR-aware and cleaned up on
// unmount, off the React render path. The release sequence is a seeded
// mulberry32, so the same coins spin the same way every load and it never
// touches Math.random on the hot path. Press anywhere to release a fresh spin.
//
// Under prefers-reduced-motion the loop never starts: one coin is laid down
// mid-lean, still, with its shadow and a faint hint of the contact ring, and
// held. The canvas is decorative, so it is aria-hidden; the controls that carry
// meaning live as real text and buttons in the Playground frame around it.

const TAU = Math.PI * 2
const STEP = 1 / 240 // fixed integration substep, seconds
const MAX_SUB = 10 // cap substeps per frame (no spiral of death)

// Inclination bounds, radians. A_MAX is a coin leaning well over (~54 deg from
// flat); A_MIN is the near-flat angle at which we call it landed and let the
// final slap carry it the rest of the way down.
const A_MAX = 0.95
const A_MIN = 0.03

// da/dt = -A_DECAY / sqrt(a): the lean bleeds off, slow while the coin stands,
// then diverging as it goes flat — the finite-time collapse that makes the
// ending a rush rather than a fade. Tuned for a spin of roughly nine seconds.
const A_DECAY = 0.07

// OMEGA = PREC / sqrt(a): the contact point's precession rate, climbing without
// bound as the lean goes to zero — the half of the physics you can hear.
const PREC = 1.9

// Phase timings, seconds.
const LAND_TIME = 0.3 // the final slap flat
const REST_TIME = 1.15 // held flat before the next release

const R = 1 // disk radius, unit world space (mapped to pixels at draw time)
const THICK = 0.055 // coin thickness, same units
const RIM_N = 72 // rim points — the disk outline is this many projected samples

// Camera: pitched down over the table by this angle, orthographic. sin/cos
// precomputed. A point (x, y, z) with z up and +y toward the viewer projects to
// screenX = cx + scale*x, screenY = cy + scale*(y*SINB - z*COSB).
const BETA = 1.02 // ~58 degrees down
const SINB = Math.sin(BETA)
const COSB = Math.cos(BETA)

// Light for the metal: from the upper-left-front, normalised.
const LX = -0.42
const LY = -0.22
const LZ = 0.88

// A seeded mulberry32 → the release sequence, so the show is identical per load
// and nothing on the hot path reaches for Math.random.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function EulerDisk({ className = '', accent = '#DCF87C' }: { className?: string; accent?: string }) {
  const reduce = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ar = parseInt(accent.slice(1, 3), 16)
    const ag = parseInt(accent.slice(3, 5), 16)
    const ab = parseInt(accent.slice(5, 7), 16)

    let w = 0
    let h = 0
    let cx = 0
    let cy = 0
    let scale = 1
    let dpr = 1

    // Spin state.
    let a = A_MAX // inclination (lean from flat)
    let psi = 0 // precession azimuth of the contact point
    let phase: 'spin' | 'land' | 'rest' = 'spin'
    let phaseT = 0
    let acc = 0
    const rng = mulberry32(0x5eed1e)
    // The fading track of recent contact points on the table — the ring the
    // racing contact point scribes as it goes flat.
    const track: { x: number; y: number; age: number }[] = []

    function release() {
      a = A_MAX * (0.9 + rng() * 0.12)
      psi = rng() * TAU
      phase = 'spin'
      phaseT = 0
      track.length = 0
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.round(w * dpr)
      canvas!.height = Math.round(h * dpr)
      canvas!.style.width = `${w}px`
      canvas!.style.height = `${h}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = w / 2
      cy = h * 0.58 // the table sits a touch below centre; headroom above
      scale = Math.min(w, h) * 0.3
    }

    // World (x right, y toward viewer, z up) → screen pixels.
    function sx(x: number): number {
      return cx + x * scale
    }
    function sy(y: number, z: number): number {
      return cy + (y * SINB - z * COSB) * scale
    }

    // The two in-plane basis vectors for a disk whose normal leans at angle `a`
    // from flat (so the normal is tilted a*... ) with azimuth `psi`. Derived so
    // that the lowest rim point (the contact) always sits exactly on z = 0.
    // u is the horizontal line of nodes; v carries the slope.
    function basis(aa: number, pp: number) {
      const sa = Math.sin(aa)
      const ca = Math.cos(aa)
      const sp = Math.sin(pp)
      const cp = Math.cos(pp)
      // u = (sin psi, -cos psi, 0); v = (cos a*cos psi, cos a*sin psi, -sin a)
      return {
        ux: sp,
        uy: -cp,
        uz: 0,
        vx: ca * cp,
        vy: ca * sp,
        vz: -sa,
        czh: R * sa, // centre height = R sin a
      }
    }

    // Contact point on the table (z = 0) for the current lean and azimuth.
    function contact(aa: number, pp: number): { x: number; y: number } {
      const ca = Math.cos(aa)
      return { x: R * ca * Math.cos(pp), y: R * ca * Math.sin(pp) }
    }

    function drawTable() {
      // A soft pool of light giving the coin a surface to stand on.
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, scale * 2.1)
      g.addColorStop(0, 'rgba(255,255,255,0.05)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.018)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx!.save()
      ctx!.translate(cx, cy)
      ctx!.scale(1, SINB)
      ctx!.translate(-cx, -cy)
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(cx, cy, scale * 2.1, 0, TAU)
      ctx!.fill()
      ctx!.restore()
    }

    function drawShadow(aa: number) {
      // The contact shadow spreads and softens as the coin lies down.
      const flat = 1 - Math.min(1, aa / A_MAX) // 0 standing → 1 flat
      const rad = scale * (0.5 + flat * 0.7)
      const alpha = 0.26 + flat * 0.1
      ctx!.save()
      ctx!.translate(cx, cy + scale * 0.02)
      ctx!.scale(1, SINB)
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, rad)
      g.addColorStop(0, `rgba(0,0,0,${alpha})`)
      g.addColorStop(0.7, `rgba(0,0,0,${alpha * 0.5})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx!.translate(-cx, -cy)
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(cx, cy, rad, 0, TAU)
      ctx!.fill()
      ctx!.restore()
    }

    function drawTrack() {
      if (track.length < 2) return
      ctx!.lineCap = 'round'
      for (let i = 1; i < track.length; i++) {
        const p0 = track[i - 1]
        const p1 = track[i]
        const t = 1 - p1.age // 1 newest → 0 oldest
        if (t <= 0) continue
        ctx!.strokeStyle = `rgba(${ar},${ag},${ab},${(t * t * 0.5).toFixed(3)})`
        ctx!.lineWidth = 0.8 + t * 2.4
        ctx!.beginPath()
        ctx!.moveTo(sx(p0.x), sy(p0.y, 0))
        ctx!.lineTo(sx(p1.x), sy(p1.y, 0))
        ctx!.stroke()
      }
    }

    // Draw the coin at lean `aa`, azimuth `pp`. Returns nothing; paints the back
    // face, the milled edge, the top face with a glint, and the lit contact.
    function drawDisk(aa: number, pp: number) {
      const b = basis(aa, pp)
      // Precompute the two rims (top face at +THICK/2 along n, bottom at -THICK/2).
      // n = u x v, but we only need its z-sign for the offset; build offset along
      // the true normal via the cross product of u and v.
      const nx = b.uy * b.vz - b.uz * b.vy
      const ny = b.uz * b.vx - b.ux * b.vz
      const nz = b.ux * b.vy - b.uy * b.vx
      const ht = THICK / 2
      type P = { x: number; y: number; z: number; sxv: number; syv: number; lit: number }
      const top: P[] = []
      const bot: P[] = []
      for (let i = 0; i < RIM_N; i++) {
        const s = (i / RIM_N) * TAU
        const cs = Math.cos(s)
        const sn = Math.sin(s)
        // Rim direction in the plane (outward normal of the edge at this point).
        const rx = cs * b.ux + sn * b.vx
        const ry = cs * b.uy + sn * b.vy
        const rz = cs * b.uz + sn * b.vz
        const lit = Math.max(0.06, rx * LX + ry * LY + rz * LZ)
        const baseX = R * rx
        const baseY = R * ry
        const baseZ = b.czh + R * rz
        const tx = baseX + nx * ht
        const ty = baseY + ny * ht
        const tz = baseZ + nz * ht
        const bx = baseX - nx * ht
        const by = baseY - ny * ht
        const bz = baseZ - nz * ht
        top.push({ x: tx, y: ty, z: tz, sxv: sx(tx), syv: sy(ty, tz), lit })
        bot.push({ x: bx, y: by, z: bz, sxv: sx(bx), syv: sy(by, bz), lit })
      }

      // Face-normal lighting for the flat top (how lit the whole face reads).
      const faceLit = Math.max(0.12, Math.abs(nx * LX + ny * LY + nz * LZ))

      // Bottom (far) face — a dark disc, drawn first so the body sits over it.
      ctx!.beginPath()
      for (let i = 0; i < RIM_N; i++) {
        const p = bot[i]
        if (i === 0) ctx!.moveTo(p.sxv, p.syv)
        else ctx!.lineTo(p.sxv, p.syv)
      }
      ctx!.closePath()
      ctx!.fillStyle = 'rgba(14,16,20,0.95)'
      ctx!.fill()

      // Milled edge — a quad per rim segment, shaded by how the edge faces the
      // light, so the band reads as a turned metal rim catching the room.
      for (let i = 0; i < RIM_N; i++) {
        const j = (i + 1) % RIM_N
        const t0 = top[i]
        const t1 = top[j]
        const b1 = bot[j]
        const b0 = bot[i]
        const lit = (t0.lit + t1.lit) / 2
        const v = Math.round(46 + lit * 150)
        ctx!.fillStyle = `rgb(${v},${v + 4},${Math.round(v * 1.04)})`
        ctx!.beginPath()
        ctx!.moveTo(t0.sxv, t0.syv)
        ctx!.lineTo(t1.sxv, t1.syv)
        ctx!.lineTo(b1.sxv, b1.syv)
        ctx!.lineTo(b0.sxv, b0.syv)
        ctx!.closePath()
        ctx!.fill()
      }

      // Top (near) face — brushed metal with a specular glint, drawn last so it
      // caps the edge. Build the path, then shade it within a clip.
      ctx!.beginPath()
      for (let i = 0; i < RIM_N; i++) {
        const p = top[i]
        if (i === 0) ctx!.moveTo(p.sxv, p.syv)
        else ctx!.lineTo(p.sxv, p.syv)
      }
      ctx!.closePath()
      const base = Math.round(70 + faceLit * 90)
      ctx!.fillStyle = `rgb(${base},${base + 5},${base + 12})`
      ctx!.fill()

      ctx!.save()
      ctx!.clip()
      // The face centre in screen space, and a glint offset toward the light.
      const ccx = sx(0 + nx * ht)
      const ccy = sy(0 + ny * ht, b.czh + nz * ht)
      const gl = ctx!.createRadialGradient(
        ccx - scale * 0.22,
        ccy - scale * 0.26,
        0,
        ccx - scale * 0.22,
        ccy - scale * 0.26,
        scale * 1.1,
      )
      gl.addColorStop(0, `rgba(255,255,255,${(0.28 * faceLit).toFixed(3)})`)
      gl.addColorStop(0.35, 'rgba(255,255,255,0.06)')
      gl.addColorStop(1, 'rgba(255,255,255,0)')
      ctx!.fillStyle = gl
      ctx!.fillRect(0, 0, w, h)
      // A faint engraved inner ring, for coin-ness.
      ctx!.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx!.lineWidth = 1
      ctx!.beginPath()
      for (let i = 0; i < RIM_N; i++) {
        const p = top[i]
        const ix = ccx + (p.sxv - ccx) * 0.82
        const iy = ccy + (p.syv - ccy) * 0.82
        if (i === 0) ctx!.moveTo(ix, iy)
        else ctx!.lineTo(ix, iy)
      }
      ctx!.closePath()
      ctx!.stroke()
      // A whisper of the accent where the light grazes the near rim.
      ctx!.strokeStyle = `rgba(${ar},${ag},${ab},${(0.22 * faceLit).toFixed(3)})`
      ctx!.lineWidth = 1.5
      ctx!.stroke()
      ctx!.restore()

      // The lit contact point — the bright bead racing the rim round the table.
      const cpt = contact(aa, pp)
      const kx = sx(cpt.x)
      const ky = sy(cpt.y, 0)
      const glow = ctx!.createRadialGradient(kx, ky, 0, kx, ky, scale * 0.16)
      glow.addColorStop(0, `rgba(${ar},${ag},${ab},0.9)`)
      glow.addColorStop(1, `rgba(${ar},${ag},${ab},0)`)
      ctx!.fillStyle = glow
      ctx!.beginPath()
      ctx!.arc(kx, ky, scale * 0.16, 0, TAU)
      ctx!.fill()
      ctx!.fillStyle = '#ffffff'
      ctx!.beginPath()
      ctx!.arc(kx, ky, Math.max(1.6, scale * 0.016), 0, TAU)
      ctx!.fill()
    }

    function render(aa: number, pp: number) {
      ctx!.clearRect(0, 0, w, h)
      drawTable()
      drawShadow(aa)
      drawTrack()
      drawDisk(aa, pp)
    }

    // One fixed substep of the two-clock dynamics.
    function substep() {
      if (phase === 'spin') {
        const omega = PREC / Math.sqrt(a)
        psi += omega * STEP
        if (psi > TAU) psi -= TAU
        a -= (A_DECAY / Math.sqrt(a)) * STEP
        const cpt = contact(a, psi)
        track.push({ x: cpt.x, y: cpt.y, age: 0 })
        if (track.length > 240) track.shift()
        if (a <= A_MIN) {
          a = A_MIN
          phase = 'land'
          phaseT = 0
        }
      } else if (phase === 'land') {
        phaseT += STEP
        const p = Math.min(1, phaseT / LAND_TIME)
        const ease = p * p * (3 - 2 * p)
        a = A_MIN * (1 - ease)
        // The precession winds down to a stop as it slaps flat.
        const omega = (PREC / Math.sqrt(Math.max(A_MIN, a))) * (1 - ease)
        psi += omega * STEP
        if (p >= 1) {
          a = 0
          phase = 'rest'
          phaseT = 0
        }
      } else {
        phaseT += STEP
        if (phaseT >= REST_TIME) release()
      }
      // Age the track so it fades whatever the phase.
      for (let i = 0; i < track.length; i++) track[i].age += STEP * 1.1
      while (track.length && track[0].age >= 1) track.shift()
    }

    let raf = 0
    let last = 0
    function frame(now: number) {
      if (!last) last = now
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05
      acc += dt
      let n = 0
      while (acc >= STEP && n < MAX_SUB) {
        substep()
        acc -= STEP
        n++
      }
      if (acc > STEP) acc = 0
      render(a, psi)
      raf = requestAnimationFrame(frame)
    }

    // The reduced-motion still: a coin held mid-lean with its shadow and a faint
    // arc of the contact ring, laid down once and never animated.
    function drawStill() {
      const aa = 0.62
      const pp = -0.7
      track.length = 0
      // A short seeded arc of contact points, so the ring hint reads without a
      // loop ever having run.
      for (let i = 0; i < 46; i++) {
        const t = i / 46
        const cpt = contact(aa + (1 - t) * 0.25, pp - t * 2.4)
        track.push({ x: cpt.x, y: cpt.y, age: 1 - t * 0.8 })
      }
      render(aa, pp)
    }

    const ro = new ResizeObserver(() => {
      resize()
      if (reduce) drawStill()
    })
    ro.observe(wrap)
    resize()

    function onPointer() {
      if (reduce) return
      release()
      acc = 0
    }

    if (reduce) {
      drawStill()
    } else {
      release()
      canvas.addEventListener('pointerdown', onPointer)
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointer)
    }
  }, [reduce, accent])

  return (
    <div ref={wrapRef} className={`relative ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  )
}
