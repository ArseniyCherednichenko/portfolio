import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'

// A card whose surface line wipes aside under the pointer to reveal a second
// line beneath it — the "text reveal" micro-interaction, rebuilt by hand. A
// vertical seam tracks where the cursor is across the card: everything left of
// the seam shows the revealed copy (bright lime over a field of drifting
// sparks), everything right of it stays the muted surface copy, so moving the
// pointer across drags the reveal open like a squeegee across glass.
//
// Three details make it feel like a real surface rather than a CSS trick.
// First, the seam is spring-followed, not pinned to the raw pointer x, so it
// has a little weight and overshoot as you flick across — the hand feels the
// mass. Second, when nothing is touching it, the seam does not sit dead at the
// edge: it breathes, drifting a few percent in and back on a slow loop, a quiet
// hint that the card is meant to be moved through (an invitation the flat
// states of this library's other cards do not give). Third, it is reachable
// without a pointer at all — the card is a focusable group, and Tabbing to it
// eases the reveal open and holds it there, so a keyboard reader gets the whole
// line, not half of it.
//
// Honest to assistive tech: both visible layers are aria-hidden (a screen
// reader would otherwise hear two overlapping half-sentences), and the card
// carries one plain label that states the surface and the reveal in full.
// Under prefers-reduced-motion the whole mechanism drops: no seam, no spring,
// no drifting sparks — the two lines simply stack, surface over reveal, both
// legible and still. The interaction is a flourish on top of content that is
// always readable, never the only way to read it.

export interface TextRevealCardProps {
  /** The line shown at rest — the muted "cover". */
  surface: string
  /** The line uncovered as the seam sweeps left-to-right — the bright "answer". */
  reveal: string
  className?: string
}

interface Spark {
  left: number
  top: number
  size: number
  delay: number
  duration: number
  base: number
}

// A fixed field of sparks, laid down once per mount. Positions are percentages
// so the field scales with the card; each gets its own twinkle delay/period so
// the field never pulses in lockstep.
function makeSparks(n: number): Spark[] {
  const out: Spark[] = []
  for (let i = 0; i < n; i++) {
    out.push({
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 3,
      duration: 1.8 + Math.random() * 2.6,
      base: 0.12 + Math.random() * 0.3,
    })
  }
  return out
}

function SparkField({ sparks, reduced }: { sparks: Spark[]; reduced: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0">
      {sparks.map((s, i) =>
        reduced ? (
          <span
            key={i}
            className="absolute rounded-full bg-[#DCF87C]"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              opacity: s.base,
            }}
          />
        ) : (
          <motion.span
            key={i}
            className="absolute rounded-full bg-[#DCF87C]"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size }}
            animate={{ opacity: [s.base, s.base + 0.45, s.base], scale: [1, 1.6, 1] }}
            transition={{
              duration: s.duration,
              delay: s.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ),
      )}
    </div>
  )
}

export function TextRevealCard({ surface, reveal, className }: TextRevealCardProps) {
  const reduced = useReducedMotion()
  const labelId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  // raw drives a spring; the spring (`pct`) is what the seam actually reads, so
  // the divider lags and overshoots the pointer a touch instead of snapping.
  const raw = useMotionValue(0)
  const pct = useSpring(raw, { stiffness: 220, damping: 30, mass: 0.6 })

  // ~44 sparks is enough to read as a field without crowding the type.
  const sparks = useMemo(() => makeSparks(44), [])

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const frac = (clientX - r.left) / r.width
      raw.set(Math.min(1, Math.max(0, frac)))
    },
    [raw],
  )

  // Idle breathing: whenever the card is neither hovered nor focused (and motion
  // is allowed), ease the seam in and back on a slow loop so the card hints it
  // wants to be moved through. The pointer/focus handlers stop this by setting
  // `active`, and take the value over directly.
  useEffect(() => {
    if (reduced || active) return
    const controls = animate(raw, [0.04, 0.2, 0.04], {
      duration: 5.5,
      ease: 'easeInOut',
      repeat: Infinity,
    })
    return () => controls.stop()
  }, [reduced, active, raw])

  if (reduced) {
    return (
      <div
        role="group"
        aria-label={`${surface} — ${reveal}`}
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/40 ${className ?? ''}`}
      >
        <SparkField sparks={sparks} reduced />
        <div className="relative z-10 flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <span className="text-2xl font-semibold text-white/35 sm:text-3xl">{surface}</span>
          <span className="font-display text-3xl font-bold text-[#DCF87C] sm:text-4xl">{reveal}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-labelledby={labelId}
      onPointerMove={(e) => {
        if (!active) setActive(true)
        setFromClientX(e.clientX)
      }}
      onPointerEnter={(e) => {
        setActive(true)
        setFromClientX(e.clientX)
      }}
      onPointerLeave={() => {
        setActive(false)
        animate(raw, 0.04, { duration: 0.5, ease: 'easeOut' })
      }}
      onFocus={() => {
        setActive(true)
        animate(raw, 0.64, { duration: 0.5, ease: [0.16, 1, 0.3, 1] })
      }}
      onBlur={() => setActive(false)}
      className={`group/reveal relative cursor-ew-resize touch-none select-none overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-black/40 outline-none focus-visible:border-[#DCF87C]/40 ${className ?? ''}`}
    >
      <span id={labelId} className="sr-only">
        {surface} — {reveal}
      </span>

      <div className="relative z-10 min-h-[220px]">
        {/* Both layers occupy the same box so the two lines sit on the same
            baseline; the seam decides which side of each shows. */}
        <Layer>
          <span className="font-display text-2xl font-bold text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.28)] sm:text-4xl">
            {surface}
          </span>
        </Layer>

        <RevealLayer pct={pct}>
          <SparkField sparks={sparks} reduced={false} />
          <div className="relative flex h-full w-full items-center justify-center px-6 text-center">
            <span className="font-display text-2xl font-bold text-[#DCF87C] [text-shadow:0_0_24px_rgba(220,248,124,0.35)] sm:text-4xl">
              {reveal}
            </span>
          </div>
        </RevealLayer>

        {/* The lit seam itself. */}
        <Seam pct={pct} />
      </div>

      <span className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white/25 transition-colors group-hover/reveal:text-white/40">
        Drag across
      </span>
    </div>
  )
}

function Layer({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center px-6 text-center">
      {children}
    </div>
  )
}

function RevealLayer({ pct, children }: { pct: MotionValue<number>; children: React.ReactNode }) {
  // Show only the slice left of the seam: clip away (1 - pct) of the right edge.
  const clip = useTransform(pct, (p) => `inset(0 ${(1 - p) * 100}% 0 0)`)
  return (
    <motion.div aria-hidden className="absolute inset-0 overflow-hidden" style={{ clipPath: clip }}>
      {children}
    </motion.div>
  )
}

function Seam({ pct }: { pct: MotionValue<number> }) {
  const left = useTransform(pct, (p) => `${p * 100}%`)
  // The seam fades out as it rests against the left edge, so a card sitting idle
  // at ~4% does not show a bright bar pinned to its border.
  const opacity = useTransform(pct, [0, 0.03, 1], [0, 0.4, 1])
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute bottom-6 top-6 w-px bg-gradient-to-b from-transparent via-[#DCF87C] to-transparent shadow-[0_0_14px_2px_rgba(220,248,124,0.55)]"
      style={{ left, opacity }}
    />
  )
}
