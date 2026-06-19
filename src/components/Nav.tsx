import { Link, NavLink } from 'react-router-dom'

// Floating translucent nav. Section anchors point at the home page (/#id) so
// they work from any route; Playground is a real page link.
const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['Work', '/#work'],
  ['About', '/#about'],
]

export function Nav() {
  return (
    <nav className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(92%,760px)] items-center justify-between rounded-full border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-xl">
      <Link to="/" className="text-lg font-bold tracking-tight">
        AC
      </Link>
      <div className="hidden gap-7 sm:flex">
        {SECTIONS.map(([label, href]) => (
          <Link key={href} to={href} className="text-sm text-white/60 transition-colors hover:text-white">
            {label}
          </Link>
        ))}
        <NavLink
          to="/playground"
          className={({ isActive }) =>
            `text-sm transition-colors hover:text-white ${isActive ? 'text-[#DCF87C]' : 'text-white/60'}`
          }
        >
          Playground
        </NavLink>
      </div>
      <a
        href="mailto:ars7ars3@gmail.com"
        className="rounded-full bg-[#DCF87C] px-4 py-1.5 text-sm font-semibold text-black transition hover:brightness-105"
      >
        Get in touch
      </a>
    </nav>
  )
}
