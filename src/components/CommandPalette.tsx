import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const ITEMS: ReadonlyArray<readonly [string, string]> = [
  ['Work', '#work'],
  ['About', '#about'],
  ['Toolkit', '#toolkit'],
  ['Playground', '#playground'],
  ['Contact', '#contact'],
  ['GitHub', 'https://github.com/ArseniyCherednichenko'],
  ['Email', 'mailto:ars7ars3@gmail.com'],
]

// Cmd/Ctrl+K quick-jump palette. Type to filter, Enter/click to go.
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = ITEMS.filter(([label]) => label.toLowerCase().includes(q.toLowerCase()))

  function go(href: string) {
    setOpen(false)
    setQ('')
    if (href.startsWith('#')) document.querySelector(href)?.scrollIntoView()
    else window.location.href = href
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
              placeholder="Jump to..."
              className="w-full bg-transparent px-5 py-4 text-white outline-none placeholder:text-white/30"
            />
            <ul className="max-h-72 overflow-y-auto border-t border-white/10 p-2">
              {results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-white/30">No matches</li>
              ) : (
                results.map(([label, href]) => (
                  <li key={label}>
                    <button
                      onClick={() => go(href)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-white/80 transition-colors hover:bg-white/5"
                    >
                      <span>{label}</span>
                      <span className="text-xs text-white/30">{href.startsWith('#') ? 'section' : 'link'}</span>
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
