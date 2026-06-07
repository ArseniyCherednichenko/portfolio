import { useState } from 'react'

// Copies `value` to the clipboard and briefly swaps its label to a confirmation.
// Falls back silently if the Clipboard API is unavailable.
export function CopyButton({
  value,
  label,
  className = '',
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked (insecure context / permissions) — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${value}`}
      className={`inline-flex items-center gap-2 transition-colors ${className}`}
    >
      <span aria-hidden className="text-xs">
        {copied ? '✓' : '⧉'}
      </span>
      {copied ? 'Copied' : (label ?? value)}
    </button>
  )
}
