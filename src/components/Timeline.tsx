import { Reveal } from './Reveal'

export interface TimelineItem {
  when: string
  title: string
  body: string
}

// Vertical timeline with a hairline rail and lime nodes. Each row reveals on
// scroll. Used on the About page for the build-journey.
export function Timeline({ items }: { items: ReadonlyArray<TimelineItem> }) {
  return (
    <ol className="relative ml-1 border-l border-white/10">
      {items.map((it, i) => (
        <li key={it.title} className="relative pb-10 pl-8 last:pb-0">
          <span
            aria-hidden
            className="absolute -left-[6px] top-1.5 h-3 w-3 rounded-full border-2 border-[#0A0A0A] bg-[#DCF87C]"
          />
          <Reveal delay={i * 0.05}>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{it.when}</div>
            <h3 className="mt-1 text-xl font-semibold">{it.title}</h3>
            <p className="mt-2 max-w-xl leading-relaxed text-white/55">{it.body}</p>
          </Reveal>
        </li>
      ))}
    </ol>
  )
}
