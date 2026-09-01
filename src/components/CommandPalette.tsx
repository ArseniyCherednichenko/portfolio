import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { PROJECTS } from '../data/projects'
import { DISCIPLINES } from '../data/disciplines'
import { ALL_CONTENT_ENTRIES } from '../data/contents'
import { fuzzyMatch, toRanges } from '../lib/fuzzy'
import { useContact } from './ContactDialog'
import { usePreferences } from './Preferences'
import { useShortcuts } from './Keyboard'
import { useToast } from './Toast'

// A site-wide command palette (Cmd/Ctrl+K). Fuzzy-search across pages,
// projects, and quick actions, then jump with the keyboard. Accessible
// (dialog + listbox semantics, focus trap on the input, escape to close)
// and reduced-motion aware.
//
// Search is a subsequence fuzzy match (see ../lib/fuzzy): results rank by how
// well the query hits each command — the letters that matched are highlighted —
// and the last few commands you ran surface as "Recent" when the box is empty,
// remembered across visits in localStorage.

type CommandGroup = 'Recent' | 'Pages' | 'Projects' | 'Disciplines' | 'Actions'

type Command = {
  id: string
  label: string
  group: CommandGroup
  hint?: string
  keywords?: string
  run: () => void
}

// --- Recents: a small most-recently-used list persisted per browser. ---
const RECENT_KEY = 'pf:cmdk:recent'
const RECENT_MAX = 5

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function pushRecent(id: string): string[] {
  const next = [id, ...loadRecent().filter((x) => x !== id)].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable (private mode, blocked) — recents just won't persist */
  }
  return next
}

type Ctx = { open: () => void }
const CommandPaletteContext = createContext<Ctx | null>(null)

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  return ctx
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Global shortcut: Cmd+K / Ctrl+K toggles the palette anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo(() => ({ open }), [open])

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <Palette open={isOpen} onClose={close} />
    </CommandPaletteContext.Provider>
  )
}

