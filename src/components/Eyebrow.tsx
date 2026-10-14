import { Permalink } from './Permalink'

// Small lime section label, uppercase + wide tracking. Shared across pages.
//
// Pass `id` (the surrounding `<section>`'s own id) to turn the label into a
// shareable waypoint: a chain glyph appears beside it that copies the absolute
// deep link to that section. The glyph stays hidden until the label group is
// hovered or focused, so quiet sections stay quiet; it reveals on touch, where
// there is no hover. Without `id` the label renders exactly as before — a plain
// <p> — so the 80-odd existing eyebrows are untouched.
export function Eyebrow({ children, id }: { children: string; id?: string }) {
  const className = 'text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]'
  if (!id) return <p className={className}>{children}</p>
  return (
    <p className={`group inline-flex items-center gap-2 ${className}`}>
      {children}
      <Permalink id={id} label={children} />
    </p>
  )
}
