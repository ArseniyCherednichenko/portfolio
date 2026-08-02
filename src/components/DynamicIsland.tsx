import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

// The library had morphing tabs (GooeyTabs), a stacking deck (ScrollStack), and
// a modal, but no single surface that changes its own SHAPE to fit whatever it
// is carrying. This is that: a pill, borrowed in spirit from Apple's Dynamic
// Island, that grows, shrinks, and re-rounds itself as its "activity" changes,
// each state crossfading its own little UI in place. It is a deliberate showcase
// of layout-driven motion — the size and radius are the animation, not a
// decoration on top of it — and it stays honest to the machine: one spring
// drives the frame, AnimatePresence crossfades the contents, and every looping
// part (the waveform, the timer, the call pulse) stills itself under
// prefers-reduced-motion while the shape still snaps between states.

/** The activities the island knows how to wear. */
export type IslandActivity = 'idle' | 'music' | 'timer' | 'call'

// Each activity fixes the frame geometry. The container springs between these,
// so a state change reads as the pill physically re-shaping rather than a swap.
const SHAPES: Record<IslandActivity, { width: number; height: number; radius: number }> = {
  idle: { width: 132, height: 36, radius: 18 },
  music: { width: 328, height: 82, radius: 30 },
  timer: { width: 300, height: 82, radius: 30 },
  call: { width: 336, height: 96, radius: 32 },
}

const ACCENT = '#DCF87C'

/**
 * A shape-shifting status pill in the spirit of the Dynamic Island. Drive it by
 * passing `activity` (controlled) or let it start on `defaultActivity`; the
 * frame springs to the new size and radius while the contents crossfade. Built
 * for a Playground bench, but self-contained enough to sit anywhere.
 *
 * Reduced motion keeps the shape change (it is the information) but drops every
 * looping flourish and shortens the spring so nothing overshoots.
 */
