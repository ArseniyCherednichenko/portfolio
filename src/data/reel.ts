// Single source for the /reel page — "The reel": an art-directed, full-screen
// sequence of the site's signature visual set-pieces, each paired with one line
// of how Arseniy thinks about making things. Unlike the Playground (a lab you
// poke at, with controls and code), the reel is a designed run of scenes — a
// showreel and a small manifesto. It de-centres any single project by putting
// the point of view about craft, not the client work, on screen.
//
// `backdrop` names a real, hand-built component the Reel page mounts full-bleed
// for that scene (mounted lazily, one at a time). Keep this list honest — every
// backdrop is a component that already lives in src/components.

export type ReelBackdrop =
  | 'aurora'
  | 'mesh'
  | 'beams'
  | 'threads'
  | 'lightning'
  | 'iridescence'
  | 'particles'
  | 'orb'
  | 'squares'
  | 'meteors'

export interface ReelScene {
  /** Stable id, used for the anchor and the progress rail. */
  id: string
  /** Which hand-built backdrop fills the scene. */
  backdrop: ReelBackdrop
  /** Small overline label. */
  eyebrow: string
  /** The line that carries the scene — a single sentence of craft POV. */
  statement: string
  /** A quieter second line, grounding the statement in practice. */
  note: string
  /** Short caption naming the component on show, so the reel stays honest. */
  made: string
}

export const REEL: ReelScene[] = [
  {
    id: 'open',
    backdrop: 'aurora',
    eyebrow: 'The reel',
    statement: 'Every frame here is hand-built.',
    note: 'No template, no drag-and-drop. Ten scenes, each one a component I wrote from scratch, running live.',
    made: 'Backdrop: Aurora',
  },
  {
    id: 'motion',
    backdrop: 'mesh',
    eyebrow: 'On motion',
    statement: 'Motion is a way of explaining, not decorating.',
    note: 'A thing that moves should be telling you where it came from and where it can go. If it is only pretty, it is noise.',
    made: 'Backdrop: MeshGradient',
  },
  {
    id: 'light',
    backdrop: 'beams',
    eyebrow: 'On light',
    statement: 'Light gives a flat screen a direction.',
    note: 'A beam, a sweep, a soft edge — enough for the eye to feel depth without a single literal shadow.',
    made: 'Backdrop: Beams',
  },
  {
    id: 'line',
    backdrop: 'threads',
    eyebrow: 'On line',
    statement: 'A line is the most honest mark there is.',
    note: 'Thin, exact, responsive. When threads bend toward the cursor, the interface admits you are there.',
    made: 'Backdrop: Threads',
  },
  {
    id: 'energy',
    backdrop: 'lightning',
    eyebrow: 'On energy',
    statement: 'A little danger keeps a page awake.',
    note: 'One arc of lightning does more for a mood than a dozen tasteful gradients. Used once, never twice.',
    made: 'Backdrop: Lightning',
  },
  {
    id: 'colour',
    backdrop: 'iridescence',
    eyebrow: 'On colour',
    statement: 'Colour should shift the way a real surface does.',
    note: 'Oil on water, a beetle wing, a screen at an angle. Hue that answers to viewpoint reads as alive.',
    made: 'Backdrop: Iridescence',
  },
  {
    id: 'field',
    backdrop: 'particles',
    eyebrow: 'On systems',
    statement: 'Small rules, repeated, make a whole.',
    note: 'Each dot follows the same three lines of physics. The pattern nobody wrote is the one worth watching.',
    made: 'Backdrop: Particles',
  },
  {
    id: 'form',
    backdrop: 'orb',
    eyebrow: 'On form',
    statement: 'One object, lit well, can hold a room.',
    note: 'Before the layout, before the copy, there is a single form that has to feel like it could be touched.',
    made: 'Backdrop: Orb',
  },
  {
    id: 'pace',
    backdrop: 'meteors',
    eyebrow: 'On pace',
    statement: 'Small, steady work reads like a shower, not a flash.',
    note: 'One thing shipped most days, none of it loud on its own. Watch long enough and the cadence, not any single streak, is the thing.',
    made: 'Backdrop: Meteors',
  },
  {
    id: 'grid',
    backdrop: 'squares',
    eyebrow: 'On structure',
    statement: 'The grid is what lets the rest break the rules.',
    note: 'A quiet lattice underneath means every deliberate step out of line actually reads as one. Then it ends, and you go make something.',
    made: 'Backdrop: Squares',
  },
]
