import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

// Simon — the colour-memory game, rebuilt as a real object you play.
//
// Distinct from everything else in the toys family. The Dice, the CoinFlip and
// the Magic 8-ball each *resolve* something when you press them; the Turntable
// and the FidgetSpinner are quantities you set in motion and watch decay. None
// of them asks anything back. This one does: it plays a lengthening sequence of
// lit pads and tones, and your job is to return it exactly — one step longer
// every round — so it is the one toy here that is a game of recall, the one
// that tests you rather than settling for you.
//
// Honest in the two ways the family cares about:
//   • The sequence is a real random walk. Each round appends one more pad drawn
//     from Math.random() across the four — nothing scripted, nothing patterned,
//     no seed you could learn. The game you lose is a game you genuinely lost.
//   • The score is the round you actually reached, and the best is the best you
//     actually played this visit. Neither is inflated.
//
// Built without canvas or image: four quarter-circle pads in pure CSS forming
// one disc, each a dark struck surface that *glows* its own hue when lit, with
// a central hub carrying the live status and the round count. Sound is optional
// WebAudio — one clean sine tone per pad (an E-minor-ish arpeggio so a correct
// run is pleasant to hear), created lazily on the first gesture and togglable;
// the family's EuclidRing sets the precedent for an opt-in tone.
//
// a11y: each pad is a real <button> with a colour aria-label, disabled while
// Simon is showing the sequence so you cannot press out of turn; the phase and
// every result are announced through a polite live region. Under reduced motion
// the pad-lift and the springy scale are dropped — a lit pad changes only its
// glow and opacity, never its size or position — so the sequence stays perfectly
// readable with no vestibular travel. The game is identical to play either way.

interface SimonProps {
  /** Diameter of the disc in px. */
  size?: number
  className?: string
}

type Phase = 'idle' | 'watch' | 'go' | 'over'

interface Pad {
  name: string
  /** The hue the pad glows when lit. */
  hue: string
  /** Pitch of this pad's tone, Hz. */
  freq: number
  /** Which outer corner of the disc this quarter rounds into. */
  corner: string
}

// Top-left, top-right, bottom-left, bottom-right — the classic clockwise-ish
// read, each pad a quarter of the disc rounding into its outer corner. The
// palette stays in the site's world (lime leads) rather than the toy-store
// green/red/yellow/blue, and the four tones climb an E-minor arpeggio so a
// correct sequence resolves upward.
const PADS: Pad[] = [
  { name: 'lime', hue: '#DCF87C', freq: 329.63, corner: 'rounded-tl-[100%]' }, // E4
  { name: 'cyan', hue: '#67E8F9', freq: 440.0, corner: 'rounded-tr-[100%]' }, // A4
  { name: 'amber', hue: '#FBBF24', freq: 554.37, corner: 'rounded-bl-[100%]' }, // C#5
  { name: 'violet', hue: '#C4B5FD', freq: 659.25, corner: 'rounded-br-[100%]' }, // E5
]

