// Small lime section label, uppercase + wide tracking. Shared across pages.
export function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">{children}</p>
  )
}
