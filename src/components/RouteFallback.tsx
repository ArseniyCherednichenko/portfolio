// Minimal full-height placeholder shown while a lazily-loaded route chunk
// downloads. A single quiet pulsing dot — no layout shift, no spinner noise.
export function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#DCF87C]" />
    </div>
  )
}
