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
import { COMPONENT_COUNT, PAGE_COUNT } from '../data/stats'
import { LOCATION, NOW_ITEMS } from '../data/now'

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
  { slug: 'start', to: '/start', blurb: 'where to begin, by what brought you' },
  { slug: 'about', to: '/about', blurb: 'who I am, how I work' },
  { slug: 'work', to: '/work', blurb: 'what I have shipped' },
  { slug: 'playground', to: '/playground', blurb: 'live motion experiments' },
  { slug: 'reel', to: '/reel', blurb: 'a full-screen showreel' },
  { slug: 'craft', to: '/craft', blurb: 'notes on motion' },
  { slug: 'taste', to: '/taste', blurb: 'plain vs considered' },
  { slug: 'design', to: '/design', blurb: 'the style guide' },
  { slug: 'toolkit', to: '/toolkit', blurb: 'the tools I reach for' },
  { slug: 'writing', to: '/writing', blurb: 'thinking in the open' },
  { slug: 'now', to: '/now', blurb: 'what I am on right now' },
  { slug: 'berlin', to: '/berlin', blurb: 'the place the work is made from' },
  { slug: 'journey', to: '/journey', blurb: 'the way here, as a path' },
  { slug: 'uses', to: '/uses', blurb: 'the setup behind the work' },
  { slug: 'principles', to: '/principles', blurb: 'the manifesto, eight beliefs' },
  { slug: 'answers', to: '/answers', blurb: 'questions people ask' },
  { slug: 'resume', to: '/resume', blurb: 'a one-page CV' },
  { slug: 'colophon', to: '/colophon', blurb: 'how this site is built' },
  { slug: 'changelog', to: '/changelog', blurb: 'the build log' },
  { slug: 'contact', to: '/contact', blurb: 'say hello' },
  { slug: 'contents', to: '/contents', blurb: 'the index of everything' },
  { slug: 'atlas', to: '/atlas', blurb: 'the site as a constellation' },
  { slug: 'library', to: '/library', blurb: 'every component, catalogued' },
]

type Line = { id: number; kind: 'in' | 'out' | 'err'; node: ReactNode }

// The longest string that every candidate starts with — used so Tab completes
// as far as it unambiguously can (like a real shell), not only on a lone match.
function commonPrefix(words: string[]): string {
  if (!words.length) return ''
  let prefix = words[0]
  for (const w of words.slice(1)) {
    let i = 0
    while (i < prefix.length && i < w.length && prefix[i] === w[i]) i += 1
    prefix = prefix.slice(0, i)
    if (!prefix) break
  }
  return prefix
}

