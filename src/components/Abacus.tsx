import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// A working soroban — the Japanese abacus, rebuilt as a real, computing object.
//
// It is deliberately a different kind of "toy" from the rest of the family:
// the Clock is a passive dial, the SplitFlap clatters between fixed strings,
// the Turntable spins with momentum, the Harmonograph plots a seeded figure.
// This one holds *state that means something* — every bead you move changes a
// number, and the readout is the honest sum of the beads' places. Nothing is
// decorative: slide the beads and the arithmetic follows, the way the real
// instrument works.
//
// Each rod carries one "heaven" bead worth five (above the reckoning bar) and
// four "earth" beads worth one each (below it). A bead counts when it is pushed
// toward the bar. The digit on a rod is therefore (heaven ? 5 : 0) + earthUp,
// 0..9; the rods left-to-right are the decimal places, most significant first.

// --- Geometry (px). Everything is laid out from these so the springs are smooth.
const BEAD_H = 22 // bead height
const BEAD_W = 40 // bead width
const ROD_W = 52 // column width
const PAD = 4 // breathing room at a deck's ends
const HEAVEN_TRAVEL = BEAD_H // how far the heaven bead drops to the bar
const EARTH_TRAVEL = Math.round(BEAD_H * 1.25) // slack in the earth deck

const HEAVEN_H = BEAD_H + HEAVEN_TRAVEL + PAD * 2
const EARTH_H = 4 * BEAD_H + EARTH_TRAVEL + PAD * 2
const BAR_H = 10

/** State of one rod: whether the 5-bead is down, and how many 1-beads are up. */
interface Rod {
  heaven: boolean
  earth: number // 0..4
}

const digitToRod = (d: number): Rod => ({ heaven: d >= 5, earth: d % 5 })
const rodToDigit = (r: Rod): number => (r.heaven ? 5 : 0) + r.earth
const clampDigit = (d: number) => Math.min(9, Math.max(0, d))

// Group digits into thin-space-separated triples for a readable place value.
function groupDigits(digits: number[]): string {
  const s = digits.join('')
  const trimmed = s.replace(/^0+(?=\d)/, '') // drop leading zeros, keep one
  const out: string[] = []
  for (let i = trimmed.length; i > 0; i -= 3) {
    out.unshift(trimmed.slice(Math.max(0, i - 3), i))
  }
  return out.join(' ')
}

/**
 * A soroban you can actually reckon on. Click a bead to move it toward the
 * reckoning bar (and the beads it should carry with it move too, the way the
 * real instrument works), or focus a rod and use the arrow keys — each rod is a
 * `role="spinbutton"` carrying its live digit, so it reads and drives from the
 * keyboard. The big number above is the honest sum of every bead's place.
 *
 * `rods` sets the number of columns (decimal places). Under
 * `prefers-reduced-motion` the bead springs come off and they snap into place —
 * it stays a fully usable, fully labelled instrument.
 */
export function Abacus({
  rods = 7,
  defaultValue = 2026,
  className = '',
}: {
  rods?: number
  defaultValue?: number
  className?: string
}) {
  const reduce = useReducedMotion()

  // Seed the rods from a starting value (right-aligned into the columns).
  const initial = useMemo<Rod[]>(() => {
    const digits = Array.from({ length: rods }, () => 0)
    let v = Math.max(0, Math.floor(defaultValue))
    for (let i = rods - 1; i >= 0 && v > 0; i--) {
      digits[i] = v % 10
      v = Math.floor(v / 10)
    }
    return digits.map(digitToRod)
  }, [rods, defaultValue])

  const [state, setState] = useState<Rod[]>(initial)

  const setRod = useCallback((col: number, next: Rod) => {
    setState((prev) => prev.map((r, i) => (i === col ? next : r)))
  }, [])

  const setDigit = useCallback(
    (col: number, digit: number) => setRod(col, digitToRod(clampDigit(digit))),
    [setRod],
  )

  const digits = state.map(rodToDigit)
  const total = digits.join('')
  const totalNumber = Number(total)
  const readout = groupDigits(digits)

  const reset = useCallback(() => {
    setState(Array.from({ length: rods }, () => ({ heaven: false, earth: 0 })))
  }, [rods])

  const springy = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 700, damping: 34, mass: 0.6 }

  return (
    <div className={className}>
      {/* Readout */}
      <div className="mb-6 flex items-end justify-between gap-4 px-1">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#DCF87C]">
            Reads
          </span>
          <div
            className="font-display mt-1 text-4xl font-semibold tabular-nums text-white sm:text-5xl"
            aria-live="polite"
            aria-label={`Value ${totalNumber.toLocaleString('en-US')}`}
          >
            {readout}
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DCF87C]"
        >
          Clear
        </button>
      </div>

      {/* The frame */}
      <div
        className="mx-auto w-fit max-w-full overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-[#1a1712] to-[#0d0b08] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-4"
        role="group"
        aria-label="Abacus — drag beads or use the arrow keys on a rod"
      >
        <div className="flex" style={{ gap: 0 }}>
          {state.map((rod, col) => (
            <Column
              key={col}
              rod={rod}
              col={col}
              place={rods - 1 - col}
              digit={digits[col]}
              onSetRod={setRod}
              onStepDigit={(delta) => setDigit(col, digits[col] + delta)}
              onSetDigit={(d) => setDigit(col, d)}
              spring={springy}
            />
          ))}
        </div>
      </div>

      <p className="mt-4 px-1 text-center text-xs text-white/35">
        One bead above the bar is worth five; each below is worth one. Click a bead, or focus a rod
        and use the arrow keys.
      </p>
    </div>
  )
}

