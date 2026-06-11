import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'

// Accessible animated modal: backdrop blur, slide-up on mobile, escape to close,
// locks body scroll while open. `size` widens the panel for content-heavy
// dialogs (e.g. the project quick-look) while keeping the compact default.
const SIZES = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const

export function Modal({
  open,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: keyof typeof SIZES
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className={`relative max-h-[88vh] w-full ${SIZES[size]} overflow-y-auto rounded-t-3xl border border-white/10 bg-[#101010] p-8 sm:rounded-3xl`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white"
            >
              <span aria-hidden className="text-2xl leading-none">&times;</span>
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
