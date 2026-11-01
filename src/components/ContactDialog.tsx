import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import { Modal } from './Modal'
import { Eyebrow } from './Eyebrow'
import { ChannelList } from './ChannelList'
import { downloadVCard } from '../lib/vcard'
import { useToast } from './Toast'

// A site-wide "Get in touch" dialog. A provider owns the open state and exposes
// useContact(); the Nav button, the command palette, and the Home contact
// section all open the same dialog. Honest content, real channels only,
// reduced-motion aware. Reuses the shared Modal shell.

type Ctx = { open: () => void }
const ContactContext = createContext<Ctx | null>(null)

export function useContact() {
  const ctx = useContext(ContactContext)
  if (!ctx) throw new Error('useContact must be used within ContactProvider')
  return ctx
}

export function ContactProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const value = useMemo(() => ({ open }), [open])

  return (
    <ContactContext.Provider value={value}>
      {children}
      <ContactBody open={isOpen} onClose={close} />
    </ContactContext.Provider>
  )
}

function ContactBody({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const saveCard = () => {
    const ok = downloadVCard()
    toast(
      ok ? 'Contact card saved to your downloads' : 'Could not save the card — email works too',
      { tone: ok ? 'success' : 'error' },
    )
  }
  return (
    <Modal open={open} onClose={onClose} label="Get in touch">
      <Eyebrow>Get in touch</Eyebrow>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Let us talk.</h2>
      <p className="mt-3 max-w-sm leading-relaxed text-white/60">
        Happy to hear about interesting products, collaborations, or to just talk shop. Email is the
        fastest way to reach me.
      </p>

      <div className="mt-7">
        <ChannelList />
      </div>

      <button
        type="button"
        onClick={saveCard}
        className="group mt-3 inline-flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-white/80 transition-colors hover:border-[#DCF87C]/40 hover:text-[#DCF87C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/70 transition-colors group-hover:border-[#DCF87C]/40 group-hover:text-[#DCF87C]">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-white/90 group-hover:text-[#DCF87C]">Save contact card</span>
          <span className="block text-white/40">A .vcf for your address book</span>
        </span>
      </button>

      <div className="mt-7 flex items-center justify-between gap-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/30">Based in Berlin · CET</p>
        <Link
          to="/contact"
          onClick={onClose}
          className="group inline-flex items-center gap-1.5 text-sm text-white/50 transition-colors hover:text-[#DCF87C]"
        >
          Contact page
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            -&gt;
          </span>
        </Link>
      </div>
    </Modal>
  )
}