function Column({
  rod,
  col,
  place,
  digit,
  onSetRod,
  onStepDigit,
  onSetDigit,
  spring,
}: {
  rod: Rod
  col: number
  place: number
  digit: number
  onSetRod: (col: number, next: Rod) => void
  onStepDigit: (delta: number) => void
  onSetDigit: (d: number) => void
  spring: object
}) {
  // Heaven bead: rests at the top, drops toward the bar when active.
  const heavenTop = rod.heaven ? HEAVEN_H - BEAD_H - PAD : PAD

  // Earth beads: active ones stack up against the bar; the rest rest at the
  // bottom, so a gap opens in the middle exactly where beads have been raised.
  const earthTop = (k: number) =>
    k < rod.earth
      ? PAD + k * BEAD_H // pushed up, kth from the bar
      : EARTH_H - PAD - (4 - k) * BEAD_H // resting at the bottom

  // Clicking the kth earth bead (0 = nearest the bar): if it is already up,
  // clear it and everything below it (new count k); if it is down, push it and
  // everything above it up (new count k + 1). The classic soroban toggle.
  const clickEarth = (k: number) => {
    const next = k < rod.earth ? k : k + 1
    onSetRod(col, { ...rod, earth: next })
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault()
        onStepDigit(1)
        break
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault()
        onStepDigit(-1)
        break
      case 'Home':
        e.preventDefault()
        onSetDigit(0)
        break
      case 'End':
        e.preventDefault()
        onSetDigit(9)
        break
      default:
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault()
          onSetDigit(Number(e.key))
        }
    }
  }

  const placeName =
    place === 0
      ? 'ones'
      : place === 1
        ? 'tens'
        : place === 2
          ? 'hundreds'
          : `place ${place + 1}`

  return (
    <div
      tabIndex={0}
      role="spinbutton"
      aria-label={`Rod ${col + 1} (${placeName})`}
      aria-valuenow={digit}
      aria-valuemin={0}
      aria-valuemax={9}
      aria-valuetext={`${digit}`}
      onKeyDown={onKeyDown}
      className="group relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
      style={{ width: ROD_W }}
    >
      {/* Heaven deck */}
      <div className="relative mx-auto" style={{ width: ROD_W, height: HEAVEN_H }}>
        <RodLine />
        <Bead
          top={heavenTop}
          active={rod.heaven}
          onClick={() => onSetRod(col, { ...rod, heaven: !rod.heaven })}
          spring={spring}
          label={`Five bead, rod ${col + 1}`}
        />
      </div>

      {/* Reckoning bar */}
      <div
        className="relative bg-gradient-to-b from-[#DCF87C]/80 to-[#a9c94f]/70"
        style={{ height: BAR_H }}
      >
        <span className="absolute inset-x-0 top-0 h-px bg-white/40" />
        {/* the unit-rod dot on the ones column, as on a real soroban */}
        {place % 3 === 0 && (
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70" />
        )}
      </div>

      {/* Earth deck */}
      <div className="relative mx-auto" style={{ width: ROD_W, height: EARTH_H }}>
        <RodLine />
        {[0, 1, 2, 3].map((k) => (
          <Bead
            key={k}
            top={earthTop(k)}
            active={k < rod.earth}
            onClick={() => clickEarth(k)}
            spring={spring}
            label={`One bead ${k + 1}, rod ${col + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

/** The rod line the beads ride on. */
function RodLine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-white/5 via-white/15 to-white/5"
    />
  )
}

function Bead({
  top,
  active,
  onClick,
  spring,
  label,
}: {
  top: number
  active: boolean
  onClick: () => void
  spring: object
  label: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="absolute left-1/2 -translate-x-1/2 cursor-pointer rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]"
      style={{ width: BEAD_W, height: BEAD_H }}
      initial={false}
      animate={{ top }}
      transition={spring}
      whileTap={{ scale: 0.92 }}
    >
      <span
        aria-hidden
        className="block h-full w-full rounded-[10px] border transition-colors"
        style={{
          clipPath:
            'polygon(0% 50%, 22% 8%, 78% 8%, 100% 50%, 78% 92%, 22% 92%, 0% 50%)',
          borderColor: active ? 'rgba(220,248,124,0.55)' : 'rgba(255,255,255,0.12)',
          background: active
            ? 'radial-gradient(120% 120% at 35% 25%, rgba(220,248,124,0.95), rgba(160,190,80,0.85) 55%, rgba(90,110,45,0.9))'
            : 'radial-gradient(120% 120% at 35% 25%, rgba(120,110,95,0.95), rgba(70,63,52,0.95) 55%, rgba(38,33,26,0.98))',
          boxShadow: active
            ? '0 2px 8px rgba(220,248,124,0.28), inset 0 1px 1px rgba(255,255,255,0.5)'
            : 'inset 0 1px 1px rgba(255,255,255,0.14), 0 2px 4px rgba(0,0,0,0.4)',
        }}
      />
    </motion.button>
  )
}
