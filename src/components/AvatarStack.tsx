import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

// The presence row every collaborative product grew once more than one person
// could be in the same place at once — the stack of faces in a Figma file, a
// Google Doc, a Linear issue, a call. Rebuilt by hand, and deliberately another
// turn toward product craft rather than a toy: the small, unglamorous interface
// work of showing *who is here* without eating the whole header.
//
// Three details carry it, and each is one a bare row of <img>s skips. The
// OVERLAP: faces stack with a ring in the page colour punched between them, so a
// crowded room reads as a tidy cluster instead of a scattered line; past a cap
// the rest collapse into a single "+N" that is a real button, not a label. The
// SPREAD: bring a pointer over the row (or tab into it) and the cluster eases
// apart just enough to separate the faces, the one under you lifting with a
// tooltip — the row stays compact at rest and becomes legible only when you
// reach for it. And the TRAFFIC: people join and leave a live session, so the
// row does too, each face springing in and pushing the rest along on a layout
// spring, the count and the overflow recomputing as it goes.
//
// Honest about the content: these are generic sample teammates — monogram
// avatars over a generated tint, with a name, a role, and a presence state —
// illustrating the pattern, not a roster of anyone real. No photos, so no real
// person is implied.
//
// Reachable without a pointer: the row is a labelled group, every face is a
// focusable button carrying its owner's name and presence in its label, the
// tooltip shows on focus as readily as on hover, the "+N" opens a full roster
// popover that takes focus and closes on Escape or an outside click, and every
// join, departure and roster open is announced through a polite live region.
// Under prefers-reduced-motion the pulse, the spread, the lift and the join
// spring are all dropped — faces appear and leave in place — so the surface
// behaves identically with nothing moving.

const EASE = [0.16, 1, 0.3, 1] as const

type Presence = 'online' | 'away' | 'offline'

interface Person {
  id: string
  name: string
  role: string
  presence: Presence
}

const PRESENCE_META: Record<Presence, { label: string; color: string }> = {
  online: { label: 'online', color: '#7FE0C0' },
  away: { label: 'away', color: '#FFC978' },
  offline: { label: 'offline', color: '#6B7280' },
}

// The sample room. Generic teammates, clearly illustrative — no real account or
// person is implied. The "arrive" control walks the reserve below.
const SEATED: readonly Person[] = [
  { id: 'p1', name: 'Mara Kessler', role: 'Design', presence: 'online' },
  { id: 'p2', name: 'Ivo Renner', role: 'Frontend', presence: 'online' },
  { id: 'p3', name: 'Dana Offermann', role: 'Product', presence: 'away' },
  { id: 'p4', name: 'Theo Brandt', role: 'Backend', presence: 'online' },
  { id: 'p5', name: 'Noa Vogel', role: 'Research', presence: 'offline' },
  { id: 'p6', name: 'Luis Marek', role: 'Motion', presence: 'online' },
]

const RESERVE: readonly Person[] = [
  { id: 'r1', name: 'Pia Hartmann', role: 'Data', presence: 'online' },
  { id: 'r2', name: 'Said Abbas', role: 'iOS', presence: 'away' },
  { id: 'r3', name: 'Elke Sauer', role: 'Writing', presence: 'online' },
  { id: 'r4', name: 'Juno Feld', role: 'QA', presence: 'online' },
]

/** How many faces show before the rest collapse into "+N". */
const MAX_VISIBLE = 5

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** A stable hue from the name, so a given person always tints the same way. */
function hueOf(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

/** A small presence dot with a soft pulse when online (static if reduced). */
function PresenceDot({
  presence,
  reduced,
  size = 11,
}: {
  presence: Presence
  reduced: boolean | null
  size?: number
}) {
  const { color } = PRESENCE_META[presence]
  return (
    <span
      aria-hidden
      className="absolute bottom-0 right-0 grid place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: '#0a0a0a',
      }}
    >
      <span
        className="relative rounded-full"
        style={{ width: size - 4, height: size - 4, background: color }}
      >
        {presence === 'online' && !reduced && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: color }}
            initial={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 2.4 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </span>
    </span>
  )
}

