// The questions people actually ask Arseniy — answered plainly, in his own
// voice. Honest only: co-founder of Guided, based in Berlin, still a student,
// builds across the whole stack. No invented clients, metrics, or availability
// promises. The answers carry ReactNode links, so the copy lives in the page
// (Answers.tsx) rather than here; this file is the question set and its shape.

export interface Answer {
  /** The question, as someone would actually ask it. */
  q: string
  /** Stable id for deep-links and the running count. */
  id: string
}

// Ordered from "who are you" outward to "how do we work together". The page
// renders each answer body itself so it can link into /work, /now, /colophon,
// and the contact dialog without pulling JSX into a data module.
export const ANSWERS: Answer[] = [
  { id: 'who', q: 'Who are you, in one line?' },
  { id: 'what', q: 'What do you actually do?' },
  { id: 'guided', q: 'Guided keeps coming up — what is it?' },
  { id: 'student', q: 'You are a student and a founder at once?' },
  { id: 'motion', q: 'Why so much motion on a portfolio?' },
  { id: 'template', q: 'Did you use a template or a UI kit?' },
  { id: 'stack', q: 'Frontend, backend, native — really all of it?' },
  { id: 'berlin', q: 'Where are you based, and does it matter?' },
  { id: 'care', q: 'What do you care about in the work?' },
  { id: 'reach', q: 'How do we work together?' },
]

export const ANSWER_COUNT = ANSWERS.length
