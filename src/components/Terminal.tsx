import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useContact } from './ContactDialog'
import { useBerlinTime } from '../hooks/useBerlinTime'
import { PROJECTS } from '../data/projects'
import { TOOLKIT } from '../data/toolkit'
import { EMAIL, GITHUB_URL } from '../data/contact'

// An interactive, keyboard-driven terminal — a playful, alternate way to move
// through the site that also doubles as a small showcase of interactive craft.
// Every command maps to something real: pages navigate via the router, `work`
// reads the actual projects data, `stack` reads the toolkit, `contact` opens
// the shared dialog. Nothing here is faked. It is honest about being a toy on
// top of a real site, not a shell with any system access.
//
// Accessibility: the log is an aria-live region, the input is a labelled text
// field, and the whole thing is reachable and operable from the keyboard. Under
// prefers-reduced-motion the boot sequence and caret settle instead of blink.

// The pages a visitor can jump to. Slugs double as `open`/`cd` targets and as
// the `ls` listing, so this list stays the single source of truth here.
const PAGES: { slug: string; to: string; blurb: string }[] = [
  { slug: 'home', to: '/', blurb: 'the landing page' },
  { slug: 'about', to: '/about', blurb: 'who I am, how I work' },
  { slug: 'work', to: '/work', blurb: 'what I have shipped' },
  { slug: 'playground', to: '/playground', blurb: 'live motion experiments' },
  { slug: 'craft', to: '/craft', blurb: 'notes on motion' },
  { slug: 'toolkit', to: '/toolkit', blurb: 'the tools I reach for' },
  { slug: 'writing', to: '/writing', blurb: 'thinking in the open' },
  { slug: 'now', to: '/now', blurb: 'what I am on right now' },
  { slug: 'answers', to: '/answers', blurb: 'questions people ask' },
  { slug: 'resume', to: '/resume', blurb: 'a one-page CV' },
  { slug: 'colophon', to: '/colophon', blurb: 'how this site is built' },
  { slug: 'changelog', to: '/changelog', blurb: 'the build log' },
  { slug: 'contact', to: '/contact', blurb: 'say hello' },
]

type Line = { id: number; kind: 'in' | 'out' | 'err'; node: ReactNode }

// A single output row. Dim leading glyph keeps list output scannable.
function Row({ children }: { children: ReactNode }) {
  return <div className="whitespace-pre-wrap leading-relaxed text-white/70">{children}</div>
}

function Head({ children }: { children: ReactNode }) {
  return <div className="mt-1 font-semibold text-white/85">{children}</div>
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-white/40">{children}</span>
}

function Accent({ children }: { children: ReactNode }) {
  return <span className="text-[#DCF87C]">{children}</span>
}