// Classic edit distance, capped small — powers the "did you mean?" hint on an
// unknown command so a near-miss (e.g. `oepn`, `contct`) still points home.
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

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
    () => [
      'help', 'about', 'neofetch', 'ls', 'open', 'work', 'now', 'guided', 'stack',
      'date', 'github', 'contact', 'history', 'theme', 'motion', 'clear',
    ],
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
      now: {
        summary: 'what I am focused on right now',
        run: () => {
          // Reads the real /now entries — the same source the Now page renders —
          // and shows only the genuine focuses, skipping any placeholder prompts
          // so the terminal never states a claim the page itself does not make.
          const current = NOW_ITEMS.filter((i) => !i.placeholder)
          // Pad every label to the widest one so the titles form a clean column,
          // whatever the labels happen to be — no fixed width to overflow.
          const labelWidth = Math.max(...current.map((i) => i.label.length))
          return (
            <div className="space-y-1">
              <Head>Right now</Head>
              {current.map((item) => (
                <Row key={item.title}>
                  <Accent>{item.label.padEnd(labelWidth)}</Accent>
                  <Muted>  </Muted>
                  <span className="text-white/75">{item.title}</span>
                </Row>
              ))}
              <Row>
                <Muted>The fuller picture is at </Muted>
                <Accent>open now</Accent>
                <Muted>.</Muted>
              </Row>
            </div>
          )
        },
      },
      neofetch: {
        summary: 'the system card — me and this site, at a glance',
        run: () => {
          // A neofetch-style card. Every figure is read from the site's own
          // single sources (stats, the now page, the contact data) so the card
          // can never quietly disagree with the pages it summarises.
          const fields: [string, ReactNode][] = [
            ['host', <Accent>arseniy@portfolio</Accent>],
            ['role', 'Builder and student — co-founder of Guided'],
            ['location', <>{LOCATION} <Muted>· {time}</Muted></>],
            ['stack', 'React · TypeScript · SwiftUI · applied AI'],
            ['site', <>{COMPONENT_COUNT} hand-built components · {PAGE_COUNT} pages</>],
            ['motion', 'Framer Motion, reduced-motion aware'],
            ['shell', <Muted>a toy on a real site — no system access</Muted>],
            ['source', <Accent>{GITHUB_URL.replace('https://', '')}</Accent>],
          ]
          const labelWidth = Math.max(...fields.map(([k]) => k.length))
          return (
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <pre
                aria-hidden="true"
                className="shrink-0 select-none text-[#DCF87C] leading-tight"
              >{`
 ▄▀█ █▀▀
 █▀█ █▄▄

`}</pre>
              <div className="min-w-0 space-y-0.5">
                <Row>
                  <Accent>arseniy</Accent>
                  <Muted>@</Muted>
                  <Accent>portfolio</Accent>
                </Row>
                <Row><Muted>{'─'.repeat(22)}</Muted></Row>
                {fields.map(([k, v]) => (
                  <Row key={k}>
                    <Accent>{k.padEnd(labelWidth)}</Accent>
                    <Muted>  </Muted>
                    <span className="text-white/70">{v}</span>
                  </Row>
                ))}
              </div>
            </div>
          )
        },
      },
      sysinfo: { summary: 'same as neofetch', hidden: true, run: (a) => registry.neofetch.run(a) },
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
      history: {
        summary: 'the commands you have run',
        run: () => {
          const past = history.current
          if (!past.length) return <Row><Muted>Nothing yet. Type a command or two.</Muted></Row>
          // Newest last, numbered — the real `history` reading order. The gutter
          // is right-aligned to the widest index so the commands line up.
          const width = String(past.length).length
          return (
            <div className="space-y-0.5">
              {past.map((cmd, i) => (
                <Row key={i}>
                  <Muted>{String(i + 1).padStart(width)}  </Muted>
                  <span className="text-white/75">{cmd}</span>
                </Row>
              ))}
            </div>
          )
        },
      },
      clear: { summary: 'clear the screen', run: () => 'CLEAR' as const },
    }
    return registry
  }, [navigate, openContact, time, HELP_ORDER])

  // Every name you can actually type — visible commands and their aliases
  // alike — so Tab completes to any real command, not just the help-listed few.
  const completable = useMemo(
    () => Object.keys(commands).filter((n) => !commands[n].hidden),
    [commands],
  )

  const run = useCallback(
    (raw: string) => {
      const input = raw.trim()
      push('in', input)
      if (!input) return
      history.current = [...history.current, input]
      setHistIndex(-1)
      const [name, ...args] = input.split(/\s+/)
      const key = name.toLowerCase()
      const cmd = commands[key]
      if (!cmd) {
        // Offer the nearest real command when the miss is close enough to be a
        // typo — a small kindness that keeps the toy feeling like a shell.
        const near = Object.keys(commands)
          .filter((n) => !commands[n].hidden)
          .map((n) => ({ n, d: editDistance(key, n) }))
          .filter((c) => c.d <= 2 && c.d < key.length)
          .sort((a, b) => a.d - b.d)[0]
        push(
          'err',
          <Row>
            <span className="text-white/70">{name}</span>
            <Muted>: command not found.</Muted>
            {near ? (
              <>
                <Muted> Did you mean </Muted>
                <Accent>{near.n}</Accent>
                <Muted>? Or type </Muted>
                <Accent>help</Accent>
                <Muted>.</Muted>
              </>
            ) : (
              <>
                <Muted> Type </Muted>
                <Accent>help</Accent>
                <Muted>.</Muted>
              </>
            )}
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
      const matches = completable.filter((n) => n.startsWith(token))
      if (!matches.length) return
      if (matches.length === 1) {
        setValue(matches[0] + ' ')
        return
      }
      // Several candidates: complete to the longest shared prefix (so Tab still
      // makes progress), and echo the options the way a shell does on a double-Tab.
      const prefix = commonPrefix(matches)
      if (prefix.length > token.length) setValue(prefix)
      push('in', value.trim())
      push(
        'out',
        <Row>
          {matches.map((n, i) => (
            <span key={n}>
              {i > 0 ? '  ' : ''}
              <Accent>{n}</Accent>
            </span>
          ))}
        </Row>,
      )
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
