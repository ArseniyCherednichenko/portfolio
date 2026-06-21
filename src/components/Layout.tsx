import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { Aurora } from './Aurora'
import { Nav } from './Nav'
import { CommandPaletteProvider } from './CommandPalette'
import { ContactProvider, useContact } from './ContactDialog'

const PAGE_EASE = [0.16, 1, 0.3, 1] as const

// On every navigation: scroll to a hash target if present, else to the top.
// Anchors (e.g. /#work) work from any page; plain page changes reset scroll.
function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0 })
  }, [pathname, hash])
  return null
}

export function Layout() {
  const location = useLocation()
  // Capture the outlet so AnimatePresence can keep the exiting page mounted
  // through its exit animation while the new one enters.
  const outlet = useOutlet()
  return (
    <ContactProvider>
      <CommandPaletteProvider>
        <div id="top" className="relative min-h-screen bg-[#0A0A0A] text-white">
          <Aurora />
          <ScrollManager />
          <Nav />
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: PAGE_EASE }}
            >
              {outlet}
            </motion.main>
          </AnimatePresence>
          <SiteFooter />
        </div>
      </CommandPaletteProvider>
    </ContactProvider>
  )
}

// Footer with a live "get in touch" trigger into the shared contact dialog.
function SiteFooter() {
  const { open } = useContact()
  const year = new Date().getFullYear()
  return (
    <footer className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-6 py-12 text-sm text-white/35 sm:flex-row sm:items-center sm:justify-between">
      <p>Built by Arseniy Cherednichenko in Berlin · {year}</p>
      <button
        type="button"
        onClick={open}
        className="self-start text-white/50 underline-offset-4 transition-colors hover:text-[#DCF87C] hover:underline sm:self-auto"
      >
        Get in touch
      </button>
    </footer>
  )
}
