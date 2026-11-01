// How tall is Devanagari ink in each font, and what line height keeps matras inside their line? Real headlines and real body
// copy, raster-scanned in Chromium: canvas text metrics round and run loose on curves (D-031), so the ink itself is read.
// All values are in ems of the font size. inkTop and inkBottom are the furthest ink above and below the baseline.
// minLineHeight is the smallest CSS line-height that keeps all ink inside the line box.
// Spacing comes from real copy. A few rare stacked forms are also measured and reported as stressTop and stressBottom.
//   node scripts/measure-font-ink.mjs     writes spike/out/fontink.json and fonts/ink.json (font -> weight -> top, bottom, ascent, descent)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(root, 'spike/fonts.json'), 'utf8'))
const fonts = config.fonts.filter(f => f.launch || f.name === 'Halant').map(f => ({ name: f.name, role: f.role, launch: !!f.launch, weights: f.weights ?? [400] }))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const heads = read('spike/headlines/janshakti-headlines.txt').split('\n').map(s => s.trim()).filter(Boolean)
const body = JSON.parse(read('spike/stories/stories.json')).flatMap(s => s.body).join(' ').split(/(?<=[।.])\s+/).slice(0, 200)
const STRESS = ['कृि र्कि ह्रैं र्क्ष्यँ ॐ ऋॠ ङ्ग ट्ठ ड्ढ श्री कीं क्ष्म्य ज्ञा रूं हृ द्ध द्व ह्न र्त्स्न्यै कॉं ऑँ', 'कुं कूँ कृं कॄ कॢ क़ ड़ ढ़ ग़ ज़ ळ ऴ ऱ', 'Gjpqy ÀÉ 0123456789 ₹ %']
const html = path.join(root, 'spike/out/measure-font-ink.html')
fs.mkdirSync(path.dirname(html), { recursive: true })
fs.writeFileSync(html, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}"></head><body></body></html>`)
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] }), page = await browser.newPage(), errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto(pathToFileURL(html).href)
const rows = await page.evaluate(async ({ fonts, heads, body, stress }) => {
  const PX = 80, out = []
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const scan = (text, font) => {
    c.font = font
    const w = Math.ceil(c.measureText(text).width) + PX * 2, h = PX * 4, base = PX * 2
    c.canvas.width = w; c.canvas.height = h; c.font = font; c.fillStyle = '#000'; c.fillText(text, PX, base)
    const d = c.getImageData(0, 0, w, h).data
    let top = h, bottom = 0
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 64) { if (y < top) top = y; if (y > bottom) bottom = y; break } }
    return { up: (base - top) / PX, down: (bottom + 1 - base) / PX }
  }
  for (const f of fonts) for (const weight of f.weights) {
    const font = `${weight} ${PX}px "${f.name}"`
    await document.fonts.load(font, 'क')
    if (!document.fonts.check(font, 'क')) { out.push({ font: f.name, weight, missing: true }); continue }
    c.font = font
    const m = c.measureText('कि'), A = m.fontBoundingBoxAscent / PX, D = m.fontBoundingBoxDescent / PX
    let inkTop = 0, inkBottom = 0, topText = '', bottomText = '', stressTop = 0, stressBottom = 0
    for (const text of [...heads, ...body]) {
      const s = scan(text.slice(0, 120), font)
      if (s.up > inkTop) { inkTop = s.up; topText = text.slice(0, 40) }
      if (s.down > inkBottom) { inkBottom = s.down; bottomText = text.slice(0, 40) }
    }
    // Rare stacked forms are reported, not spaced for: real copy sets the spacing, and nothing is clipped if one reaches further.
    for (const text of stress) { const s = scan(text, font); stressTop = Math.max(stressTop, s.up); stressBottom = Math.max(stressBottom, s.down) }
    const minLineHeight = Math.max(2 * inkTop - A + D, 2 * inkBottom + A - D, inkTop + inkBottom)
    out.push({ font: f.name, role: f.role, launch: f.launch, weight, ascent: +A.toFixed(3), descent: +D.toFixed(3), inkTop: +inkTop.toFixed(3), inkBottom: +inkBottom.toFixed(3), inkHeight: +(inkTop + inkBottom).toFixed(3), minLineHeight: +minLineHeight.toFixed(3), stressTop: +stressTop.toFixed(3), stressBottom: +stressBottom.toFixed(3), topText, bottomText })
  }
  return out
}, { fonts, heads, body, stress: STRESS })
await browser.close()
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
fs.writeFileSync(path.join(root, 'spike/out/fontink.json'), JSON.stringify(rows, null, 1))
const table = {}
for (const r of rows.filter(x => !x.missing)) (table[r.font] ??= {})[r.weight] = { top: r.inkTop, bottom: r.inkBottom, ascent: r.ascent, descent: r.descent }
fs.mkdirSync(path.join(root, 'fonts'), { recursive: true })
fs.writeFileSync(path.join(root, 'fonts/ink.json'), JSON.stringify(table, null, 1) + '\n')
for (const r of rows) console.log(r.missing ? `${r.font} ${r.weight}: font did not load` : `${r.font.padEnd(24)} ${r.weight}  ink up ${r.inkTop.toFixed(2)} down ${r.inkBottom.toFixed(2)} height ${r.inkHeight.toFixed(2)}  min line-height ${r.minLineHeight.toFixed(2)}  rare forms up ${r.stressTop.toFixed(2)} down ${r.stressBottom.toFixed(2)}`)
