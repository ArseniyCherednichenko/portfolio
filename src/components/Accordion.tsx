import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId, useState, type ReactNode } from 'react'

const EASE = [0.16, 1, 0.3, 1] as const

export interface AccordionItem {
  /** The question / row label. */
  q: string
  /** The answer body. ReactNode so it can carry links. */
  a: ReactNode
}

/**
 * Accessible, animated disclosure list. One row open at a time by default; the
 * open row's body springs down (height + opacity) and a lime plus rotates into
 * a cross. Buttons carry aria-expanded / aria-controls and the panel is a
 * labelled region, so it reads correctly to assistive tech. Under reduced
 * motion the body toggles instantly with no height animation.
 */
export function Accordion({
  items,
  /** Index open on mount, or null for all-closed. */
  defaultOpen = null,
  className = '',
}: {
  items: AccordionItem[]
  defaultOpen?: number | null
  className?: string
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState<number | null>(defaultOpen)
  const baseId = useId()

  return (
    <div className={`divide-y divide-white/10 border-y border-white/10 ${className}`}>
      {items.map((item, i) => {
        const isOpen = open === i
        const btnId = `${baseId}-btn-${i}`
        const panelId = `${baseId}-panel-${i}`
        return (
          <div key={item.q}>
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group flex w-full items-center justify-between gap-6 py-6 text-left"
              >
                <span
                  className={`font-display text-xl font-semibold leading-snug tracking-tight transition-colors sm:text-2xl ${
                    isOpen ? 'text-white' : 'text-white/75 group-hover:text-white'
                  }`}
                >
                  {item.q}
                </span>
                <span className="relative grid h-7 w-7 shrink-0 place-items-center">
                  {/* horizontal bar */}
                  <span
                    className={`absolute h-[2px] w-3.5 rounded-full transition-colors ${
                      isOpen ? 'bg-[#DCF87C]' : 'bg-white/40 group-hover:bg-white/70'
                    }`}
                  />
                  {/* vertical bar — rotates flat when open, turning + into - */}
                  <motion.span
                    aria-hidden
                    className={`absolute h-3.5 w-[2px] rounded-full transition-colors ${
                      isOpen ? 'bg-[#DCF87C]' : 'bg-white/40 group-hover:bg-white/70'
                    }`}
                    animate={reduce ? undefined : { rotate: isOpen ? 90 : 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  key="content"
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pb-6 pr-10 text-base leading-relaxed text-white/60 sm:text-lg">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
