import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useId, useRef, useState } from 'react'

// A Magic 8-Ball you actually shake. Not a card, a field, or a text effect but
// a small *object with a verdict*: ask it a yes/no question, press, and the
// triangular die floats up through the murk of the window with one of the
// twenty classic replies. The answer is an honest draw — one Math.random()
// across the real twenty, nothing weighted, nothing that reads your question.
// The input is flavour: typing a question and pressing Enter just triggers the
// same fair shake. The copy around it says so, so the toy never pretends to be
// an oracle.
//
// Distinct from its neighbours in the toys family. The Dice is a throw that
// settles on a face; the Turntable is a wheel you give momentum to; the Abacus
// holds a number you set by hand. This is a *question answered* — a shake, a
// sink into the dark, and a rise back with a reply — and it is the one toy here
// that returns words rather than a number or a position.
//
// Built as pure inline SVG and transforms (no canvas, no WebGL), so the glossy
// sphere and the deep-blue window stay crisp at any size and in both themes.
// The three tones (affirmative, neutral, negative) only tint the die's glow;
// the house lime stays the accent, on the "8" badge and the controls.
//
// Honest to a11y: the ball is a real button with an aria-label, the question
// field is a labelled input, and the revealed reply is announced through an
// aria-live region. Under reduced motion there is no shake and no sink — the
// die simply crossfades to the new reply and holds still, so it stays a usable,
// legible toy.

interface MagicEightBallProps {
  /** Diameter of the ball in px. */
  size?: number
  className?: string
}

type Tone = 'yes' | 'maybe' | 'no'

interface Reply {
  text: string
  tone: Tone
}

// The real twenty, in the canonical split: ten affirmative, five non-committal,
// five negative. No invented lines — this is the standard set.
const REPLIES: readonly Reply[] = [
  { text: 'It is certain.', tone: 'yes' },
  { text: 'It is decidedly so.', tone: 'yes' },
  { text: 'Without a doubt.', tone: 'yes' },
  { text: 'Yes, definitely.', tone: 'yes' },
  { text: 'You may rely on it.', tone: 'yes' },
  { text: 'As I see it, yes.', tone: 'yes' },
  { text: 'Most likely.', tone: 'yes' },
  { text: 'Outlook good.', tone: 'yes' },
  { text: 'Yes.', tone: 'yes' },
  { text: 'Signs point to yes.', tone: 'yes' },
  { text: 'Reply hazy, try again.', tone: 'maybe' },
  { text: 'Ask again later.', tone: 'maybe' },
  { text: 'Better not tell you now.', tone: 'maybe' },
  { text: 'Cannot predict now.', tone: 'maybe' },
  { text: 'Concentrate and ask again.', tone: 'maybe' },
  { text: "Don't count on it.", tone: 'no' },
  { text: 'My reply is no.', tone: 'no' },
  { text: 'My sources say no.', tone: 'no' },
  { text: 'Outlook not so good.', tone: 'no' },
  { text: 'Very doubtful.', tone: 'no' },
] as const

// Per-tone glow for the die face. Deliberately muted — the window reads as deep
// blue ink first, the tint is a hint rather than a verdict colour.
const TONE_GLOW: Record<Tone, string> = {
  yes: 'rgba(126, 224, 200, 0.45)',
  maybe: 'rgba(196, 165, 255, 0.4)',
  no: 'rgba(255, 159, 178, 0.4)',
}

type Phase = 'idle' | 'shaking' | 'settled'

