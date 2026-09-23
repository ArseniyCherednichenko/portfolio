import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

// One number reel of a briefcase combination lock: a single 0–9 digit you can
// spin. The current digit is large and centred; its two neighbours sit faint
// above and below behind an edge fade, so the slot reads as a physical wheel.
// It is a real spinbutton — focus it and the arrow keys tick it, Home/End jump
// to the ends — and it also takes a vertical drag and a scroll, so pointer and
// keyboard reach it the same way. Each change slides the new digit in from the
// direction you turned; under reduced motion the digit just swaps in place.

const DIGIT_STEP = 26 // px of vertical drag that advances the reel by one digit

function mod10(n: number): number {
  return ((n % 10) + 10) % 10
}

function Reel({
  value,
  onChange,
  label,
  locked,
}: {
  value: number
  onChange: (next: number, dir: number) => void
  label: string
  locked: boolean
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  // Direction of the last change, so the entering digit slides in the way the
  // wheel turned: +1 counts up (new digit rises from below), -1 counts down.
  const [dir, setDir] = useState(1)
  const drag = useRef<{ startY: number; startValue: number; moved: boolean } | null>(null)

  const step = useCallback(
    (delta: number) => {
      const d = delta >= 0 ? 1 : -1
      setDir(d)
      onChange(mod10(value + delta), d)
    },
    [onChange, value],
  )

  const setTo = useCallback(
    (next: number) => {
      const n = mod10(next)
      if (n === value) return
      const d = n > value ? 1 : -1
      setDir(d)
      onChange(n, d)
    },
    [onChange, value],
  )

  // A scroll over the reel spins it: pushing the wheel up (deltaY < 0) counts up.
  // Registered non-passively so the gesture claims the scroll instead of moving
  // the page, and only while the lock is closed.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (locked) return
      e.preventDefault()
      step(e.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [locked, step])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (locked || e.button !== 0) return
    drag.current = { startY: e.clientY, startValue: value, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    const steps = Math.round((d.startY - e.clientY) / DIGIT_STEP)
    if (steps === 0) return
    d.moved = true
    setTo(d.startValue + steps)
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    drag.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (locked) return
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault()
        step(1)
        break
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault()
        step(-1)
        break
      case 'Home':
        e.preventDefault()
        setTo(0)
        break
      case 'End':
        e.preventDefault()
        setTo(9)
        break
      default:
        break
    }
  }

  const enter = reduce ? { opacity: 0 } : { y: dir * 34, opacity: 0 }
  const exit = reduce ? { opacity: 0 } : { y: dir * -34, opacity: 0 }

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={locked ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={9}
      aria-valuenow={value}
      aria-valuetext={String(value)}
      aria-disabled={locked || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={`relative h-[92px] w-14 touch-none select-none overflow-hidden rounded-lg border border-white/12 bg-gradient-to-b from-white/[0.09] via-white/[0.02] to-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-8px_16px_rgba(0,0,0,0.45)] outline-none transition-shadow ${
        locked ? 'cursor-default' : 'cursor-ns-resize focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70'
      }`}
      style={{
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, #000 26%, #000 74%, transparent)',
        maskImage: 'linear-gradient(to bottom, transparent, #000 26%, #000 74%, transparent)',
      }}
    >
      {/* faint neighbours, top and bottom, so the slot reads as a wheel */}
      <span className="pointer-events-none absolute inset-x-0 top-1.5 text-center font-display text-lg font-semibold tabular-nums text-white/25">
        {mod10(value - 1)}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center font-display text-lg font-semibold tabular-nums text-white/25">
        {mod10(value + 1)}
      </span>
      {/* the live digit */}
      <div className="absolute inset-0 grid place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={value}
            initial={enter}
            animate={{ y: 0, opacity: 1 }}
            exit={exit}
            transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 34 }}
            className="font-display text-3xl font-bold tabular-nums text-white"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* centre index line, like the window on a real lock */}
      <div className="pointer-events-none absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-[#DCF87C]/30" />
    </div>
  )
}

/**
 * A briefcase-style combination padlock. Three number reels sit in the lock
 * body; spin each to a digit by dragging it, scrolling over it, or focusing it
 * and using the arrow keys. When all three match the combination the shackle
 * springs open — lifting and swinging clear on its hinge — and re-seats the
 * moment you spin any reel away again. The code is shown as a hint, so the lock
 * is honestly openable; a scramble button spins the reels to a fresh wrong set.
 *
 * Everything defers to prefers-reduced-motion: the shackle and the reels snap
 * between their exact states instead of travelling, and the whole thing stays
 * fully keyboard-operable with a live region that announces locked and open.
 */
