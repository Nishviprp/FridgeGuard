/**
 * generate-icons.mjs
 *
 * Creates public/icon-192.png and public/badge-72.png using pure Node.js —
 * no external dependencies needed (uses built-in zlib for deflate).
 *
 * Run once:  node scripts/generate-icons.mjs
 *
 * Colors: sage green (#7CAE7A) background with a white snowflake ❄
 * (The emoji 🧊 can't be painted without a canvas library, so we use a
 * clean geometric design that works as a notification icon.)
 */

import fs   from 'fs'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC    = path.join(__dirname, '..', 'public')

// ── Sage green + white color scheme ──────────────────────────────────────────
const SAGE   = [0x7C, 0xAE, 0x7A]   // #7CAE7A
const WHITE  = [0xFF, 0xFF, 0xFF]

// ─── Pure PNG encoder ─────────────────────────────────────────────────────────
// No external library — raw PNG bytes via Node's built-in zlib.

function makePNG(width, height, pixelFn) {
  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = chunk('IHDR', ihdrData(width, height))

  // Build raw scanlines: filter-byte(0) + RGB triplet per pixel
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0                      // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y, width, height)
      const off = y * (1 + width * 3) + 1 + x * 3
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })
  const idat       = chunk('IDAT', compressed)
  const iend       = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdr, idat, iend])
}

function ihdrData(w, h) {
  const b = Buffer.alloc(13)
  b.writeUInt32BE(w, 0); b.writeUInt32BE(h, 4)
  b[8] = 8; b[9] = 2   // 8-bit RGB
  return b
}

function chunk(type, data) {
  const lenBuf  = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcVal  = crc32(Buffer.concat([typeBuf, data]))
  const crcBuf  = Buffer.alloc(4); crcBuf.writeUInt32BE(crcVal, 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// CRC-32 (standard PNG checksum algorithm)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// ─── Icon pixel functions ─────────────────────────────────────────────────────

/** Circular icon: sage circle + white cross / snowflake shape */
function iconPixel(x, y, w, h) {
  const cx = w / 2, cy = h / 2, r = w / 2
  const dx = x - cx, dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Outside the circle → transparent (use white as background — PNG bg)
  if (dist > r) return WHITE

  // Inner snowflake design: 6-point star / cross
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  const relDist = dist / r

  // Arms of the snowflake (every 60°, 15° wide)
  const armAngle = ((((angle % 60) + 60) % 60))   // normalise to 0–60
  const isArm    = (armAngle < 12 || armAngle > 48) && relDist > 0.15

  // Centre dot
  const isCentre = relDist < 0.15

  if (isCentre || isArm) return WHITE
  return SAGE
}

/** Badge: solid sage circle (simple, readable at 72px) */
function badgePixel(x, y, w, h) {
  const cx = w / 2, cy = h / 2, r = w / 2 - 1
  const dx = x - cx, dy = y - cy
  return Math.sqrt(dx * dx + dy * dy) <= r ? SAGE : WHITE
}

// ─── Generate ─────────────────────────────────────────────────────────────────
fs.mkdirSync(PUBLIC, { recursive: true })

const icon192 = makePNG(192, 192, iconPixel)
const badge72 = makePNG(72,  72,  badgePixel)

fs.writeFileSync(path.join(PUBLIC, 'icon-192.png'), icon192)
fs.writeFileSync(path.join(PUBLIC, 'badge-72.png'), badge72)

console.log('✅  public/icon-192.png  —', icon192.length, 'bytes')
console.log('✅  public/badge-72.png  —', badge72.length, 'bytes')