function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { open: openContact } = useContact()
  const { open: openPrefs } = usePreferences()
  const { openShortcuts } = useShortcuts()
  const { toast } = useToast()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const go = useCallback(
    (to: string) => {
      onClose()
      navigate(to)
    },
    [navigate, onClose],
  )

  // Run a command and remember it, so the last few surface under "Recent".
  const runCommand = useCallback((c: Command) => {
    setRecent(pushRecent(c.id))
    c.run()
  }, [])

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = [
      { id: 'home', label: 'Home', group: 'Pages', hint: '/', keywords: 'start landing', run: () => go('/') },
      { id: 'work', label: 'Work', group: 'Pages', hint: 'all projects', keywords: 'projects portfolio case studies', run: () => go('/work') },
      { id: 'range', label: 'The range', group: 'Pages', hint: 'disciplines I work across', keywords: 'range disciplines frontend ios backend applied ai motion skills capabilities multi disciplinary full stack breadth', run: () => go('/range') },
      { id: 'about', label: 'About', group: 'Pages', hint: 'story, path', keywords: 'bio story timeline principles', run: () => go('/about') },
      { id: 'now', label: 'Now', group: 'Pages', hint: 'current focus', keywords: 'now current focus building learning today snapshot status', run: () => go('/now') },
      { id: 'uses', label: 'Uses', group: 'Pages', hint: 'the setup', keywords: 'uses setup gear tools daily drivers desk machine editor terminal browser stack environment what i use dev setup', run: () => go('/uses') },
      { id: 'toolkit', label: 'Toolkit', group: 'Pages', hint: 'tools and stack', keywords: 'tools stack skills tech react typescript swift supabase', run: () => go('/toolkit') },
      { id: 'playground', label: 'Playground', group: 'Pages', hint: 'experiments', keywords: 'motion experiments demos', run: () => go('/playground') },
      { id: 'reel', label: 'The reel', group: 'Pages', hint: 'a full-screen showreel', keywords: 'reel showreel scenes cinematic full screen motion manifesto craft point of view backdrops sequence', run: () => go('/reel') },
      { id: 'writing', label: 'Writing', group: 'Pages', hint: 'notes, in progress', keywords: 'writing notes blog essays journal articles thoughts', run: () => go('/writing') },
      { id: 'contact-page', label: 'Contact', group: 'Pages', hint: 'reach me', keywords: 'contact email hire reach availability', run: () => go('/contact') },
      { id: 'colophon', label: 'Colophon', group: 'Pages', hint: 'how it is built', keywords: 'colophon stack build source open source craft typography fonts', run: () => go('/colophon') },
      { id: 'principles', label: 'Principles', group: 'Pages', hint: 'the manifesto', keywords: 'principles manifesto beliefs values ethos philosophy how i build craft process convictions statement rules', run: () => go('/principles') },
      { id: 'answers', label: 'Answers', group: 'Pages', hint: 'questions people ask', keywords: 'answers faq questions about who what ask frequently help', run: () => go('/answers') },
      { id: 'craft', label: 'On motion', group: 'Pages', hint: 'notes on craft, playable', keywords: 'craft motion animation easing spring stagger reduced motion interactive demos notes principles', run: () => go('/craft') },
      { id: 'taste', label: 'Taste', group: 'Pages', hint: 'plain vs considered', keywords: 'taste details polish craft difference plain considered before after care design judgement small moments button empty state number field interface quality', run: () => go('/taste') },
      { id: 'design', label: 'Design language', group: 'Pages', hint: 'the style guide', keywords: 'design language style guide system palette colours colors tokens type typography fraunces inter scale motion easing swatch hex copy', run: () => go('/design') },
      { id: 'specimen', label: 'Type specimen', group: 'Pages', hint: 'the type, in your hands', keywords: 'type specimen typography fraunces inter variable font axis weight optical size opsz wght glyphs alphabet scale letters tester', run: () => go('/specimen') },
      { id: 'resume', label: 'Résumé', group: 'Pages', hint: 'one-page CV, printable', keywords: 'resume cv curriculum vitae print pdf download experience hire', run: () => go('/resume') },
      { id: 'terminal', label: 'Terminal', group: 'Pages', hint: 'drive the site by typing', keywords: 'terminal shell command line console type cli bash prompt play interactive', run: () => go('/terminal') },
      { id: 'changelog', label: 'Changelog', group: 'Pages', hint: 'the build log', keywords: 'changelog build log history releases updates commits shipped open source what changed', run: () => go('/changelog') },
      { id: 'contents', label: 'Index', group: 'Pages', hint: 'every page in one place', keywords: 'index contents sitemap map directory all pages everything table of contents overview', run: () => go('/contents') },
      { id: 'atlas', label: 'Atlas', group: 'Pages', hint: 'the site as a constellation', keywords: 'atlas map constellation graph network nodes sitemap shape structure visual index force directed stars galaxy overview', run: () => go('/atlas') },
      { id: 'wander', label: 'Wander', group: 'Pages', hint: 'a random page, dealt', keywords: 'wander random shuffle surprise me serendipity discover explore roam lucky dip deck lose the map chance', run: () => go('/wander') },
      { id: 'library', label: 'The library', group: 'Pages', hint: 'every component, catalogued', keywords: 'library components catalogue catalog gallery parts made by hand ui kit built no template list showcase', run: () => go('/library') },
      { id: 'numbers', label: 'By the numbers', group: 'Pages', hint: 'the site, counted', keywords: 'numbers stats statistics metrics measured counts data dashboard breakdown charts bars components pages made by hand', run: () => go('/numbers') },
      { id: 'keyboard', label: 'Keyboard', group: 'Pages', hint: 'the go-chords, playable', keywords: 'keyboard keys shortcuts chords hotkeys map press play typing navigation go to interactive', run: () => go('/keyboard') },
    ]

    const projects: Command[] = PROJECTS.filter((p) => !p.soon).map((p) => ({
      id: `project-${p.slug}`,
      label: p.title,
      group: 'Projects',
      hint: p.year || undefined,
      keywords: `${p.blurb} ${p.stack.join(' ')} case study`,
      run: () => go(`/work/${p.slug}`),
    }))

    const disciplines: Command[] = DISCIPLINES.map((d) => ({
      id: `discipline-${d.id}`,
      label: d.title,
      group: 'Disciplines',
      hint: d.tag,
      keywords: `range discipline ${d.tag} ${d.lede} ${d.tools.join(' ')}`,
      run: () => go(`/range/${d.id}`),
    }))

    const actions: Command[] = [
      {
        id: 'contact',
        label: 'Get in touch',
        group: 'Actions',
        hint: 'ways to reach me',
        keywords: 'contact email mail hire message reach work together',
        run: () => {
          onClose()
          openContact()
        },
      },
      {
        id: 'copy-email',
        label: 'Copy email address',
        group: 'Actions',
        keywords: 'clipboard contact mail',
        run: () => {
          navigator.clipboard?.writeText('ars7ars3@gmail.com').catch(() => {})
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1400)
          toast('Email address copied', { tone: 'success' })
        },
      },
      {
        id: 'surprise',
        label: 'Surprise me',
        group: 'Actions',
        hint: 'jump somewhere random',
        keywords: 'surprise random shuffle wander lucky dip serendipity discover roam anywhere chance',
        run: () => {
          const pool = ALL_CONTENT_ENTRIES.filter((e) => e.to !== '/wander' && e.to !== window.location.pathname)
          const pick = pool[Math.floor(Math.random() * pool.length)]
          if (pick) go(pick.to)
        },
      },
      {
        id: 'preferences',
        label: 'Preferences',
        group: 'Actions',
        hint: 'motion',
        keywords: 'settings motion animation reduce calm accessibility prefers reduced motion tune',
        run: () => {
          onClose()
          openPrefs()
        },
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        group: 'Actions',
        hint: '?',
        keywords: 'keys hotkeys navigation help cheatsheet chords go to',
        run: () => {
          onClose()
          openShortcuts()
        },
      },
      {
        id: 'github',
        label: 'GitHub',
        group: 'Actions',
        hint: 'source',
        keywords: 'code repository open source',
        run: () => {
          window.open('https://github.com/ArseniyCherednichenko/portfolio', '_blank', 'noopener,noreferrer')
          onClose()
        },
      },
    ]

    return [...pages, ...projects, ...disciplines, ...actions]
  }, [go, onClose, openContact, openPrefs, openShortcuts, toast])

  // A rendered row: a command plus the label indices to highlight (empty when
  // the match came from keywords rather than the visible label).
  type Row = Command & { indices: number[] }

  // When the box is empty, show the recents first (if any) then the full,
  // grouped catalogue. When there's a query, rank every command by fuzzy score
  // and present one flat, sorted list.
  const { rows, grouped } = useMemo<{ rows: Row[]; grouped: boolean }>(() => {
    const q = query.trim()
    if (!q) {
      const recents: Row[] = recent
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is Command => Boolean(c))
        .map((c) => ({ ...c, group: 'Recent' as const, indices: [] }))
      const rest: Row[] = commands.map((c) => ({ ...c, indices: [] }))
      return { rows: [...recents, ...rest], grouped: true }
    }

    const scored = commands
      .map((c) => {
        const label = fuzzyMatch(q, c.label)
        const hay = label.matched
          ? label
          : fuzzyMatch(q, `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.group}`)
        if (!hay.matched) return null
        // A hit on the visible label always outranks one buried in keywords.
        const score = label.matched ? label.score + 25 : hay.score
        return { cmd: c, score, indices: label.matched ? label.indices : [] }
      })
      .filter((x): x is { cmd: Command; score: number; indices: number[] } => x !== null)
      .sort((a, b) => b.score - a.score)

    return { rows: scored.map((s) => ({ ...s.cmd, indices: s.indices })), grouped: false }
  }, [commands, query, recent])

  const filtered = rows

  // Reset state whenever the palette opens, and focus the input.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setCopied(false)
      setRecent(loadRecent())
      const id = window.setTimeout(() => inputRef.current?.focus(), 10)
      return () => window.clearTimeout(id)
    }
  }, [open])

  // Keep the active index in range as the filtered list shrinks/grows.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Lock body scroll + escape handling while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Ensure the active row stays visible while arrowing through results.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (filtered.length ? (a - 1 + filtered.length) % filtered.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const c = filtered[active]
      if (c) runCommand(c)
    }
  }

  // Render with group separators while preserving the flat index for keyboarding.
  let lastGroup = ''

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm sm:pt-[18vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0E0E0E]/95 shadow-2xl shadow-black/60"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, projects, actions..."
                aria-label="Search commands"
                role="combobox"
                aria-expanded
                aria-controls="command-list"
                className="w-full bg-transparent py-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
              />
              <kbd className="hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/40 sm:block">
                esc
              </kbd>
            </div>

            <div ref={listRef} id="command-list" role="listbox" className="max-h-[min(60vh,360px)] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-white/40">No matches for "{query}".</p>
              )}
              {filtered.map((c, i) => {
                const showGroup = grouped && c.group !== lastGroup
                lastGroup = c.group
                const isActive = i === active
                const isCopied = c.id === 'copy-email' && copied
                return (
                  <div key={`${c.group}-${c.id}`}>
                    {showGroup && (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-white/30">
                        {c.group}
                      </p>
                    )}
                    <button
                      type="button"
                      data-index={i}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => runCommand(c)}
                      onMouseMove={() => setActive(i)}
                      className={`relative flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId={reduce ? undefined : 'cmd-active'}
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#DCF87C]"
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                      <span className={`min-w-0 truncate text-sm ${isActive ? 'text-white' : 'text-white/75'}`}>
                        {isCopied ? 'Copied to clipboard' : <Highlight text={c.label} indices={c.indices} />}
                      </span>
                      <span className="flex shrink-0 items-center gap-2.5">
                        {/* When ranking a flat search list, name each row's group
                            so the context isn't lost with the headers gone. */}
                        {!grouped && (
                          <span className="hidden text-[10px] uppercase tracking-wider text-white/25 sm:inline">
                            {c.group}
                          </span>
                        )}
                        {c.hint && <span className="text-xs text-white/30">{c.hint}</span>}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-[11px] text-white/30">
              <span className="flex items-center gap-1.5">
                <Kbd>up</Kbd>
                <Kbd>down</Kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>enter</Kbd>
                select
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Render `text` with the fuzzy-matched character ranges lit in the accent.
function Highlight({ text, indices }: { text: string; indices: number[] }) {
  if (indices.length === 0) return <>{text}</>
  const ranges = toRanges(indices)
  const parts: ReactNode[] = []
  let cursor = 0
  ranges.forEach(([start, end], r) => {
    if (start > cursor) parts.push(<span key={`p${r}`}>{text.slice(cursor, start)}</span>)
    parts.push(
      <span key={`m${r}`} className="text-[#DCF87C]">
        {text.slice(start, end)}
      </span>,
    )
    cursor = end
  })
  if (cursor < text.length) parts.push(<span key="rest">{text.slice(cursor)}</span>)
  return <>{parts}</>
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 font-medium text-white/40">
      {children}
    </kbd>
  )
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-white/40"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </svg>
  )
}
