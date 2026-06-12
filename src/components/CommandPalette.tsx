import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CASE_STUDIES } from '../data/projects'
import { openProjectQuickLook } from './ProjectQuickLook'

// Targets starting with "/" are in-app routes (incl. /#section hashes); those
// starting with "action:" dispatch a window event (e.g. open a dialog);
// "project:<slug>" opens a project's quick-look preview; the rest (http,
// mailto) are external. Case studies are pulled in from the shared data so the
// palette stays in sync with the work the site actually has.
const ITEMS: ReadonlyArray<readonly [string, string]> = [
  ['Home', '/'],
  ['About', '/about'],
  ['Playground', '/playground'],
  ['Uses', '/uses'],
  ['Work archive', '/work'],
  ['Work', '/#work'],
  ['Toolkit', '/#toolkit'],
  ['Approach', '/#approach'],
  ['Contact', '/#contact'],
  ['Compose a message', 'action:contact'],
  ...CASE_STUDIES.map((p): readonly [string, string] => [`${p.title} — quick look`, `project:${p.slug}`]),
  ...CASE_STUDIES.map((p): readonly [string, string] => [`${p.title} — case study`, `/work/${p.slug}`]),
  ['GitHub', 'https://github.com/ArseniyCherednichenko'],
  ['LinkedIn', 'https://www.linkedin.com/in/arseniy-cherednichenko-bb3b962b9/'],
  ['Email', 'mailto:ars7ars3@gmail.com'],
]

// Cmd/Ctrl+K quick-jump palette. Also opens on a window "open-command-palette"
// event (so a hint button can trigger it). Arrow keys + Enter to navigate.
export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    setSel(0)
  }, [q, open])

  const results = ITEMS.filter(([label]) => label.toLowerCase().includes(q.toLowerCase()))

  function go(href?: string) {
    if (!href) return
    setOpen(false)
    setQ('')
    if (href.startsWith('action:')) {
      window.dispatchEvent(new Event(`open-${href.slice('action:'.length)}`))
    } else if (href.startsWith('project:')) {
      openProjectQuickLook(href.slice('project:'.length))
    } else if (href.startsWith('/')) navigate(href)
    else window.location.href = href
  }

  function onInputKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[sel]?.[1])
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-start justify-center bg-black/60 p-4 pt-[18vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#101010]"
            initial={{ y: -12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Jump to..."
              className="w-full bg-transparent px-5 py-4 text-white outline-none placeholder:text-white/30"
            />
            <ul className="max-h-72 overflow-y-auto border-t border-white/10 p-2">
              {results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-white/30">No matches</li>
              ) : (
                results.map(([label, href], i) => (
                  <li key={label}>
                    <button
                      onClick={() => go(href)}
                      onMouseEnter={() => setSel(i)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${i === sel ? 'bg-white/10 text-white' : 'text-white/80'}`}
                    >
                      <span>{label}</span>
                      <span className="text-xs text-white/30">{href.startsWith('action:') ? 'action' : href.startsWith('project:') ? 'preview' : href.includes('#') ? 'section' : href.startsWith('/') ? 'page' : 'link'}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
