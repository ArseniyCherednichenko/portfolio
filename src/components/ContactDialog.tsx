import { useEffect, useId, useRef, useState } from 'react'
import { Modal } from './Modal'
import { CopyButton } from './CopyButton'
import { SocialLinks } from './SocialLinks'

const EMAIL = 'ars7ars3@gmail.com'

// Global "compose a message" dialog. Honest by design: there is no backend, so
// the form simply assembles a mailto: link and hands it to the visitor's mail
// app with the subject and body already filled in. It opens anywhere via a
// window "open-contact" event (the nav button, command palette, and the home
// contact CTA all dispatch it), mirroring the command-palette pattern.
export function ContactDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [message, setMessage] = useState('')
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const baseId = useId()

  useEffect(() => {
    function onOpen() {
      setOpen(true)
    }
    window.addEventListener('open-contact', onOpen)
    return () => window.removeEventListener('open-contact', onOpen)
  }, [])

  // Move focus into the form once the open animation has begun.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [open])

  const canSend = message.trim().length > 0

  function send() {
    if (!canSend) return
    const subject = name.trim() ? `Hello from ${name.trim()}` : 'Hello from your site'
    const lines = [message.trim(), '', '—', name.trim(), from.trim()].filter(Boolean)
    const body = lines.join('\n')
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setOpen(false)
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <h2 className="text-2xl font-bold tracking-tight">Say hello</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/55">
        Write a line and this opens your mail app with it ready to send. Prefer the keyboard? Just email{' '}
        <span className="text-white/80">{EMAIL}</span>.
      </p>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={`${baseId}-name`}
            label="Your name"
            value={name}
            onChange={setName}
            placeholder="Ada Lovelace"
            inputRef={firstFieldRef}
          />
          <Field
            id={`${baseId}-from`}
            label="Your email"
            type="email"
            value={from}
            onChange={setFrom}
            placeholder="you@example.com"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${baseId}-message`} className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Message
          </label>
          <textarea
            id={`${baseId}-message`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="What are you building?"
            className="resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#DCF87C]/60"
          />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-full bg-[#DCF87C] px-6 py-3 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:brightness-105"
          >
            Open in mail app
          </button>
          <CopyButton value={EMAIL} label="Copy email" className="text-sm text-white/45 hover:text-white" />
        </div>
      </form>

      <div className="mt-7 border-t border-white/10 pt-5">
        <SocialLinks />
      </div>
    </Modal>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputRef,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#DCF87C]/60"
      />
    </div>
  )
}
