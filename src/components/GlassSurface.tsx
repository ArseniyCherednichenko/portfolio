import { useRef, type ReactNode } from 'react'

let uid = 0

export interface GlassSurfaceProps {
  children?: ReactNode
  className?: string
  /** Corner radius in px (matched by the clip + the specular ring). */
  radius?: number
  /** Frost blur applied to the backdrop, in px. */
  blur?: number
  /** Refraction strength — how far the displacement map bends the backdrop. */
  displace?: number
  /** Glass tint fill (a translucent colour laid over the frosted backdrop). */
  tint?: string
  /** A slow specular band that glides across the pane. Off = still glass. */
  sheen?: boolean
}

// A refractive "liquid glass" panel — a kind of surface the site did not have.
// Distinct from the gooey SVG filters (GooeyTabs / MetaBalls, which fuse blobs)
// and from plain frosted blur: this actually *bends* the content behind it. An
// feTurbulence noise field feeds an feDisplacementMap wired into the element's
// `backdrop-filter`, so whatever sits behind the pane (aurora, orbit, text) is
// warped as if seen through hand-poured glass, then frosted and tinted. A soft
// top-left gloss and a bright inset ring give it real specular weight, and an
// optional slow sheen band drifts across like light catching the surface.
//
// The refraction rides on `backdrop-filter: url(#...)`, which Chromium/Firefox
// honour; where it is unsupported (Safari) the pane still reads as premium
// frosted glass — the effect degrades, it never breaks. The sheen is a CSS
// animation, so the site-wide reduced-motion guard stills it automatically.
export function GlassSurface({
  children,
  className = '',
  radius = 28,
  blur = 6,
  displace = 14,
  tint = 'rgba(255,255,255,0.06)',
  sheen = true,
}: GlassSurfaceProps) {
  // Stable per-mount ids: an SVG filter id and a turbulence seed (varied per
  // instance so two panes on one screen do not share the exact same warp).
  const idRef = useRef<number>(0)
  if (idRef.current === 0) idRef.current = ++uid
  const filterId = `glass-${idRef.current}`
  const seed = (idRef.current * 7) % 100

  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        // The refraction (url) + frost (blur) + a touch of saturation/brightness
        // so the glass looks lit rather than muddy. The -webkit- pair keeps the
        // frost in Safari even though it ignores the url() reference.
        backdropFilter: `blur(${blur}px) saturate(1.6) brightness(1.04) url(#${filterId})`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(1.6) brightness(1.04)`,
        backgroundColor: tint,
        boxShadow:
          'inset 0 1px 0 0 rgba(255,255,255,0.28), inset 0 0 0 1px rgba(255,255,255,0.10), 0 24px 60px -30px rgba(0,0,0,0.8)',
      }}
    >
      {/* Displacement filter — zero-size, purely a reference for the backdrop. */}
      <svg aria-hidden className="pointer-events-none absolute h-0 w-0" width="0" height="0">
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.009 0.013"
            numOctaves={2}
            seed={seed}
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale={displace}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {/* Top-left gloss — the highlight where light enters the glass. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          background:
            'radial-gradient(120% 90% at 12% 8%, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 42%, transparent 70%)',
        }}
      />

      {/* Slow specular sweep — light travelling across the pane. */}
      {sheen && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ borderRadius: radius }}
        >
          <div
            className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-18deg]"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)',
              animation: 'glass-sheen 7s linear infinite',
            }}
          />
        </div>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  )
}
