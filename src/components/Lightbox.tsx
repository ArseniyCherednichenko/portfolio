import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

// A focused fullscreen viewer for visual content. Darkens everything else,
// springs the content up to fill the frame, and closes on Escape, backdrop
// click, or the close control. Locks body scroll while open and respects
// reduced-motion (it cross-fades instead of scaling).
export function Lightbox({
  open,
  onClose,
  children,
  caption,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  caption?: string
}) {
  const reduce = useReducedMotion()

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
          className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-md sm:p-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={caption ?? 'Expanded view'}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            <span aria-hidden className="text-2xl leading-none">&times;</span>
          </button>

          <motion.div
            className="w-full max-w-4xl"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 18 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.4, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
            {caption && (
              <p className="mt-4 text-center text-sm text-white/55">{caption}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