export function Terminal() {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const { open: openContact } = useContact()
  const { time } = useBerlinTime()

  const [lines, setLines] = useState<Line[]>([])
  const [value, setValue] = useState('')
  // Command history for ArrowUp/ArrowDown recall; -1 means "the live input".
  const history = useRef<string[]>([])
  const [histIndex, setHistIndex] = useState(-1)

  const idRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const push = useCallback((kind: Line['kind'], node: ReactNode) => {
    idRef.current += 1
    setLines((prev) => [...prev, { id: idRef.current, kind, node }])
  }, [])

  // Names shown by `help`, in a deliberate reading order (hidden aliases out).
  const HELP_ORDER = useMemo(
    () => ['help', 'about', 'ls', 'open', 'work', 'guided', 'stack', 'contact', 'motion', 'clear'],
    [],
  )

  // Command registry. Each command returns a node to print, the sentinel
  // 'CLEAR' to wipe the screen, or void when it only has a side effect.
  const commands = useMemo(() => {
    const go = (to: string, label: string): ReactNode => {
      // Defer so the "opening" line paints before the route swaps.
      window.setTimeout(() => navigate(to), 220)
      return (
        <Row>
          Opening <Accent>{label}</Accent>
          <Muted> …</Muted>
        </Row>
      )
    }

    const registry: Record<
      string,
      { summary: string; hidden?: boolean; run: (args: string[]) => ReactNode | 'CLEAR' | void }
    > = {
      help: {
        summary: 'list everything you can do here',
        run: () => (
          <div className="space-y-0.5">
            <Head>Commands</Head>
            {HELP_ORDER.map((name) => (
              <Row key={name}>
                <Accent>{name.padEnd(11)}</Accent>
                <Muted>{registry[name].summary}</Muted>
              </Row>
            ))}
            <Row>
              <Muted>Try </Muted>
              <Accent>open work</Accent>
              <Muted> or just </Muted>
              <Accent>about</Accent>
              <Muted>. Arrow keys recall history, Tab completes.</Muted>
            </Row>
          </div>
        ),
      },
      about: {
        summary: 'a short bio',
        run: () => (
          <div className="space-y-1">
            <Head>Arseniy Cherednichenko</Head>
            <Row>
              Builder based in <Accent>Berlin</Accent>, and a student. Co-founder of Guided, a
              Socratic AI tutor.
            </Row>
            <Row>
              I work mostly in React, TypeScript, and SwiftUI, with a lot of applied AI. I care
              about products that feel effortless — the motion, the type, the small moments.
            </Row>
            <Row>
              <Muted>More at </Muted>
              <Accent>open about</Accent>
              <Muted>.</Muted>
            </Row>
          </div>
        ),
      },
      whoami: { summary: 'same as about', hidden: true, run: (a) => registry.about.run(a) },
      ls: {
        summary: 'list the pages you can visit',
        run: () => (
          <div className="space-y-0.5">
            {PAGES.map((p) => (
              <Row key={p.slug}>
                <Accent>{p.slug.padEnd(12)}</Accent>
                <Muted>{p.blurb}</Muted>
              </Row>
            ))}
            <Row>
              <Muted>Jump with </Muted>
              <Accent>open &lt;name&gt;</Accent>
              <Muted>.</Muted>
            </Row>
          </div>
        ),
      },
      open: {
        summary: 'open a page or project — e.g. open work',
        run: (args) => {
          const target = (args[0] || '').toLowerCase()
          if (!target) {
            return <Row>Usage: <Accent>open &lt;name&gt;</Accent>. Try <Accent>ls</Accent> for names.</Row>
          }
          const page = PAGES.find((p) => p.slug === target)
          if (page) return go(page.to, page.slug)
          const project = PROJECTS.find((p) => p.slug === target && !p.soon)
          if (project) {
            const external = project.href || project.repo
            if (external) {
              window.open(external, '_blank', 'noopener,noreferrer')
              return (
                <Row>
                  Opening <Accent>{project.title}</Accent> in a new tab
                  <Muted> — {external}</Muted>
                </Row>
              )
            }
            return go(`/work/${project.slug}`, project.title)
          }
          return (
            <Row>
              <Muted>Nothing called </Muted>
              <span className="text-white/70">{target}</span>
              <Muted>. Try </Muted>
              <Accent>ls</Accent>
              <Muted> or </Muted>
              <Accent>work</Accent>
              <Muted>.</Muted>
            </Row>
          )
        },
      },
      cd: { summary: 'alias for open', hidden: true, run: (a) => registry.open.run(a) },
      work: {
        summary: 'list the projects',
        run: () => (
          <div className="space-y-1">
            <Head>Selected work</Head>
            {PROJECTS.map((p) =>
              p.soon ? (
                <Row key={p.slug}>
                  <Muted>{'…'.padEnd(12)}</Muted>
                  <Muted>{p.blurb}</Muted>
                </Row>
              ) : (
                <Row key={p.slug}>
                  <Accent>{p.title}</Accent>
                  <Muted>{p.year ? `  ${p.year}` : ''} — {p.blurb}</Muted>
                </Row>
              ),
            )}
            <Row>
              <Muted>Open one with </Muted>
              <Accent>open {PROJECTS[0].slug}</Accent>
              <Muted>.</Muted>
            </Row>
          </div>
        ),
      },
      projects: { summary: 'same as work', hidden: true, run: (a) => registry.work.run(a) },
      guided: {
        summary: 'about Guided',
        run: () => (
          <div className="space-y-1">
            <Head>Guided</Head>
            <Row>
              A Socratic AI tutor for students aged 8 to 18. Instead of handing over answers, it
              asks the questions a good tutor would. Curriculum-aware for the Abitur, IB, and GCSE.
            </Row>
            <Row>
              Web app plus a native iOS app on a shared Supabase backend. I co-founded it and build
              across the whole stack.
            </Row>
            <Row>
              <Muted>Visit it with </Muted>
              <Accent>open guided</Accent>
              <Muted>.</Muted>
            </Row>
          </div>
        ),
      },
      stack: {
        summary: 'the tools I actually use',
        run: () => (
          <div className="space-y-1">
            {TOOLKIT.map((group) => (
              <Row key={group.label}>
                <Accent>{group.label}</Accent>
                <Muted>: {group.tools.map((t) => t.name).join(', ')}</Muted>
              </Row>
            ))}
            <Row>
              <Muted>The full bench is at </Muted>
              <Accent>open toolkit</Accent>
              <Muted>.</Muted>
            </Row>
          </div>
        ),
      },
      toolkit: { summary: 'same as stack', hidden: true, run: (a) => registry.stack.run(a) },
      contact: {
        summary: 'open the contact dialog',
        run: () => {
          window.setTimeout(openContact, 200)
          return (
            <div className="space-y-0.5">
              <Row>
                <Muted>Email  </Muted>
                <Accent>{EMAIL}</Accent>
              </Row>
              <Row>
                <Muted>GitHub </Muted>
                <Accent>{GITHUB_URL.replace('https://', '')}</Accent>
              </Row>
              <Row>
                <Muted>Opening the contact dialog …</Muted>
              </Row>
            </div>
          )
        },
      },
      email: {
        summary: 'copy or open my email',
        run: () => {
          window.open(`mailto:${EMAIL}`, '_self')
          return <Row>Email: <Accent>{EMAIL}</Accent></Row>
        },
      },
      github: {
        summary: 'open my GitHub',
        run: () => {
          window.open(GITHUB_URL, '_blank', 'noopener,noreferrer')
          return <Row>GitHub: <Accent>{GITHUB_URL.replace('https://', '')}</Accent></Row>
        },
      },
      date: {
        summary: 'the time in Berlin',
        run: () => (
          <Row>
            <Accent>{time}</Accent>
            <Muted> — Europe/Berlin, where I am.</Muted>
          </Row>
        ),
      },
      time: { summary: 'same as date', hidden: true, run: (a) => registry.date.run(a) },
      echo: {
        summary: 'echo back what you type',
        run: (args) => <Row>{args.join(' ') || <Muted>(nothing to echo)</Muted>}</Row>,
      },
      motion: {
        summary: 'a note on the animation here',
        run: () => (
          <Row>
            Everything that moves checks <Accent>prefers-reduced-motion</Accent> first and falls
            back to something calm and static. Delight is never forced on anyone.
          </Row>
        ),
      },
      theme: {
        summary: 'about the look',
        run: () => (
          <Row>
            Dark, by design — one considered palette with a single lime accent{' '}
            <Accent>#DCF87C</Accent>. No theme switch to maintain, no half-tuned second skin.
          </Row>
        ),
      },
      sudo: {
        summary: 'try to run as root',
        hidden: true,
        run: () => (
          <Row>
            <Muted>Nice try. This is a portfolio, not a shell — no root here, only pixels.</Muted>
          </Row>
        ),
      },
      exit: {
        summary: 'leave the terminal',
        hidden: true,
        run: () => go('/', 'home'),
      },
      clear: { summary: 'clear the screen', run: () => 'CLEAR' as const },
    }
    return registry
  }, [navigate, openContact, time, HELP_ORDER])

  const run = useCallback(
    (raw: string) => {
      const input = raw.trim()
      push('in', input)
      if (!input) return
      history.current = [...history.current, input]
      setHistIndex(-1)
      const [name, ...args] = input.split(/\s+/)
      const cmd = commands[name.toLowerCase()]
      if (!cmd) {
        push(
          'err',
          <Row>
            <span className="text-white/70">{name}</span>
            <Muted>: command not found. Type </Muted>
            <Accent>help</Accent>
            <Muted>.</Muted>
          </Row>,
        )
        return
      }
      const result = cmd.run(args)
      if (result === 'CLEAR') {
        setLines([])
        return
      }
      if (result) push('out', result)
    },
    [commands, push],
  )

  // Boot banner — printed once on mount. Reduced motion shows it instantly.
  useEffect(() => {
    push(
      'out',
      <div className="space-y-0.5">
        <Head>arseniy@portfolio</Head>
        <Row>
          <Muted>An interactive way in. Type </Muted>
          <Accent>help</Accent>
          <Muted> to see what it knows, or </Muted>
          <Accent>ls</Accent>
          <Muted> to look around.</Muted>
        </Row>
      </div>,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the newest output in view, and keep focus in the input.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      run(value)
      setValue('')
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const h = history.current
      if (!h.length) return
      const next = histIndex === -1 ? h.length - 1 : Math.max(0, histIndex - 1)
      setHistIndex(next)
      setValue(h[next])
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const h = history.current
      if (histIndex === -1) return
      const next = histIndex + 1
      if (next >= h.length) {
        setHistIndex(-1)
        setValue('')
      } else {
        setHistIndex(next)
        setValue(h[next])
      }
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const token = value.trim().toLowerCase()
      if (!token || token.includes(' ')) return
      const names = Object.keys(commands).filter((n) => !commands[n].hidden)
      const match = names.find((n) => n.startsWith(token))
      if (match) setValue(match + ' ')
    }
  }

  // Clicking the frame focuses the input, unless the user is selecting text.
  const focusInput = () => {
    if (window.getSelection()?.toString()) return
    inputRef.current?.focus()
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0C0C0C] shadow-2xl shadow-black/40"
      onClick={focusInput}
    >
      {/* Title bar with the usual three dots — honest window chrome, no OS. */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-white/15" />
        <span className="h-3 w-3 rounded-full bg-white/15" />
        <span className="h-3 w-3 rounded-full bg-[#DCF87C]/60" />
        <span className="ml-3 text-xs font-medium text-white/35">arseniy@portfolio — bash</span>
      </div>

      <div
        ref={scrollRef}
        className="h-[26rem] overflow-y-auto px-4 py-4 font-mono text-[13px] sm:text-sm"
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
      >
        {lines.map((line) => (
          <div key={line.id} className="mb-1">
            {line.kind === 'in' ? (
              <div className="flex gap-2">
                <span className="select-none text-[#DCF87C]/70">$</span>
                <span className="text-white/85">{line.node}</span>
              </div>
            ) : line.kind === 'err' ? (
              <div className="text-rose-300/80">{line.node}</div>
            ) : (
              <div>{line.node}</div>
            )}
          </div>
        ))}

        {/* Live prompt line. */}
        <div className="flex items-center gap-2">
          <span className="select-none text-[#DCF87C]/70">$</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-label="Terminal input — type a command and press Enter"
            className="flex-1 bg-transparent font-mono text-[13px] text-white caret-[#DCF87C] outline-none placeholder:text-white/25 sm:text-sm"
            placeholder="type a command, e.g. help"
          />
        </div>
      </div>
    </motion.div>
  )
}