export function Simon({ size = 260, className = '' }: SimonProps) {
  const reduce = useReducedMotion()
  const id = useId()

  const [sequence, setSequence] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [lit, setLit] = useState<number | null>(null)
  // How many of the current sequence the player has correctly returned.
  const [progress, setProgress] = useState(0)
  const [best, setBest] = useState(0)
  const [sound, setSound] = useState(true)

  // Timers scheduled for the playback; cleared on unmount or restart.
  const timers = useRef<number[]>([])
  // Bumped on every playback/restart so stale scheduled callbacks no-op.
  const runId = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)
  // Mirror of `sound` so timeout callbacks read the live value, not a closure.
  const soundRef = useRef(sound)
  useEffect(() => {
    soundRef.current = sound
  }, [sound])

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (Ctx) audioRef.current = new Ctx()
    }
    return audioRef.current
  }, [])

  // One short sine blip. A soft attack and an exponential release keep it a
  // musical note rather than a click; skipped entirely when sound is off.
  const tone = useCallback(
    (freq: number, durMs: number) => {
      if (!soundRef.current) return
      const ctx = ensureAudio()
      if (!ctx) return
      if (ctx.state === 'suspended') void ctx.resume()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.16, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + durMs / 1000 + 0.03)
    },
    [ensureAudio],
  )

  // A low two-note fall for a wrong answer — the one tone that is not part of
  // the pleasant arpeggio, so losing sounds like losing.
  const buzz = useCallback(() => {
    if (!soundRef.current) return
    const ctx = ensureAudio()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.5)
    gain.gain.setValueAtTime(0.14, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.6)
  }, [ensureAudio])

  // Flash one pad and sound its tone. Returns nothing; purely the visual +
  // audio pulse used both during playback and when the player presses.
  const flash = useCallback(
    (pad: number, durMs: number) => {
      setLit(pad)
      tone(PADS[pad].freq, durMs)
      const off = window.setTimeout(() => {
        setLit((cur) => (cur === pad ? null : cur))
      }, durMs)
      timers.current.push(off)
    },
    [tone],
  )

  // Play a whole sequence back, then hand the turn to the player. Each pad is
  // scheduled against a run token so a restart mid-playback cancels cleanly.
  const playBack = useCallback(
    (seq: number[]) => {
      clearTimers()
      const myRun = ++runId.current
      setPhase('watch')
      setProgress(0)
      setLit(null)
      // Speeds up a touch as the sequence grows, the way the real toy does,
      // but floored so it never outruns a human.
      const lightDur = Math.max(230, 440 - seq.length * 14)
      const gap = lightDur + Math.max(90, 200 - seq.length * 8)
      seq.forEach((pad, i) => {
        const at = window.setTimeout(() => {
          if (myRun !== runId.current) return
          flash(pad, lightDur)
        }, 450 + i * gap)
        timers.current.push(at)
      })
      const done = window.setTimeout(
        () => {
          if (myRun !== runId.current) return
          setPhase('go')
        },
        450 + seq.length * gap + 120,
      )
      timers.current.push(done)
    },
    [clearTimers, flash],
  )

  const nextRound = useCallback(
    (seq: number[]) => {
      const added = [...seq, Math.floor(Math.random() * PADS.length)]
      setSequence(added)
      playBack(added)
    },
    [playBack],
  )

  const start = useCallback(() => {
    // A fresh game: the first gesture also unlocks audio.
    ensureAudio()
    setPhase('idle')
    nextRound([])
  }, [ensureAudio, nextRound])

  const press = useCallback(
    (pad: number) => {
      if (phase !== 'go') return
      flash(pad, 200)
      const expected = sequence[progress]
      if (pad !== expected) {
        // Lost. Score is the number of full rounds survived (length − 1 for
        // the round you fell on), and the best holds the high-water mark.
        clearTimers()
        runId.current++
        const reached = sequence.length - 1
        setBest((b) => Math.max(b, reached))
        setPhase('over')
        buzz()
        return
      }
      const nextProgress = progress + 1
      if (nextProgress === sequence.length) {
        // Round cleared. Record it, then extend after a short breath.
        setBest((b) => Math.max(b, sequence.length))
        setProgress(nextProgress)
        const myRun = runId.current
        const t = window.setTimeout(() => {
          if (myRun !== runId.current) return
          nextRound(sequence)
        }, 620)
        timers.current.push(t)
      } else {
        setProgress(nextProgress)
      }
    },
    [phase, sequence, progress, flash, buzz, clearTimers, nextRound],
  )

  const round = sequence.length
  const status =
    phase === 'idle'
      ? 'Ready'
      : phase === 'watch'
        ? 'Watch'
        : phase === 'go'
          ? 'Your turn'
          : 'Missed it'

  // The live announcement: terse but complete, so a screen reader follows the
  // game without seeing the pads light.
  const announce =
    phase === 'idle'
      ? 'Press start to play.'
      : phase === 'watch'
        ? `Watch round ${round}.`
        : phase === 'go'
          ? `Your turn. Repeat the ${round}-step sequence.`
          : `Wrong pad. You reached round ${round - 1}.`

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="group"
        aria-label="Simon memory game"
      >
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
          {PADS.map((pad, i) => {
            const on = lit === i
            const playable = phase === 'go'
            return (
              <motion.button
                key={pad.name}
                type="button"
                onClick={() => press(i)}
                disabled={!playable}
                aria-label={`${pad.name} pad`}
                className={`${pad.corner} relative overflow-hidden outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-white/70 ${
                  playable ? 'cursor-pointer' : 'cursor-default'
                }`}
                animate={
                  reduce
                    ? { opacity: on ? 1 : 0.9 }
                    : { scale: on ? 1.015 : 1, opacity: on ? 1 : 0.92 }
                }
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 400, damping: 26 }
                }
                style={{
                  background: on
                    ? `radial-gradient(130% 130% at 30% 24%, ${pad.hue} 0%, ${pad.hue}dd 42%, ${pad.hue}99 100%)`
                    : `radial-gradient(130% 130% at 30% 24%, ${pad.hue}1f 0%, ${pad.hue}0f 46%, #0a0b07 100%)`,
                  border: `1px solid ${on ? pad.hue : pad.hue + '33'}`,
                  boxShadow: on
                    ? `0 0 28px ${pad.hue}aa, 0 0 70px ${pad.hue}55, inset 0 2px 10px rgba(255,255,255,0.3)`
                    : 'inset 0 -8px 20px rgba(0,0,0,0.6), inset 0 2px 8px rgba(255,255,255,0.04)',
                }}
              />
            )
          })}
        </div>

        {/* Central hub: carries the status word and the live round count, and
            doubles as the start/restart control when the game is not running. */}
        <div
          className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center rounded-full border border-white/10 bg-[#0b0c08] text-center"
          style={{
            width: size * 0.4,
            height: size * 0.4,
            transform: 'translate(-50%, -50%)',
            boxShadow:
              'inset 0 2px 10px rgba(255,255,255,0.05), inset 0 -10px 24px rgba(0,0,0,0.7), 0 14px 30px rgba(0,0,0,0.5)',
          }}
        >
          {phase === 'idle' || phase === 'over' ? (
            <button
              type="button"
              onClick={start}
              className="flex h-full w-full flex-col items-center justify-center rounded-full outline-none transition hover:text-[#DCF87C] focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
                {phase === 'over' ? status : 'Simon'}
              </span>
              <span className="mt-1 font-display text-lg font-semibold text-[#DCF87C]">
                {phase === 'over' ? 'Again' : 'Start'}
              </span>
            </button>
          ) : (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
                {status}
              </span>
              <span className="mt-1 font-display text-3xl font-semibold tabular-nums text-[#DCF87C]">
                {round}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
                round
              </span>
            </>
          )}
        </div>
      </div>

      <p id={`${id}-live`} aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/* Scoreboard + sound toggle. */}
      <div className="mt-8 flex flex-col items-center">
        <div className="flex items-center gap-8 text-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
              Round
            </div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-white/90">
              {round}
            </div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
              Best
            </div>
            <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#DCF87C]">
              {best}
            </div>
          </div>
        </div>

        <p className="mt-5 max-w-xs text-center text-[11px] leading-relaxed text-white/35">
          {phase === 'go'
            ? `Repeat the sequence — ${progress} of ${round} returned.`
            : phase === 'watch'
              ? 'Watch the pads light, then play them back in order.'
              : phase === 'over'
                ? `You reached round ${round - 1}. The sequence is a fresh random draw every game.`
                : 'Simon lights a pad, then two, then three — return each run and it grows by one.'}
        </p>

        <button
          type="button"
          onClick={() => setSound((s) => !s)}
          aria-pressed={sound}
          className="mt-4 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-white/70 transition hover:border-[#DCF87C]/40 hover:text-white"
        >
          Sound {sound ? 'on' : 'off'}
        </button>
      </div>
    </div>
  )
}
