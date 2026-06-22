// Generates public/og.png — the social share image.
// Zero dependencies: builds a PNG by hand using Node's built-in zlib.
// Brand art only (no rasterized text — the title rides in the og:title meta),
// matching the site: dark canvas, soft lime-led colour fields, faint grid,
// an orbit ring echoing HeroOrbit, and a dark vignette. Deterministic.

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const W = 1200
const H = 630

// --- palette (sRGB 0-255) ---
const BG = [9, 9, 11]
const LIME = [220, 248, 124]
const TEAL = [94, 234, 212]
const VIOLET = [129, 140, 248]

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// soft radial field falloff
function field(px, py, cx, cy, radius) {
  const dx = px - cx
  const dy = py - cy
  const d2 = dx * dx + dy * dy
  return Math.exp(-d2 / (2 * radius * radius))
}

// distance to an ellipse outline (rough, in normalised space)
function ringGlow(px, py, cx, cy, rx, ry, thickness) {
  const nx = (px - cx) / rx
  const ny = (py - cy) / ry
  const r = Math.sqrt(nx * nx + ny * ny)
  const t = Math.abs(r - 1) * Math.min(rx, ry)
  return Math.exp(-(t * t) / (2 * thickness * thickness))
}

const raw = Buffer.alloc(H * (1 + W * 3))

for (let y = 0; y < H; y++) {
  const rowStart = y * (1 + W * 3)
  raw[rowStart] = 0 // filter: none
  for (let x = 0; x < W; x++) {
    let r = BG[0]
    let g = BG[1]
    let b = BG[2]

    // lime leads, two seeded companions
    const fLime = field(x, y, W * 0.2, H * 0.28, 300) * 0.7
    const fTeal = field(x, y, W * 0.86, H * 0.18, 260) * 0.32
    const fViolet = field(x, y, W * 0.78, H * 0.95, 360) * 0.4

    r = lerp(r, LIME[0], fLime)
    g = lerp(g, LIME[1], fLime)
    b = lerp(b, LIME[2], fLime)
    r = lerp(r, TEAL[0], fTeal)
    g = lerp(g, TEAL[1], fTeal)
    b = lerp(b, TEAL[2], fTeal)
    r = lerp(r, VIOLET[0], fViolet)
    g = lerp(g, VIOLET[1], fViolet)
    b = lerp(b, VIOLET[2], fViolet)

    // faint grid
    const grid = (x % 48 === 0 || y % 48 === 0) ? 10 : 0
    r += grid
    g += grid
    b += grid

    // orbit ring + a leading dot, echoing HeroOrbit
    const ring = ringGlow(x, y, W * 0.52, H * 0.5, 300, 224, 1.5) * 95
    r += ring * (LIME[0] / 255)
    g += ring * (LIME[1] / 255)
    b += ring * (LIME[2] / 255)
    const dotAngle = -0.5
    const dcx = W * 0.52 + Math.cos(dotAngle) * 300
    const dcy = H * 0.5 + Math.sin(dotAngle) * 224
    const dotCore = field(x, y, dcx, dcy, 7) * 255
    const dotGlow = field(x, y, dcx, dcy, 26) * 90
    const dotI = dotCore + dotGlow
    r += dotI * (LIME[0] / 255)
    g += dotI * (LIME[1] / 255)
    b += dotI * (LIME[2] / 255)

    // vignette
    const vx = (x - W / 2) / (W / 2)
    const vy = (y - H / 2) / (H / 2)
    const vig = 1 - clamp((vx * vx + vy * vy) * 0.6, 0, 0.78)
    r *= vig
    g *= vig
    b *= vig

    const o = rowStart + 1 + x * 3
    raw[o] = clamp(Math.round(r), 0, 255)
    raw[o + 1] = clamp(Math.round(g), 0, 255)
    raw[o + 2] = clamp(Math.round(b), 0, 255)
  }
}

// --- PNG assembly ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 2 // colour type: truecolour
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

const idat = deflateSync(raw, { level: 9 })
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
])

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'og.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log(`wrote ${out} (${png.length} bytes, ${W}x${H})`)
