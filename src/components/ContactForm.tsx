import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { EMAIL } from '../data/contact'

// Honest, no-backend contact form. Nothing is sent from this page and there is
// no server, no tracking, no third-party form service. The button simply
// composes a pre-filled draft (subject + body) and hands it to the visitor's
// own email client via a `mailto:` link — they review and send it themselves.
// Keeping it client-only is the honest version of a contact form for a static
// site: it removes the friction of opening a blank email without pretending to
// capture or store anything.

const MAX_MESSAGE = 1200

function buildMailto({
  name,
  subject,
  message,
}: {
  name: string
  subject: string
  message: string
}): string {
  const trimmedSubject = subject.trim()
  const finalSubject = trimmedSubject ? trimmedSubject : 'Hello from your site'
  const signature = name.trim() ? `\n\n— ${name.trim()}` : ''
  const body = `${message.trim()}${signature}`
  const params = new URLSearchParams({ subject: finalSubject, body })
  // URLSearchParams encodes spaces as "+"; mail clients want %20 in mailto bodies.
  return `mailto:${EMAIL}?${params.toString().replace(/\+/g, '%20')}`
}

export function ContactForm() {
  const reduce = useReducedMotion()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [opened, setOpened] = useState(false)
  const [touched, setTouched] = useState(false)

  const messageReady = message.trim().length > 0
  const mailto = useMemo(
    () => buildMailto({ name, subject, message }),
    [name, subject, message],
  )

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!messageReady) {
      setTouched(true)
      return
    }
    window.location.href = mailto
    setOpened(true)
    window.setTimeout(() => setOpened(false), 4000)
  }

  const fieldBase =
    'w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/90 placeholder:text-white/30 outline-none transition-colors focus:border-[#DCF87C]/50 focus:bg-white/[0.04]'

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" hint="optional" htmlFor="cf-name">
          <input
            id="cf-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Arseniy"
            className={fieldBase}
          />
        </Field>
        <Field label="What is this about" hint="optional" htmlFor="cf-subject">
          <input
            id="cf-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="A product, a collab, or just hi"
            className={fieldBase}
          />
        </Field>
      </div>

      <Field
        label="Message"
        hint={`${Math.min(message.length, MAX_MESSAGE)}/${MAX_MESSAGE}`}
        htmlFor="cf-message"
      >
        <textarea
          id="cf-message"
          value={message}
          maxLength={MAX_MESSAGE}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTouched(true)}
          rows={5}
          required
          aria-invalid={touched && !messageReady}
          placeholder="Tell me what you are working on, or what you would like to talk about."
          className={`${fieldBase} resize-y leading-relaxed`}
        />
      </Field>

      {touched && !messageReady && (
        <motion.p
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="-mt-1 text-xs text-[#DCF87C]/90"
        >
          Add a line or two so I have something to reply to.
        </motion.p>
      )}

      <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xs text-xs leading-relaxed text-white/40">
          No server, no tracking. This opens a ready-to-send draft in your own mail app.
        </p>
        <motion.button
          type="submit"
          disabled={!messageReady}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
        >
          {opened ? 'Opening your mail app' : 'Open email draft'}
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0"
          >
            -&gt;
          </span>
        </motion.button>
      </div>

      <p aria-live="polite" className="sr-only">
        {opened ? 'A pre-filled email draft has been opened in your mail application.' : ''}
      </p>
    </form>
  )
}

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          {label}
        </span>
        {hint && <span className="text-[11px] tabular-nums text-white/25">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
