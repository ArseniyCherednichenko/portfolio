import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useReducedMotion } from 'framer-motion'

// ---------------------------------------------------------------------------
// A tone matrix — the grid instrument in the lineage of Toshio Iwai's
// Tenori-on and André Michelle's ToneMatrix. Paint cells on a grid of pitch
// (up the rows) against time (across the columns); a playhead sweeps the
// columns at tempo and every lit cell in the column it lands on sounds its
// note. It is the melodic counterpart to the two rhythm pieces beside it: the
// Euclidean ring *spaces* a single pulse and the Metronome *counts* a beat, but
// this one lets you actually compose a line.
//
// The rows are tuned to a pentatonic scale on purpose. A pentatonic has no
// semitone clashes, so any set of cells you turn on lands in tune with any
// other — scribble at random and it still sounds like music, which is the whole
// charm of the toy and what makes it inviting rather than a theory exercise.
// ---------------------------------------------------------------------------

const ROWS = 8
const STEPS = 16
const MIN_BPM = 50
const MAX_BPM = 200

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// A deterministic PRNG so the grid opens on the *same* phrase every load, the
// way the Euclidean ring opens on a tresillo — a seeded start, not per-frame
// entropy on the hot path.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// C major pentatonic climbing two octaves: C D E G A C D E. Row 0 is the LOWEST
// pitch and is drawn at the bottom; index up the array climbs the scale. The
// frequencies are C4-based (261.63 Hz) shifted by equal-temperament semitones,
// so the ladder is genuinely in tune, not eyeballed.
const SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16]
const C4 = 261.6256
const FREQS = SEMITONES.map((s) => C4 * Math.pow(2, s / 12))
const NOTE_NAMES = ['C', 'D', 'E', 'G', 'A', 'C', 'D', 'E']
const NOTE_OCTAVE = [4, 4, 4, 4, 4, 5, 5, 5]
const noteLabel = (row: number) => `${NOTE_NAMES[row]}${NOTE_OCTAVE[row]}`

// The starting phrase — a gentle rising-and-falling seeded sprinkle, thinned so
// the grid opens sparse and legible rather than as a wall of light.
function seedGrid(): boolean[][] {
  const rand = mulberry32(20260913)
  const g: boolean[][] = Array.from({ length: ROWS }, () =>
    new Array<boolean>(STEPS).fill(false),
  )
  for (let c = 0; c < STEPS; c++) {
    // one contour note that arcs up then down across the bar, plus the odd
    // sparse accent — enough to sound like a phrase, never crowded.
    const arc = Math.sin((c / (STEPS - 1)) * Math.PI)
    const row = clamp(Math.round(1 + arc * (ROWS - 3)), 0, ROWS - 1)
    if (rand() < 0.72) g[row][c] = true
    if (rand() < 0.14) g[clamp(row + (rand() < 0.5 ? 2 : -2), 0, ROWS - 1)][c] = true
  }
  return g
}

const emptyGrid = (): boolean[][] =>
  Array.from({ length: ROWS }, () => new Array<boolean>(STEPS).fill(false))

// A small polyphonic WebAudio voice: a soft plucked tone per note, warmed with
// a quiet octave partial and rolled off through a lowpass so a whole column
// firing at once reads as a chord, not a click. Held behind one lazily-built
// context, always optional — the matrix is fully usable and legible silent, and
// nothing here runs until the listener asks for sound and the browser has a
// gesture to unlock it.
class Voice {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null

  resume() {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!AC) return
      if (!this.ctx) {
        this.ctx = new AC()
        this.bus = this.ctx.createGain()
        this.bus.gain.value = 0.9
        this.bus.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch {
      this.ctx = null
      this.bus = null
    }
  }

  // Play a set of frequencies together. Level is scaled by the count so a full
  // column stays well short of clipping.
  play(freqs: number[]) {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus || freqs.length === 0) return
    try {
      const now = ctx.currentTime
      const peak = 0.16 / Math.sqrt(freqs.length)
      for (const f of freqs) {
        const osc = ctx.createOscillator()
        const partial = ctx.createOscillator()
        const gain = ctx.createGain()
        const lp = ctx.createBiquadFilter()
        osc.type = 'triangle'
        partial.type = 'sine'
        osc.frequency.setValueAtTime(f, now)
        partial.frequency.setValueAtTime(f * 2, now)
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(Math.min(f * 6, 7000), now)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
        osc.connect(gain)
        partial.connect(gain)
        gain.connect(lp).connect(bus)
        osc.start(now)
        partial.start(now)
        osc.stop(now + 0.5)
        partial.stop(now + 0.5)
      }
    } catch {
      /* a single missed note is never worth throwing over */
    }
  }

  close() {
    try {
      void this.ctx?.close()
    } catch {
      /* ignore */
    }
    this.ctx = null
    this.bus = null
  }
}

