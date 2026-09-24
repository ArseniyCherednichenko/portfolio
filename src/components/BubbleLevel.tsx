import { animate, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// The most tilt the tool reports, in degrees. Past this the bubble is pinned to
// the high end — a real vial runs out of travel too.
const MAX_TILT = 12
// Below this the tool reads as level: the bubble sits between the gauge lines
// and the vial locks to lime. A hair of slack, like a real level's tolerance.
const LEVEL_EPS = 0.35
// How far a horizontal drag turns the tool. Degrees per pixel — unhurried, so
// fine adjustments near level are possible with a small hand movement.
const DEG_PER_PX = 0.05
// Half the bubble's travel inside the vial, in the SVG's user units.
const TRAVEL = 26

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * A spirit level, rebuilt as a tactile instrument rather than a graphic. Drag
 * the body to tilt it (or focus it and nudge with the arrow keys); the tool
 * rotates rigidly under your hand while the bubble inside the glass vial lags
 * behind on a spring, sliding toward the high end exactly as trapped air would.
 * Bring it within a fraction of a degree of flat and the vial locks to lime,
 * the bubble settling dead-centre between the two gauge lines, and a live region
 * announces "Level". A digital readout shows the pitch to a tenth of a degree
 * and which side is low.
 *
 * The body's rotation tracks the pointer one-to-one — an instrument you are
 * holding should not feel elastic — so only the bubble carries the liquid lag,
 * and only the "Level it" reset and keyboard leveling ease the body home with a
 * short spring settle. Under prefers-reduced-motion the bubble and the reset
 * both cut straight to their exact positions with no travel, the reading still
 * perfectly true.
 */
export function BubbleLevel({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [tilt, setTilt] = useState(0)

  // Pointer drag: capture the start point and the tilt we started from, then map
  // horizontal movement onto degrees. A ref, not state, so the move handler
  // never restarts the gesture.
  const drag = useRef<{ id: number; x: number; from: number } | null>(null)
  // Any in-flight leveling animation, so a fresh interaction can interrupt it.
  const settling = useRef<ReturnType<typeof animate> | null>(null)
  const stopSettle = () => {
    settling.current?.stop()
    settling.current = null
  }
  useEffect(() => () => stopSettle(), [])

  const setTiltClamped = useCallback((v: number) => {
    setTilt(clamp(v, -MAX_TILT, MAX_TILT))
  }, [])

  // Ease the tool back to flat. A spring gives the bubble a moment to overshoot
  // and settle — the way air does when a surface drops level. Reduced motion
  // just lands it.
  const levelOut = useCallback(() => {
    stopSettle()
    if (reduce) {
      setTilt(0)
      return
    }
    settling.current = animate(tilt, 0, {
      type: 'spring',
      stiffness: 140,
      damping: 13,
      onUpdate: (v) => setTilt(v),
    })
  }, [reduce, tilt])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return
    stopSettle()
    drag.current = { id: e.pointerId, x: e.clientX, from: tilt }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    setTiltClamped(d.from + (e.clientX - d.x) * DEG_PER_PX)
  }
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    let handled = true
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setTiltClamped(tilt - (e.shiftKey ? 1 : 0.2))
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setTiltClamped(tilt + (e.shiftKey ? 1 : 0.2))
    else if (e.key === 'Home' || e.key === 'Enter' || e.key === ' ') levelOut()
    else if (e.key === 'End') setTilt(MAX_TILT)
    else handled = false
    if (handled) {
      e.preventDefault()
      if (e.key !== 'Home' && e.key !== 'Enter' && e.key !== ' ') stopSettle()
    }
  }

  const isLevel = Math.abs(tilt) <= LEVEL_EPS
  // Bubble rides to the HIGH side: tilt the right side down (positive) and the
  // air climbs left. Fraction of travel scales with the sine so it eases toward
  // the ends the way a curved vial reads.
  const frac = clamp(Math.sin((tilt * Math.PI) / 180) / Math.sin((MAX_TILT * Math.PI) / 180), -1, 1)
  const bubbleX = -frac * TRAVEL

  const side = isLevel ? 'level' : tilt > 0 ? 'right side low' : 'left side low'
  const reading = isLevel ? 'Level' : `${Math.abs(tilt).toFixed(1)}° ${tilt > 0 ? 'right' : 'left'}`
  const bubbleSpring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 170, damping: 15, mass: 0.9 }

  const vialStroke = isLevel ? '#DCF87C' : 'rgba(255,255,255,0.16)'
  const bubbleFill = isLevel ? '#DCF87C' : '#8fe3c4'

  return (
    <div className={`flex w-full max-w-sm flex-col items-center ${className}`}>
      <div
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={-MAX_TILT}
        aria-valuemax={MAX_TILT}
        aria-valuenow={Math.round(tilt * 10) / 10}
        aria-valuetext={isLevel ? 'Level' : `${Math.abs(tilt).toFixed(1)} degrees, ${side}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
        style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
      >
        <span id={labelId} className="sr-only">
          Spirit level. Drag to tilt, arrow keys to nudge, Home to level.
        </span>
        <motion.svg
          viewBox="0 0 260 96"
          className="h-auto w-full drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          // The body follows the pointer rigidly — no spring on the frame.
          style={{ rotate: tilt }}
          aria-hidden
        >
          <defs>
            <linearGradient id="lvl-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2b2f24" />
              <stop offset="0.5" stopColor="#20241b" />
              <stop offset="1" stopColor="#171a13" />
            </linearGradient>
            <linearGradient id="lvl-vial" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="1" stopColor="rgba(0,0,0,0.35)" />
            </linearGradient>
            <radialGradient id="lvl-bubble" cx="0.38" cy="0.34" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="0.35" stopColor={bubbleFill} stopOpacity="0.95" />
              <stop offset="1" stopColor={bubbleFill} stopOpacity="0.7" />
            </radialGradient>
          </defs>

          {/* Milled aluminium body */}
          <rect x="4" y="18" width="252" height="60" rx="12" fill="url(#lvl-body)" stroke="rgba(255,255,255,0.08)" />
          {/* Machined end caps */}
          <rect x="10" y="24" width="10" height="48" rx="4" fill="rgba(255,255,255,0.05)" />
          <rect x="240" y="24" width="10" height="48" rx="4" fill="rgba(255,255,255,0.05)" />

          {/* Glass vial */}
          <rect x="70" y="34" width="120" height="28" rx="14" fill="url(#lvl-vial)" stroke={vialStroke} strokeWidth="1.5" />
          {/* Centre gauge lines */}
          <line x1="118" y1="34" x2="118" y2="62" stroke={vialStroke} strokeWidth="1.5" />
          <line x1="142" y1="34" x2="142" y2="62" stroke={vialStroke} strokeWidth="1.5" />

          {/* The bubble — lags the tool on a spring, glowing when centred */}
          <motion.g animate={{ x: bubbleX }} transition={bubbleSpring}>
            <circle cx="130" cy="48" r="11" fill="url(#lvl-bubble)" />
            <ellipse cx="126" cy="44" rx="4" ry="2.4" fill="#ffffff" opacity="0.75" />
          </motion.g>
        </motion.svg>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div
          className={`min-w-[104px] rounded-lg border px-3 py-2 text-center font-mono text-sm tabular-nums transition-colors ${
            isLevel
              ? 'border-[#DCF87C]/40 bg-[#DCF87C]/10 text-[#DCF87C]'
              : 'border-white/10 bg-white/[0.02] text-white/70'
          }`}
        >
          {reading}
        </div>
        <button
          type="button"
          onClick={levelOut}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Level it
        </button>
      </div>

      {/* Announces the level state to assistive tech without stealing focus. */}
      <span aria-live="polite" className="sr-only">
        {isLevel ? 'Level' : ''}
      </span>
    </div>
  )
}