export function CombinationLock({
  secret = [2, 4, 8],
  className = '',
}: {
  secret?: [number, number, number]
  className?: string
}) {
  const reduce = useReducedMotion()
  const labelId = useId()
  const [digits, setDigits] = useState<[number, number, number]>([0, 0, 0])

  const open = digits.every((d, i) => d === secret[i])

  const setDigit = useCallback((index: number, next: number) => {
    setDigits((prev) => {
      const copy = [...prev] as [number, number, number]
      copy[index] = next
      return copy
    })
  }, [])

  // Spin to a random combination that is guaranteed not to be the code, so a
  // scramble always leaves the lock closed and there is something to solve.
  const scramble = useCallback(() => {
    let next: [number, number, number]
    do {
      next = [
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 10),
      ]
    } while (next.every((d, i) => d === secret[i]))
    setDigits(next)
  }, [secret])

  const shackleSpring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 220, damping: 16, mass: 0.9 }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <p id={labelId} className="sr-only">
        Combination lock. Set the three reels to open the shackle.
      </p>

      <div className="relative">
        {/* Shackle — pivots on its left leg, lifting and swinging clear when open.
            Sits behind the body (negative margin) so its legs tuck into it. */}
        <div className="pointer-events-none absolute inset-x-0 -top-[64px] flex justify-center">
          <motion.svg
            width="132"
            height="120"
            viewBox="0 0 132 120"
            fill="none"
            aria-hidden
            style={{ transformOrigin: '40px 108px' }}
            animate={open ? { y: -16, rotate: -32 } : { y: 0, rotate: 0 }}
            transition={shackleSpring}
          >
            <defs>
              <linearGradient id="shackle-steel" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#8b93a0" />
                <stop offset="0.5" stopColor="#e6ebf2" />
                <stop offset="1" stopColor="#6b7280" />
              </linearGradient>
            </defs>
            {/* A U: up the right leg, over the top, down the left (hinge) leg. */}
            <path
              d="M92 112 L92 56 A26 26 0 0 0 40 56 L40 112"
              stroke="url(#shackle-steel)"
              strokeWidth="13"
              strokeLinecap="round"
            />
          </motion.svg>
        </div>

        {/* Lock body */}
        <div className="relative w-[236px] rounded-[26px] border border-white/12 bg-gradient-to-br from-[#20242c] via-[#161a20] to-[#0d0f13] px-5 pb-6 pt-8 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)]">
          {/* status pip + word */}
          <div className="mb-5 flex items-center justify-center gap-2">
            <motion.span
              className="h-2 w-2 rounded-full"
              animate={{
                backgroundColor: open ? '#DCF87C' : 'rgba(255,255,255,0.28)',
                boxShadow: open ? '0 0 12px rgba(220,248,124,0.85)' : '0 0 0 rgba(0,0,0,0)',
              }}
              transition={{ duration: reduce ? 0 : 0.3 }}
            />
            <span
              className={`text-[0.7rem] font-semibold uppercase tracking-[0.28em] transition-colors ${
                open ? 'text-[#DCF87C]' : 'text-white/45'
              }`}
            >
              {open ? 'Open' : 'Locked'}
            </span>
          </div>

          {/* the three reels */}
          <div className="flex items-center justify-center gap-3">
            {digits.map((d, i) => (
              <Reel
                key={i}
                value={d}
                locked={open}
                label={`${['First', 'Second', 'Third'][i]} digit`}
                onChange={(next) => setDigit(i, next)}
              />
            ))}
          </div>

          {/* scramble */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={scramble}
              className="rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
            >
              Scramble
            </button>
          </div>
        </div>
      </div>

      {/* honest hint — the lock is meant to be openable */}
      <p className="mt-5 text-center text-xs text-white/45">
        The combination is{' '}
        <span className="font-semibold tabular-nums text-white/75">
          {secret[0]} &middot; {secret[1]} &middot; {secret[2]}
        </span>
        . Spin the reels to it.
      </p>

      {/* polite live region for assistive tech */}
      <span aria-live="polite" className="sr-only">
        {open ? 'Unlocked. The shackle is open.' : 'Locked.'}
      </span>
    </div>
  )
}
