// Generates PWA icons from the official app artwork (assets/app-icon-source.png).
// The blob mascot is auto-cropped (alpha/luminance threshold), centered on the
// TimeBank dark background, and exported at every required size. The maskable
// variant renders the artwork smaller so Android's safe zone never clips it.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const SOURCE = join(root, 'assets', 'app-icon-source.png')
const OUT_DIR = join(root, 'public', 'icons')

// Brand background: TimeBank ink with the signature subtle gold glow.
const BG_TOP = [17, 23, 32] // slightly lifted ink at top
const BG_BOTTOM = [8, 11, 16] // ink at bottom
const GLOW = [232, 197, 71] // gold

// --- helpers -----------------------------------------------------------------

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Load the source PNG, remove the design-tool checkered background, and crop
 * to the mascot's bounding box. The checker is neutral dark gray (r≈g≈b) while
 * the blob is blue-tinted glass, so a chroma test separates them cleanly.
 */
function loadCroppedSource() {
  const png = PNG.sync.read(readFileSync(SOURCE))
  const { width, height, data } = png

  const pixelInfo = (x, y) => {
    const i = (y * width + x) * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3] / 255
    const luminance = a < 0.1 ? 0 : 0.2126 * r + 0.7152 * g + 0.0722 * b
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    return { r, g, b, a, luminance, chroma }
  }

  // Remove neutral dark background (checker + grid lines) in place.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const { luminance, chroma } = pixelInfo(x, y)
      if (chroma < 14 && luminance < 75) {
        data[i + 3] = 0
      }
    }
  }

  // Drop small isolated opaque islands (checker fragments that survived the
  // chroma test). The mascot is one huge component; fragments are tiny.
  const visited = new Uint8Array(width * height)
  const stack = []
  for (let y0 = 0; y0 < height; y0++) {
    for (let x0 = 0; x0 < width; x0++) {
      const idx0 = y0 * width + x0
      if (visited[idx0] || data[idx0 * 4 + 3] <= 24) continue
      stack.length = 0
      stack.push(idx0)
      visited[idx0] = 1
      const component = []
      while (stack.length > 0) {
        const idx = stack.pop()
        component.push(idx)
        const x = idx % width
        const y = (idx - x) / width
        const neighbors = [
          x > 0 ? idx - 1 : -1,
          x < width - 1 ? idx + 1 : -1,
          y > 0 ? idx - width : -1,
          y < height - 1 ? idx + width : -1,
        ]
        for (const n of neighbors) {
          if (n === -1 || visited[n] || data[n * 4 + 3] <= 24) continue
          visited[n] = 1
          stack.push(n)
        }
      }
      if (component.length < 500) {
        for (const idx of component) data[idx * 4 + 3] = 0
      }
    }
  }

  // Soften the 1px fringe: half-transparent pixels touching transparency get
  // slightly reduced alpha for cleaner edges at small sizes.
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : data[(y * width + x) * 4 + 3])
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] === 255) {
        const neighborsTransparent =
          alphaAt(x - 1, y) === 0 || alphaAt(x + 1, y) === 0 || alphaAt(x, y - 1) === 0 || alphaAt(x, y + 1) === 0
        const { luminance, chroma } = pixelInfo(x, y)
        if (neighborsTransparent && chroma < 18 && luminance < 90) {
          data[i + 3] = 120
        }
      }
    }
  }

  const THRESHOLD = 24 // any non-transparent pixel counts toward the bbox
  let minX = width, minY = height, maxX = 0, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX <= minX || maxY <= minY) throw new Error('Icon source appears empty')

  // Small padding so the glass edges survive the crop.
  const pad = 2
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(width - 1, maxX + pad)
  maxY = Math.min(height - 1, maxY + pad)

  const cropW = maxX - minX + 1
  const cropH = maxY - minY + 1
  const cropped = new PNG({ width: cropW, height: cropH })
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcIdx = ((minY + y) * width + (minX + x)) * 4
      const dstIdx = (y * cropW + x) * 4
      cropped.data[dstIdx] = data[srcIdx]
      cropped.data[dstIdx + 1] = data[srcIdx + 1]
      cropped.data[dstIdx + 2] = data[srcIdx + 2]
      cropped.data[dstIdx + 3] = data[srcIdx + 3]
    }
  }
  return cropped
}

/**
 * Paint one icon: brand background with soft gold glow, mascot centered,
 * bilinear downscaling for crisp results at small sizes.
 */
