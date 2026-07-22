import { Suspense, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { Aurora } from './Aurora'
import { RouteFallback } from './RouteFallback'
import { Nav } from './Nav'
import { CommandPaletteProvider } from './CommandPalette'
import { ContactProvider } from './ContactDialog'
import { KeyboardProvider } from './Keyboard'
import { ScrollProgress } from './ScrollProgress'
import { BackToTop } from './BackToTop'
import { Cursor } from './Cursor'
import { ClickSpark } from './ClickSpark'
import { Preloader } from './Preloader'
import { SiteFooter } from './SiteFooter'

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
      <KeyboardProvider>
        <CommandPaletteProvider>
        <div id="top" className="relative min-h-screen bg-[#0A0A0A] text-white">
          <Aurora />
          <ScrollProgress />
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
              {/* Lazy route chunks stream in here; the branded fallback shows
                  only if a page's code hasn't loaded yet (Home is eager, so the
                  landing never flashes it). The boundary lives inside the
                  animated container so page transitions still play. */}
              <Suspense fallback={<RouteFallback />}>{outlet}</Suspense>
            </motion.main>
          </AnimatePresence>
          <SiteFooter />
          <BackToTop />
          <Cursor />
          <ClickSpark />
          <Preloader />
        </div>
        </CommandPaletteProvider>
      </KeyboardProvider>
    </ContactProvider>
  )
}
