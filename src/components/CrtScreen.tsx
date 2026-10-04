import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'

// CrtScreen — wrap any content in a cathode-ray tube.
//
// Not a canvas piece and not a glitch effect: it is a honest *display*, the
// screen the Oscilloscope and the Nixie would have lived behind. It takes
// arbitrary children and dresses them as phosphor on glass — the thing that
// separates it from its neighbours is that it frames real content (text, a
// clock, a list) rather than drawing its own figure.
//
// Every layer is a real artefact of the tube, stacked over the content and
// aria-hidden so a reader hears only what is inside:
//   · scanlines — a fixed comb of dark horizontal lines, the gaps between the
//     raster rows a shadow mask never lit;
//   · a roll bar — one soft bright band drifting down the face, the out-of-sync
//     frame that never quite holds still on an old set;
//   · bloom + vignette — the phosphor glows past its own edges toward the
//     centre and falls dark into the corners, so the glass reads as curved;
//   · flicker — the whole face breathes a hair in brightness, the mains hum you
//     see more than hear;
//   · power-on — on mount the picture snaps open from a single white line and
//     settles, the way a tube warms up.
//
// All of the motion is CSS/transform only (no per-frame JS), and every bit of
// it is gated on prefers-reduced-motion: the still version keeps the scanlines,
// the bloom and the vignette — the look, not the loop — and simply holds.
export function CrtScreen({
  children,
  className = '',
  /** The phosphor colour. Classic green by default; the site's lime reads as a
   *  warmer P1 phosphor. Any CSS colour works. */
  tint = '#DCF87C',
  /** Darken the corners and round the glass to fake the tube's curve. */
  curvature = true,
  /** Play the warm-up snap on mount. */
  power = true,
  /** Pixel gap between scanlines — smaller is a finer raster. */
  scanlineGap = 3,
  style,
}: {
  children: ReactNode
  className?: string
  tint?: string
  curvature?: boolean
  power?: boolean
  scanlineGap?: number
  style?: CSSProperties
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  // Only run the warm-up once the screen is actually on page and allowed to
  // move; otherwise the content is simply there from the first paint.
  const [lit, setLit] = useState(() => !power)

  useEffect(() => {
    if (!power) return
    if (reduce) {
      setLit(true)
      return
    }
    // A frame's grace so the closed state paints before it opens.
    const id = requestAnimationFrame(() => setLit(true))
    return () => cancelAnimationFrame(id)
  }, [power, reduce])

  const scanlines =
    `repeating-linear-gradient(to bottom,` +
    ` rgba(0,0,0,0) 0px,` +
    ` rgba(0,0,0,0) ${scanlineGap - 1}px,` +
    ` rgba(0,0,0,0.42) ${scanlineGap - 1}px,` +
    ` rgba(0,0,0,0.42) ${scanlineGap}px)`

  return (
    <div
      ref={ref}
      className={`relative isolate overflow-hidden bg-[#050705] ${
        curvature ? 'rounded-[2rem]' : 'rounded-2xl'
      } ${className}`}
      style={{
        // The glass itself: a bezel ring, and an inset shadow that darkens the
        // rim so the surface reads as bulging toward you.
        boxShadow: curvature
          ? 'inset 0 0 120px rgba(0,0,0,0.75), inset 0 0 18px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)'
          : 'inset 0 0 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
        ...style,
      }}
    >
      {/* CONTENT — warms up from a single line, then settles. Tinted toward the
          phosphor and given a faint glow so it reads as light, not ink. */}
      <motion.div
        className="relative z-0 h-full w-full"
        style={{ color: tint, textShadow: `0 0 8px ${hexToRgba(tint, 0.45)}` }}
        initial={reduce || !power ? false : { scaleY: 0.004, opacity: 0.2 }}
        animate={lit ? { scaleY: 1, opacity: 1 } : undefined}
        transition={{
          scaleY: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.12 },
          opacity: { duration: 0.3, ease: 'easeOut' },
        }}
      >
        {children}
      </motion.div>

      {/* PHOSPHOR WASH — a low tint of the beam colour over everything, so even
          a white child picks up the tube's cast. Screen-blended to add light. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 mix-blend-screen"
        style={{ background: hexToRgba(tint, 0.06) }}
      />

      {/* SCANLINES — the fixed comb. Kept on under reduced motion: it is the
          look of the thing, not animation. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20"
        style={{ backgroundImage: scanlines, backgroundSize: `100% ${scanlineGap}px` }}
      />

      {/* ROLL BAR — one soft bright band sweeping down the face, the frame that
          never syncs. Motion only; gone when stilled. */}
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-20 h-1/3"
          style={{
            background: `linear-gradient(to bottom, transparent, ${hexToRgba(
              tint,
              0.07,
            )}, transparent)`,
          }}
          initial={{ top: '-33%' }}
          animate={{ top: ['-33%', '100%'] }}
          transition={{ duration: 7, ease: 'linear', repeat: Infinity }}
        />
      )}

      {/* VIGNETTE + GLASS — darker corners read as curve, a soft diagonal sheen
          reads as a reflection on the glass. */}
      {curvature && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            background:
              'radial-gradient(130% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)',
          }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-30"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 32%, transparent 100%)',
        }}
      />

      {/* FLICKER — the whole face breathes in brightness. A transform-free
          opacity pulse on a transparent black sheet, so it dims everything a
          hair at once. Motion only. */}
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-40 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.04, 0, 0.02, 0, 0.05, 0] }}
          transition={{ duration: 0.3, ease: 'linear', repeat: Infinity, repeatDelay: 0.9 }}
        />
      )}

      {/* POWER-ON FLASH — the quick white bloom as the beam strikes, over the
          top of the opening picture, then gone. */}
      {power && !reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-40"
          style={{ background: hexToRgba(tint, 0.9) }}
          initial={{ opacity: 0.85 }}
          animate={lit ? { opacity: 0 } : undefined}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.14 }}
        />
      )}
    </div>
  )
}

// Small helper: a #rgb / #rrggbb hex to an rgba() string at the given alpha.
// Kept local so the component carries no colour-utility dependency. Falls back
// to the raw value for named/already-rgba colours so any CSS colour still works
// (just without the alpha multiply).
function hexToRgba(color: string, alpha: number): string {
  const hex = color.trim()
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!m) return color
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
