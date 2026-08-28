import { Suspense, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { Aurora } from './Aurora'
import { RouteFallback } from './RouteFallback'
import { Nav } from './Nav'
import { CommandPaletteProvider } from './CommandPalette'
import { ContactProvider } from './ContactDialog'
import { KeyboardProvider } from './Keyboard'
import { ToastProvider } from './Toast'
import { ScrollProgress } from './ScrollProgress'
import { BackToTop } from './BackToTop'
import { Cursor } from './Cursor'
import { ClickSpark } from './ClickSpark'
import { Grain } from './Grain'
import { Preloader } from './Preloader'
import { SiteFooter } from './SiteFooter'
import { SkipLink } from './SkipLink'
import { StructuredData } from './StructuredData'

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
    <ToastProvider>
      <ContactProvider>
      <KeyboardProvider>
        <CommandPaletteProvider>
        <div id="top" className="relative min-h-screen bg-[#0A0A0A] text-white">
          {/* First focusable element on the page — a keyboard jump past the
              chrome, straight to the content. */}
          <SkipLink />
          {/* Machine-readable identity (JSON-LD) for search and social crawlers. */}
          <StructuredData />
          <Aurora />
          <ScrollProgress />
          <ScrollManager />
          <Nav />
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              key={location.pathname}
              id="main-content"
              tabIndex={-1}
              className="outline-none"
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
          {/* Editorial film grain over the whole page — a fine, filmic texture
              that gives the dark theme a printed feel. Above content, below the
              nav/overlays/cursor; pointer-events: none, so it never interferes.
              Held to a single still frame under reduced motion. */}
          <Grain fixed className="z-[40]" />
          <BackToTop />
          <Cursor />
          <ClickSpark />
          <Preloader />
        </div>
        </CommandPaletteProvider>
      </KeyboardProvider>
      </ContactProvider>
    </ToastProvider>
  )
}
