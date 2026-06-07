import { useActiveSection } from '../hooks/useActiveSection'

const SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['about', 'About'],
  ['work', 'Work'],
  ['toolkit', 'Toolkit'],
  ['playground', 'Playground'],
  ['approach', 'Approach'],
  ['contact', 'Contact'],
]

// Fixed vertical dots (desktop) showing scroll position; click a dot to jump.
export function SectionDots() {
  const active = useActiveSection(SECTIONS.map(([id]) => id))
  return (
    <nav aria-label="Sections" className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3.5 lg:flex">
      {SECTIONS.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          aria-label={label}
          aria-current={active === id ? 'true' : undefined}
          className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${active === id ? 'scale-125 bg-[#DCF87C]' : 'bg-white/25 hover:bg-white/50'}`}
        />
      ))}
    </nav>
  )
}
