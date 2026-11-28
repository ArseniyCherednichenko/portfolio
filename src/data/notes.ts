// Writing — an honest, in-the-open notes section.
//
// This is a real, intentional part of the site. Most pieces are still being
// written: every such entry is a genuine topic Arseniy plans to write about,
// marked `status: 'planned'` so it reads as an honest promise, not a fabricated
// post. When a piece is actually written it flips to `status: 'published'`, gets
// a real `date`, and carries a `body` — the finished prose, rendered on its
// detail page. NOTHING here pretends to be finished, and no note invents a
// claim, a client, or a result.
//
// Keep it honest: only topics he actually means to write, in his own voice,
// and a `body` only once the piece is genuinely written. The one published
// piece so far — "Building this site in the open" — is deliberately about a
// subject every reader can verify against the repo itself, so none of it rests
// on a claim you have to take on faith.

import { COMPONENT_COUNT } from './stats'

export type NoteStatus = 'planned' | 'published'

/**
 * One block of a published note's body. Kept deliberately small: a paragraph,
 * a sub-heading, or a pulled-out line. No raw HTML, no fabricated structure —
 * just the shapes real prose actually needs, so the detail page can render a
 * finished piece with proper rhythm instead of one undifferentiated wall.
 */
export type NoteBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'quote'; text: string }

export interface Note {
  slug: string
  title: string
  /** One honest line on what the piece will be about. */
  summary: string
  /** A single grouping tag, used by the on-page filter. */
  tag: NoteTag
  status: NoteStatus
  /** ISO date, only once genuinely published. */
  date?: string
  /**
   * The threads Arseniy actually means to pull in the finished piece. These
   * are honest planning notes — an outline of intent, NOT fabricated
   * conclusions or claims. Shown on the note's detail page while it is still
   * in draft, so a reader can see where it is headed.
   */
  plan?: string[]
  /**
   * The finished prose, present ONLY on a published piece. An ordered list of
   * blocks the detail page renders in sequence. Honest by construction: write
   * it only when the piece is actually written.
   */
  body?: NoteBlock[]
}

export type NoteTag = 'Craft' | 'Building in the open' | 'AI' | 'iOS'

// The filter tabs, in display order. "All" is prepended by the page.
export const NOTE_TAGS: NoteTag[] = ['Craft', 'Building in the open', 'AI', 'iOS']

