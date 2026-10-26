import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'

type KbdSize = 'sm' | 'md' | 'lg'
type KbdTone = 'default' | 'muted'

interface KbdProps {
  children: ReactNode
  /**
   * A physical key (matched against `KeyboardEvent.key`, case-insensitive) that
   * depresses and lights this cap when it is actually held down — so a key
   * legend printed on the page answers the reader's own keyboard. Common
   * symbol legends map to their event names (⌘→Meta, ⇧→Shift, ↵→Enter, esc→
   * Escape, ⎵→space), so you can pass either the symbol you display or the raw
   * key. Purely decorative: this never handles the shortcut, only mirrors it.
   */
  live?: string
  size?: KbdSize
  /** A quieter cap for hints inside dense chrome (nav, dialog footers). */
  tone?: KbdTone
  className?: string
}

// Symbol legends → KeyboardEvent.key, so `live="⌘"` matches the real Meta key.
const KEY_ALIASES: Record<string, string> = {
  '⌘': 'meta',
  cmd: 'meta',
  command: 'meta',
  '⌥': 'alt',
  opt: 'alt',
  option: 'alt',
  '⇧': 'shift',
  '⌃': 'control',
  ctrl: 'control',
  '↵': 'enter',
  '⏎': 'enter',
  return: 'enter',
  '⎋': 'escape',
  esc: 'escape',
  '⌫': 'backspace',
  del: 'delete',
  '⇥': 'tab',
  '␣': ' ',
  '⎵': ' ',
  space: ' ',
  '↑': 'arrowup',
  '↓': 'arrowdown',
  '←': 'arrowleft',
  '→': 'arrowright',
}

function normalize(k: string): string {
  const low = k.toLowerCase()
  return KEY_ALIASES[low] ?? low
}

const SIZES: Record<KbdSize, string> = {
  sm: 'h-5 min-w-[1.25rem] px-1.5 text-[10px]',
  md: 'h-6 min-w-[1.55rem] px-2 text-[11px]',
  lg: 'h-8 min-w-[2rem] px-2.5 text-sm',
}

/**
 * Kbd — one honest keycap. The site named its shortcuts in four slightly
 * different hand-rolled `<kbd>`s (the nav hint, the command palette footer, the
 * keyboard page); this is the single primitive they now share. It reads as a
 * physical key — a lit top bevel over a dark bottom lip — and presses when you
 * push it with the pointer, or, given `live`, when the matching key on your
 * real keyboard goes down, so a printed legend and the keyboard under your
 * hands move together. Decorative only: it is a `<kbd>`, never an interactive
 * control, so it never steals focus or intercepts the shortcut it depicts.
 * Under reduced motion the travel is dropped and only the colour answers.
 */
export function Kbd({ children, live, size = 'md', tone = 'default', className = '' }: KbdProps) {
  const reduce = useReducedMotion()
  const [down, setDown] = useState(false)

  // Mirror the physical key. Passive listeners (no preventDefault), so this
  // never competes with the site's real shortcut handling; cleared on blur and
  // tab-away so a cap can't stick lit if the keyup is missed off-window.
  useEffect(() => {
    if (!live) return
    const want = normalize(live)
    const onDown = (e: KeyboardEvent) => {
      if (normalize(e.key) === want) setDown(true)
    }
    const onUp = (e: KeyboardEvent) => {
      if (normalize(e.key) === want) setDown(false)
    }
    const clear = () => setDown(false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', clear)
    }
  }, [live])

  const restFill =
    tone === 'muted'
      ? 'border-white/10 bg-white/[0.03] text-white/45'
      : 'border-white/15 bg-white/[0.06] text-white/75'
  const restShadow =
    tone === 'muted'
      ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_1.5px_0_rgba(0,0,0,0.45)]'
      : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_0_rgba(0,0,0,0.55)]'

  // Pressed: the lip collapses and the cap sits down. A live press tints lime
  // (the real key is answering); a pointer press just brightens.
  const downFill = live
    ? 'border-[#DCF87C]/55 bg-[#DCF87C]/15 text-[#DCF87C]'
    : 'border-white/20 bg-white/[0.13] text-white'
  const downShadow = 'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'

  const fill = down ? downFill : restFill
  const shadow = down ? downShadow : restShadow
  const travel = reduce ? '' : down ? 'translate-y-[2px]' : 'translate-y-0'

  const release = () => setDown(false)

  return (
    <kbd
      onPointerDown={() => setDown(true)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      className={`inline-flex select-none items-center justify-center gap-1 rounded-md border font-sans font-medium leading-none tabular-nums transition-[transform,box-shadow,background-color,border-color,color] duration-100 ${SIZES[size]} ${fill} ${shadow} ${travel} ${className}`}
    >
      {children}
    </kbd>
  )
}
