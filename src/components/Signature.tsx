import type { CSSProperties } from 'react'
import { DrawSVG, type DrawPath } from './DrawSVG'

// The signature, authored once as pen strokes.
//
// A real signature is a flourish, not lettering — a confident single gesture
// that only suggests the letters. So this is one continuous main stroke that
// climbs the "A", runs the humps of "rseni", and drops into a looping "y"
// tail, joined by the A's crossbar, a trailing swash, and a settling underline.
// The pen order matters: the strokes are listed the way a hand would lay them
// down, so DrawSVG's left-to-right stagger reads as writing, not assembling.
//
// It is his name, drawn — the personal mark the site signs off with, distinct
// from DrawSVG's generic HandUnderline swash and from the CircularText seal.
const STROKES: DrawPath[] = [
  // 1 — the body: up the A, over the humps of r·s·e·n·i, into the y descender.
  'M24 104 C30 60 44 30 58 26 C66 24 69 42 70 60 C72 84 74 96 77 104 ' +
    'C83 82 92 69 100 77 C107 84 100 97 109 100 C119 104 127 87 135 81 ' +
    'C143 75 151 93 159 96 C169 100 177 81 185 79 C195 77 199 96 207 98 ' +
    'C217 100 225 83 233 81 C245 79 251 96 259 96 C269 96 277 77 285 75 ' +
    'C297 73 301 100 296 112 C292 124 278 125 272 116',
  // 2 — the A crossbar, a quick left-to-right tick.
  { d: 'M40 74 C55 70 66 70 79 75', strokeWidth: 3, delay: 0.05 },
  // 3 — the flick off the y that finishes the name.
  { d: 'M296 112 C320 108 337 100 357 90', strokeWidth: 3 },
  // 4 — the settling underline, one confident sweep beneath it all.
  { d: 'M20 120 C120 112 258 112 342 101', strokeWidth: 2.5 },
]

/**
 * Signature — Arseniy's name, written by the pen.
 *
 * A specific personal asset, not another motion primitive: hand-authored script
 * strokes fed through the DrawSVG pen so the name traces itself into being,
 * ink-on-paper, in writing order. Use it to sign off a page — the footer, an
 * about close, a contact card.
 *
 * `tone` picks the ink: 'ink' (a warm off-white, the default) reads as pen on
 * dark; 'accent' signs in lime. `height` scales the whole mark; the width
 * follows the 380×130 aspect. Everything else — the inView/mount/loop trigger,
 * the hover replay, the reduced-motion fallback that shows the name already
 * written — comes straight from DrawSVG, so it stays honest to assistive tech
 * and to prefers-reduced-motion for free.
 */
export function Signature({
  height = 72,
  tone = 'ink',
  trigger = 'inView',
  replayOnHover = true,
  className = '',
  style,
}: {
  height?: number
  tone?: 'ink' | 'accent'
  trigger?: 'inView' | 'mount' | 'loop'
  replayOnHover?: boolean
  className?: string
  style?: CSSProperties
}) {
  const stroke = tone === 'accent' ? '#DCF87C' : '#F2F1EA'
  return (
    <DrawSVG
      paths={STROKES}
      viewBox="0 0 380 130"
      stroke={stroke}
      strokeWidth={3.5}
      duration={1.15}
      stagger={0.16}
      trigger={trigger}
      replayOnHover={replayOnHover}
      loopHold={2.2}
      className={className}
      style={{ height, width: (height * 380) / 130, ...style }}
      ariaLabel="Arseniy Cherednichenko, signed"
    />
  )
}
