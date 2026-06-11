import { Link, useLocation } from 'react-router-dom'
import { Aurora } from './Aurora'
import { PageTransition } from './PageTransition'
import { Grain } from './Grain'
import { ScrollProgress } from './ScrollProgress'
import { RouteProgress } from './RouteProgress'
import { CommandPalette } from './CommandPalette'
import { ContactDialog } from './ContactDialog'
import { ProjectQuickLook } from './ProjectQuickLook'
import { BackToTop } from './BackToTop'
import { CursorDot } from './CursorDot'
import { Nav } from './Nav'
import { SectionDots } from './SectionDots'
import { SkipLink } from './SkipLink'
import { ScrollManager } from './ScrollManager'

// Persistent shell shared by every route: ambient background, global overlays,
// nav, footer. The active page renders into <Outlet />. Section-position dots
// only make sense on the long-scrolling homepage, so they are gated to "/".
export function Layout() {
  const onHome = useLocation().pathname === '/'

  return (
    <div id="top" className="relative min-h-screen bg-[#0A0A0A] text-white">
      <SkipLink />
      <ScrollManager />
      <Aurora />
      <Grain />
      <ScrollProgress />
      <RouteProgress />
      <CommandPalette />
      <ContactDialog />
      <ProjectQuickLook />
      <BackToTop />
      <CursorDot />
      <Nav />
      {onHome && <SectionDots />}

      <PageTransition />

      <footer className="mx-auto w-full max-w-4xl border-t border-white/10 px-6 py-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <p className="text-sm text-white/35">
            &copy; {new Date().getFullYear()} Arseniy Cherednichenko. Built in Berlin with React and Framer Motion.
          </p>
          <div className="flex flex-wrap gap-5 text-sm text-white/55">
            <Link to="/about" className="transition-colors hover:text-white">
              About
            </Link>
            <Link to="/playground" className="transition-colors hover:text-white">
              Playground
            </Link>
            <Link to="/uses" className="transition-colors hover:text-white">
              Uses
            </Link>
            <a href="https://github.com/ArseniyCherednichenko" className="transition-colors hover:text-white">
              GitHub
            </a>
            <a href="mailto:ars7ars3@gmail.com" className="transition-colors hover:text-white">
              Email
            </a>
            <a
              href="https://www.linkedin.com/in/arseniy-cherednichenko-bb3b962b9/"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              LinkedIn
            </a>
            <a href="https://askguided.com" className="transition-colors hover:text-white">
              Guided
            </a>
            <a
              href="https://github.com/ArseniyCherednichenko/portfolio"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              Source
            </a>
            <Link to="/" className="transition-colors hover:text-white">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
