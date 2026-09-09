import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

// The "hard native control, rebuilt" thread (Select, Combobox, Calendar,
// ColorField, TagInput) kept turning the browser's ugly defaults into
// product-grade craft — but it never touched the file input, the single
// clumsiest control the platform ships. `<input type="file">` gives you an
// unstyleable button and a bare filename, no drag target, no preview, no way
// to drop a handful at once and take one back out. This is that control rebuilt
// as a real dropzone: a large, keyboard-reachable target you can drag onto or
// click to browse, that reads each file locally, previews the images as
// thumbnails, and lets you lift any one back off — the whole surface animated
// so the drag reads as a physical act rather than a form field.
//
// It is deliberately an *interaction study*, the same honesty the ContactForm
// and the Waveform keep: nothing is uploaded, nothing is sent anywhere, no
// backend exists. Files are read into object URLs in the browser and revoked
// again the moment a thumbnail leaves or the component unmounts, so the demo
// costs the visitor nothing. The point is the interface, not a destination.
//
// Motion lives in three places and all of it defers to prefers-reduced-motion:
// the dashed border and the whole surface lift and warm to the accent while a
// file hovers over it; each thumbnail springs in and, on removal, animates out
// under AnimatePresence; and a brief accent sweep crosses a card while its file
// is being read. Reduced motion keeps every one of these as a plain, instant
// state change — the dropzone stays fully usable, just calm.

export interface DroppedFile {
  id: string
  name: string
  size: number
  type: string
  /** An object URL for image files, so the thumbnail can render locally. */
  url?: string
}

let uid = 0
const nextId = () => `dz-${Date.now().toString(36)}-${(uid++).toString(36)}`

/** Human-readable byte size, e.g. "1.4 MB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

/** A tiny monochrome glyph for a non-image file, chosen off its type. */
function fileGlyph(type: string): string {
  if (type.startsWith('audio/')) return 'AUD'
  if (type.startsWith('video/')) return 'VID'
  if (type.includes('pdf')) return 'PDF'
  if (type.includes('zip') || type.includes('compressed')) return 'ZIP'
  if (type.startsWith('text/')) return 'TXT'
  return 'FILE'
}

/**
 * A hand-built, accessible file dropzone with local image previews. Drag files
 * onto it, or focus it and press Enter/Space to browse; each file is read in
 * the browser (never uploaded) and shown as a card, images as live thumbnails.
 * Any file can be lifted back off. Controlled callers get every change through
 * `onChange`; everything is revoked and cleaned up on unmount.
 *
 * Under prefers-reduced-motion the lift, the spring-in, and the read sweep all
 * come off and it stays a plain, legible, fully usable control.
 */
