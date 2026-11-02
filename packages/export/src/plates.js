import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { findGhostscript, runStrict } from './pdf.js'
const require = createRequire(new URL('../../../spike/package.json', import.meta.url))
const { createCanvas, loadImage } = require('@napi-rs/canvas')
const names = ['Cyan', 'Magenta', 'Yellow', 'Black']

// Same uncompressed eight-bit tiffsep format and ink convention as black-spike.mjs.
function readTiff(file) {
  const b = fs.readFileSync(file), le = b.toString('ascii', 0, 2) === 'II'
  const u16 = n => le ? b.readUInt16LE(n) : b.readUInt16BE(n), u32 = n => le ? b.readUInt32LE(n) : b.readUInt32BE(n)
  const at = u32(4), tags = {}
  for (let i = 0; i < u16(at); i++) {
    const entry = at + 2 + i * 12, type = u16(entry + 2), count = u32(entry + 4), size = type === 3 ? 2 : 4
    const value = count * size > 4 ? u32(entry + 8) : entry + 8
    tags[u16(entry)] = Array.from({ length: count }, (_, j) => size === 2 ? u16(value + j * 2) : u32(value + j * 4))
  }
  if ((tags[259]?.[0] ?? 1) !== 1 || tags[258]?.[0] !== 8 || (tags[277]?.[0] ?? 1) !== 1) throw new Error('plate TIFF must be uncompressed, eight-bit, single-channel')
  const w = tags[256][0], h = tags[257][0], ink = new Uint8Array(w * h), white = tags[262]?.[0] === 1
  let n = 0
  for (const [i, offset] of tags[273].entries()) for (let k = 0; k < tags[279][i]; k++) ink[n++] = white ? 255 - b[offset + k] : b[offset + k]
  if (n !== w * h) throw new Error('plate TIFF has an unexpected byte count')
  return { w, h, ink }
}
function curveAt(k, curve) {
  for (let i = 1; i < curve.length; i++) if (k <= curve[i][0]) {
    const [x0, y0] = curve[i - 1], [x1, y1] = curve[i]
    return y0 + (k - x0) * (y1 - y0) / (x1 - x0)
  }
  return curve.at(-1)[1]
}

export async function checkPlates(pdf, pageReports, profile, outputDir) {
  const pattern = path.join(outputDir, 'plate-%03d.tif')
  runStrict(findGhostscript(), ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=tiffsep', '-r192', '-sCompression=none', `-sOutputFile=${pattern}`, pdf])
  let totalInkMaxPct = 0, neutralCheckedPixels = 0, neutralFailedPixels = 0
  const pages = [], samples = []
  for (const [pageIndex, report] of pageReports.entries()) {
    const stem = `plate-${String(pageIndex + 1).padStart(3, '0')}`
    const channels = names.map(name => readTiff(path.join(outputDir, `${stem}(${name}).tif`)))
    const { w, h } = channels[0]
    if (channels.some(c => c.w !== w || c.h !== h)) throw new Error('plate dimensions differ')
    for (let i = 0; i < w * h; i++) totalInkMaxPct = Math.max(totalInkMaxPct, channels.reduce((sum, c) => sum + c.ink[i], 0) / 2.55)
    const maskImage = await loadImage(report.neutralMask), cv = createCanvas(w, h), cx = cv.getContext('2d')
    const factor = 192 / (report.neutralMaskDpi ?? 96)
    if (Math.abs(maskImage.width * factor - w) > 2 || Math.abs(maskImage.height * factor - h) > 2) throw new Error('neutral mask and plate dimensions differ')
    cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h); cx.imageSmoothingEnabled = false
    cx.drawImage(maskImage, 0, 0, maskImage.width * factor, maskImage.height * factor)
    const pixels = cx.getImageData(0, 0, w, h).data
    let checked = 0, failed = 0
    if (!Array.isArray(report.neutralRegions)) throw new Error(`neutral region coverage missing for page ${report.id}`)
    const regions = []
    for (const region of report.neutralRegions) {
      const expected = curveAt(region.k, profile.neutralCurve) * 255, sourceGray = (1 - region.k) * 255
      let regionChecked = 0, regionFailed = 0
      const x0 = Math.max(1, Math.floor(region.x * 2)), y0 = Math.max(1, Math.floor(region.y * 2))
      const x1 = Math.min(w - 1, Math.ceil((region.x + region.w) * 2)), y1 = Math.min(h - 1, Math.ceil((region.y + region.h) * 2))
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const at = y * w + x
        // Sample the region's actual paint tone, not antialias greys mistaken for independent tints.
        if (Math.abs(pixels[at * 4] - sourceGray) > 6) continue
        regionChecked++
        let match = false
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const i = (y + dy) * w + x + dx
          if (channels.slice(0, 3).every(c => c.ink[i] <= 6) && Math.abs(channels[3].ink[i] - expected) <= 12) match = true
        }
        if (!match) {
          regionFailed++
          if (samples.length < 8) samples.push({ page: pageIndex + 1, region: region.id, x, y, expected: +expected.toFixed(1), ink: channels.map(c => c.ink[at]) })
        }
      }
      const failedPct = regionChecked ? regionFailed / regionChecked * 100 : null
      if (!regionChecked || failedPct > 0.5) throw new Error(`neutral plate region ${report.id}/${region.id} failed: ${regionFailed}/${regionChecked} pixels; ${JSON.stringify(samples)}`)
      checked += regionChecked; failed += regionFailed
      regions.push({ id: region.id, checked: regionChecked, failed: regionFailed, failedPct })
    }
    neutralCheckedPixels += checked; neutralFailedPixels += failed
    const images = {}
    for (const [i, name] of names.entries()) {
      const canvas = createCanvas(w, h), context = canvas.getContext('2d'), data = context.createImageData(w, h)
      const colour = [[0, 160, 230], [230, 0, 126], [255, 220, 0], [0, 0, 0]][i]
      for (let j = 0; j < w * h; j++) {
        const a = channels[i].ink[j] / 255
        for (let k = 0; k < 3; k++) data.data[j * 4 + k] = Math.round(255 - a * (255 - colour[k]))
        data.data[j * 4 + 3] = 255
      }
      context.putImageData(data, 0, 0)
      const file = `${stem}-${name}.png`; fs.writeFileSync(path.join(outputDir, file), canvas.toBuffer('image/png')); images[name] = file
    }
    pages.push({ id: report.id, checked, failed, regions, images, neutralCheck: regions.length ? 'checked' : 'not-applicable' })
  }
  const neutralFailedPct = neutralCheckedPixels ? neutralFailedPixels / neutralCheckedPixels * 100 : null
  if (totalInkMaxPct > profile.inkLimit + 0.5) throw new Error(`plate total ink ${totalInkMaxPct.toFixed(1)}% exceeds inkLimit ${profile.inkLimit}%`)
  if (neutralFailedPct !== null && neutralFailedPct > 0.5) throw new Error(`neutral plate check failed: ${neutralFailedPixels}/${neutralCheckedPixels} pixels (${neutralFailedPct?.toFixed(2)}%): ${JSON.stringify(samples)}`)
  return { dpi: 192, totalInkMaxPct: +totalInkMaxPct.toFixed(2), neutralCheckedPixels, neutralFailedPixels,
    neutralFailedPct: neutralFailedPct === null ? null : +neutralFailedPct.toFixed(4), passed: true, pages }
}
