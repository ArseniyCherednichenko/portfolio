import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A zoetrope (strictly, a phenakistoscope seen from above): the oldest moving
// picture there is, rebuilt as a working object. A disc carries a ring of drawn
// frames — here the twelve poses of a bouncing ball — and between the frames sit
// radial slits. Spin the disc and glance through the slit at the top and the eye
// stitches the passing frames into one animation: the ball appears to bounce in
// place. The whole trick is that motion on a screen is really a sequence of
// stills shown fast, which is exactly what this device makes visible.
//
// The single piece of state is the disc's ROTATION. The frame currently at the
// top window, and therefore the pose the viewer reconstructs, is derived from
// that rotation and nothing else — so the picture can never drift from where the
// disc actually is. Drag the disc to spin it (it coasts on momentum and slows
// under friction, like a real wheel), press Spin for a shove, or focus it and
// step one frame at a time with the arrow keys. Under prefers-reduced-motion
// there is no free coast: a drag tracks the finger and stops on release, and the
// buttons and arrows step frame by frame.

const N = 12 // frames around the disc — the twelve poses of one bounce cycle
const STEP = 360 / N // degrees between adjacent frames / slits
const CX = 180
const CY = 180
const RING_R = 126 // radius at which each frame's ground line sits
const OUTER_R = 168
const INNER_R = 58
const VIEW = 360

// The single frame of animation: a ball at pose `frame` of a one-bounce cycle,
// drawn upright with its ground line at local y = 0 and the ball rising above it.
// Both the disc cells and the big viewer use this same function, so what you see
// through the slit is provably the same drawing that rides the disc.
function ballPose(frame: number, r: number, rise: number) {
  const phase = frame / N // 0 at ground, 0.5 at the apex, back to ground at 1
  const h = Math.sin(Math.PI * phase) // height 0..1: ground contact only at frame 0
  const ry = r * (1 - 0.36 * (1 - h)) // squash flat on contact, round at the apex
  const rx = (r * r) / ry // keep the area roughly constant, so squash reads as squash
  const cy = -(ry + h * rise) // centre above the ground by its own radius plus the rise
  return { rx, ry, cy, h }
}

function Ball({ frame, r, rise }: { frame: number; r: number; rise: number }) {
  const { rx, ry, cy, h } = ballPose(frame, r, rise)
  return (
    <g>
      {/* the ground the ball bounces on */}
      <line x1={-r * 1.6} x2={r * 1.6} y1={0} y2={0} stroke="rgba(255,255,255,0.28)" strokeWidth={1.5} />
      {/* a shadow that tightens as the ball nears the ground */}
      <ellipse
        cx={0}
        cy={-1.5}
        rx={r * (1.1 - 0.5 * h)}
        ry={2.4 * (1.1 - 0.5 * h)}
        fill="rgba(0,0,0,0.35)"
      />
      <ellipse cx={0} cy={cy} rx={rx} ry={ry} fill="#DCF87C" />
      {/* a small highlight so the ball has a little form */}
      <ellipse cx={-rx * 0.32} cy={cy - ry * 0.34} rx={rx * 0.26} ry={ry * 0.26} fill="rgba(255,255,255,0.5)" />
    </g>
  )
}

const norm360 = (d: number) => ((d % 360) + 360) % 360
// shortest signed difference b - a wrapped to (-180, 180]
const shortest = (a: number, b: number) => (((b - a) % 360) + 540) % 360 - 180

/**
 * A working zoetrope. The disc's rotation is the only state; the frame at the top
 * window (and thus the reconstructed animation) is derived from it. Drag to spin
 * with real momentum and friction, press Spin for a shove, or arrow-key one frame
 * at a time. Reduced motion removes the coast and keeps only frame-by-frame steps.
 */