function paintIcon(size, cropped, { maskable = false } = {}) {
  const out = new PNG({ width: size, height: size })

  // Background: vertical gradient + centered radial gold glow (subtle).
  for (let y = 0; y < size; y++) {
    const ty = y / (size - 1)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      let r = lerp(BG_TOP[0], BG_BOTTOM[0], ty)
      let g = lerp(BG_TOP[1], BG_BOTTOM[1], ty)
      let b = lerp(BG_TOP[2], BG_BOTTOM[2], ty)

      const dx = (x / size - 0.5) * 2
      const dy = (y / size - 0.42) * 2
      const dist = Math.sqrt(dx * dx + dy * dy)
      const glow = Math.max(0, 1 - dist / 1.35) ** 2 * 0.1
      r = Math.min(255, r + GLOW[0] * glow)
      g = Math.min(255, g + GLOW[1] * glow)
      b = Math.min(255, b + GLOW[2] * glow)

      out.data[i] = Math.round(r)
      out.data[i + 1] = Math.round(g)
      out.data[i + 2] = Math.round(b)
      out.data[i + 3] = 255
    }
  }

  // Mascot: fit into a centered square region.
  const contentScale = maskable ? 0.62 : 0.78 // maskable safe zone
  const boxSize = Math.floor(size * contentScale)
  const cropLongest = Math.max(cropped.width, cropped.height)
  const drawW = Math.max(1, Math.floor((cropped.width / cropLongest) * boxSize))
  const drawH = Math.max(1, Math.floor((cropped.height / cropLongest) * boxSize))
  const offX = Math.floor((size - drawW) / 2)
  const offY = Math.floor((size - drawH) / 2)

  const sx = cropped.width / drawW
  const sy = cropped.height / drawH

  for (let y = 0; y < drawH; y++) {
    for (let x = 0; x < drawW; x++) {
      // Bilinear sample from the cropped source.
      const fx = Math.min(cropped.width - 1.001, (x + 0.5) * sx - 0.5)
      const fy = Math.min(cropped.height - 1.001, (y + 0.5) * sy - 0.5)
      const x0 = Math.max(0, Math.floor(fx))
      const y0 = Math.max(0, Math.floor(fy))
      const x1 = Math.min(cropped.width - 1, x0 + 1)
      const y1 = Math.min(cropped.height - 1, y0 + 1)
      const ax = fx - x0
      const ay = fy - y0

      const px = (cx, cy) => {
        const i = (cy * cropped.width + cx) * 4
        return [cropped.data[i], cropped.data[i + 1], cropped.data[i + 2], cropped.data[i + 3]]
      }
      const c00 = px(x0, y0)
      const c10 = px(x1, y0)
      const c01 = px(x0, y1)
      const c11 = px(x1, y1)

      const sample = c00.map((_, k) =>
        lerp(lerp(c00[k], c10[k], ax), lerp(c01[k], c11[k], ax), ay),
      )

      const alpha = sample[3] / 255
      if (alpha <= 0.003) continue
      const dstIdx = ((offY + y) * size + (offX + x)) * 4
      // Straight-alpha over.
      out.data[dstIdx] = Math.round(sample[0] * alpha + out.data[dstIdx] * (1 - alpha))
      out.data[dstIdx + 1] = Math.round(sample[1] * alpha + out.data[dstIdx + 1] * (1 - alpha))
      out.data[dstIdx + 2] = Math.round(sample[2] * alpha + out.data[dstIdx + 2] * (1 - alpha))
      out.data[dstIdx + 3] = 255
    }
  }
  return PNG.sync.write(out)
}

// --- main --------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true })
const cropped = loadCroppedSource()
console.log(`Source cropped to ${cropped.width}x${cropped.height}`)

writeFileSync(join(OUT_DIR, 'icon-192.png'), paintIcon(192, cropped))
writeFileSync(join(OUT_DIR, 'icon-512.png'), paintIcon(512, cropped))
writeFileSync(join(OUT_DIR, 'icon-maskable-512.png'), paintIcon(512, cropped, { maskable: true }))
writeFileSync(join(OUT_DIR, 'apple-touch-icon.png'), paintIcon(180, cropped))
writeFileSync(join(OUT_DIR, 'favicon.png'), paintIcon(64, cropped))
console.log('Icons written to public/icons/')
