import { useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { Seo } from '../components/Seo'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { TracingBeam } from '../components/TracingBeam'
import { ReadingDial } from '../components/ReadingDial'
import { getNote, nextNote, relatedNotes, readingMinutes, type NoteBlock } from '../data/notes'

const EASE = [0.16, 1, 0.3, 1] as const

// Renders one published piece's prose. Each block scroll-reveals on a gentle
// stagger (reduced-motion shows it in place). Paragraphs carry the reading
// column; a sub-heading breaks the rhythm; a pulled-out line gets a lime rule
// and display type. No raw HTML is ever injected — the block union is the only
// shape the body can take, so a note can never smuggle markup onto the page.
function NoteBody({ blocks, reduce }: { blocks: NoteBlock[]; reduce: boolean | null }) {
  return (
    <div>
      {blocks.map((block, i) => {
        const reveal = {
          initial: reduce ? false : { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.55, ease: EASE },
        } as const
        if (block.type === 'h') {
          return (
            <motion.h2
              key={i}
              {...reveal}
              className="mt-14 font-display text-2xl font-bold leading-tight tracking-tight text-white/90 sm:text-3xl"
            >
              {block.text}
            </motion.h2>
          )
        }
        if (block.type === 'quote') {
          return (
            <motion.blockquote
              key={i}
              {...reveal}
              className="relative mt-10 border-l-2 border-[#DCF87C]/60 pl-6 font-display text-xl font-medium italic leading-snug text-white/80 sm:text-2xl"
            >
              {block.text}
            </motion.blockquote>
          )
        }
        return (
          <motion.p
            key={i}
            {...reveal}
            className="mt-6 text-lg leading-relaxed text-white/70 first:mt-0"
          >
            {block.text}
          </motion.p>
        )
      })}
    </div>
  )
}

// A single "keep reading" card, reused for the next note and related notes.
function NoteLink({ slug, title, tag, label }: { slug: string; title: string; tag: string; label: string }) {
  return (
    <Link
      to={`/writing/${slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-white/25"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#DCF87C]/[0.06] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <span className="relative text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">{label}</span>
      <p className="relative mt-3 font-display text-xl font-bold leading-snug text-white/90">{title}</p>
      <span className="relative mt-3 inline-block text-xs font-semibold uppercase tracking-[0.18em] text-[#DCF87C]/80">
        {tag}
      </span>
    </Link>
  )
}

export default function WritingDetail() {
  const { slug } = useParams()
  const reduce = useReducedMotion()
  const note = getNote(slug)
  // The reading column the corner dial reports progress across — the article
  // element itself, so the dial measures the piece rather than the whole page.
  const articleRef = useRef<HTMLElement>(null)

  if (!note) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-6">
        <Seo title="Note not found" description="That note does not exist, or it has moved. Head back to the writing." />
        <Eyebrow>Not found</Eyebrow>
        <h1 className="mt-5 font-display text-5xl font-bold tracking-tight">No such note.</h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-white/55">
          That note does not exist, or it has moved. Head back to the writing.
        </p>
        <Link
          to="/writing"
          className="mt-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#DCF87C] transition-opacity hover:opacity-80"
        >
          <span aria-hidden>&lt;-</span> All writing
        </Link>
      </div>
    )
  }

  const draft = note.status === 'planned'
  const minutes = readingMinutes(note)
  const next = nextNote(note.slug)
  const related = relatedNotes(note).slice(0, 2)

  return (
    <article ref={articleRef} className="mx-auto w-full max-w-3xl px-6 pb-28 pt-32">
      <Seo title={note.title} description={note.summary} />

      {/* Trail */}
      <Breadcrumbs items={[{ label: 'Writing', to: '/writing' }, { label: note.title }]} />

      {/* HEADER */}
      <header className="mt-10">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
          className="flex flex-wrap items-center gap-3"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DCF87C]/80">{note.tag}</span>
          {draft ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/50">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/35" />
              Draft
            </span>
          ) : (
            <>
              {note.date && <span className="text-xs tabular-nums text-white/45">{note.date}</span>}
              {minutes > 0 && (
                <>
                  <span aria-hidden className="text-white/20">·</span>
                  <span className="text-xs text-white/45">{minutes} min read</span>
                </>
              )}
            </>
          )}
        </motion.div>

        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
          className="mt-6 font-display text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl"
        >
          {note.title}
        </motion.h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          className="mt-7 text-xl leading-relaxed text-white/65 sm:text-2xl"
        >
          {note.summary}
        </motion.p>
      </header>

      {/* DRAFT STATE — the honesty is the feature. No fabricated body. */}
      {draft && (
        <Reveal className="mt-14">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-10">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#DCF87C]/[0.07] blur-3xl"
            />
            <div className="relative flex items-center gap-3">
              <span aria-hidden className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DCF87C]/50" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#DCF87C]" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">Still being written</span>
            </div>
            <p className="relative mt-5 max-w-xl leading-relaxed text-white/60">
              This one is a genuine draft, not a finished piece dressed up as one. I would rather show you exactly what is
              coming than pad the page with words I have not thought through yet. Here are the threads I actually mean to
              pull.
            </p>

            {note.plan && note.plan.length > 0 && (
              <ul className="relative mt-8 space-y-4">
                {note.plan.map((point, i) => (
                  <motion.li
                    key={point}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.08, 0.3) }}
                    className="flex items-start gap-4"
                  >
                    <span className="mt-1 shrink-0 text-sm font-semibold tabular-nums text-[#DCF87C]/70">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="leading-relaxed text-white/75">{point}</span>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
      )}

      {/* PUBLISHED BODY — the finished prose, rendered from the block model and
          run down the hallmark TracingBeam reading rule, so a long piece carries
          the same margin beam the Craft notes do: a lime fill that draws down the
          gutter as the column scrolls, the reader's eye tracking its lit head. */}
      {!draft && note.body && note.body.length > 0 && (
        <TracingBeam className="mt-14">
          <NoteBody blocks={note.body} reduce={reduce} />
        </TracingBeam>
      )}

      {/* CTA — tuned to the note's state. A draft offers to send the finished
          piece along; a published one points at the proof it talks about. */}
      <Reveal className="mt-14" delay={0.05}>
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.015] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <p className="max-w-md text-sm leading-relaxed text-white/55">
            {draft
              ? 'Want a heads-up when this one is finished? The best way is to say hello — I am happy to send it your way.'
              : 'This whole site is built in the open — written and shipped a small green commit at a time, with the history all there to read. You can check every claim against it.'}
          </p>
          <Link
            to={draft ? '/contact' : '/colophon'}
            className="shrink-0 rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#e6ff9a]"
          >
            {draft ? 'Get in touch' : 'How it is built'}
          </Link>
        </div>
      </Reveal>

      {/* KEEP READING */}
      {(next || related.length > 0) && (
        <section className="mt-20">
          <Reveal>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white/85 sm:text-3xl">
              Keep <GradientText>reading.</GradientText>
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {next && <NoteLink slug={next.slug} title={next.title} tag={next.tag} label="Next up" />}
              {related
                .filter((r) => !next || r.slug !== next.slug)
                .slice(0, next ? 1 : 2)
                .map((r) => (
                  <NoteLink key={r.slug} slug={r.slug} title={r.title} tag={r.tag} label={`More on ${r.tag}`} />
                ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* Corner reading dial — only on a finished piece, where there is a column
          long enough to track. It reports progress through this article and
          doubles as the way back to the top of it. */}
      {!draft && note.body && note.body.length > 0 && <ReadingDial targetRef={articleRef} />}
    </article>
  )
}
