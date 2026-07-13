import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * One line in the transcript. A `cmd` is typed out character by character after
 * the prompt; `out` (optional) is the program's response, revealed once the
 * command finishes. A line with only `out` prints as bare output (no prompt).
 */
export interface TerminalLine {
  cmd?: string
  out?: ReactNode
  /** Plain-text mirror of `out`, used for the screen-reader transcript. */
  outText?: string
  /** Pause in ms after this line settles, before the next begins. */
  hold?: number
}

interface TerminalProps {
  lines: TerminalLine[]
  /** The shell prompt shown before each typed command. */
  prompt?: string
  /** Window-chrome title. */
  title?: string
  /** Milliseconds per typed character. */
  typeSpeed?: number
  className?: string
  /** Delay before the first character is typed, once in view. */
  startDelay?: number
}

/** Where the animation currently is: which line, how many chars typed, out shown. */
interface Progress {
  line: number
  typed: number
  outShown: boolean
}

// A blinking block cursor. Framer-driven so reduced-motion callers can hold it
// steady rather than pulse.
function Caret({ steady }: { steady?: boolean }) {
  if (steady) {
    return <span className="ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] bg-[#DCF87C]/80" />
  }
  return (
    <motion.span
      aria-hidden
      className="ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.15em] bg-[#DCF87C]"
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1, times: [0, 0.5, 0.5, 1], repeat: Infinity, ease: 'linear' }}
    />
  )
}

/**
 * A faux terminal that types out an honest transcript, one command at a time,
 * with a blinking caret. It plays once when scrolled into view. Under reduced
 * motion the whole transcript renders instantly with a steady caret, and a
 * visually-hidden plain-text mirror keeps the whole thing legible to
 * screen readers regardless.
 */
export function Terminal({
  lines,
  prompt = 'arseniy@berlin ~ %',
  title = 'zsh — arseniy@berlin',
  typeSpeed = 42,
  className = '',
  startDelay = 320,
}: TerminalProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const [started, setStarted] = useState(false)
  const [progress, setProgress] = useState<Progress>({ line: 0, typed: 0, outShown: false })

  // Start once the terminal scrolls into view.
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setStarted(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  // Drive the type-out. A cancellable async loop; every timeout is tracked and
  // cleared on unmount or when inputs change so nothing runs after teardown.
  useEffect(() => {
    if (!started) return
    if (reduce) {
      setProgress({ line: lines.length, typed: 0, outShown: true })
      return
    }
    let cancelled = false
    const timers: number[] = []
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, ms)
        timers.push(t)
      })

    ;(async () => {
      await wait(startDelay)
      for (let i = 0; i < lines.length; i++) {
        if (cancelled) return
        const l = lines[i]
        setProgress({ line: i, typed: 0, outShown: false })
        if (l.cmd) {
          for (let c = 1; c <= l.cmd.length; c++) {
            if (cancelled) return
            // A touch of jitter so the typing never feels metronomic.
            await wait(typeSpeed + (c % 3 === 0 ? 26 : 0))
            setProgress({ line: i, typed: c, outShown: false })
          }
          await wait(200)
        }
        if (cancelled) return
        setProgress({ line: i, typed: l.cmd?.length ?? 0, outShown: true })
        await wait(l.hold ?? 460)
      }
      if (!cancelled) setProgress({ line: lines.length, typed: 0, outShown: true })
    })()

    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [started, reduce, lines, typeSpeed, startDelay])

  const done = progress.line >= lines.length

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d09] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] ${className}`}
      role="img"
      aria-label="A terminal transcript: an honest short bio, typed out command by command."
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 truncate text-xs font-medium text-white/40">{title}</span>
      </div>

      {/* Body */}
      <div
        aria-hidden
        className="min-h-[15rem] px-5 py-5 font-mono text-[0.82rem] leading-relaxed sm:text-sm"
      >
        {lines.map((l, i) => {
          if (i > progress.line) return null
          const isCurrent = i === progress.line && !done
          const cmdText = l.cmd ? l.cmd.slice(0, isCurrent ? progress.typed : l.cmd.length) : ''
          const outShown = isCurrent ? progress.outShown : true
          const typingCmd = isCurrent && !!l.cmd && !progress.outShown

          return (
            <div key={i} className="whitespace-pre-wrap break-words">
              {l.cmd !== undefined && (
                <div>
                  <span className="text-[#DCF87C]">{prompt}</span>{' '}
                  <span className="text-white/90">{cmdText}</span>
                  {typingCmd && <Caret />}
                </div>
              )}
              {outShown && l.out !== undefined && (
                <div className={l.cmd !== undefined ? 'mt-0.5 text-white/55' : 'text-white/55'}>{l.out}</div>
              )}
            </div>
          )
        })}

        {/* Idle prompt with a resting caret once the whole thing has played. */}
        {done && (
          <div className="mt-0.5">
            <span className="text-[#DCF87C]">{prompt}</span> <Caret steady={!!reduce} />
          </div>
        )}
      </div>

      {/* Full transcript for assistive tech, regardless of animation state. */}
      <div className="sr-only">
        {lines.map((l, i) => (
          <p key={i}>
            {l.cmd ? `${prompt} ${l.cmd}` : ''}
            {l.outText ?? (typeof l.out === 'string' ? l.out : '')}
          </p>
        ))}
      </div>
    </div>
  )
}
