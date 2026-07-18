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
import { useContact } from './ContactDialog'
import { useShortcuts } from './Keyboard'

// A site-wide command palette (Cmd/Ctrl+K). Fuzzy-search across pages,
// projects, and quick actions, then jump with the keyboard. Accessible
// (dialog + listbox semantics, focus trap on the input, escape to close)
// and reduced-motion aware.

type Command = {
  id: string
  label: string
  group: 'Pages' | 'Projects' | 'Actions'
  hint?: string
  keywords?: string
  run: () => void
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
  const { openShortcuts } = useShortcuts()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const go = useCallback(
    (to: string) => {
      onClose()
      navigate(to)
    },
    [navigate, onClose],
  )

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = [
      { id: 'home', label: 'Home', group: 'Pages', hint: '/', keywords: 'start landing', run: () => go('/') },
      { id: 'work', label: 'Work', group: 'Pages', hint: 'all projects', keywords: 'projects portfolio case studies', run: () => go('/work') },
      { id: 'about', label: 'About', group: 'Pages', hint: 'story, path', keywords: 'bio story timeline principles', run: () => go('/about') },
      { id: 'now', label: 'Now', group: 'Pages', hint: 'current focus', keywords: 'now current focus building learning today snapshot status', run: () => go('/now') },
      { id: 'toolkit', label: 'Toolkit', group: 'Pages', hint: 'tools and stack', keywords: 'tools stack skills tech react typescript swift supabase', run: () => go('/toolkit') },
      { id: 'playground', label: 'Playground', group: 'Pages', hint: 'experiments', keywords: 'motion experiments demos', run: () => go('/playground') },
      { id: 'writing', label: 'Writing', group: 'Pages', hint: 'notes, in progress', keywords: 'writing notes blog essays journal articles thoughts', run: () => go('/writing') },
      { id: 'contact-page', label: 'Contact', group: 'Pages', hint: 'reach me', keywords: 'contact email hire reach availability', run: () => go('/contact') },
      { id: 'colophon', label: 'Colophon', group: 'Pages', hint: 'how it is built', keywords: 'colophon stack build source open source craft typography fonts', run: () => go('/colophon') },
      { id: 'answers', label: 'Answers', group: 'Pages', hint: 'questions people ask', keywords: 'answers faq questions about who what ask frequently help', run: () => go('/answers') },
      { id: 'craft', label: 'On motion', group: 'Pages', hint: 'notes on craft, playable', keywords: 'craft motion animation easing spring stagger reduced motion interactive demos notes principles', run: () => go('/craft') },
      { id: 'resume', label: 'Résumé', group: 'Pages', hint: 'one-page CV, printable', keywords: 'resume cv curriculum vitae print pdf download experience hire', run: () => go('/resume') },
      { id: 'terminal', label: 'Terminal', group: 'Pages', hint: 'drive the site by typing', keywords: 'terminal shell command line console type cli bash prompt play interactive', run: () => go('/terminal') },
      { id: 'changelog', label: 'Changelog', group: 'Pages', hint: 'the build log', keywords: 'changelog build log history releases updates commits shipped open source what changed', run: () => go('/changelog') },
      { id: 'contents', label: 'Index', group: 'Pages', hint: 'every page in one place', keywords: 'index contents sitemap map directory all pages everything table of contents overview', run: () => go('/contents') },
    ]

    const projects: Command[] = PROJECTS.filter((p) => !p.soon).map((p) => ({
      id: `project-${p.slug}`,
      label: p.title,
      group: 'Projects',
      hint: p.year || undefined,
      keywords: `${p.blurb} ${p.stack.join(' ')} case study`,
      run: () => go(`/work/${p.slug}`),
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

    return [...pages, ...projects, ...actions]
  }, [go, onClose, openContact, openShortcuts])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) =>
      `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q),
    )
  }, [commands, query])

  // Reset state whenever the palette opens, and focus the input.
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setCopied(false)
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
      filtered[active]?.run()
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
                const showGroup = c.group !== lastGroup
                lastGroup = c.group
                const isActive = i === active
                return (
                  <div key={c.id}>
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
                      onClick={() => c.run()}
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
                      <span className={`text-sm ${isActive ? 'text-white' : 'text-white/75'}`}>
                        {c.id === 'copy-email' && copied ? 'Copied to clipboard' : c.label}
                      </span>
                      {c.hint && <span className="shrink-0 text-xs text-white/30">{c.hint}</span>}
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
