import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// LabelMaker — a Dymo-style embossing label gun, rebuilt as a working display.
//
// It joins the digital-display thread on the site (the dot-matrix sign, the
// flip-dot board, the braille line, the seven-segment and VFD readouts, the
// Nixie tubes) as a new *kind* of machine none of them is: not light switching,
// not discs flipping, not pins rising — a strip of coloured plastic tape with
// raised letters punched into it one squeeze at a time. The honest signature is
// the emboss: a real Dymo letter looks lighter than its tape because the die
// stretches the pigment film as it raises the glyph, so each character here is
// a light ink on the tape colour, lit along its top edge and shadowed below so
// it reads as physically raised rather than printed.
//
// The motion is the gun doing its work: when the line changes, only the letters
// that actually changed stamp in — a quick press (a drop and a punch) rippling
// left to right across the new tail — so typing appends a single fresh letter
// rather than re-punching the whole strip. It is pure DOM and CSS with a
// framer-motion press per glyph; no canvas, no font faked as hardware beyond
// the mono face every label gun wears. Honest and reachable: the strip is one
// role="img" carrying the text as its label, so a reader hears the word, not
// the tape. Under reduced motion nothing presses — the finished label is simply
// shown, every letter already raised.

export interface TapeStyle {
  /** The plastic tape colour. */
  tape: string
  /** The raised-letter ink — a light tint of the tape, the stretched film. */
  ink: string
  /** The lit top edge of the tape, for the sheen. */
  edge: string
}

// Classic embossing-tape colours. Letters always come out lighter than the
// tape, the way the real die leaves them, so every ink here is a pale tint.
export const TAPES: Record<string, TapeStyle> = {
  black: { tape: '#161616', ink: '#ededed', edge: '#3a3a3a' },
  red: { tape: '#9f2d27', ink: '#f4dbd6', edge: '#c54a42' },
  blue: { tape: '#1e3a63', ink: '#d9e2f1', edge: '#36598b' },
  green: { tape: '#1f4a35', ink: '#d8ece0', edge: '#376b4f' },
}

export type TapeColor = keyof typeof TAPES

export interface LabelMakerProps {
  /** The text to emboss. Rendered upper-case, the way the dial only offers. */
  value: string
  /** Tape colour key. Defaults to the classic black. */
  color?: TapeColor
  /** Tape height in px; the glyph size and padding scale from it. */
  height?: number
  /** Seconds between each letter's press in a multi-letter stamp. */
  step?: number
  className?: string
  'aria-label'?: string
}

const EASE = [0.34, 1.2, 0.5, 1] as const

export function LabelMaker({
  value,
  color = 'black',
  height = 72,
  step = 0.06,
  className = '',
  'aria-label': ariaLabel,
}: LabelMakerProps) {
  const reduce = useReducedMotion()
  const style = TAPES[color] ?? TAPES.black

  // Upper-case, since an embossing dial only carries capitals, digits, and a
  // little punctuation — and collapse runs of spaces so the tape stays honest.
  const text = value.toUpperCase().replace(/\s+/g, ' ')
  const chars = text.split('')

  // The previous text, so a change only presses the letters that are genuinely
  // new. `base` is the first index that differs from last render; letters from
  // there rightward ripple in, everything before it stays put.
  const prevRef = useRef('')
  const prev = prevRef.current
  let base = 0
  while (base < chars.length && base < prev.length && chars[base] === prev[base]) {
    base += 1
  }
  useEffect(() => {
    prevRef.current = text
  }, [text])

  const font = Math.round(height * 0.4)
  const padX = Math.round(height * 0.5)
  const minW = Math.round(height * 1.4)

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? text}
      className={`relative inline-flex select-none items-center ${className}`}
      style={{
        height,
        minWidth: minW,
        paddingLeft: padX,
        paddingRight: padX,
        borderRadius: height / 2,
        backgroundColor: style.tape,
        // The raised middle of the tape and the lip at each end — a vertical
        // sheen over the colour, an inset top highlight, and a soft drop below.
        backgroundImage: `linear-gradient(180deg, ${style.edge}55 0%, transparent 22%, transparent 74%, rgba(0,0,0,0.35) 100%)`,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 6px rgba(0,0,0,0.4), 0 10px 24px -12px rgba(0,0,0,0.8)',
      }}
    >
      {/* A faint pressed channel running the length of the tape, where the
          letters sit — the groove the die leaves. Decorative. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-full"
        style={{
          height: Math.round(height * 0.62),
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
          borderRadius: height / 3,
        }}
      />
      <span
        aria-hidden
        className="relative flex items-center font-mono font-bold uppercase"
        style={{ fontSize: font, letterSpacing: '0.14em', lineHeight: 1 }}
      >
        {chars.map((c, i) => {
          const fresh = i >= base
          const space = c === ' '
          // One raised glyph: a light ink with a lit top edge and a shadow
          // below, so it reads as punched up out of the tape.
          const glyph = (
            <span
              style={{
                color: style.ink,
                textShadow:
                  '0 -1px 0 rgba(255,255,255,0.4), 0 1px 1px rgba(0,0,0,0.55), 0 2px 2px rgba(0,0,0,0.35)',
              }}
            >
              {c}
            </span>
          )
          if (space) {
            return (
              <span key={`sp-${i}`} aria-hidden style={{ width: font * 0.5 }} />
            )
          }
          if (reduce) {
            return (
              <span key={`${i}-${c}`} aria-hidden>
                {glyph}
              </span>
            )
          }
          return (
            <motion.span
              // Keying on index+char remounts only the letters that changed, so
              // a changed glyph replays its press and the rest hold still.
              key={`${i}-${c}`}
              aria-hidden
              className="inline-block"
              initial={fresh ? { opacity: 0, scaleY: 0.5, y: -height * 0.12 } : false}
              animate={{ opacity: 1, scaleY: 1, y: 0 }}
              transition={{
                duration: 0.26,
                ease: EASE,
                delay: fresh ? Math.max(0, i - base) * step : 0,
              }}
              style={{ transformOrigin: 'center top' }}
            >
              {glyph}
            </motion.span>
          )
        })}
      </span>
    </div>
  )
}