export function DynamicIsland({
  activity: controlled,
  defaultActivity = 'idle',
  onActivityChange,
  className = '',
}: {
  activity?: IslandActivity
  defaultActivity?: IslandActivity
  onActivityChange?: (a: IslandActivity) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  const isControlled = controlled !== undefined
  const [internal, setInternal] = useState<IslandActivity>(defaultActivity)
  const activity = isControlled ? controlled : internal

  function go(next: IslandActivity) {
    if (!isControlled) setInternal(next)
    onActivityChange?.(next)
  }

  const shape = SHAPES[activity]
  const spring = reduce
    ? { type: 'spring' as const, stiffness: 1200, damping: 90 }
    : { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.9 }

  // A human-readable line for assistive tech, so the visual morph is narrated.
  const status: Record<IslandActivity, string> = {
    idle: 'Idle',
    music: 'Now playing: Passenger Seat by Death Cab for Cutie',
    timer: 'Timer running',
    call: 'Incoming call from Studio',
  }

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={status[activity]}
      className={`relative grid place-items-center overflow-hidden bg-black text-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)] ring-1 ring-white/10 ${className}`}
      animate={{ width: shape.width, height: shape.height, borderRadius: shape.radius }}
      transition={spring}
      style={{ width: shape.width, height: shape.height, borderRadius: shape.radius }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {activity === 'idle' && <IdleFace key="idle" reduce={!!reduce} />}
        {activity === 'music' && <MusicFace key="music" reduce={!!reduce} />}
        {activity === 'timer' && <TimerFace key="timer" reduce={!!reduce} />}
        {activity === 'call' && (
          <CallFace key="call" reduce={!!reduce} onEnd={() => go('idle')} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Shared crossfade for the inner faces. A small vertical drift so a face rises
// into the frame and the outgoing one sinks — off under reduced motion.
function faceMotion(reduce: boolean) {
  return {
    initial: { opacity: 0, y: reduce ? 0 : 6, filter: reduce ? 'none' : 'blur(4px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: reduce ? 0 : -6, filter: reduce ? 'none' : 'blur(4px)' },
    transition: { duration: reduce ? 0.12 : 0.26 },
  }
}

// IDLE — the resting notch: a dim camera dot on the right, a lit sensor on the
// left, nothing more. The thing sits quiet until something needs saying.
function IdleFace({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      {...faceMotion(reduce)}
      className="flex w-full items-center justify-between px-3.5"
    >
      <span className="h-2 w-2 rounded-full bg-white/25" />
      <motion.span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: ACCENT }}
        animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
        transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  )
}

// MUSIC — album blob, title/artist, and a live waveform whose bars breathe on
// staggered loops. Under reduced motion the bars hold a fixed silhouette.
const BARS = [0.4, 0.9, 0.55, 1, 0.7, 0.35, 0.85, 0.5]
function MusicFace({ reduce }: { reduce: boolean }) {
  return (
    <motion.div {...faceMotion(reduce)} className="flex w-full items-center gap-3 px-4">
      <motion.div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
        style={{ background: `linear-gradient(140deg, ${ACCENT}, #6ee7b7 55%, #38bdf8)` }}
        animate={reduce ? undefined : { rotate: [0, 3, -3, 0] }}
        transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" className="text-black/80">
          <path
            d="M9 18V6l10-2v10"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7" cy="18" r="2" fill="currentColor" />
          <circle cx="17" cy="16" r="2" fill="currentColor" />
        </svg>
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">Passenger Seat</p>
        <p className="truncate text-xs text-white/50">Death Cab for Cutie</p>
      </div>
      <div className="flex h-8 items-center gap-[3px]" aria-hidden>
        {BARS.map((peak, i) => (
          <motion.span
            key={i}
            className="w-[3px] rounded-full"
            style={{ background: ACCENT, height: 8 }}
            animate={
              reduce
                ? { height: 8 + peak * 16 }
                : { height: [8, 8 + peak * 18, 8] }
            }
            transition={
              reduce
                ? undefined
                : {
                    duration: 0.7 + peak * 0.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.09,
                  }
            }
          />
        ))}
      </div>
    </motion.div>
  )
}

// TIMER — a countdown from 15s: a lime ring drains as the mm:ss digits tick.
// The ring is real progress off elapsed time; reduced motion keeps the count
// but drops the sub-second ring easing to whole-second steps.
function TimerFace({ reduce }: { reduce: boolean }) {
  const total = 15
  const [remaining, setRemaining] = useState(total)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = Date.now()
    let mounted = true
    const tick = () => {
      if (!mounted || startRef.current == null) return
      const elapsed = (Date.now() - startRef.current) / 1000
      const left = total - (elapsed % total)
      setRemaining(reduce ? Math.ceil(left) : left)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      mounted = false
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [reduce])

  const frac = remaining / total
  const r = 15
  const circ = 2 * Math.PI * r
  const mm = Math.floor(remaining / 60)
  const ss = Math.floor(remaining % 60)
  const label = `${mm}:${ss.toString().padStart(2, '0')}`

  return (
    <motion.div {...faceMotion(reduce)} className="flex w-full items-center gap-3.5 px-4">
      <div className="relative grid h-12 w-12 place-items-center">
        <svg viewBox="0 0 40 40" className="h-12 w-12 -rotate-90">
          <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={3.5} />
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={ACCENT}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - frac)}
          />
        </svg>
        <span className="absolute text-[10px] font-semibold tabular-nums text-white/70">
          {Math.ceil(remaining)}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wide text-white/45">Timer</p>
        <p className="font-display text-2xl font-bold tabular-nums leading-tight">{label}</p>
      </div>
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
        Focus
      </span>
    </motion.div>
  )
}

// CALL — an incoming call with a pulsing avatar and real decline/accept buttons.
// Answering or declining ends the activity (the parent returns it to idle). The
// avatar ring pulses under motion; reduced motion holds it steady.
function CallFace({ reduce, onEnd }: { reduce: boolean; onEnd: () => void }) {
  return (
    <motion.div {...faceMotion(reduce)} className="flex w-full items-center gap-3 px-4">
      <div className="relative grid h-12 w-12 shrink-0 place-items-center">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 0 2px ${ACCENT}` }}
          animate={reduce ? undefined : { scale: [1, 1.25], opacity: [0.6, 0] }}
          transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
        <div
          className="grid h-12 w-12 place-items-center rounded-full text-sm font-semibold text-black"
          style={{ background: `linear-gradient(140deg, ${ACCENT}, #6ee7b7)` }}
        >
          AC
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">Studio</p>
        <p className="truncate text-xs text-white/50">incoming call…</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onEnd}
          aria-label="Decline call"
          className="grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white transition-transform hover:scale-105 active:scale-95"
        >
          <svg viewBox="0 0 24 24" width={16} height={16} className="rotate-[135deg]" fill="currentColor">
            <path d="M6.62 10.79a15.5 15.5 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.57 1 1 0 0 1-.24 1z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onEnd}
          aria-label="Accept call"
          className="grid h-9 w-9 place-items-center rounded-full text-black transition-transform hover:scale-105 active:scale-95"
          style={{ background: ACCENT }}
        >
          <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
            <path d="M6.62 10.79a15.5 15.5 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.57 1 1 0 0 1-.24 1z" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}
