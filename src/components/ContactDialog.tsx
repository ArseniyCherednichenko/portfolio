import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Modal } from './Modal'
import { Eyebrow } from './Eyebrow'
import { ChannelList } from './ChannelList'

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
  return (
    <Modal open={open} onClose={onClose}>
      <Eyebrow>Get in touch</Eyebrow>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">Let us talk.</h2>
      <p className="mt-3 max-w-sm leading-relaxed text-white/60">
        Happy to hear about interesting products, collaborations, or to just talk shop. Email is the
        fastest way to reach me.
      </p>

      <div className="mt-7">
        <ChannelList />
      </div>

      <p className="mt-7 text-xs uppercase tracking-[0.2em] text-white/30">Based in Berlin · CET</p>
    </Modal>
  )
}