export function Zoetrope({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [angle, setAngle] = useState(0) // degrees; grows unbounded, normalised for display
  const [masked, setMasked] = useState(false) // "look through the slit" overlay

  // Refs driving the drag + coast without re-rendering on every intermediate.
  const dragging = useRef(false)
  const grabPointer = useRef(0) // pointer angle at grab (deg)
  const grabAngle = useRef(0) // disc angle at grab (deg)
  const vel = useRef(0) // deg per second, for the coast
  const lastMoveT = useRef(0)
  const lastMoveA = useRef(0)
  const raf = useRef<number | null>(null)
  const lastFrameT = useRef(0)

  // The frame sitting in the top window: the disc is rotated by `angle`, frame i
  // starts at i*STEP, so frame i is at the top when angle + i*STEP ≡ 0 (mod 360).
  const frameIndex = ((Math.round(-angle / STEP) % N) + N) % N

  const stopCoast = useCallback(() => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
    vel.current = 0
  }, [])

  // The momentum coast: advance the angle by the velocity and bleed the velocity
  // off exponentially, the way a spun wheel loses speed to friction.
  const startCoast = useCallback(() => {
    if (reduce) return
    if (raf.current != null) return
    lastFrameT.current = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameT.current) / 1000)
      lastFrameT.current = now
      vel.current *= Math.exp(-1.6 * dt) // lose ~80% of the speed each second
      setAngle((a) => a + vel.current * dt)
      if (Math.abs(vel.current) < 6) {
        raf.current = null
        vel.current = 0
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [reduce])

  const pointerAngle = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      stopCoast()
      dragging.current = true
      grabPointer.current = pointerAngle(e.clientX, e.clientY)
      grabAngle.current = angle
      lastMoveT.current = performance.now()
      lastMoveA.current = angle
    },
    [angle, pointerAngle, stopCoast],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const p = pointerAngle(e.clientX, e.clientY)
      const next = grabAngle.current + shortest(grabPointer.current, p)
      // estimate angular velocity from how far we moved since the last sample
      const now = performance.now()
      const dt = (now - lastMoveT.current) / 1000
      if (dt > 0) {
        const inst = (next - lastMoveA.current) / dt
        // light smoothing so a single jittery sample can't fling it
        vel.current = vel.current * 0.4 + inst * 0.6
        lastMoveT.current = now
        lastMoveA.current = next
      }
      setAngle(next)
    },
    [pointerAngle],
  )

  const endDrag = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    // clamp the fling so it can't spin absurdly fast, then let it coast
    vel.current = Math.max(-1400, Math.min(1400, vel.current))
    if (!reduce && Math.abs(vel.current) > 30) startCoast()
    else vel.current = 0
  }, [reduce, startCoast])

  // Snap to the nearest frame, then move one frame either way. Advancing a frame
  // means the disc turns back by one STEP (see frameIndex), so ArrowRight/Up move
  // the animation forward. Keyboard steps are always discrete — no coast.
  const stepFrame = useCallback(
    (dir: number) => {
      stopCoast()
      dragging.current = false
      setAngle((a) => {
        const snapped = Math.round(a / STEP) * STEP
        return snapped - dir * STEP
      })
    },
    [stopCoast],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        stepFrame(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        stepFrame(-1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        stopCoast()
        setAngle(0)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        stopCoast()
        if (reduce) stepFrame(1)
        else {
          vel.current = 900
          startCoast()
        }
      }
    },
    [reduce, startCoast, stepFrame, stopCoast],
  )

  const spin = useCallback(() => {
    stopCoast()
    if (reduce) {
      stepFrame(1)
      return
    }
    vel.current = 900
    startCoast()
  }, [reduce, startCoast, stepFrame, stopCoast])

  useEffect(() => () => stopCoast(), [stopCoast])

  const discDeg = norm360(angle)

  return (
    <div className={`flex w-full flex-col items-center ${className}`}>
      {/* The viewer: the single pose the slit reveals right now, shown large. As
          the disc spins this cycles through the twelve frames — the reconstructed
          animation, drawn with the exact same function the disc cells use. */}
      <div className="flex flex-col items-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
          Through the slit
        </span>
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 px-10 pb-5 pt-8">
          <svg viewBox="-60 -96 120 116" className="h-28 w-28" aria-hidden="true">
            <Ball frame={frameIndex} r={18} rise={64} />
          </svg>
        </div>
        <span className="mt-2 text-sm tabular-nums text-white/45" aria-hidden="true">
          frame {frameIndex + 1} / {N}
        </span>
      </div>

      {/* The disc itself — the object you spin. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={1}
        aria-valuemax={N}
        aria-valuenow={frameIndex + 1}
        aria-valuetext={`frame ${frameIndex + 1} of ${N}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="mt-6 w-full max-w-[380px] touch-none select-none outline-none [&:focus-visible_.zoe-rim]:stroke-[#DCF87C]/70"
        style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      >
        <title id={labelId}>
          Zoetrope showing frame {frameIndex + 1} of {N}. Drag the disc to spin it, or use the arrow
          keys to step one frame at a time.
        </title>

        <defs>
          {/* aperture mask for the "look through the slit" mode: a single lit wedge
              at the top over an otherwise darkened disc */}
          <mask id={`${labelId}-ap`}>
            <rect x={0} y={0} width={VIEW} height={VIEW} fill="black" />
            <path
              d={describeWedge(CX, CY, INNER_R - 4, OUTER_R + 6, -90 - STEP / 2, -90 + STEP / 2)}
              fill="white"
            />
          </mask>
        </defs>

        {/* fixed backing disc */}
        <circle cx={CX} cy={CY} r={OUTER_R} fill="rgba(255,255,255,0.03)" />
        <circle
          className="zoe-rim"
          cx={CX}
          cy={CY}
          r={OUTER_R}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={1.5}
        />

        {/* the rotating disc: frames + slits, turned by the current angle */}
        <g transform={`rotate(${discDeg} ${CX} ${CY})`}>
          {/* radial slits, one between each pair of frames */}
          {Array.from({ length: N }, (_, i) => {
            const a = ((i + 0.5) * STEP - 90) * (Math.PI / 180)
            const x1 = CX + Math.cos(a) * (INNER_R + 6)
            const y1 = CY + Math.sin(a) * (INNER_R + 6)
            const x2 = CX + Math.cos(a) * (OUTER_R - 4)
            const y2 = CY + Math.sin(a) * (OUTER_R - 4)
            return (
              <line
                key={`slit${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={5}
                strokeLinecap="round"
              />
            )
          })}
          {/* the twelve frames, each drawn upright at its slot so it stands upright
              when it reaches the top window */}
          {Array.from({ length: N }, (_, i) => (
            <g key={`cell${i}`} transform={`rotate(${i * STEP} ${CX} ${CY}) translate(${CX} ${CY - RING_R})`}>
              <Ball frame={i} r={9} rise={30} />
            </g>
          ))}
          <circle cx={CX} cy={CY} r={INNER_R} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
        </g>

        {/* the darkening overlay for slit mode, cut by the aperture mask */}
        {masked && (
          <g mask={`url(#${labelId}-ap)`}>
            <circle cx={CX} cy={CY} r={OUTER_R} fill="rgba(0,0,0,0.82)" />
          </g>
        )}

        {/* the fixed reading window marker at the top — the eye's viewpoint */}
        <path
          d={`M ${CX - 9} 8 L ${CX + 9} 8 L ${CX} 22 Z`}
          fill="#DCF87C"
        />
        <text x={CX} y={CY + 5} textAnchor="middle" className="fill-white/30" style={{ fontSize: 11, letterSpacing: 2 }}>
          {Math.round(discDeg)}&deg;
        </text>
      </svg>

      {/* controls */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={spin}
          className="rounded-full bg-[#DCF87C] px-5 py-2 text-sm font-semibold text-black transition-transform active:scale-[0.97]"
        >
          {reduce ? 'Next frame' : 'Spin'}
        </button>
        <button
          type="button"
          onClick={() => setMasked((m) => !m)}
          aria-pressed={masked}
          className={`rounded-full border px-5 py-2 text-sm font-semibold transition-colors ${
            masked
              ? 'border-[#DCF87C]/50 text-[#DCF87C]'
              : 'border-white/15 text-white/70 hover:border-[#DCF87C]/50 hover:text-[#DCF87C]'
          }`}
        >
          {masked ? 'Open the disc' : 'Look through the slit'}
        </button>
      </div>

      <span aria-live="polite" className="sr-only">
        frame {frameIndex + 1} of {N}
      </span>
    </div>
  )
}

// Build a filled wedge (annular sector) path between two radii and two angles.
function describeWedge(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  a0Deg: number,
  a1Deg: number,
) {
  const a0 = (a0Deg * Math.PI) / 180
  const a1 = (a1Deg * Math.PI) / 180
  const p = (r: number, a: number) => `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`
  const large = Math.abs(a1Deg - a0Deg) > 180 ? 1 : 0
  return [
    `M ${p(rIn, a0)}`,
    `L ${p(rOut, a0)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${p(rOut, a1)}`,
    `L ${p(rIn, a1)}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${p(rIn, a0)}`,
    'Z',
  ].join(' ')
}

export default Zoetrope
