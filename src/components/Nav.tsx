import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { useActiveSection } from '../hooks/useActiveSection'

// Floating translucent nav. Two kinds of links:
//  - page links (to: '/about') are active when the route matches.
//  - section links (to: '/#work', section: 'work') resolve to the homepage and
//    are active via scroll-spy while on it. ScrollManager handles the scroll
//    after cross-route navigation.
interface NavLink {
  label: string
  to: string
  section?: string
}

const LINKS: ReadonlyArray<NavLink> = [
  { label: 'Work', to: '/#work', section: 'work' },
  { label: 'About', to: '/about' },
  { label: 'Playground', to: '/playground' },
  { label: 'Uses', to: '/uses' },
  { label: 'Contact', to: '/#contact', section: 'contact' },
]

const SECTION_IDS = LINKS.filter((l) => l.section).map((l) => l.section as string)

export function Nav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const onHome = pathname === '/'
  // Scroll-spy only tracks sections that actually exist (the homepage).
  const active = useActiveSection(onHome ? SECTION_IDS : [])

  function isActive(l: NavLink): boolean {
    return l.section ? onHome && l.section === active : pathname === l.to
  }

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <nav className="fixed inset-x-0 top-4 z-50 mx-auto w-[min(92%,800px)]">
      <div className="flex items-center justify-between rounded-full border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-xl">
        <Link to="/" className="text-lg font-bold tracking-tight" onClick={() => setOpen(false)}>
          AC
        </Link>
        <div className="hidden gap-7 sm:flex">
          {LINKS.map((l) => {
            const act = isActive(l)
            return (
              <Link
                key={l.to}
                to={l.to}
                aria-current={act ? 'true' : undefined}
                className={`text-sm transition-colors ${act ? 'text-[#DCF87C]' : 'text-white/60 hover:text-white'}`}
              >
                {l.label}
              </Link>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-contact'))}
            className="hidden rounded-full bg-[#DCF87C] px-4 py-1.5 text-sm font-semibold text-black transition hover:brightness-105 sm:block"
          >
            Get in touch
          </button>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white sm:hidden"
          >
            <span aria-hidden className="text-xl leading-none">
              {open ? '×' : '≡'}
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mt-2 overflow-hidden rounded-3xl border border-white/10 bg-black/70 backdrop-blur-xl sm:hidden"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex flex-col p-2">
              {LINKS.map((l) => {
                const act = isActive(l)
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    aria-current={act ? 'true' : undefined}
                    className={`rounded-2xl px-4 py-3 transition-colors ${act ? 'text-[#DCF87C]' : 'text-white/75 hover:bg-white/5'}`}
                  >
                    {l.label}
                  </Link>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  window.dispatchEvent(new Event('open-contact'))
                }}
                className="mt-1 rounded-2xl bg-[#DCF87C] px-4 py-3 text-center font-semibold text-black"
              >
                Get in touch
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
