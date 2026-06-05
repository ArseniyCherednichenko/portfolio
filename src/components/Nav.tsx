// Floating translucent nav with smooth-scroll anchors.
const LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Work', '#work'],
  ['About', '#about'],
  ['Toolkit', '#toolkit'],
  ['Playground', '#playground'],
  ['Contact', '#contact'],
]

export function Nav() {
  return (
    <nav className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(92%,760px)] items-center justify-between rounded-full border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-xl">
      <a href="#top" className="text-lg font-bold tracking-tight">
        AC
      </a>
      <div className="hidden gap-7 sm:flex">
        {LINKS.map(([label, href]) => (
          <a key={href} href={href} className="text-sm text-white/60 transition-colors hover:text-white">
            {label}
          </a>
        ))}
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
