import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'

// The appreciation control — the Medium-claps gesture, rebuilt by hand.
//
// It exists because of a real product idea most "like" buttons get wrong: a
// single binary tap throws away how *much* someone liked a thing. Medium's clap
// solved that by letting you keep tapping, each tap worth one unit, up to a cap
// — so appreciation has a volume knob, not just an on/off switch. That one idea
// carries a surprising amount of interaction craft, which is why it earns a
// place here rather than a plain heart toggle.
//
// The craft is in four things a lazy version skips. (1) It is a *hold-to-repeat*
// gesture, not just a click: press and keep pressing and the count climbs on a
// steady cadence, the same by pointer and by a held Space/Enter, so a long press
// pours appreciation in rather than demanding a flurry of clicks. (2) Every add
// throws a short burst of lime sparks from the centre — the tiny reward that
// makes the gesture feel physical — laid out on a deterministic ring (no
// Math.random, so a burst is reproducible and never flashes a stray outlier).
// (3) A combo bubble rises and re-pops while you are mid-streak, showing the
// running tally for this press and fading once you stop, so a rapid run reads as
// one accumulating gesture. (4) A ring around the button fills toward the cap,
// and at the cap the control settles into a calm "maxed" state rather than
// silently eating presses.
//
// Honesty: the tally lives only in this browser tab and resets on reload — it is
// a demonstration of the gesture, not a real signal wired to anything.
//
// Reduced motion gets a genuine alternative, not a broken animation: the sparks,
// the number pop, the ring sweep, and the combo rise all drop to nothing, the
// count simply updates, and the control stays exactly as usable — hold-to-repeat
// included.

const EASE = [0.16, 1, 0.3, 1] as const

export interface AppreciateProps {
  /** The ceiling — how many units a single viewer can add. Default 50. */
  max?: number
  /** The resting verb on the button. Default "Appreciate". */
  label?: string
  /** Fired on every change, with the new running total. */
  onChange?: (count: number) => void
  className?: string
}

/** One spark in a burst. Angle and reach are derived from the burst seed and
 *  the particle index, so a burst is fully deterministic. */
interface Spark {
  id: number
  dx: number
  dy: number
  size: number
}

interface Burst {
  id: number
  sparks: Spark[]
}

