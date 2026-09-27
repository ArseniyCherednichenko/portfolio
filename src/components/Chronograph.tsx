import { useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// A chronograph — a mechanical stopwatch rebuilt as a working object rather than
// a picture of one. Two pushers flank a dial: the top starts and stops the sweep,
// the bottom takes a lap while it runs and zeroes it once it is stopped. A slim
// hand sweeps the whole dial once a minute, a subdial totals the elapsed minutes,
// and a fast subdial hand spins once a second so the sub-second reads as motion.
//
// The single source of truth is ELAPSED MILLISECONDS, and every hand and every
// digit is derived from it, so the three hands and the digital readout can never
// disagree — there is no separate "seconds" and "minutes" state to drift apart.
// Time is measured off performance.now(), not the wall clock, so a tab-away can't
// skew it and it survives a resize untouched. Under prefers-reduced-motion the
// sweep is dropped: the seconds hand ticks whole seconds the way a quartz movement
// does, the fast subdial hand is stilled, and the digital readout — the essential
// reading — still runs to the hundredth.

const CX = 150
const CY = 150
const DIAL_R = 132

// Subdial geometry, in dial space.
const MIN_CX = 150
const MIN_CY = 92 // minutes totalizer, up top
const SUB_R = 34
const TEN_CX = 150
const TEN_CY = 208 // tenths-of-a-second flourish, down low

const MAX_MIN = 30 // the totalizer wraps every half hour, like a real 30-minute register

// Format elapsed ms as MM:SS.CC (centiseconds). The digital face reads exactly
// what the hands point to, because both come off the same number.
function format(ms: number) {
  const totalCs = Math.floor(ms / 10)
  const cs = totalCs % 100
  const totalS = Math.floor(totalCs / 100)
  const s = totalS % 60
  const m = Math.floor(totalS / 60)
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return { m: pad(m), s: pad(s), cs: pad(cs), spokenM: m, spokenS: s }
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
}

/**
 * A working chronograph. Elapsed milliseconds is the only state; the sweep hand,
 * the minute totalizer, the tenths flourish, and the digital readout are all
 * derived from it. Top pusher starts/stops, bottom pusher laps while running and
 * resets when stopped. Reduced motion drops the sweep to a quartz tick and stills
 * the fast hand, but the reading stays true to the hundredth.
 */
export function Chronograph({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const labelId = useId()

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // ms — the single source of truth
  const [laps, setLaps] = useState<number[]>([])

  // Refs run the movement without a re-render on every intermediate: the start
  // timestamp of the current run and the time banked from previous runs.
  const startRef = useRef(0)
  const accRef = useRef(0)
  const raf = useRef<number | null>(null)

  const stopRaf = useCallback(() => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
  }, [])

  // While running, read elapsed straight off the clock each frame. When the tab
  // is hidden rAF pauses but performance.now keeps counting, so on return elapsed
  // catches up in one step — the watch genuinely kept running, as it should.
  useEffect(() => {
    if (!running) return
    const tick = () => {
      setElapsed(accRef.current + (performance.now() - startRef.current))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => stopRaf()
  }, [running, stopRaf])

  useEffect(() => () => stopRaf(), [stopRaf])

  const startStop = useCallback(() => {
    setRunning((r) => {
      if (r) {
        // stopping: bank the run so far and settle on the exact stopped value
        accRef.current += performance.now() - startRef.current
        setElapsed(accRef.current)
        return false
      }
      // starting: mark the moment; the rAF effect takes it from here
      startRef.current = performance.now()
      return true
    })
  }, [])

  // The bottom pusher: a lap while running, a reset once stopped.
  const lapOrReset = useCallback(() => {
    if (running) {
      setLaps((l) => [accRef.current + (performance.now() - startRef.current), ...l])
    } else {
      accRef.current = 0
      startRef.current = 0
      setElapsed(0)
      setLaps([])
    }
  }, [running])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        startStop()
      } else if (e.key === 'Enter' || e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        lapOrReset()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        // an explicit reset always zeroes; stop first if it is running
        stopRaf()
        accRef.current = 0
        startRef.current = 0
        setRunning(false)
        setElapsed(0)
        setLaps([])
      }
    },
    [lapOrReset, startStop, stopRaf],
  )

  const { m, s, cs, spokenM, spokenS } = format(elapsed)

  // Derived hand angles. The sweep hand carries the seconds-within-the-minute; the
  // minute totalizer carries whole minutes up to the register's wrap; the fast hand
  // spins once a second. Under reduced motion the sweep and the fast hand snap to
  // whole seconds rather than gliding.
  const totalSeconds = elapsed / 1000
  const sweepSeconds = reduce ? Math.floor(totalSeconds) % 60 : totalSeconds % 60
  const sweepDeg = (sweepSeconds / 60) * 360

  const minutes = Math.floor(totalSeconds / 60) % MAX_MIN
  const minDeg = (minutes / MAX_MIN) * 360

  const tenthDeg = ((elapsed % 1000) / 1000) * 360

  const sweepTip = polar(CX, CY, DIAL_R - 20, sweepDeg)
  const sweepTail = polar(CX, CY, -22, sweepDeg)
  const minHand = polar(MIN_CX, MIN_CY, SUB_R - 6, minDeg)
  const tenHand = polar(TEN_CX, TEN_CY, SUB_R - 6, tenthDeg)

  const zeroed = elapsed === 0 && !running

  return (
    <div className={`flex w-full flex-col items-center ${className}`}>
      <svg
        viewBox="0 0 300 300"
        role="timer"
        tabIndex={0}
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="w-full max-w-[360px] touch-none select-none outline-none [&:focus-visible_.chr-bezel]:stroke-[#DCF87C]/70"
      >
        <title id={labelId}>
          Chronograph reading {m} minutes {s} seconds. Space starts and stops it; Enter takes a lap
          while running and resets it when stopped.
        </title>

        {/* case and bezel */}
        <circle cx={CX} cy={CY} r={DIAL_R + 12} fill="rgba(255,255,255,0.03)" />
        <circle
          className="chr-bezel"
          cx={CX}
          cy={CY}
          r={DIAL_R + 12}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={2}
        />
        <circle cx={CX} cy={CY} r={DIAL_R} fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.08)" />

        {/* the main track: 60 second ticks, every fifth heavier and lettered by fives */}
        {Array.from({ length: 60 }, (_, i) => {
          const deg = (i / 60) * 360
          const major = i % 5 === 0
          const p1 = polar(CX, CY, DIAL_R - 4, deg)
          const p2 = polar(CX, CY, DIAL_R - (major ? 16 : 9), deg)
          return (
            <line
              key={`t${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'}
              strokeWidth={major ? 2 : 1}
            />
          )
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const deg = (i / 12) * 360
          const p = polar(CX, CY, DIAL_R - 30, deg)
          const val = i * 5 === 0 ? 60 : i * 5
          return (
            <text
              key={`n${i}`}
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              className="fill-white/45"
              style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
            >
              {val}
            </text>
          )
        })}

        {/* minutes totalizer subdial */}
        <g>
          <circle cx={MIN_CX} cy={MIN_CY} r={SUB_R} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.12)" />
          {Array.from({ length: 6 }, (_, i) => {
            const deg = (i / 6) * 360
            const q1 = polar(MIN_CX, MIN_CY, SUB_R - 2, deg)
            const q2 = polar(MIN_CX, MIN_CY, SUB_R - 7, deg)
            return (
              <line key={`m${i}`} x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
            )
          })}
          <text x={MIN_CX} y={MIN_CY + SUB_R - 9} textAnchor="middle" className="fill-white/35" style={{ fontSize: 8, letterSpacing: 1 }}>
            MIN
          </text>
          <line x1={MIN_CX} y1={MIN_CY} x2={minHand.x} y2={minHand.y} stroke="rgba(255,255,255,0.8)" strokeWidth={2} strokeLinecap="round" />
          <circle cx={MIN_CX} cy={MIN_CY} r={2.6} fill="rgba(255,255,255,0.8)" />
        </g>

        {/* tenths-of-a-second flourish subdial (the fast one) */}
        <g>
          <circle cx={TEN_CX} cy={TEN_CY} r={SUB_R} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.12)" />
          {Array.from({ length: 10 }, (_, i) => {
            const deg = (i / 10) * 360
            const q1 = polar(TEN_CX, TEN_CY, SUB_R - 2, deg)
            const q2 = polar(TEN_CX, TEN_CY, SUB_R - 6, deg)
            return (
              <line key={`d${i}`} x1={q1.x} y1={q1.y} x2={q2.x} y2={q2.y} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
            )
          })}
          <text x={TEN_CX} y={TEN_CY - SUB_R + 12} textAnchor="middle" className="fill-white/35" style={{ fontSize: 8, letterSpacing: 1 }}>
            1/10
          </text>
          {/* the fast hand is pure smooth flourish, so reduced motion stills it */}
          {!reduce && (
            <line x1={TEN_CX} y1={TEN_CY} x2={tenHand.x} y2={tenHand.y} stroke="#DCF87C" strokeWidth={1.6} strokeLinecap="round" opacity={running ? 0.9 : 0.5} />
          )}
          <circle cx={TEN_CX} cy={TEN_CY} r={2.2} fill="rgba(255,255,255,0.6)" />
        </g>

        {/* digital readout, set in the dial's lower-mid so it reads with the hands */}
        <text
          x={CX}
          y={CY + 52}
          textAnchor="middle"
          className="fill-[#DCF87C]"
          style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}
        >
          {m}:{s}
          <tspan className="fill-white/50" style={{ fontSize: 15 }}>.{cs}</tspan>
        </text>

        {/* the sweep hand — the chronograph seconds, in the accent */}
        <line
          x1={sweepTail.x}
          y1={sweepTail.y}
          x2={sweepTip.x}
          y2={sweepTip.y}
          stroke="#DCF87C"
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={5} fill="#DCF87C" />
        <circle cx={CX} cy={CY} r={2} fill="#0A0A0A" />
      </svg>

      {/* pushers */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={startStop}
          className="rounded-full bg-[#DCF87C] px-6 py-2 text-sm font-semibold text-black transition-transform active:scale-[0.97]"
        >
          {running ? 'Stop' : elapsed > 0 ? 'Resume' : 'Start'}
        </button>
        <button
          type="button"
          onClick={lapOrReset}
          disabled={zeroed}
          className="rounded-full border border-white/15 px-6 py-2 text-sm font-semibold text-white/70 transition-colors enabled:hover:border-[#DCF87C]/50 enabled:hover:text-[#DCF87C] disabled:opacity-35"
        >
          {running ? 'Lap' : 'Reset'}
        </button>
      </div>

      {/* laps — the splits, newest first, each with its delta from the one before */}
      {laps.length > 0 && (
        <ol className="mt-6 w-full max-w-[360px] space-y-1.5" aria-label="Recorded laps">
          {laps.map((total, idx) => {
            // laps is newest-first, so the split is this lap minus the next-older one
            const prev = laps[idx + 1] ?? 0
            const split = format(total - prev)
            const cume = format(total)
            const num = laps.length - idx
            return (
              <li
                key={idx}
                className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-sm tabular-nums"
              >
                <span className="text-white/40">Lap {num}</span>
                <span className="text-white/85">
                  {split.m}:{split.s}.{split.cs}
                </span>
                <span className="text-white/35">
                  {cume.m}:{cume.s}.{cume.cs}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <span aria-live="polite" className="sr-only">
        {running ? 'Running' : 'Stopped'} at {spokenM} minutes {spokenS} seconds.
      </span>
    </div>
  )
}

export default Chronograph
