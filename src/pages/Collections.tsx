import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import { Eyebrow } from '../components/Eyebrow'
import { GradientText } from '../components/GradientText'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { Seo } from '../components/Seo'
import { COLLECTIONS, PICK_COUNT, type Pick } from '../data/collections'

const EASE = [0.16, 1, 0.3, 1] as const

// One curated pick — a card that deep-links straight to the live piece on
// /playground. Hover grows a lime edge and nudges the whole card, the same
// language the Work ledger uses, so a pick reads as a doorway rather than a
// static tile. The note is the point: it is why *this* one is on the shelf.
function PickCard({ pick }: { pick: Pick }) {
  return (
    <Link
      to={`/playground#${pick.anchor}`}
      data-cursor
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-[#DCF87C]/40 hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DCF87C]/60 sm:p-6"
    >
      {/* Lime edge that grows in on hover — the shared ledger tell. */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-0 rounded-full bg-[#DCF87C] transition-transform duration-500 ease-out group-hover:scale-y-100"
      />
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-white transition-transform duration-500 ease-out group-hover:translate-x-1 sm:text-xl">
          {pick.name}
        </h3>
        <span
          aria-hidden
          className="mt-1 shrink-0 text-white/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#DCF87C]"
        >
          &rarr;
        </span>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-white/55">{pick.note}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/30 transition-colors group-hover:text-[#DCF87C]/80">
        Open in the playground
      </span>
    </Link>
  )
}

// The /collections page — Arseniy's own taste-led paths through the Playground.
// The Playground is organised by the kind of motion; the Library is the full
// catalogue; this is the missing layer that says which pieces he would send you
// to first, and why. Deliberately about the craft and the person, not any one
// product — it de-centres Guided by foregrounding the range built for its own
// sake.
export default function Collections() {
  return (
    <>
      <Seo
        title="Collections"
        description="Arseniy Cherednichenko's own curated paths through the Playground — favourite hand-built pieces grouped by the threads he cares about, each with an honest line on why it earns its place."
      />

      {/* HERO */}
      <header className="mx-auto w-full max-w-4xl px-6 pt-36 sm:pt-44">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <Eyebrow>Collections</Eyebrow>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
          className="mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-7xl"
        >
          The pieces I would <GradientText>show you first.</GradientText>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.14, ease: EASE }}
          className="mt-7 max-w-xl text-lg leading-relaxed text-white/55"
        >
          The Playground has grown large. This is a shorter way in &mdash; a few
          personal collections, pulled from the shelf and grouped by a thread I
          actually care about. Every pick is something I built by hand, and every
          line is why it is here.
        </motion.p>

        {/* COUNT — a live total, so the figure never drifts behind the data. */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22, ease: EASE }}
          className="mt-9 flex items-end gap-3"
        >
          <AnimatedCounter
            value={PICK_COUNT}
            className="font-display text-5xl font-bold leading-none text-[#DCF87C] sm:text-6xl"
          />
          <span className="pb-1 text-sm leading-snug text-white/45">
            picks, across
            <br />
            {COLLECTIONS.length} collections
          </span>
        </motion.div>
      </header>

      {/* CHIP RAIL — jump to any collection. Sticky under the nav, scrollable on
          small screens so it never wraps into a block. */}
      <motion.nav
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
        aria-label="Jump to a collection"
        className="sticky top-16 z-20 mt-12 border-y border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md"
      >
        <div className="mx-auto flex w-full max-w-4xl gap-2 overflow-x-auto px-6 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {COLLECTIONS.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="shrink-0 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:border-[#DCF87C]/50 hover:text-[#DCF87C]"
            >
              <span className="mr-1.5 tabular-nums text-white/30">{c.num}</span>
              {c.title}
            </a>
          ))}
        </div>
      </motion.nav>

      {/* THE COLLECTIONS */}
      <div className="mx-auto w-full max-w-4xl px-6 pb-8">
        {COLLECTIONS.map((collection) => (
          <section
            key={collection.id}
            id={collection.id}
            className="scroll-mt-32 border-t border-white/10 py-16 first:border-t-0 sm:py-20"
          >
            <Reveal>
              <Eyebrow id={collection.id}>{`Collection ${collection.num}`}</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-4 max-w-2xl font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                {collection.title}
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/55">
                {collection.blurb}
              </p>
            </Reveal>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {collection.picks.map((pick, i) => (
                <Reveal key={pick.anchor} delay={Math.min(i * 0.05, 0.2)}>
                  <PickCard pick={pick} />
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* CLOSING — out into the full shelf, and back to the rest of the site so
          no single thread (this one included) reads as the whole story. */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-28 pt-6">
        <Reveal>
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              That is the shortlist.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/60">
              These are favourites, not the whole shelf. The full Playground is a
              few hundred hand-built pieces deep, and the Library is the honest
              catalogue of every one.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/playground"
                className="rounded-full bg-[#DCF87C] px-6 py-3 text-sm font-semibold text-black transition hover:brightness-105"
              >
                Open the full playground
              </Link>
              <Link
                to="/library"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-[#DCF87C]/60 hover:text-white"
              >
                The whole catalogue
              </Link>
              <Link
                to="/work"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-[#DCF87C]/60 hover:text-white"
              >
                See the client work
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
