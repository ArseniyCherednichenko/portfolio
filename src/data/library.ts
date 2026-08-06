// Single source of truth for the /library page — "The library": a browsable
// catalog of every hand-built component in src/components. The site's whole
// thesis is "made, not assembled"; this page makes that literal and countable.
//
// Every entry names a real file in src/components and describes it honestly in
// one line. `to`/`where` point at a real place the component is on show (a page
// or the Playground) so a card can double as a way in — only set when true.
//
// Keep this in sync as the component set grows: add the file's entry to the
// right group, and keep COMPONENT_COUNT in src/data/stats.ts equal to the total
// here (LIBRARY_COUNT). The Library header reads COMPONENT_COUNT; the two must
// agree, so a viewer counting cards never catches a gap.

export interface LibraryItem {
  /** The component's file name in src/components (without .tsx). */
  name: string
  /** One honest line about what it does. */
  note: string
  /** Search/scan tags — lowercase, a few words. */
  tags: string[]
  /** A real route where it is on show, if any. */
  to?: string
  /** Short label for that place, e.g. "About", "Playground". */
  where?: string
}

export interface LibraryGroup {
  /** Short editorial label for the group. */
  label: string
  /** One sentence framing what lives here. */
  intro: string
  items: LibraryItem[]
}

export const LIBRARY: LibraryGroup[] = [
  {
    label: 'Type & text',
    intro: 'Letters and words that respond to the cursor, the scroll, and the moment they first appear.',
    items: [
      { name: 'GradientText', note: 'An animated lime-to-white gradient washing across a headline.', tags: ['text', 'gradient', 'motion'], to: '/', where: 'Home' },
      { name: 'ShinyText', note: 'A soft highlight that sweeps across otherwise-muted text — the quiet cousin of the gradient wash, built for small labels and status lines.', tags: ['text', 'shine', 'label'], to: '/now', where: 'Now' },
      { name: 'VariableProximity', note: 'Variable-font letters that lean and swell toward the cursor.', tags: ['text', 'variable font', 'pointer'], to: '/about', where: 'About' },
      { name: 'ScrollReveal', note: 'A paragraph that assembles itself word by word as it scrolls.', tags: ['text', 'scroll', 'reveal'], to: '/about', where: 'About' },
      { name: 'ScrollVelocity', note: 'Text bands that drift and flip direction with scroll speed.', tags: ['text', 'scroll', 'marquee'], to: '/', where: 'Home' },
      { name: 'TrueFocus', note: 'A line that pulls one word at a time into sharp focus.', tags: ['text', 'focus', 'motion'], to: '/', where: 'Home' },
      { name: 'SplitText', note: 'A headline split into letters that stagger into place.', tags: ['text', 'stagger', 'reveal'], to: '/playground', where: 'Playground' },
      { name: 'BlurText', note: 'Words that resolve out of a soft focus, one at a time, as the line sharpens in.', tags: ['text', 'blur', 'reveal'], to: '/', where: 'Home' },
      { name: 'Highlighter', note: 'A marker-pen sweep that grows in behind (or under) a run of words, transform-origin left, like a highlighter dragged once across the line.', tags: ['text', 'marker', 'reveal', 'scroll'], to: '/about', where: 'About' },
      { name: 'DecryptedText', note: 'Text that resolves out of random glyphs, left to right.', tags: ['text', 'glitch', 'reveal'], to: '/playground', where: 'Playground' },
      { name: 'FuzzyText', note: 'A jittering, glitching display headline.', tags: ['text', 'glitch'], to: '/playground', where: 'Playground' },
      { name: 'LetterGlitch', note: 'A canvas grid of glyphs flickering like a decode.', tags: ['text', 'canvas', 'glitch'], to: '/playground', where: 'Playground' },
      { name: 'GlitchText', note: 'Two colour-split ghost copies snap to sliced offsets over a clean base, tearing the word into chromatic signal corruption then re-forming.', tags: ['text', 'glitch', 'chromatic'], to: '/playground', where: 'Playground' },
      { name: 'ASCIIText', note: 'A word rendered as a shimmering field of ASCII glyphs.', tags: ['text', 'ascii'], to: '/colophon', where: 'Colophon' },
      { name: 'CircularText', note: 'A rotating circular text seal with a mark in its centre.', tags: ['text', 'circular', 'motion'], to: '/playground', where: 'Playground' },
      { name: 'CurvedLoop', note: 'Text flowing endlessly along a looping curved path.', tags: ['text', 'path', 'marquee'], to: '/playground', where: 'Playground' },
      { name: 'RotatingWord', note: 'A single slot that cross-fades through alternative words.', tags: ['text', 'motion'], to: '/', where: 'Home' },
      { name: 'GooeyText', note: 'One word melts into the next through a gooey filter, glyph-halos fusing mid-swap.', tags: ['text', 'liquid', 'motion'], to: '/about', where: 'About' },
      { name: 'TextType', note: 'A typewriter that types a phrase, holds, erases it, and cycles to the next behind a blinking caret.', tags: ['text', 'typewriter', 'terminal'], to: '/terminal', where: 'Terminal' },
      { name: 'Lamp', note: 'An overhead light rig that switches on as it scrolls into view — a glowing tube stretches wide, a beam fans down, and the heading rises up into the pool of light. Additive, so it lights what is behind rather than boxing it.', tags: ['text', 'light', 'reveal', 'scroll'], to: '/work', where: 'Work' },
    ],
  },
  {
    label: 'Cards & surfaces',
    intro: 'Surfaces that tilt, glow, and catch the light as the cursor moves across them.',
    items: [
      { name: 'SpotlightCard', note: 'A card with a soft spotlight that tracks the cursor.', tags: ['card', 'pointer', 'glow'], to: '/playground', where: 'Playground' },
      { name: 'TiltCard', note: 'A surface that tilts in 3D toward the pointer.', tags: ['card', '3d', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'ProfileCard', note: 'A tilting identity card under a sweeping iridescent film.', tags: ['card', '3d', 'pointer'], to: '/about', where: 'About' },
      { name: 'ChromaGrid', note: 'A grid of cards lit by a colour that follows the pointer.', tags: ['card', 'grid', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'BentoGrid', note: 'An asymmetric bento layout of framed, responsive cells.', tags: ['card', 'grid', 'layout'], to: '/playground', where: 'Playground' },
      { name: 'GlassSurface', note: 'A frosted-glass panel with real depth and edge light.', tags: ['card', 'glass'], to: '/playground', where: 'Playground' },
      { name: 'GlareHover', note: 'A soft band of light that sweeps across any surface on hover.', tags: ['card', 'hover', 'css'], to: '/playground', where: 'Playground' },
      { name: 'BorderBeam', note: 'A comet of light tracing a rounded border.', tags: ['card', 'border', 'motion'], to: '/contact', where: 'Contact' },
      { name: 'AnimatedBeam', note: 'A beam of light travelling a curved line drawn between two real DOM nodes.', tags: ['beam', 'diagram', 'svg', 'motion'], to: '/about', where: 'About' },
      { name: 'SpotlightReveal', note: 'Content uncovered under a moving spotlight mask.', tags: ['card', 'reveal', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'CardStack', note: 'An auto-advancing 3D deck of cards you can flick through.', tags: ['card', '3d', 'drag'], to: '/playground', where: 'Playground' },
      { name: 'FlipCard', note: 'A card that flips in 3D to reveal its back.', tags: ['card', '3d', 'flip'], to: '/playground', where: 'Playground' },
      { name: 'PixelTransition', note: 'A pixel-dissolve that reveals a second image on hover.', tags: ['card', 'pixel', 'hover'], to: '/work', where: 'Work' },
      { name: 'ScratchReveal', note: 'A scratch-off surface you rub away to reveal what is under it.', tags: ['card', 'reveal', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'CompareSlider', note: 'A draggable seam that wipes between a before and an after.', tags: ['card', 'drag', 'compare'], to: '/craft', where: 'On motion' },
      { name: 'Masonry', note: 'A measured masonry wall that packs tiles of any height into the shortest column and reflows on a spring.', tags: ['card', 'layout', 'grid'], to: '/playground', where: 'Playground' },
      { name: 'Lens', note: 'A magnifying loupe that follows the pointer and reveals a zoomed circle of the surface in place — one radial mask over a copy scaled from the cursor, so what sits under the glass stays put as it grows.', tags: ['card', 'magnify', 'pointer', 'mask'], to: '/playground', where: 'Playground' },
    ],
  },
  {
    label: 'Pointer fields',
    intro: 'Full-canvas fields — dots, needles, cells, threads, blobs, ribbons — that bend and warm toward the pointer.',
    items: [
      { name: 'DotGrid', note: 'A grid of dots that spring away from the pointer and brighten.', tags: ['field', 'canvas', 'pointer'], to: '/design', where: 'Design' },
      { name: 'MagnetLines', note: 'A grid of needles that all aim at the cursor.', tags: ['field', 'canvas', 'pointer'], to: '/', where: 'Home' },
      { name: 'Squares', note: 'A lattice whose cells warm toward the pointer under a drifting scan.', tags: ['field', 'canvas', 'grid'], to: '/contents', where: 'Index' },
      { name: 'Threads', note: 'Flowing wave-lines that bulge and warm where the pointer nears.', tags: ['field', 'canvas', 'waves'], to: '/changelog', where: 'Changelog' },
      { name: 'Particles', note: 'A constellation of linked particles that webs around the cursor.', tags: ['field', 'canvas', 'particles'], to: '/contact', where: 'Contact' },
      { name: 'Starfield', note: 'A warp field of streaking stars steered by the pointer.', tags: ['field', 'canvas', 'stars'], to: '/resume', where: 'Résumé' },
      { name: 'Aurora', note: 'A slow aurora of coloured light drifting behind the page.', tags: ['field', 'ambient', 'sitewide'], to: '/', where: 'Home' },
      { name: 'Lightning', note: 'Jagged electric filaments wriggling between drifting anchors.', tags: ['field', 'canvas', 'electric'], to: '/colophon', where: 'Colophon' },
      { name: 'Orb', note: 'A glowing orb that leans and lights toward the cursor.', tags: ['field', 'orb', 'pointer'], to: '/contact', where: 'Contact' },
      { name: 'MetaBalls', note: 'Liquid metaballs that merge and split as they drift.', tags: ['field', 'canvas', 'liquid'], to: '/playground', where: 'Playground' },
      { name: 'Beams', note: 'Sweeping volumetric beams of light.', tags: ['field', 'light'], to: '/playground', where: 'Playground' },
      { name: 'Meteors', note: 'A steady diagonal rain of light streaks, each fading from a bright head to nothing, warming toward lime near the pointer.', tags: ['field', 'canvas', 'light'], to: '/reel', where: 'The reel' },
      { name: 'Iridescence', note: 'A shifting, oil-slick iridescent sheen.', tags: ['field', 'shader', 'colour'], to: '/playground', where: 'Playground' },
      { name: 'Ribbons', note: 'Flowing ribbons that trail after the cursor.', tags: ['field', 'ribbon', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'PixelTrail', note: 'A trail of pixels that light up under the moving pointer.', tags: ['field', 'pixel', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'FlowField', note: 'Motes streaming through an evolving vector field, curling into a lime eddy around the cursor.', tags: ['field', 'canvas', 'flow', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'Gravity', note: 'Objects that fall, collide, and pile with real physics.', tags: ['field', 'physics', 'drag'], to: '/playground', where: 'Playground' },
      { name: 'GridMotion', note: 'Stacked rows of tiles that drift in alternating directions while the slab tilts in 3D toward the cursor.', tags: ['field', 'grid', 'pointer', 'parallax'], to: '/playground', where: 'Playground' },
      { name: 'Murmuration', note: 'An emergent boids flock that wheels and folds by the three Reynolds rules — lead it by hovering, scatter it by pressing.', tags: ['field', 'canvas', 'flock', 'emergent', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'MeshGradient', note: 'A wash of blurred colour blobs that idle-drift and lean toward the cursor, pooling where it goes.', tags: ['field', 'gradient', 'pointer', 'ambient'], to: '/about', where: 'About' },
      { name: 'Crosshair', note: 'A precision reticle — two spring-eased hairlines that span a surface, track the pointer, and read out its X/Y over a calibrated tick scale.', tags: ['field', 'reticle', 'pointer', 'measure'], to: '/colophon', where: 'Colophon' },
      { name: 'BlobCursor', note: 'A gooey blob that chases the pointer — a chain of circles welded under an SVG goo filter into one liquid mass with a stretching tail, swelling when you press.', tags: ['field', 'cursor', 'goo', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'Kaleidoscope', note: 'Folds the path the pointer traces into six-fold rotational and mirror symmetry, accumulating the strokes into a slowly-fading, self-composing mandala.', tags: ['field', 'canvas', 'pointer', 'symmetry', 'generative'], to: '/playground', where: 'Playground' },
      { name: 'Contour', note: 'A living topographic map — a smooth field of drifting hills resampled each frame and traced into iso-lines with marching squares, the rings warming to lime at the peaks and rising into a bright bullseye wherever the pointer rests.', tags: ['field', 'canvas', 'pointer', 'generative', 'marching-squares'], to: '/playground', where: 'Playground' },
    ],
  },
  {
    label: 'Scroll & reveal',
    intro: 'Motion wired to the scroll position — drawing, counting, stacking, and travelling as you move down the page.',
    items: [
      { name: 'Reveal', note: 'The base scroll-into-view fade-and-lift the whole site leans on.', tags: ['scroll', 'reveal', 'sitewide'], to: '/', where: 'Home' },
      { name: 'AnimatedCounter', note: 'A number that counts up the moment it scrolls into view.', tags: ['scroll', 'counter', 'numbers'], to: '/about', where: 'About' },
      { name: 'Odometer', note: 'A trip-meter counter whose digit reels roll up from zero into place.', tags: ['scroll', 'counter', 'numbers', 'mechanical'], to: '/', where: 'Home' },
      { name: 'HorizontalScroll', note: 'A pinned section where vertical scroll becomes sideways travel.', tags: ['scroll', 'pin', 'horizontal'], to: '/', where: 'Home' },
      { name: 'ScrollScene', note: 'A pinned scrollytelling stage that assembles in steps.', tags: ['scroll', 'pin', 'scrollytelling'], to: '/colophon', where: 'Colophon' },
      { name: 'ScrollStack', note: 'Cards that pin and stack into a deck as you scroll.', tags: ['scroll', 'pin', 'stack'], to: '/playground', where: 'Playground' },
      { name: 'ScrollProgress', note: 'A springed lime reading bar pinned to the top edge.', tags: ['scroll', 'progress', 'sitewide'] },
      { name: 'ScrollCue', note: 'A bobbing hint that there is more below the fold.', tags: ['scroll', 'hint'] },
      { name: 'DrawSVG', note: 'Line art that draws itself, one stroke at a time, by tracing the real path length.', tags: ['scroll', 'reveal', 'svg', 'draw'], to: '/about', where: 'About' },
      { name: 'Timeline', note: 'A vertical timeline with lit nodes marking a path.', tags: ['scroll', 'timeline'], to: '/about', where: 'About' },
      { name: 'Stepper', note: 'A numbered pipeline that lights up stage by stage.', tags: ['scroll', 'steps', 'process'], to: '/colophon', where: 'Colophon' },
      { name: 'CircularGallery', note: 'A carousel of images bent around a curved arc.', tags: ['scroll', 'gallery', 'carousel'], to: '/playground', where: 'Playground' },
      { name: 'Marquee', note: 'An infinite, seamless scrolling ticker row.', tags: ['scroll', 'marquee'], to: '/', where: 'Home' },
      { name: 'BackToTop', note: 'A floating control that springs in and glides home.', tags: ['scroll', 'control', 'sitewide'] },
    ],
  },
  {
    label: 'Navigation & controls',
    intro: 'Buttons, menus, and switches built for feel — magnetic pulls, gooey tabs, a magnifying dock, keyboard chords.',
    items: [
      { name: 'MagneticButton', note: 'A button that pulls magnetically toward the cursor.', tags: ['control', 'button', 'pointer'], to: '/', where: 'Home' },
      { name: 'Dock', note: 'A magnifying, macOS-style dock that swells under the pointer.', tags: ['control', 'nav', 'pointer'], to: '/playground', where: 'Playground' },
      { name: 'GooeyTabs', note: 'A liquid tab switcher whose blobs merge as the selection moves.', tags: ['control', 'tabs', 'liquid'], to: '/changelog', where: 'Changelog' },
      { name: 'ElasticSlider', note: 'A range control that stretches elastically past its ends.', tags: ['control', 'slider', 'input'], to: '/playground', where: 'Playground' },
      { name: 'Knob', note: 'A rotary dial you turn like hardware — drag, wheel, or arrow keys.', tags: ['control', 'knob', 'input'], to: '/design', where: 'Design' },
      { name: 'Switch', note: 'A binary toggle whose thumb rides a spring across the track — squashing into the travel while the rail crossfades to lime and a dash morphs into a check.', tags: ['control', 'toggle', 'switch', 'input'], to: '/playground', where: 'Playground' },
      { name: 'CodeInput', note: 'A segmented one-time-code field: focus hands itself forward as you type and back as you delete, a paste scatters across the empty cells, each digit springs in, and a full code lifts the row in a lime-lit stagger.', tags: ['control', 'input', 'otp', 'keyboard'], to: '/playground', where: 'Playground' },
      { name: 'DynamicIsland', note: "A status pill that changes its own shape to fit what it carries — springing between a resting notch, a now-playing bar, a countdown ring, and an incoming call, the contents crossfading in as it re-shapes.", tags: ['control', 'status', 'morph', 'motion'], to: '/playground', where: 'Playground' },
      { name: 'FlowingMenu', note: 'Editorial link rows with a lime panel that slides in on hover.', tags: ['control', 'menu', 'hover'], to: '/', where: 'Home' },
      { name: 'Accordion', note: 'An animated disclosure list, one row open at a time.', tags: ['control', 'accordion', 'a11y'], to: '/about', where: 'About' },
      { name: 'SphereMenu', note: 'A menu of items wrapped around a rotating sphere.', tags: ['control', 'menu', '3d'], to: '/playground', where: 'Playground' },
      { name: 'HoverIndex', note: 'An editorial list whose rows float a generative preview that trails the cursor.', tags: ['control', 'menu', 'hover'], to: '/work', where: 'Work' },
      { name: 'AnimatedList', note: 'A scroll-revealed list whose lime highlight springs between real, focusable rows as you hover or arrow through.', tags: ['control', 'list', 'keyboard'], to: '/', where: 'Home' },
      { name: 'Sortable', note: 'A drag-to-reorder list laid out absolutely by index, so the whole reorder is one number — the dragged row tracks the pointer while the rest spring to their new slots and the order re-solves live underneath. Reorders by arrow key too, with a polite live region reading the new position.', tags: ['control', 'list', 'drag', 'reorder', 'keyboard'], to: '/playground', where: 'Playground' },
      { name: 'InfiniteScroll', note: 'A vertical column of cards that loops forever and never seams — it drifts on its own, and grabbing it scrubs with release momentum.', tags: ['control', 'list', 'drag', 'loop'], to: '/playground', where: 'Playground' },
      { name: 'Carousel', note: 'A stories-style panel sequence with segmented progress bars filling across the top — the bar is the clock. Hold to pause, click an edge to step, swipe, tap a bar to jump, or drive it from the keyboard.', tags: ['control', 'carousel', 'stories', 'auto', 'keyboard'], to: '/about', where: 'About' },
      { name: 'PillNav', note: 'A scroll-spy pill rail that jumps between sections.', tags: ['control', 'nav', 'scroll-spy'], to: '/playground', where: 'Playground' },
      { name: 'SectionNav', note: 'A right-rail scroll-spy for long pages.', tags: ['control', 'nav', 'scroll-spy'], to: '/', where: 'Home' },
      { name: 'Nav', note: 'The persistent top navigation bar and its active states.', tags: ['control', 'nav', 'sitewide'] },
      { name: 'MobileMenu', note: 'The full-screen mobile navigation overlay.', tags: ['control', 'nav', 'mobile'] },
      { name: 'Keyboard', note: 'The site-wide go-chords and the shortcut help dialog.', tags: ['control', 'keyboard', 'a11y'] },
    ],
  },
  {
    label: 'Overlays',
    intro: 'The modals and loaders — everything that comes forward over the page and then gets out of the way.',
    items: [
      { name: 'Modal', note: 'The shared accessible dialog primitive the others build on.', tags: ['overlay', 'dialog', 'a11y'] },
      { name: 'CommandPalette', note: 'The Cmd/Ctrl+K fuzzy palette that jumps anywhere.', tags: ['overlay', 'palette', 'search'] },
      { name: 'PlaygroundFinder', note: 'A scoped palette for the Playground — search, jump, surprise, and deep-link any of its experiments. Press /.', tags: ['overlay', 'palette', 'search', 'finder'], to: '/playground', where: 'Playground' },
      { name: 'ContactDialog', note: 'The site-wide get-in-touch modal.', tags: ['overlay', 'dialog', 'contact'] },
      { name: 'Tooltip', note: 'A portal-based hint that rises on hover and focus and flips to stay on-screen.', tags: ['overlay', 'tooltip', 'a11y'], to: '/playground', where: 'Playground' },
      { name: 'Toast', note: 'A site-wide notification queue whose lime meter both counts down and, on its end, dismisses the toast.', tags: ['overlay', 'toast', 'a11y'], to: '/playground', where: 'Playground' },
      { name: 'ProjectQuickLook', note: 'An in-page project preview modal beside the case study.', tags: ['overlay', 'modal', 'work'], to: '/work', where: 'Work' },
      { name: 'Lightbox', note: 'A focused fullscreen viewer for a single piece of media.', tags: ['overlay', 'lightbox', 'media'] },
      { name: 'Preloader', note: 'The once-per-session intro curtain that wipes away to reveal the site.', tags: ['overlay', 'intro', 'sitewide'] },
      { name: 'RouteFallback', note: 'The calm loader shown while a page chunk streams in.', tags: ['overlay', 'loader'] },
    ],
  },
  {
    label: 'Objects & toys',
    intro: 'Hand-built objects with a bit of life in them — things to grab, wind, and watch settle.',
    items: [
      { name: 'Globe', note: 'A draggable dotted globe with pins on real coordinates.', tags: ['object', 'globe', 'drag'], to: '/about', where: 'About' },
      { name: 'Clock', note: 'A hand-drawn analog dial reading a real timezone.', tags: ['object', 'clock', 'time'], to: '/contact', where: 'Contact' },
      { name: 'SplitFlap', note: 'A split-flap departure board that clatters to new text.', tags: ['object', 'flip', 'board'], to: '/playground', where: 'Playground' },
      { name: 'Lanyard', note: 'A name badge on a cord you can grab, throw, and watch swing.', tags: ['object', 'physics', 'drag'], to: '/playground', where: 'Playground' },
      { name: 'Turntable', note: 'A record deck you can play or spin by hand — it coasts on real momentum.', tags: ['object', 'physics', 'drag', 'spin'], to: '/playground', where: 'Playground' },
      { name: 'Harmonograph', note: 'A pendulum plotter that traces real decaying-sinusoid figures; crossings glow, and every seed redraws the same plate.', tags: ['object', 'canvas', 'generative', 'physics'], to: '/playground', where: 'Playground' },
      { name: 'Ballpit', note: 'A canvas bin of lit spheres with real circle-circle physics — grab one and toss it, they pile and bounce.', tags: ['object', 'canvas', 'physics', 'drag'], to: '/playground', where: 'Playground' },
      { name: 'Folder', note: 'A folder that opens and fans out the papers inside it.', tags: ['object', 'folder', 'hover'], to: '/playground', where: 'Playground' },
      { name: 'Terminal', note: 'An interactive shell that drives the whole site by typing.', tags: ['object', 'terminal', 'interactive'], to: '/terminal', where: 'Terminal' },
      { name: 'HeroOrbit', note: 'The orbiting mark that circles behind the hero.', tags: ['object', 'orbit', 'motion'], to: '/', where: 'Home' },
    ],
  },
  {
    label: 'Foundations',
    intro: 'The quiet plumbing — hand-built too, and holding the whole thing up.',
    items: [
      { name: 'Layout', note: 'The persistent shell: aurora, nav, footer, page transitions, providers.', tags: ['foundation', 'shell', 'sitewide'] },
      { name: 'Seo', note: 'Per-page document title and meta tags.', tags: ['foundation', 'seo', 'meta'] },
      { name: 'Eyebrow', note: 'The small uppercase label that opens a section.', tags: ['foundation', 'label', 'sitewide'] },
      { name: 'SiteFooter', note: 'The structured closing footer — CTA, site map, live clock.', tags: ['foundation', 'footer', 'sitewide'] },
      { name: 'Cursor', note: 'The custom lime cursor and its hover and press states.', tags: ['foundation', 'cursor', 'pointer'] },
      { name: 'ClickSpark', note: 'A burst of lime sparks on every click, anywhere.', tags: ['foundation', 'feedback', 'canvas'] },
      { name: 'Grain', note: 'The fine film-grain texture laid over the whole site.', tags: ['foundation', 'texture', 'sitewide', 'canvas'], to: '/playground#fields', where: 'Playground' },
      { name: 'ChannelList', note: 'The shared, honest list of ways to reach me.', tags: ['foundation', 'contact'], to: '/contact', where: 'Contact' },
      { name: 'ContactForm', note: 'A no-backend form that drafts a mailto for you to send.', tags: ['foundation', 'contact', 'form'], to: '/contact', where: 'Contact' },
      { name: 'ProjectPoster', note: 'A generative, seeded poster rendered per project.', tags: ['foundation', 'generative', 'work'], to: '/work', where: 'Work' },
    ],
  },
]

/** Every item, flattened — for search and counts. */
export const ALL_LIBRARY_ITEMS: LibraryItem[] = LIBRARY.flatMap((g) => g.items)

/** Total hand-built components catalogued here. Kept equal to COMPONENT_COUNT. */
export const LIBRARY_COUNT = ALL_LIBRARY_ITEMS.length