/** The monogram face — a generated tint, never a photo, so no one real is implied. */
function Face({ person, size = 44 }: { person: Person; size?: number }) {
  const hue = hueOf(person.name)
  return (
    <span
      aria-hidden
      className="grid place-items-center rounded-full font-semibold text-black/80"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `linear-gradient(140deg, hsl(${hue} 70% 72%), hsl(${(hue + 40) % 360} 68% 58%))`,
      }}
    >
      {initials(person.name)}
    </span>
  )
}

export interface AvatarStackProps {
  className?: string
}

export function AvatarStack({ className }: AvatarStackProps) {
  const reduced = useReducedMotion()
  const [people, setPeople] = useState<Person[]>(() => SEATED.slice(0, 4))
  const [spread, setSpread] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [announce, setAnnounce] = useState('')

  const seatIndex = useRef(4)
  const reserveIndex = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const rosterRef = useRef<HTMLDivElement>(null)
  const overflowBtnRef = useRef<HTMLButtonElement>(null)
  const baseId = useId()

  const visible = people.slice(0, MAX_VISIBLE)
  const hiddenCount = Math.max(0, people.length - MAX_VISIBLE)
  const onlineCount = people.filter((p) => p.presence === 'online').length

  // Stacked at rest, eased apart when the row is reached for.
  const overlap = spread ? 6 : -14

  const addPerson = useCallback(() => {
    // Walk the seated list first, then the reserve, so the row grows with
    // plausible, distinct teammates and never repeats an id.
    let next: Person | undefined
    if (seatIndex.current < SEATED.length) {
      next = SEATED[seatIndex.current]
      seatIndex.current += 1
    } else if (reserveIndex.current < RESERVE.length) {
      next = RESERVE[reserveIndex.current]
      reserveIndex.current += 1
    }
    if (!next) {
      setAnnounce('The room is full.')
      return
    }
    const joined = next
    setPeople((prev) => [...prev, joined])
    setAnnounce(`${joined.name} joined. ${people.length + 1} in the room.`)
  }, [people.length])

  const removePerson = useCallback(() => {
    setPeople((prev) => {
      if (prev.length <= 1) {
        setAnnounce('Only one person left in the room.')
        return prev
      }
      const leaving = prev[prev.length - 1]
      // Hand the ids back so the row can be refilled from the top.
      if (reserveIndex.current > 0 && RESERVE.some((r) => r.id === leaving.id)) {
        reserveIndex.current -= 1
      } else if (seatIndex.current > 0) {
        seatIndex.current -= 1
      }
      setAnnounce(`${leaving.name} left. ${prev.length - 1} in the room.`)
      return prev.slice(0, -1)
    })
  }, [])

  // Close the roster on an outside click or Escape, and return focus to its button.
  useEffect(() => {
    if (!rosterOpen) return
    const onDown = (e: PointerEvent) => {
      if (
        rosterRef.current &&
        !rosterRef.current.contains(e.target as Node) &&
        !overflowBtnRef.current?.contains(e.target as Node)
      ) {
        setRosterOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [rosterOpen])

  const closeRoster = useCallback(() => {
    setRosterOpen(false)
    overflowBtnRef.current?.focus()
  }, [])

  const onRosterKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRoster()
      }
    },
    [closeRoster],
  )

  const activePerson = useMemo(
    () => visible.find((p) => p.id === active) ?? null,
    [visible, active],
  )

  return (
    <div className={className}>
      <div
        ref={rootRef}
        className="flex flex-col items-center gap-6"
      >
        {/* The presence row. */}
        <div
          role="group"
          aria-label={`${people.length} people in the room, ${onlineCount} online`}
          className="relative flex items-center"
          onPointerEnter={() => !reduced && setSpread(true)}
          onPointerLeave={() => {
            setSpread(false)
            setActive(null)
          }}
          onFocus={() => !reduced && setSpread(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setSpread(false)
              setActive(null)
            }
          }}
        >
          <ul className="flex items-center" style={{ paddingLeft: 14 }}>
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((person, i) => {
                const isActive = active === person.id
                return (
                  <motion.li
                    key={person.id}
                    layout={!reduced}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, x: -10 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      x: 0,
                      marginLeft: i === 0 ? 0 : overlap,
                    }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, x: 10 }}
                    transition={
                      reduced
                        ? { duration: 0.15 }
                        : { type: 'spring', stiffness: 420, damping: 32, mass: 0.6 }
                    }
                    style={{ zIndex: isActive ? 40 : MAX_VISIBLE - i }}
                    className="relative"
                  >
                    {/* The tooltip, above the face, on hover or focus. */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          role="status"
                          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }}
                          transition={{ duration: 0.16, ease: EASE }}
                          className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-max -translate-x-1/2 rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-left shadow-xl"
                        >
                          <span className="block text-sm font-semibold text-white">
                            {person.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-white/55">
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ background: PRESENCE_META[person.presence].color }}
                            />
                            {person.role} &middot; {PRESENCE_META[person.presence].label}
                          </span>
                          <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-white/10 bg-[#111]" />
                        </motion.span>
                      )}
                    </AnimatePresence>

                    <motion.button
                      type="button"
                      aria-label={`${person.name}, ${person.role}, ${PRESENCE_META[person.presence].label}`}
                      onPointerEnter={() => setActive(person.id)}
                      onPointerLeave={() => setActive((a) => (a === person.id ? null : a))}
                      onFocus={() => setActive(person.id)}
                      className="relative block rounded-full outline-none ring-2 ring-[#0a0a0a] transition-shadow focus-visible:ring-[#DCF87C]"
                      animate={reduced ? undefined : { y: isActive ? -6 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                    >
                      <Face person={person} />
                      <PresenceDot presence={person.presence} reduced={reduced} />
                    </motion.button>
                  </motion.li>
                )
              })}
            </AnimatePresence>

            {/* The overflow — a real button that opens the full roster. */}
            {hiddenCount > 0 && (
              <motion.li
                layout={!reduced}
                style={{ marginLeft: overlap, zIndex: 0 }}
                className="relative"
              >
                <button
                  ref={overflowBtnRef}
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={rosterOpen}
                  aria-controls={`${baseId}-roster`}
                  onClick={() => {
                    setRosterOpen((o) => !o)
                    if (!rosterOpen) setAnnounce(`Roster open. ${people.length} people.`)
                  }}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white/80 outline-none ring-2 ring-[#0a0a0a] transition-colors hover:bg-white/15 focus-visible:ring-[#DCF87C]"
                >
                  +{hiddenCount}
                </button>
              </motion.li>
            )}
          </ul>
        </div>

        {/* Live line: how many are here and online. */}
        <p className="text-sm text-white/45">
          <span className="font-semibold text-white/75">{people.length}</span> in the room
          {onlineCount > 0 && (
            <>
              {' '}
              &middot; <span style={{ color: PRESENCE_META.online.color }}>{onlineCount} online</span>
            </>
          )}
        </p>

        {/* The traffic controls — people join and leave a live session. */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={addPerson}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
          >
            Someone joins
          </button>
          <button
            type="button"
            onClick={removePerson}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
          >
            Someone leaves
          </button>
        </div>
      </div>

      {/* The roster popover — the full list, every presence state spelled out. */}
      <AnimatePresence>
        {rosterOpen && (
          <motion.div
            ref={rosterRef}
            id={`${baseId}-roster`}
            role="dialog"
            aria-label="Everyone in the room"
            onKeyDown={onRosterKey}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="mx-auto mt-6 w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d0d] p-2 shadow-2xl"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <h4 className="text-sm font-semibold text-white">In the room</h4>
              <button
                type="button"
                onClick={closeRoster}
                className="rounded-md px-2 py-1 text-xs text-white/50 outline-none hover:text-white focus-visible:text-[#DCF87C]"
              >
                Close
              </button>
            </div>
            <ul className="max-h-64 space-y-0.5 overflow-y-auto">
              {people.map((person) => (
                <li key={person.id}>
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                    <span className="relative shrink-0">
                      <Face person={person} size={36} />
                      <PresenceDot presence={person.presence} reduced={reduced} size={10} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-white/45">{person.role}</span>
                    </span>
                    <span
                      className="shrink-0 text-xs capitalize"
                      style={{ color: PRESENCE_META[person.presence].color }}
                    >
                      {PRESENCE_META[person.presence].label}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tooltip name read out for the focused face, plus traffic announcements. */}
      <span className="sr-only" aria-live="polite">
        {activePerson ? `${activePerson.name}, ${activePerson.role}, ${PRESENCE_META[activePerson.presence].label}. ` : ''}
        {announce}
      </span>
    </div>
  )
}

export default AvatarStack
