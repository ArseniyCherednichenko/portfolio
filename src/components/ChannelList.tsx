import { useCallback, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CHANNELS, EMAIL, type Channel } from '../data/contact'
import { useToast } from './Toast'

// Shared, honest list of ways to reach Arseniy. One source of truth for the
// row markup, the copy-to-clipboard behaviour, and the channel icons — used by
// both the global Contact dialog and the deep-linkable /contact page so the two
// never drift apart. Staggered reveal, reduced-motion aware.

export function ChannelList({ stagger = 0.06 }: { stagger?: number }) {
  const reduce = useReducedMotion()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const copyEmail = useCallback(() => {
    navigator.clipboard
      ?.writeText(EMAIL)
      .then(() => toast('Email copied', { description: EMAIL, variant: 'success' }))
      .catch(() => toast('Could not copy', { description: 'Your browser blocked clipboard access.', variant: 'error' }))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }, [toast])

  return (
    <ul className="space-y-2.5">
      {CHANNELS.map((c, i) => (
        <motion.li
          key={c.kind}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: reduce ? 0 : 0.05 + i * stagger, ease: [0.16, 1, 0.3, 1] }}
        >
          <ChannelRow channel={c} copied={copied} onCopy={copyEmail} />
        </motion.li>
      ))}
    </ul>
  )
}

function ChannelRow({
  channel,
  copied,
  onCopy,
}: {
  channel: Channel
  copied: boolean
  onCopy: () => void
}) {
  const isCopy = channel.kind === 'copy'
  const showCopied = isCopy && copied

  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 transition-colors group-hover:border-[#DCF87C]/40 group-hover:text-[#DCF87C]">
        <ChannelIcon kind={channel.kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white/90">
          {showCopied ? 'Copied to clipboard' : channel.label}
        </span>
        <span className="block truncate text-xs text-white/40">{channel.detail}</span>
      </span>
      <span
        aria-hidden
        className="shrink-0 translate-x-0 text-white/25 transition-all group-hover:translate-x-1 group-hover:text-[#DCF87C]"
      >
        {isCopy ? '' : '->'}
      </span>
    </>
  )

  const className =
    'group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04]'

  if (isCopy) {
    return (
      <button type="button" onClick={onCopy} className={className}>
        {inner}
      </button>
    )
  }

  const external = channel.kind === 'github'
  return (
    <a
      href={channel.href}
      className={className}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {inner}
    </a>
  )
}

function ChannelIcon({ kind }: { kind: Channel['kind'] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (kind === 'email') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    )
  }
  if (kind === 'copy') {
    return (
      <svg {...common}>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
    )
  }
  // github
  return (
    <svg {...common}>
      <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </svg>
  )
}