/**
 * A tone matrix. Paint cells across a grid of pitch (up) against time (across);
 * press play and a playhead sweeps the columns at the set tempo, sounding every
 * lit cell as it passes. The rows are a pentatonic scale, so whatever you draw
 * lands in tune.
 *
 * The grid is a real keyboard-navigable field: arrow keys move a roving focus,
 * Space or Enter toggles a cell, and every cell carries an aria-label naming its
 * note and step and an aria-pressed state. The transport is a real play/pause
 * button, sound is an optional toggle off by default, and a polite live region
 * reports playing state and how many notes are lit. Under prefers-reduced-motion
 * the playhead steps column to column with no sweep and the note flashes come
 * off — it still plays, and every state stays legible.
 */
export function ToneMatrix({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion()
  const baseId = useId()

  const [grid, setGrid] = useState<boolean[][]>(seedGrid)
  const [playing, setPlaying] = useState(false)
  const [sound, setSound] = useState(false)
  const [bpm, setBpm] = useState(110)
  const [col, setCol] = useState(-1)
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: ROWS - 3, c: 0 })

  // Refs the rAF loop reads without re-subscribing.
  const gridRef = useRef(grid)
  gridRef.current = grid
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const soundRef = useRef(sound)
  soundRef.current = sound
  const voiceRef = useRef<Voice | null>(null)

  const rafRef = useRef<number | null>(null)
  const accRef = useRef(0)
  const lastRef = useRef(0)

  const cellRefs = useRef<(HTMLButtonElement | null)[][]>([])

  const noteCount = grid.reduce(
    (a, row) => a + row.reduce((b, on) => b + (on ? 1 : 0), 0),
    0,
  )

  // Ring every lit cell in a column at once.
  const fireColumn = useCallback((c: number) => {
    if (!soundRef.current) return
    const g = gridRef.current
    const freqs: number[] = []
    for (let r = 0; r < ROWS; r++) if (g[r][c]) freqs.push(FREQS[r])
    if (freqs.length) voiceRef.current?.play(freqs)
  }, [])

  // ---- The transport clock ------------------------------------------------
  // Each column is an eighth note, so a 16-step loop is two bars and a melody
  // breathes rather than machine-gunning. Timing runs off one rAF loop
  // accumulating real elapsed time, not the wall clock, so a stalled tab
  // resumes cleanly instead of firing a burst of columns.
  useEffect(() => {
    if (!playing) return
    accRef.current = 0
    lastRef.current = performance.now()
    setCol((prev) => {
      const next = prev < 0 || prev >= STEPS ? 0 : (prev + 1) % STEPS
      fireColumn(next)
      return next
    })

    const loop = (now: number) => {
      const stepMs = 60000 / bpmRef.current / 2
      accRef.current += now - lastRef.current
      lastRef.current = now
      if (accRef.current >= stepMs) {
        accRef.current = accRef.current % stepMs
        setCol((prev) => {
          const next = (prev + 1) % STEPS
          fireColumn(next)
          return next
        })
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [playing, fireColumn])

  useEffect(() => () => voiceRef.current?.close(), [])

  const ensureVoice = useCallback(() => {
    if (!voiceRef.current) voiceRef.current = new Voice()
    voiceRef.current.resume()
  }, [])

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      const next = !p
      if (next && soundRef.current) ensureVoice()
      if (!next) setCol(-1)
      return next
    })
  }, [ensureVoice])

  const toggleSound = useCallback(() => {
    setSound((s) => {
      const next = !s
      if (next) ensureVoice()
      return next
    })
  }, [ensureVoice])

  const toggleCell = useCallback(
    (r: number, c: number) => {
      setGrid((prev) => {
        const next = prev.slice()
        const row = next[r].slice()
        row[c] = !row[c]
        next[r] = row
        // A tap on a lit cell while paused should be audible feedback if sound
        // is on, so the instrument responds even when not running.
        if (row[c] && soundRef.current && !playing) voiceRef.current?.play([FREQS[r]])
        return next
      })
    },
    [playing],
  )

  const clear = useCallback(() => setGrid(emptyGrid()), [])
  const reseed = useCallback(() => setGrid(seedGrid()), [])

  // ---- Roving focus across the grid --------------------------------------
  const moveFocus = useCallback((r: number, c: number) => {
    const rr = clamp(r, 0, ROWS - 1)
    const cc = clamp(c, 0, STEPS - 1)
    setFocus({ r: rr, c: cc })
    cellRefs.current[rr]?.[cc]?.focus()
  }, [])

  const onCellKey = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>, r: number, c: number) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          moveFocus(r - 1, c)
          break
        case 'ArrowDown':
          e.preventDefault()
          moveFocus(r + 1, c)
          break
        case 'ArrowLeft':
          e.preventDefault()
          moveFocus(r, c - 1)
          break
        case 'ArrowRight':
          e.preventDefault()
          moveFocus(r, c + 1)
          break
        case 'Home':
          e.preventDefault()
          moveFocus(r, 0)
          break
        case 'End':
          e.preventDefault()
          moveFocus(r, STEPS - 1)
          break
        default:
      }
    },
    [moveFocus],
  )

  // Rows are drawn top (highest pitch) to bottom (lowest), so iterate the pitch
  // ladder in reverse for display while keeping row 0 = lowest in the data.
  const displayRows = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i)

  return (
    <div className={`w-full ${className}`}>
      {/* -------------------------------------------------- Transport --- */}
      <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-pressed={playing}
          className="inline-flex items-center gap-2 rounded-full bg-[#DCF87C] px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.03] active:scale-95"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {playing ? 'Pause' : 'Play'}
        </button>

        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
            sound
              ? 'border-[#DCF87C]/50 bg-[#DCF87C]/10 text-[#DCF87C]'
              : 'border-white/15 text-white/60 hover:text-white'
          }`}
        >
          {sound ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M11 5 6 9H2v6h4l5 4z" />
              <line x1="22" y1="9" x2="16" y2="15" />
              <line x1="16" y1="9" x2="22" y2="15" />
            </svg>
          )}
          {sound ? 'Sound on' : 'Sound off'}
        </button>

        <div className="mx-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBpm((b) => clamp(b - 5, MIN_BPM, MAX_BPM))}
            disabled={bpm <= MIN_BPM}
            aria-label="Decrease tempo"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div
            role="spinbutton"
            tabIndex={0}
            aria-label="Tempo"
            aria-valuenow={bpm}
            aria-valuemin={MIN_BPM}
            aria-valuemax={MAX_BPM}
            aria-valuetext={`${bpm} bpm`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                e.preventDefault()
                setBpm((b) => clamp(b + 5, MIN_BPM, MAX_BPM))
              } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                e.preventDefault()
                setBpm((b) => clamp(b - 5, MIN_BPM, MAX_BPM))
              } else if (e.key === 'Home') {
                e.preventDefault()
                setBpm(MIN_BPM)
              } else if (e.key === 'End') {
                e.preventDefault()
                setBpm(MAX_BPM)
              }
            }}
            className="min-w-[4.5rem] rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-center font-mono text-sm tabular-nums text-white outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/50"
          >
            {bpm} bpm
          </div>
          <button
            type="button"
            onClick={() => setBpm((b) => clamp(b + 5, MIN_BPM, MAX_BPM))}
            disabled={bpm >= MAX_BPM}
            aria-label="Increase tempo"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={reseed}
          className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/55 transition-colors hover:border-white/25 hover:text-white"
        >
          Seed
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={noteCount === 0}
          className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/55 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          Clear
        </button>
      </div>

      {/* ----------------------------------------------------- The grid --- */}
      <div className="mx-auto max-w-[540px]">
        <div
          role="group"
          aria-label="Tone matrix — pitch up the rows, time across the columns"
          className="flex flex-col gap-1.5"
        >
          {displayRows.map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="w-6 shrink-0 text-right font-mono text-[10px] text-white/25"
              >
                {noteLabel(r)}
              </span>
              <div className="flex flex-1 gap-1.5">
                {Array.from({ length: STEPS }, (_, c) => {
                  const on = grid[r][c]
                  const activeCol = c === col
                  const firing = activeCol && on
                  const isFocus = focus.r === r && focus.c === c
                  // A faint beat grouping: every fourth column reads as a bar
                  // line so the eye can keep place across the loop.
                  const barEdge = c % 4 === 0
                  return (
                    <button
                      key={c}
                      type="button"
                      ref={(el) => {
                        if (!cellRefs.current[r]) cellRefs.current[r] = []
                        cellRefs.current[r][c] = el
                      }}
                      tabIndex={isFocus ? 0 : -1}
                      aria-pressed={on}
                      aria-label={`${noteLabel(r)}, step ${c + 1}: ${on ? 'on' : 'off'}`}
                      onFocus={() => setFocus({ r, c })}
                      onClick={() => toggleCell(r, c)}
                      onKeyDown={(e) => onCellKey(e, r, c)}
                      style={{
                        transition: reduce
                          ? 'none'
                          : 'background-color 120ms ease, transform 120ms ease, box-shadow 160ms ease',
                        transform: firing && !reduce ? 'scale(1.14)' : 'scale(1)',
                        boxShadow: firing
                          ? '0 0 14px 2px rgba(220,248,124,0.55)'
                          : 'none',
                      }}
                      className={[
                        'aspect-square flex-1 rounded-[5px] outline-none',
                        'focus-visible:ring-2 focus-visible:ring-[#DCF87C] focus-visible:ring-offset-1 focus-visible:ring-offset-black',
                        on
                          ? firing
                            ? 'bg-[#DCF87C]'
                            : activeCol
                              ? 'bg-[#DCF87C]/90'
                              : 'bg-[#DCF87C]/75 hover:bg-[#DCF87C]'
                          : activeCol
                            ? barEdge
                              ? 'bg-white/[0.14]'
                              : 'bg-white/[0.11]'
                            : barEdge
                              ? 'bg-white/[0.06] hover:bg-white/15'
                              : 'bg-white/[0.035] hover:bg-white/15',
                      ].join(' ')}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center font-mono text-xs text-white/45" aria-live="polite">
        {playing ? 'Playing' : 'Stopped'} — {noteCount} {noteCount === 1 ? 'note' : 'notes'} lit,{' '}
        {bpm} bpm, C pentatonic
      </p>
    </div>
  )
}