export const NOTES: Note[] = [
  {
    slug: 'the-voice-is-in-the-type',
    title: 'The voice is in the type',
    summary:
      'A site’s typography is its accent, not its outfit. Two typefaces, held with restraint, carry more of the feeling than color or layout ever could — notes on the type behind this one.',
    tag: 'Craft',
    status: 'published',
    date: '2026-11-28',
    plan: [
      'Type as the voice of an interface, not a finishing coat',
      'Why two faces — a serif that announces, a sans that explains',
      'Restraint, self-hosting, and how to check it on this site',
    ],
    body: [
      {
        type: 'p',
        text: 'Type is usually the last thing anyone decides, and it is treated like a finishing coat — pick something clean, make the headings bigger, move on. I have come to think that is exactly backwards. Type is the first thing a reader actually hears. Before they have parsed a single word, the shapes of the letters have already set a tone: brisk or warm, serious or playful, considered or thrown together. Typography is not the outfit a site wears. It is the voice it speaks in.',
      },
      {
        type: 'p',
        text: 'This site speaks in two. Inter carries the body and the interface — the quiet, legible work of a sentence you are meant to read straight through without noticing the letters at all. Fraunces, a variable serif, carries the display type: the headlines, the big statements, the page and project titles. One face for talking, one for announcing. Almost everything the site feels like, it feels like because of the gap between those two.',
      },
      {
        type: 'quote',
        text: 'You notice a typeface the way you notice an accent, not the way you notice a logo — quietly, underneath the words, shaping how everything else is heard.',
      },
      { type: 'h', text: 'Why two, and not one' },
      {
        type: 'p',
        text: 'The easy path is one sans-serif everywhere. It is safe, and it is why so many sites sound identical: competent, neutral, and instantly forgettable, like a room furnished entirely from one catalogue. A single well-made sans can hold a whole product together, but it tends to speak in one register, and a site that is only ever one register reads as templated even when every pixel was placed by hand. The second face is where a voice actually comes from.',
      },
      {
        type: 'p',
        text: 'So the display face here is a serif, and deliberately a warm, slightly characterful one. A serif set large does something a sans rarely does — it reads as editorial, as written rather than generated, as though a person chose these words and meant them. Fraunces in particular carries an optical-size axis, meaning the letterforms are drawn differently for a headline than for a caption, and this site lets that axis track the rendered size, so a title is not just body text made big but a genuine display cut with the flourishes that only make sense large. The contrast is the whole point: the serif announces, the sans explains, and the distance between them is most of the editorial feeling the site has.',
      },
      { type: 'h', text: 'Restraint is the whole trick' },
      {
        type: 'p',
        text: 'Two faces is already a decision about restraint, and the restraint does not stop there. One display face, one text face, a small set of weights, and a single accent color used sparingly — that is the entire kit. The temptation is always more: another weight for this one heading, a condensed cut for that label, a second accent because the first felt lonely. Each addition feels like richness in the moment and reads as noise in aggregate. A type system earns its coherence by what it refuses, not by what it includes. Saying no to the fourth weight is the same craft as cutting the animation that could not say why it was there.',
      },
      { type: 'h', text: 'Self-hosted, on purpose' },
      {
        type: 'p',
        text: 'The display face is not pulled from a font service on every visit. It is subset down to the characters the site actually uses, served from the site itself, and preloaded so the headlines paint in the right face from the first frame instead of flashing a fallback and reflowing a beat later. That is more work than a single link tag, and it buys two things worth having. Control, because the type is part of the build rather than a remote dependency that can change or quietly disappear. And honesty, because there is no third party watching who reads which page. The font is a file in the repository, like everything else here.',
      },
      { type: 'h', text: 'You can check this one too' },
      {
        type: 'p',
        text: 'Like the rest of the site, none of this asks to be taken on faith. There is a type specimen page that lays both faces out — every size, set side by side — and names exactly what carries what. Put a headline next to a paragraph and you can see the division of labour for yourself: the serif doing the announcing, the sans doing the reading. I would rather you look than believe me.',
      },
      {
        type: 'p',
        text: 'Typography is quiet by design. Done well, nobody comes away saying the type was good; they come away feeling the thing was considered, and the type is a large, invisible part of why. The voice of an interface is not in its copy alone — it is in the shapes the copy is set in. Choose those shapes with care, hold them with restraint, and the whole thing starts to sound like someone, instead of like a template with the serial numbers filed off.',
      },
    ],
  },
  {
    slug: 'building-with-models-not-around-them',
    title: 'Building with models, not around them',
    summary:
      'Weaving AI into a real product so it feels like part of the thing, not a chatbot bolted on the side. Notes from actually doing it.',
    tag: 'AI',
    status: 'published',
    date: '2026-11-26',
    plan: [
      'Making AI feel like part of the product, not bolted on',
      'Designing for the moments when the model is wrong',
      'The seam between deterministic code and a model',
    ],
    body: [
      {
        type: 'p',
        text: 'The easy way to add AI to a product is to put a chatbot in the corner. A little bubble, a text box, a model behind it, and you can say the thing has AI now. I have built that version, and I have deleted it. It is a confession that you could not think of anything better to do with the model than hand the user a second, worse search bar and hope they know what to type into it.',
      },
      {
        type: 'p',
        text: 'The products that actually use a model well rarely look like they have a model at all. The intelligence is spread through the thing — in what it suggests, in what it quietly skips, in the shape of the next step it offers — not parked in a panel you have to go and talk to. The question I try to ask is not where do I put the AI, but what does this product do that is suddenly cheap now that a model exists, and was impossibly expensive before. The answers almost never look like a chat window.',
      },
      {
        type: 'quote',
        text: 'A model is not a feature you add. It is a new material you build with, and like any material it has a grain you either work along or fight.',
      },
      { type: 'h', text: 'Part of the thing, not bolted on' },
      {
        type: 'p',
        text: 'Guided is the clearest case I have built. It is a tutor for students, and the one design decision the whole thing rests on is that it asks rather than answers. A model will cheerfully hand a fourteen-year-old the finished solution to their homework, and that is exactly the thing a tutor must not do, because the understanding happens in the struggle you just skipped. So the model is not bolted on as an answer machine; the entire product is shaped around pointing it the other way — toward the question a good teacher would ask next. The AI is not a feature of Guided. It is the grain the product is cut along.',
      },
      {
        type: 'p',
        text: 'That is the difference I mean. Bolted-on AI leaves the product exactly as it was and adds a door marked "ask the robot." Woven-in AI changes what the product is for. It is more work, because you cannot treat the model as a black box at the edge of the system — you have to decide what it is allowed to do, what it must never do, and what the product does in its place when it refuses. But it is the only version that feels like one thing instead of two things sharing a screen.',
      },
      { type: 'h', text: 'Design for when it is wrong' },
      {
        type: 'p',
        text: 'A model is wrong sometimes. Not rarely, not in a way you can patch out — structurally, as a property of the thing. If your design only works when the model is right, you have not designed for a model at all; you have designed for an oracle and borrowed a model to play the part. The interesting work is almost entirely in the other case: the moment the output is confident and wrong, and a person is about to trust it.',
      },
      {
        type: 'p',
        text: 'So I design the wrong path first, before the happy one. What does the screen do when the answer is low-confidence? How does a person correct it without starting over? Where is the off-ramp back to something deterministic they can rely on? A model that can say "I am not sure" and hand control back is worth more than one that is right slightly more often and never flinches, because the first one is honest about its own shape and the second one will eventually betray someone quietly. The whole trick is to make the failure graceful and legible instead of invisible, so a person can catch it with you rather than discover it alone, later, when it has cost them something.',
      },
      { type: 'h', text: 'The seam between code and a model' },
      {
        type: 'p',
        text: 'The part I find most underrated is the seam — the join between the deterministic code you can reason about completely and the probabilistic core you cannot. Good AI products are not mostly model. They are mostly ordinary, boring, dependable code, with the model doing the one narrow thing only a model can do, fenced in tightly on both sides. The code decides what to ask and when. The model answers in its own uncertain way. Then the code checks, constrains, and shapes that answer back into something the rest of the system can treat as solid.',
      },
      {
        type: 'p',
        text: 'This is unglamorous and it is where most of the reliability lives. Validate the shape of what came back before you trust it. Keep the state that must be correct — a student’s progress, a record, anything a person depends on — in plain code and a real database, never implied inside a prompt. Let the model suggest; let deterministic code commit. Draw that line deliberately, write it down, and defend it, because the failure mode of a careless seam is a product that works beautifully in the demo and surprises you in production, which is the one place surprises are expensive.',
      },
      { type: 'h', text: 'The honesty this site already keeps' },
      {
        type: 'p',
        text: `There is a small, related honesty I hold myself to, and you can check it on this very site. Across the ${COMPONENT_COUNT} hand-built pieces here, several simulate a signal — a meter that leans after a level, an analyser that shows a spectrum — and every one of them says so on its own face: no audio, no microphone, a synthesised signal, a relative scale. None of them pretends to measure a world it never touched. That is the same discipline a model demands, turned down to a small component: be exactly as honest about what the thing is doing as you are proud of how it looks doing it.`,
      },
      {
        type: 'p',
        text: 'Build with the model, not around it. Not a panel you bolt to the side and point at, but a material you cut the product along — fenced by code you can trust, graceful in the moments it is wrong, and honest, always, about which parts are certain and which are a good guess. The model is the exciting part. The judgement about where to let it loose and where to hold it back is the actual job.',
      },
    ],
  },
  {
    slug: 'ship-then-refine',
    title: 'Ship, then refine',
    summary:
      'Why I put rough things in front of people early, and how the slow, quiet work of refinement is where the craft actually lives.',
    tag: 'Craft',
    status: 'published',
    date: '2026-11-21',
    plan: [
      'Why rough-but-real beats polished-but-late',
      'The slow work of refinement, and why it is where craft lives',
      'Telling which details are actually worth the sweat',
    ],
    body: [
      {
        type: 'p',
        text: 'There is a version of me that wants to hold everything back until it is perfect. Ship nothing until the corners are rounded, the copy is final, the motion is just so. I have learned not to trust that version. The things I am proudest of did not quietly become good in private and then appear, finished. They went out rough, in front of people, and got good in the open afterwards.',
      },
      {
        type: 'p',
        text: 'The instinct to polish first feels like care. Mostly it is fear wearing care’s clothes. A thing you never ship cannot be judged — and a thing you never ship also cannot teach you anything, because the only honest feedback is what happens when a real person meets it while trying to do a real task. Everything before that moment is a guess about a guess.',
      },
      {
        type: 'quote',
        text: 'Rough and real beats polished and late, because only the real version can tell you what is worth polishing.',
      },
      { type: 'h', text: 'Rough, but real' },
      {
        type: 'p',
        text: 'Rough does not mean broken. It means plain. I try to ship the smallest version that genuinely works end to end — the whole path a person actually walks, with nothing on it faked — even when it is unstyled and a little embarrassing. I sketch fast, and in code rather than on paper, because the things I most need to judge early are feel and timing, and those simply do not exist on a static mock. A picture of a screen tells you the layout. It tells you nothing about how a transition lands on a tired phone at the end of a long day.',
      },
      {
        type: 'p',
        text: 'The catch is that rough has a floor. A thing can look unfinished; it cannot be a lie. The one path has to really run, the empty states have to really say something, the thing has to survive being used in earnest and not just demoed down a happy track. Below that floor it is not a rough version of the product — it is a different, prettier product that happens to share its screenshots.',
      },
      { type: 'h', text: 'Refinement is the slow part, and it is the craft' },
      {
        type: 'p',
        text: 'Then comes the part nobody watches: the slow return, again and again, to something that already works, making it a little better each pass. The timing of a transition. The weight of a heading against the line beneath it. The few pixels of space that stop two things from feeling cramped. None of these is a feature. Added up, they are the whole difference between an interface that feels considered and one that merely functions.',
      },
      {
        type: 'p',
        text: 'This is unglamorous, and it is most of the job. Getting something to work is a weekend; getting it to feel right is the long tail of small decisions after that, and the long tail is the reason a thing reads as though someone cared. Refinement is also where a product stops being a demo and becomes something I would put my name on. A demo proves an idea is possible. The polish proves I meant it.',
      },
      { type: 'h', text: 'Which details are worth the sweat' },
      {
        type: 'p',
        text: 'Not every detail deserves the same attention, and pretending otherwise is just a slower way to ship nothing. Infinite polish is its own kind of avoidance — the busywork that feels like progress while the thing quietly fails to ship. So I try to spend the care where a person’s attention actually lands: the first screen, the control they touch most often, and the moment something goes wrong, which is exactly when a little grace matters most and is most often skipped.',
      },
      {
        type: 'p',
        text: 'The test I use is simple. Would a real person notice its absence? Nobody can name the weight of a heading, but a page with the wrong one feels cheap in a way they feel and cannot explain. Nobody praises a good loading state, but its absence reads as broken. Those are worth the hours. Meanwhile there are corners no one will ever reach, and those get to stay rough a while longer — honestly rough, on a list — rather than stealing the time the front door needs.',
      },
      { type: 'h', text: 'This site is the argument' },
      {
        type: 'p',
        text: `You are reading the method, not just a description of it. This portfolio shipped rough: public from the first commit, visibly unfinished on purpose, and refined in the open ever since — a little most days. The ${COMPONENT_COUNT} hand-built pieces here did not arrive polished. Most went up plain and got better in later commits you can read, in order, against the history. The refinement is not hidden behind the result; it is the result, laid out a step at a time.`,
      },
      {
        type: 'p',
        text: 'Ship, then refine. Not because the rough version is good enough — it usually is not — but because the shipping is the thing that makes the refining possible, and honest. You cannot sweat the details of something that does not exist yet. So build the real, plain version, put it where it can be used, and then do the slow, quiet work in full view. That order is the whole discipline.',
      },
    ],
  },
  {
    slug: 'motion-that-earns-its-place',
    title: 'Motion that earns its place',
    summary:
      'When an animation helps someone understand where they are, and when it is just noise. How I decide, and why every motion here respects reduced-motion.',
    tag: 'Craft',
    status: 'published',
    date: '2026-11-20',
    plan: [
      'The one question I ask before adding any animation',
      'Where motion genuinely helps: orientation, continuity, feedback',
      'Treating reduced-motion as a first-class path, not a fallback',
    ],
    body: [
      {
        type: 'p',
        text: 'This site has a lot of things that move. That is on purpose, and it is also the easiest thing in the world to get wrong. Motion is cheap to add and expensive to take back: a transition you ship is a transition someone has to sit through on every visit, whether or not it told them anything. So the hard part was never making things move. It was deciding what deserved to.',
      },
      {
        type: 'p',
        text: 'I have one question I ask before any animation stays. Not "does this look nice" — almost anything looks nice for the first three seconds. The question is narrower, and it is the whole discipline.',
      },
      {
        type: 'quote',
        text: 'Does this motion help someone understand where they are, or is it just me showing that I can animate?',
      },
      {
        type: 'p',
        text: 'If the honest answer is the second one, it comes out, however much work it was. That rule has killed plenty of effects I was proud of. It is the only reason a site with this much movement does not feel like a screensaver.',
      },
      { type: 'h', text: 'Where motion actually earns its keep' },
      {
        type: 'p',
        text: 'There are a few places where an animation is not decoration — it is information, and the page is genuinely worse without it. The first is orientation. When you open a panel, a menu, or a detail view, a short transition tells you where it came from and where it will go back to. Cut that to an instant swap and the new thing just appears, and for a beat you have to work out what happened. The motion is doing a job: it keeps you from getting lost.',
      },
      {
        type: 'p',
        text: 'The second is continuity. When one element becomes another — a card that grows into the page it links to, a filter pill that slides to the option you picked — tweening between the two states says "this is the same thing, in a new place" far more clearly than a cut ever could. Your eye follows the object instead of re-finding it. That is why so many of the transitions here are shared-element moves rather than fades: the fade is prettier, but the move is more honest about what is going on.',
      },
      {
        type: 'p',
        text: 'The third is feedback. A button that gives slightly under a press, a control that springs to the value you set, a thing that confirms it heard you — that is motion standing in for the physical response a screen cannot give you. It is the difference between an interface that feels alive and one that feels like it might be broken.',
      },
      {
        type: 'p',
        text: 'Orientation, continuity, feedback. If a piece of motion is not doing one of those three, it is probably noise, and I treat it as noise until it proves otherwise.',
      },
      { type: 'h', text: 'Reduced motion is a path, not an apology' },
      {
        type: 'p',
        text: 'Some people turn animation off at the operating-system level — because it makes them ill, because it distracts them, or simply because they prefer it. The browser hands that preference to the site as prefers-reduced-motion, and the lazy way to honour it is to bolt on a last-minute check that strips the movement and leaves a worse, half-considered version behind. I did not want a worse version for those readers. I wanted a different, equally finished one.',
      },
      {
        type: 'p',
        text: `So reduced motion is designed, not patched. Every animated component on this site reads that preference and has a deliberate still state: the thing that would have travelled is simply present, in its final place, composed rather than frozen. A list that would stagger in is just there. A trail that would chase the cursor lays down one calm arrangement instead of a dead panel. There are ${COMPONENT_COUNT} hand-built pieces in here, and the rule held for all of them, because it was part of building each one rather than a sweep at the end.`,
      },
      {
        type: 'p',
        text: 'You can check this the same way you can check everything else here: turn the preference on in your own settings and move around. Nothing should break, nothing should look unfinished. If it does, that is a bug, and I would rather hear about it than have you assume the stillness was the best I had.',
      },
      { type: 'h', text: 'The point' },
      {
        type: 'p',
        text: 'Good motion is invisible. You do not notice it working; you only notice its absence, in the small disorientation of a screen that jumps instead of moves. The goal was never to make a site that shows off how much it can animate. It was to make one where every bit of movement is pulling its weight — and where the version with no movement at all is just as considered as the one with all of it.',
      },
    ],
  },
  {
    slug: 'building-a-portfolio-in-the-open',
    title: 'Building this site in the open',
    summary:
      'This portfolio is public and grows a little each day. What it is like to build something continuously, in full view, and what that changes about how you work.',
    tag: 'Building in the open',
    status: 'published',
    date: '2026-11-19',
    plan: [
      'What changes when the commit history is part of the work',
      'Moving in small, daily, coherent steps instead of big drops',
      'The discipline of never pushing something broken to main',
    ],
    body: [
      {
        type: 'p',
        text: 'Most portfolios arrive finished. You see the polished result and none of the deciding, the discarding, the Tuesday where nothing worked. I wanted this one to be the opposite: public from the first commit, and visibly unfinished on purpose. The repository is open, the history is readable, and the site grows a little most days rather than landing fully formed. If you want to know how I work, you can read it line by line instead of taking my word for it.',
      },
      {
        type: 'p',
        text: 'That decision sounds small. It is not. Building in the open changes what the work is.',
      },
      { type: 'h', text: 'The commit history becomes part of the work' },
      {
        type: 'p',
        text: 'When the history is private, a commit is a save point — a note to yourself, written in the shorthand of someone who already knows what they meant. When the history is public, each commit is a sentence a stranger might read. So I write them as sentences. A message says what changed and, more importantly, why, in plain words, because the why is the part that is gone by next week if it is not written down.',
      },
      {
        type: 'p',
        text: 'This is slower, and I think it is worth it. The site is a claim about caring over the small moments. A commit log full of "wip" and "fix" would quietly contradict that claim. The log is not a byproduct of the work here; it is one of the surfaces, held to the same standard as the pages.',
      },
      { type: 'quote', text: 'If the site claims I sweat the details, the commit log cannot be the one place I stop.' },
      { type: 'h', text: 'Small steps, most days, instead of big drops' },
      {
        type: 'p',
        text: `The whole thing is built one coherent, self-contained improvement at a time. Not a weekend of frantic work and then a month of silence — a little, most days. A single new component. One page made better. A real polish pass on something that was almost right. The ${COMPONENT_COUNT} hand-built pieces in here did not arrive in a batch; they accumulated, the way anything real does.`,
      },
      {
        type: 'p',
        text: 'The constraint is the gift. Forcing every change to be small and complete means I cannot hide a half-finished idea inside a giant diff and promise to come back to it. Each step has to stand on its own: typed, building, and genuinely better than the state before it. It is a harder way to work than it looks, and it keeps me honest about what "done" means.',
      },
      {
        type: 'p',
        text: 'It also compounds. A page I would never have sat down to build in one sitting gets there anyway, a commit at a time. Momentum turns out to be cheaper to keep than to restart.',
      },
      { type: 'h', text: 'The main branch is never broken' },
      {
        type: 'p',
        text: 'There is one rule I do not bend: nothing lands on the main branch unless it type-checks and builds. The site is public and live, so a broken push is not a private embarrassment — it is the thing everyone sees. Strict TypeScript and a clean production build are the gate, every time, before anything ships.',
      },
      {
        type: 'p',
        text: 'That discipline is freeing rather than restricting. Because the trunk is always green, I can move quickly on top of it without fear. There is no dreaded integration day, no slow drift into a state nobody understands. The site you are reading is, at every moment, a version that actually works. The confidence to keep changing it comes directly from refusing to ever leave it broken.',
      },
      { type: 'h', text: 'Why bother' },
      {
        type: 'p',
        text: 'Working this way is an argument about craft. Finished things hide their making, and the making is where the real decisions live. By keeping this site unfinished in public — green, honest, and moving — the process becomes as legible as the result. You are not looking at a snapshot of what I can do. You are watching it happen, and you can check the receipts.',
      },
      {
        type: 'p',
        text: 'This note is itself part of that. It is the first finished piece of writing on the site, shipped the same way as everything else: small, in the open, on a branch that still builds. There will be more. You can watch them arrive.',
      },
    ],
  },
  {
    slug: 'a-tutor-that-asks-not-answers',
    title: 'A tutor that asks, not answers',
    summary:
      'The design idea behind Guided: why handing a student the answer short-circuits learning, and what it takes to build a tool that asks the right question instead.',
    tag: 'AI',
    status: 'planned',
    plan: [
      'Why the answer is often the least useful thing to hand a student',
      'Designing prompts that nudge toward understanding, not solve',
      'Staying curriculum-aware without becoming rigid',
    ],
  },
  {
    slug: 'one-backend-two-apps',
    title: 'One backend, two apps',
    summary:
      'Keeping a React web app and a native SwiftUI app honest with each other on a single shared backend, without the two ever quietly drifting apart.',
    tag: 'iOS',
    status: 'published',
    date: '2026-11-27',
    plan: [
      'Keeping a React web app and a SwiftUI app in step',
      'Where a shared Supabase schema helps, and where it leaks',
      'Catching drift between the two before anyone feels it',
    ],
    body: [
      {
        type: 'p',
        text: 'Guided runs on two front doors and one house. There is a React web app you open in a browser, and a native SwiftUI app you install on a phone, and underneath both of them is a single Supabase backend they share. From the outside that is invisible, which is exactly the point. A student on the web and a student on the phone are using the same product, not two products that happen to rhyme. Keeping it that way — genuinely one thing, seen through two different panes — is most of the work nobody sees.',
      },
      {
        type: 'p',
        text: 'The tempting shortcut is to build the web app, get it right, and then treat the iOS app as a port: a second rendering of the first, kept roughly in line by hand. It works for about a month. Then the two drift, because every change you make to one is a change you have to remember to make to the other, and memory is not an architecture. The honest version is harder and quieter: decide what the two clients are allowed to disagree about, and make everything else impossible to get out of sync in the first place.',
      },
      {
        type: 'quote',
        text: 'Two clients on one backend do not stay in step because you are careful. They stay in step because you made drifting the harder thing to do.',
      },
      { type: 'h', text: 'Two front doors, one house' },
      {
        type: 'p',
        text: 'A web app and a native app are not the same material. React leans on the DOM, the browser, a URL for every state; SwiftUI leans on the device, the navigation stack, the gestures a phone already knows. Try to make them identical and you fight both frameworks at once, and lose to each. So I do not. The surface is allowed — expected — to feel native to where it runs: the iOS app should behave like an iOS app, with the sheets and the back-swipes and the keyboard a phone user reaches for without thinking, and the web app should behave like the web, linkable and resizable and open in a dozen tabs at once. Sameness is not the goal. Continuity is.',
      },
      {
        type: 'p',
        text: 'What has to match is not the pixels but the meaning. The same account, the same progress, the same rules about what the product will and will not do. A student who starts a session on the laptop at the kitchen table and finishes it on the phone on the bus should never feel a seam. That continuity is not something the two clients negotiate between themselves. It comes from below, from the one place they both trust, and the design job is to push every fact that must agree down into that shared floor and keep it from creeping back up into either client, where a private copy of it could quietly rot.',
      },
      { type: 'h', text: 'Where a shared schema helps, and where it leaks' },
      {
        type: 'p',
        text: 'A shared backend earns its keep by being the single source of truth. The data model, the sign-in, the rules about who is allowed to see what — define them once, in Supabase, and both the web app and the iOS app read the same shape through the same door. When I add a field or tighten a permission, I am not making the change in two places and hoping they stay in agreement; I am making it in the one place both clients are already looking at. That is the part of one backend that genuinely holds the thing together, and it is worth a great deal.',
      },
      {
        type: 'p',
        text: 'But a shared schema is not a shared app, and pretending it is, is where the leaks begin. A database tells you the shape of the data; it does not tell you how a sheet should animate, when iOS should ask for a review, how the web should handle a deep link, or what the empty state says before a student has done anything at all. Those are client decisions, and they have to live in the client — not smuggled into the backend because it happened to be the one place both could reach. The seam I guard most carefully sits right here: the backend owns what is true, each client owns how it feels, and the moment feel starts leaking into the schema, or truth starts being re-decided inside a client, the two apps have begun to drift even though nothing visible has broken yet.',
      },
      { type: 'h', text: 'Catching drift before anyone feels it' },
      {
        type: 'p',
        text: 'Drift is quiet. Nothing crashes. One client simply starts to believe something slightly different from the other — an old assumption about a field, a rule enforced on the web but forgotten on the phone — and it stays invisible right up until a real person falls into the gap between them. By then it is a bug that is miserable to chase, because the fault is not really in either app; it is in the space between them that no single screen owns.',
      },
      {
        type: 'p',
        text: 'So I try to keep that space narrow and legible. Shared truth has exactly one home, and anything derived from it is derived on the spot, not stored a second time where the two copies can disagree — the same discipline I hold the small pieces of this very site to, where a readout is computed from its state rather than kept beside it, so the figure and the thing it describes can never tell two different stories. Types do a lot of the watching: the shape each client expects is written down, not assumed, so a change to the backend has somewhere concrete to break loudly instead of leaking in silence. And the rule that has saved me the most grief is the plainest one — when a fact matters, let the backend decide it and let both clients ask, rather than each remembering an answer that was only true last week.',
      },
      { type: 'h', text: 'Why it is worth the trouble' },
      {
        type: 'p',
        text: 'Building across web and native on one backend is more work than building either alone, and far more than building two apps that merely resemble each other. You carry two sets of framework instincts in your head at once, and you spend real effort on a seam that, done right, no one will ever notice. But that invisibility is the whole return. The product gets to be one thing with reach — able to meet a student wherever they are, on whatever is in their hand — instead of fracturing into two codebases that slowly tell different stories about the same account.',
      },
      {
        type: 'p',
        text: 'That is the range I care about most: not a list of technologies on a page, but the discipline of holding the web, the native app, and the data underneath in one head so the seams between them stay invisible. One backend, two apps, and a person who never has to know there were two.',
      },
    ],
  },
]

