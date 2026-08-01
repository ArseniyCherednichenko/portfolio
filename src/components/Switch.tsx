import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion'
import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

// The controls family had sliders (ElasticSlider), a rotary dial (Knob), and a
// discrete Stepper, but no toggle — the one binary control every settings row
// leans on. This fills that gap. It is the same "give it real physics" language
// the sliders speak: the thumb rides a spring across the track rather than
// snapping, and while it travels it squashes and stretches in the direction of
// motion (scaleX up, scaleY down, area roughly kept) so the flick lands with
// weight instead of a flat CSS transition. The track crossfades from a muted
// rail to the lime accent on the same spring, and a small mark inside the thumb
// morphs from a dash to a check as it crosses. It is a real role="switch": a
// focusable button carrying aria-checked, toggled by click or Space/Enter, with
// a visible focus ring, controlled or uncontrolled, and a disabled state. Under
// prefers-reduced-motion the squash and the long spring come off — the thumb
// moves near-instantly and stays a plain, fully usable toggle.

/**
 * A tactile on/off toggle. Click it, or focus it and press Space/Enter; the
 * thumb springs across the track and squashes into the travel, the rail
 * crossfading to the lime accent as a small dash morphs into a check.
 *
 * Controlled (`checked` + `onChange`) or uncontrolled (`defaultChecked`). It is
 * a real `role="switch"` — focusable, keyboard-driven, aria-checked — and honours
 * a `disabled` state. Under prefers-reduced-motion the physics come off and it
 * stays a plain, legible toggle that still reads and responds to assistive tech.
 */
export function Switch({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  label,
  disabled = false,
  size = 30,
  icon = true,
  className = '',
}: {
  /** Controlled state. When set, changes are reported via onChange only. */
  checked?: boolean
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  /** Optional visible text, placed before the track; also the accessible name. */
  label?: string
  disabled?: boolean
  /** Track height in px; the rest of the geometry scales from it. */
  size?: number
  /** Show the dash→check mark inside the thumb (auto-hidden on tiny sizes). */
  icon?: boolean
  className?: string
}) {
  const reduce = useReducedMotion()
  const id = useId()

  const isControlled = controlledChecked !== undefined
  const [uncontrolled, setUncontrolled] = useState(defaultChecked)
  const on = isControlled ? controlledChecked : uncontrolled

  // Geometry is fixed by props, so no measuring is needed — travel is exact.
  const pad = Math.max(3, Math.round(size * 0.13))
  const thumb = size - pad * 2
  const width = Math.round(size * 1.75)
  const travel = width - thumb - pad * 2

  // The thumb rides a spring toward its target x; a stiffer, heavily damped
  // spring under reduced motion lands it almost immediately with no overshoot.
  const xTarget = useMotionValue(on ? travel : 0)
  const x = useSpring(xTarget, reduce
    ? { stiffness: 2200, damping: 90 }
    : { stiffness: 700, damping: 34, mass: 0.6 })

  // Track fill crossfades on the same timeline as the thumb.
  const fillTarget = useMotionValue(on ? 1 : 0)
  const fill = useSpring(fillTarget, reduce
    ? { stiffness: 2200, damping: 90 }
    : { stiffness: 520, damping: 40 })

  // Squash-and-stretch: the faster the thumb moves, the more it elongates along
  // travel and thins across it. Clamped, and flat (1) whenever motion is off.
  const velocity = useVelocity(x)
  const scaleX = useTransform(velocity, (v) =>
    reduce ? 1 : 1 + Math.min(Math.abs(v) / 2600, 0.16))
  const scaleY = useTransform(velocity, (v) =>
    reduce ? 1 : 1 - Math.min(Math.abs(v) / 2600, 0.16) * 0.7)

  const dashOpacity = useTransform(fill, [0, 0.5], [1, 0])
  const checkOpacity = useTransform(fill, [0.5, 1], [0, 1])
  const markRotate = useTransform(fill, [0, 1], [-60, 0])

  useEffect(() => {
    xTarget.set(on ? travel : 0)
    fillTarget.set(on ? 1 : 0)
  }, [on, travel, xTarget, fillTarget])

  function toggle() {
    if (disabled) return
    const next = !on
    if (!isControlled) setUncontrolled(next)
    onChange?.(next)
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      toggle()
    }
  }

  const showIcon = icon && thumb >= 18

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ? undefined : 'Toggle'}
      aria-labelledby={label ? `${id}-label` : undefined}
      disabled={disabled}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={`group inline-flex items-center gap-3 rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {label && (
        <span
          id={`${id}-label`}
          className="select-none text-sm text-white/70 transition-colors group-hover:text-white/90"
        >
          {label}
        </span>
      )}

      <span
        className="relative shrink-0 rounded-full ring-1 ring-inset ring-white/10 transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-[#DCF87C]/70 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-black"
        style={{ width, height: size }}
      >
        {/* Rail base and the lime fill that crossfades in over it. */}
        <span className="absolute inset-0 rounded-full bg-white/10" />
        <motion.span
          className="absolute inset-0 rounded-full bg-[#DCF87C]"
          style={{ opacity: fill }}
          aria-hidden
        />

        {/* The thumb: a spring-driven, squash-stretching disc. */}
        <motion.span
          className="absolute top-1/2 grid place-items-center rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
          style={{
            x,
            left: pad,
            width: thumb,
            height: thumb,
            marginTop: -thumb / 2,
            scaleX,
            scaleY,
          }}
          aria-hidden
        >
          {showIcon && (
            <motion.svg
              viewBox="0 0 24 24"
              width={thumb * 0.6}
              height={thumb * 0.6}
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-black/70"
              style={{ rotate: markRotate }}
            >
              {/* dash (off) and check (on), crossfading on the fill spring */}
              <motion.path d="M7 12 L17 12" style={{ opacity: dashOpacity }} />
              <motion.path d="M6 12.5 L10 16.5 L18 8" style={{ opacity: checkOpacity }} />
            </motion.svg>
          )}
        </motion.span>
      </span>
    </button>
  )
}
