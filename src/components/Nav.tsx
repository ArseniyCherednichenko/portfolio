import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useActiveSection } from '../hooks/useActiveSection'

// Floating translucent nav with smooth-scroll anchors + a mobile dropdown menu.
const LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Work', '#work'],
  ['About', '#about'],
  ['Toolkit', '#toolkit'],
  ['Playground', '#playground'],
  ['Approach', '#approach'],
  ['Contact', '#contact'],
]

export function Nav() {
  const [open, setOpen] = useState(false)
  const active = useActiveSection(LINKS.map(([, href]) => href.slice(1)))

  return (
    <nav className="fixed inset-x-0 top-4 z-50 mx-auto w-[min(92%,760px)]">
      <div className="flex items-center justify-between rounded-full border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-xl">
        <a href="#top" className="text-lg font-bold tracking-tight" onClick={() => setOpen(false)}>
          AC
        </a>
        <div className="hidden gap-7 sm:flex">
          {LINKS.map(([label, href]) => {
            const isActive = href.slice(1) === active
            return (
              <a
                key={href}
                href={href}
                aria-current={isActive ? 'true' : undefined}
                className={`text-sm transition-colors ${isActive ? 'text-[#DCF87C]' : 'text-white/60 hover:text-white'}`}
              >
                {label}
              </a>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="mailto:ars7ars3@gmail.com"
            className="hidden rounded-full bg-[#DCF87C] px-4 py-1.5 text-sm font-semibold text-black transition hover:brightness-105 sm:block"
          >
            Get in touch
          </a>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white sm:hidden"
          >
            <span aria-hidden className="text-xl leading-none">{open ? '×' : '≡'}</span>
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
              {LINKS.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="rounded-2xl px-4 py-3 text-white/75 transition-colors hover:bg-white/5"
                >
                  {label}
                </a>
              ))}
              <a
                href="mailto:ars7ars3@gmail.com"
                onClick={() => setOpen(false)}
                className="mt-1 rounded-2xl bg-[#DCF87C] px-4 py-3 text-center font-semibold text-black"
              >
                Get in touch
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