export const PUBLISHED_COUNT = NOTES.filter((n) => n.status === 'published').length
export const NOTE_COUNT = NOTES.length

/**
 * An honest reading-time estimate for a published piece, in whole minutes
 * (never below one). Counted from the real words in the body at ~200 wpm, so it
 * tracks the actual prose and cannot drift into a made-up figure. A note with
 * no body returns 0 — there is nothing to read yet.
 */
export function readingMinutes(note: Note): number {
  if (!note.body || note.body.length === 0) return 0
  const words = note.body.reduce(
    (sum, block) => sum + block.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  )
  return Math.max(1, Math.round(words / 200))
}

/**
 * The published pieces, newest first. Dates are ISO (`YYYY-MM-DD`), so a plain
 * string compare sorts them correctly without parsing — the newest piece lands
 * at the head, which is exactly the one the Writing landing features.
 */
export const PUBLISHED_NOTES: Note[] = NOTES.filter((n) => n.status === 'published')
  .slice()
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

/** The most recent published piece, if any — the featured essay on /writing. */
export const LATEST_PUBLISHED: Note | undefined = PUBLISHED_NOTES[0]

/**
 * The honest total reading time across every published piece, in whole minutes.
 * Summed from the real per-piece estimates (which count actual words), so it can
 * never drift into a made-up figure — it always reflects the prose that is up.
 */
export const TOTAL_READING_MINUTES: number = PUBLISHED_NOTES.reduce(
  (sum, n) => sum + readingMinutes(n),
  0,
)

/** How many distinct topics the published writing actually spans so far. */
export const TOPICS_COVERED: number = new Set(PUBLISHED_NOTES.map((n) => n.tag)).size

/** Find a note by slug, for the deep-linkable detail page. */
export function getNote(slug: string | undefined): Note | undefined {
  if (!slug) return undefined
  return NOTES.find((n) => n.slug === slug)
}

/**
 * The next note in reading order, wrapping around the list. Used for
 * "keep reading" navigation on a note's detail page.
 */
export function nextNote(slug: string): Note | undefined {
  const i = NOTES.findIndex((n) => n.slug === slug)
  if (i === -1) return undefined
  const next = NOTES[(i + 1) % NOTES.length]
  return next.slug === slug ? undefined : next
}

/** Other planned notes sharing a tag, excluding the given slug. */
export function relatedNotes(note: Note): Note[] {
  return NOTES.filter((n) => n.tag === note.tag && n.slug !== note.slug)
}
