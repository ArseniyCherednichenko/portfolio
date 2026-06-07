import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface QA {
  q: string
  a: string
}

// Accessible expand/collapse list. One open at a time.
export function Accordion({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="border-y border-white/10">
      {items.map((it, i) => (
        <div key={i} className="border-b border-white/10 last:border-b-0">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-4 py-5 text-left"
          >
            <span className="text-lg font-medium text-white/90">{it.q}</span>
            <span className={`text-2xl leading-none text-[#DCF87C] transition-transform duration-300 ${open === i ? 'rotate-45' : ''}`}>
              +
            </span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <p className="max-w-2xl pb-5 leading-relaxed text-white/55">{it.a}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
