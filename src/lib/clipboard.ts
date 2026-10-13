import { useCallback, useEffect, useRef, useState } from 'react'

// Shared clipboard helpers — the single source of truth for every "Copy"
// affordance on the site. Before this, the same best-effort write and the same
// short-lived "Copied" flag were hand-rolled, almost verbatim, on /bio,
// /design, and /specimen (the comments there even said so). One copy of the
// idiom means every copy button behaves the same way and improves in one place.

// Best-effort clipboard write. Returns whether it landed, so a caller can flash
// a confirmation — or fall back to a hint — without assuming success on
// locked-down browsers. Tries the async Clipboard API first, then a legacy
// hidden-textarea + execCommand path for older or restricted engines where the
// modern API is missing (e.g. non-secure contexts). Never throws.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below — the async API can reject when the
    // document is not focused or the permission is denied.
  }

  if (typeof document === 'undefined') return false
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    // Keep it out of the layout and off-screen so focusing it never scrolls the
    // page or flashes a box.
    area.style.position = 'fixed'
    area.style.top = '-9999px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

// A short-lived "copied" flag after a successful copy, resetting itself after
// `resetMs`. One timer per instance, cleared on unmount so a late reset never
// fires into an unmounted component. The returned `copy` resolves to whether the
// write landed, so callers that still want a toast or a fallback hint can read
// it; those that only want the inline flash can ignore the result.
export function useCopied(resetMs = 1200): [boolean, (text: string) => Promise<boolean>] {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyText(text)
      if (ok) {
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), resetMs)
      }
      return ok
    },
    [resetMs],
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return [copied, copy]
}