export function MagicEightBall({ size = 240, className = '' }: MagicEightBallProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const [reply, setReply] = useState<Reply | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [question, setQuestion] = useState('')
  // Bumped on every reveal so the die re-mounts and replays its rise even when
  // the same reply is drawn twice in a row.
  const [nonce, setNonce] = useState(0)
  const timers = useRef<number[]>([])

  const ask = useCallback(() => {
    if (phase === 'shaking') return
    // Clear any timers still in flight from a previous ask.
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    const next = REPLIES[Math.floor(Math.random() * REPLIES.length)]

    if (reduce) {
      // No shake, no sink: crossfade straight to the new reply.
      setReply(next)
      setPhase('settled')
      setNonce((n) => n + 1)
      return
    }

    // Shake first with the window dark, then let the die rise with the reply.
    setPhase('shaking')
    setReply(null)
    timers.current.push(
      window.setTimeout(() => {
        setReply(next)
        setPhase('settled')
        setNonce((n) => n + 1)
      }, 520),
    )
  }, [phase, reduce])

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      ask()
    },
    [ask],
  )

  const S = size
  const shaking = phase === 'shaking'
  const glow = reply ? TONE_GLOW[reply.tone] : TONE_GLOW.maybe

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div style={{ width: S, height: S }} className="relative flex items-center justify-center">
        <motion.button
          type="button"
          onClick={ask}
          disabled={shaking}
          aria-describedby={`${id}-live`}
          aria-label={
            reply
              ? `Magic 8-ball. It says: ${reply.text}. Press to ask again.`
              : 'Magic 8-ball. Press to ask.'
          }
          className="relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 disabled:cursor-default"
          style={{ width: S, height: S }}
          animate={
            shaking && !reduce
              ? { rotate: [0, -7, 6, -5, 4, -2, 0], x: [0, -5, 5, -4, 3, -1, 0] }
              : { rotate: 0, x: 0 }
          }
          transition={shaking && !reduce ? { duration: 0.5, ease: 'easeInOut' } : { duration: 0.2 }}
        >
          <svg
            viewBox="0 0 200 200"
            width={S}
            height={S}
            aria-hidden
            style={{ display: 'block' }}
          >
            <defs>
              <radialGradient id={`${id}-ball`} cx="38%" cy="32%" r="78%">
                <stop offset="0%" stopColor="#3a3a3a" />
                <stop offset="42%" stopColor="#161616" />
                <stop offset="100%" stopColor="#040404" />
              </radialGradient>
              <radialGradient id={`${id}-window`} cx="50%" cy="38%" r="70%">
                <stop offset="0%" stopColor="#1b2a6b" />
                <stop offset="60%" stopColor="#0b1130" />
                <stop offset="100%" stopColor="#05081c" />
              </radialGradient>
              <radialGradient id={`${id}-sheen`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <clipPath id={`${id}-clip`}>
                <circle cx="100" cy="118" r="52" />
              </clipPath>
            </defs>

            {/* The sphere */}
            <circle cx="100" cy="100" r="96" fill={`url(#${id}-ball)`} />
            <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            {/* Specular highlight, top-left */}
            <ellipse cx="66" cy="58" rx="34" ry="22" fill={`url(#${id}-sheen)`} opacity="0.7" />

            {/* The "8" badge, upper centre */}
            <circle cx="100" cy="52" r="20" fill="#f4f4f0" />
            <text
              x="100"
              y="53"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="26"
              fontWeight="700"
              fill="#0a0a0a"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              8
            </text>

            {/* The answer window */}
            <g clipPath={`url(#${id}-clip)`}>
              <circle cx="100" cy="118" r="52" fill={`url(#${id}-window)`} />
              {/* Murk that deepens while shaking */}
              <motion.circle
                cx="100"
                cy="118"
                r="52"
                fill="#05081c"
                animate={{ opacity: shaking ? 0.92 : 0 }}
                transition={{ duration: shaking ? 0.3 : 0.6 }}
              />
              {/* The die face: an upward triangle that rises on reveal */}
              {reply && (
                <motion.g
                  key={nonce}
                  initial={reduce ? false : { y: 26, opacity: 0, scale: 0.82 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={
                    reduce
                      ? { duration: 0.2 }
                      : { type: 'spring', stiffness: 120, damping: 14, mass: 0.9 }
                  }
                >
                  <polygon
                    points="100,86 134,142 66,142"
                    fill="#111a4d"
                    stroke={glow}
                    strokeWidth="1.5"
                    style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
                  />
                  <foreignObject x="68" y="104" width="64" height="40">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        width: '100%',
                        textAlign: 'center',
                        lineHeight: 1.05,
                        color: '#eef1ff',
                        fontSize: 8.5,
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                      }}
                    >
                      {reply.text}
                    </div>
                  </foreignObject>
                </motion.g>
              )}
            </g>
            {/* Glass rim of the window */}
            <circle cx="100" cy="118" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          </svg>
        </motion.button>
      </div>

      <div className="mt-8 flex w-full max-w-sm flex-col items-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
          {reply ? 'It says' : 'Ask a question'}
        </span>
        <span
          id={`${id}-live`}
          aria-live="polite"
          className="mt-2 min-h-[2.4em] text-center font-display text-2xl font-semibold leading-tight text-[#DCF87C]"
        >
          {shaking ? '…' : reply ? reply.text : 'Shake for an answer'}
        </span>

        <form onSubmit={onSubmit} className="mt-5 flex w-full items-center gap-2">
          <label htmlFor={`${id}-q`} className="sr-only">
            Ask the 8-ball a yes or no question
          </label>
          <input
            id={`${id}-q`}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will it ship today?"
            className="min-w-0 flex-1 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/85 placeholder:text-white/30 focus:border-[#DCF87C]/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={shaking}
            className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2 text-sm font-medium text-white/80 transition hover:border-[#DCF87C]/40 hover:text-white disabled:opacity-40"
          >
            {shaking ? 'Shaking…' : 'Shake'}
          </button>
        </form>
      </div>
    </div>
  )
}