export function Dropzone({
  accept = 'image/*',
  maxFiles = 6,
  label = 'Drop files here',
  hint = 'or click to browse — nothing is uploaded',
  onChange,
  className = '',
}: {
  /** Passed to the underlying input; also gates dropped files by MIME/type. */
  accept?: string
  /** Cap on how many files are held at once; older ones drop off the front. */
  maxFiles?: number
  /** The large call-to-action line inside the zone. */
  label?: string
  /** The quieter line under it. */
  hint?: string
  /** Fires with the current list whenever files are added or removed. */
  onChange?: (files: DroppedFile[]) => void
  className?: string
}) {
  const reduce = useReducedMotion()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<DroppedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState<Set<string>>(new Set())
  // dragenter/leave fire for every child; a counter tracks true boundary
  // crossings so the lit state does not flicker as the pointer moves inside.
  const dragDepth = useRef(0)

  // Keep the latest files in a ref so cleanup on unmount can revoke every URL
  // without making the effect depend on (and re-run with) the list.
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(
    () => () => {
      for (const f of filesRef.current) if (f.url) URL.revokeObjectURL(f.url)
    },
    [],
  )

  const matchesAccept = useCallback(
    (file: File) => {
      if (!accept || accept === '*' || accept === '*/*') return true
      return accept.split(',').some((raw) => {
        const rule = raw.trim().toLowerCase()
        if (!rule) return false
        if (rule.endsWith('/*')) return file.type.startsWith(rule.slice(0, -1))
        if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule)
        return file.type.toLowerCase() === rule
      })
    },
    [accept],
  )

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list).filter(matchesAccept)
      if (incoming.length === 0) return

      const added: DroppedFile[] = incoming.map((file) => {
        const isImage = file.type.startsWith('image/')
        return {
          id: nextId(),
          name: file.name,
          size: file.size,
          type: file.type,
          url: isImage ? URL.createObjectURL(file) : undefined,
        }
      })

      // A brief "reading" state per new card, purely for the sweep animation;
      // there is no real async decode, so it clears on a short timer.
      if (!reduce) {
        setReading((prev) => {
          const next = new Set(prev)
          for (const f of added) next.add(f.id)
          return next
        })
        for (const f of added) {
          window.setTimeout(() => {
            setReading((prev) => {
              const next = new Set(prev)
              next.delete(f.id)
              return next
            })
          }, 480)
        }
      }

      setFiles((prev) => {
        const merged = [...prev, ...added]
        // Enforce the cap by dropping the oldest, revoking their URLs.
        let trimmed = merged
        if (merged.length > maxFiles) {
          const overflow = merged.slice(0, merged.length - maxFiles)
          for (const f of overflow) if (f.url) URL.revokeObjectURL(f.url)
          trimmed = merged.slice(merged.length - maxFiles)
        }
        onChange?.(trimmed)
        return trimmed
      })
    },
    [matchesAccept, maxFiles, onChange, reduce],
  )

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const gone = prev.find((f) => f.id === id)
        if (gone?.url) URL.revokeObjectURL(gone.url)
        const next = prev.filter((f) => f.id !== id)
        onChange?.(next)
        return next
      })
    },
    [onChange],
  )

  const clearAll = useCallback(() => {
    setFiles((prev) => {
      for (const f of prev) if (f.url) URL.revokeObjectURL(f.url)
      onChange?.([])
      return []
    })
  }, [onChange])

  const onDrop = useCallback(
    (e: ReactDragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  const onDragEnter = useCallback((e: ReactDragEvent) => {
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }, [])

  const onDragLeave = useCallback((e: ReactDragEvent) => {
    e.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }, [])

  const openPicker = useCallback(() => inputRef.current?.click(), [])

  const onZoneKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openPicker()
      }
    },
    [openPicker],
  )

  const spring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 30 }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`${label}. ${hint}`}
        onClick={openPicker}
        onKeyDown={onZoneKeyDown}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        animate={
          reduce
            ? undefined
            : { scale: dragging ? 1.012 : 1, y: dragging ? -2 : 0 }
        }
        transition={spring}
        className={`group relative flex min-h-[168px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 text-center outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
          dragging
            ? 'border-[#DCF87C]/80 bg-[#DCF87C]/[0.06]'
            : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.03]'
        }`}
      >
        {/* Accent wash that fades up while a file hovers over the zone. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={false}
          animate={{ opacity: dragging ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.3 }}
          style={{
            background:
              'radial-gradient(120% 120% at 50% 0%, rgba(220,248,124,0.14), transparent 70%)',
          }}
        />

        {/* The drop mark: a tray with an arrow that lifts on drag-over. */}
        <motion.svg
          aria-hidden
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          className="relative mb-3 text-white/70"
          animate={reduce ? undefined : { y: dragging ? -3 : 0 }}
          transition={spring}
        >
          <path
            d="M12 3v10m0-10 3.5 3.5M12 3 8.5 6.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={dragging ? 'text-[#DCF87C]' : ''}
          />
          <path
            d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>

        <p className="relative font-display text-lg font-semibold text-white">
          {dragging ? 'Release to add' : label}
        </p>
        <p className="relative mt-1 text-sm text-white/45">{hint}</p>

        <span className="relative mt-3 text-[11px] uppercase tracking-[0.28em] text-white/30">
          {files.length}/{maxFiles}
        </span>
      </motion.div>

      {/* The tray of read files. */}
      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div
            key="tray"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex items-center justify-between px-1">
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
                In your browser
              </span>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-full px-2 py-1 text-xs text-white/50 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60"
              >
                Clear all
              </button>
            </div>

            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <AnimatePresence initial={false} mode="popLayout">
                {files.map((file) => (
                  <motion.li
                    key={file.id}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, scale: 0.9, y: -6 }
                    }
                    transition={spring}
                    className="group/card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-black/40">
                      {file.url ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                          {fileGlyph(file.type)}
                        </span>
                      )}

                      {/* The read sweep — a single accent band crossing once. */}
                      {reading.has(file.id) && !reduce && (
                        <motion.div
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 w-1/2"
                          initial={{ x: '-120%' }}
                          animate={{ x: '240%' }}
                          transition={{ duration: 0.48, ease: 'easeInOut' }}
                          style={{
                            background:
                              'linear-gradient(90deg, transparent, rgba(220,248,124,0.35), transparent)',
                          }}
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => removeFile(file.id)}
                        aria-label={`Remove ${file.name}`}
                        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white/80 opacity-0 backdrop-blur transition-opacity hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/70 group-hover/card:opacity-100"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M2 2l8 8M10 2l-8 8"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="px-2.5 py-2">
                      <p className="truncate text-xs font-medium text-white/85">
                        {file.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {formatSize(file.size)}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