// A tiny integer hash → [0,1), used only to give each spark a hair of variety
// in reach and size without reaching for Math.random (which would make a burst
// non-reproducible and could flash a stray outlier).
function frac(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const SPARK_COUNT = 10

function makeBurst(id: number): Burst {
  const rot = frac(id) * Math.PI * 2 // the whole ring rotates a little each burst
  const sparks: Spark[] = []
  for (let i = 0; i < SPARK_COUNT; i++) {
    const angle = (i / SPARK_COUNT) * Math.PI * 2 + rot
    const reach = 34 + frac(id * 7 + i) * 26 // 34–60px
    sparks.push({
      id: i,
      dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach,
      size: 4 + frac(id * 13 + i * 3) * 4, // 4–8px
    })
  }
  return { id, sparks }
}

/**
 * A press-and-hold appreciation control — the Medium-claps gesture done
 * properly. Tap to add one, or hold (pointer or Space/Enter) to pour it in on a
 * steady cadence, up to `max`. Each add bursts a ring of lime sparks, pops the
 * count, rises a combo bubble, and fills the ring toward the cap. A real
 * `<button>` with a polite live region; under prefers-reduced-motion every bit
 * of motion drops away and the control stays fully usable.
 */
export function Appreciate({ max = 50, label = 'Appreciate', onChange, className = '' }: AppreciateProps) {
  const reduce = useReducedMotion()
  const [count, setCount] = useState(0)
  const [bursts, setBursts] = useState<Burst[]>([])
  const [combo, setCombo] = useState(0)

  // The count pop and the combo bubble are driven by motion values so the
  // visuals can never disagree with state, and so reduced motion can simply not
  // drive them.
  const numScale = useMotionValue(1)

  // Refs the hold loop reads without re-subscribing, plus its timers.
  const countRef = useRef(0)
  const burstId = useRef(0)
  const repeatRef = useRef<number | null>(null)
  const comboResetRef = useRef<number | null>(null)
  const burstTimers = useRef<number[]>([])

  const maxed = count >= max

  const clearRepeat = useCallback(() => {
    if (repeatRef.current) window.clearInterval(repeatRef.current)
    repeatRef.current = null
  }, [])

  useEffect(
    () => () => {
      clearRepeat()
      if (comboResetRef.current) window.clearTimeout(comboResetRef.current)
      burstTimers.current.forEach((t) => window.clearTimeout(t))
    },
    [clearRepeat],
  )

  // The single add step, shared by tap, pointer-hold, and key-hold. Returns
  // whether it actually added, so the hold loop can stop itself at the cap.
  const add = useCallback(() => {
    if (countRef.current >= max) return false
    const next = countRef.current + 1
    countRef.current = next
    setCount(next)
    onChange?.(next)

    // Combo: the running tally for this press streak, reset after a short lull.
    setCombo((c) => c + 1)
    if (comboResetRef.current) window.clearTimeout(comboResetRef.current)
    comboResetRef.current = window.setTimeout(() => setCombo(0), 900)

    if (!reduce) {
      // A burst of sparks, auto-cleared after it has played.
      const id = ++burstId.current
      const burst = makeBurst(id)
      setBursts((b) => [...b, burst])
      const t = window.setTimeout(() => {
        setBursts((b) => b.filter((x) => x.id !== id))
        burstTimers.current = burstTimers.current.filter((x) => x !== t)
      }, 700)
      burstTimers.current.push(t)
      // The number pop — up and back on a quick spring.
      numScale.stop()
      numScale.set(1.24)
      animate(numScale, 1, { duration: 0.42, ease: EASE })
    }
    return true
  }, [max, onChange, reduce, numScale])

  // Begin a press: add once immediately, then repeat on a cadence while held.
  const startHold = useCallback(() => {
    if (countRef.current >= max) return
    clearRepeat()
    add()
    repeatRef.current = window.setInterval(() => {
      const ok = add()
      if (!ok) clearRepeat()
    }, 150)
  }, [add, clearRepeat, max])

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || maxed) return
    e.preventDefault()
    startHold()
  }
  function endHold() {
    clearRepeat()
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return
    e.preventDefault()
    // A held key auto-repeats keydown; treat only the first as the press so the
    // cadence is ours, not the OS key-repeat rate.
    if (e.repeat) return
    startHold()
  }
  function onKeyUp(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') endHold()
  }

  function reset() {
    clearRepeat()
    countRef.current = 0
    setCount(0)
    setCombo(0)
    onChange?.(0)
  }

  // Ring geometry — a 96px dial, stroked around the button to show the fill.
  const R = 46
  const C = 2 * Math.PI * R
  const pct = Math.min(1, count / max)

  return (
    <div className={`inline-flex flex-col items-center gap-4 ${className}`}>
      <div className="relative h-28 w-28 select-none">
        {/* The progress ring. Fill tracks count/max; off under reduced motion it
            still shows the right amount, just with no sweep. */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <motion.circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="#DCF87C"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={false}
            animate={{ strokeDashoffset: C * (1 - pct) }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE }}
            style={{ filter: maxed ? 'drop-shadow(0 0 6px rgba(220,248,124,0.6))' : 'none' }}
          />
        </svg>

        {/* Spark bursts, centred on the button. Pointer-inert. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
          <AnimatePresence>
            {bursts.map((burst) => (
              <div key={burst.id} className="absolute h-0 w-0">
                {burst.sparks.map((s) => (
                  <motion.span
                    key={s.id}
                    className="absolute rounded-full bg-[#DCF87C]"
                    style={{ width: s.size, height: s.size, left: -s.size / 2, top: -s.size / 2 }}
                    initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
                    animate={{ x: s.dx, y: s.dy, opacity: 0, scale: 0.3 }}
                    transition={{ duration: 0.6, ease: EASE }}
                  />
                ))}
              </div>
            ))}
          </AnimatePresence>
        </div>

        {/* The combo bubble — the running tally for this streak, rising and
            fading. Hidden entirely under reduced motion (the live total below
            carries the same information). */}
        {!reduce && (
          <AnimatePresence>
            {combo > 1 && (
              <motion.span
                key={combo}
                className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 font-display text-lg font-semibold text-[#DCF87C]"
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: 1, y: -14, scale: 1 }}
                exit={{ opacity: 0, y: -26 }}
                transition={{ duration: 0.5, ease: EASE }}
                aria-hidden
              >
                +{combo}
              </motion.span>
            )}
          </AnimatePresence>
        )}

        {/* The button itself. One tab stop; hold to pour. */}
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onContextMenu={(e) => e.preventDefault()}
          disabled={maxed}
          aria-label={
            maxed
              ? `Appreciation maxed at ${max}`
              : `${label}. Appreciated ${count} ${count === 1 ? 'time' : 'times'} of ${max}. Hold to add more.`
          }
          className={`absolute inset-[14px] grid touch-none place-items-center rounded-full border text-center outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
            maxed
              ? 'cursor-default border-[#DCF87C]/70 bg-[#DCF87C]/15 text-[#DCF87C]'
              : 'cursor-pointer border-white/15 bg-white/[0.03] text-white hover:border-[#DCF87C]/50 hover:bg-[#DCF87C]/[0.06]'
          }`}
        >
          <motion.span
            className="font-display text-3xl font-bold tabular-nums leading-none"
            style={{ scale: reduce ? 1 : numScale }}
          >
            {count}
          </motion.span>
        </button>
      </div>

      {/* State line + reset. Honest about what the tally is. */}
      <div className="flex min-h-[1.75rem] items-center gap-3">
        <span className="text-sm text-white/55">
          {maxed ? 'Thank you — that is the lot.' : count === 0 ? 'Hold to appreciate' : 'Keep going'}
        </span>
        {count > 0 && (
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold text-white/50 transition-colors hover:border-white/30 hover:text-white/80"
          >
            Reset
          </button>
        )}
      </div>

      {/* Polite live region — speaks the running total, not every frame. */}
      <span className="sr-only" aria-live="polite">
        {maxed ? `Appreciation maxed at ${max}` : `Appreciated ${count} of ${max}`}
      </span>
    </div>
  )
}
