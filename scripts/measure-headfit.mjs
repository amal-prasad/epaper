// Do real headlines fit their slots, in every launch font, without ink leaving the space or lines touching? Chromium, real fonts,
// the 200 real headlines, every distinct headline slot in templates/. Layout comes from layoutHeadline(); the ink is then read
// back from a raster, independently of it. Also checks itself: spacing lines at the old 1.14 must be seen as lines touching.
//   node scripts/measure-headfit.mjs     writes spike/out/headfit.json
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const preset = read('presets/newspaper.json'), inks = read('fonts/ink.json')
const templates = fs.readdirSync(path.join(root, 'templates')).filter(f => f.endsWith('.json')).map(f => read(`templates/${f}`))
const heads = fs.readFileSync(path.join(root, 'spike/headlines/janshakti-headlines.txt'), 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
const launch = read('spike/fonts.json').fonts.filter(f => (f.launch && ['headline', 'text', 'text-serif'].includes(f.role)) || f.name === 'Halant').map(f => f.name)
const engine = f => JSON.stringify(path.join(root, 'packages/engine/src', f).replace(/\\/g, '/'))

const code = `
import { layoutHeadline } from ${engine('headline.js')}
import { buildPage } from ${engine('templates.js')}
const PRESET = ${JSON.stringify(preset)}, INKS = ${JSON.stringify(inks)}, TEMPLATES = ${JSON.stringify(templates)}, HEADS = ${JSON.stringify(heads)}, FONTS = ${JSON.stringify(launch)}
const PX = 96 / 25.4, WEIGHT = PRESET.headline.weight
const slots = new Map()
for (const t of TEMPLATES) {
  const { objects, frames } = buildPage(t, PRESET, { pageId: 'p', orgId: 'o' })
  for (const f of frames) {
    const o = objects.find(x => x.slotId === f.slotId && x.style.role === 'headline'); if (!o) continue
    const key = [f.priority, o.w.toFixed(1), o.h.toFixed(1)].join('/')
    if (!slots.has(key)) slots.set(key, { priority: f.priority, width: o.w * PX, height: o.h * PX, example: t.id + ':' + f.slotId })
  }
}
const SCALE = 3, c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
// The ink rows of one line, in px from the top of the space.
function inkRows(text, family, size, baseline, width) {
  const w = Math.ceil(width * SCALE) + 40, pad = Math.ceil(size * 2 * SCALE), h = pad * 2
  c.canvas.width = w; c.canvas.height = h; c.font = WEIGHT + ' ' + size * SCALE + 'px "' + family + '"'; c.fillText(text, 4, pad)
  const d = c.getImageData(0, 0, w, h).data
  let top = h, bottom = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 96) { if (y < top) top = y; if (y > bottom) bottom = y; break }
  return bottom < 0 ? null : { top: baseline + (top - pad) / SCALE, bottom: baseline + (bottom + 1 - pad) / SCALE }
}
function violations(r, family, height) {
  const rows = r.lines.map(l => inkRows(l.text, family, r.size, l.baseline, l.w)).filter(Boolean), out = []
  const SLACK = 0.5
  if (rows.some(x => x.top < -SLACK)) out.push('ink above the space')
  if (r.fits && rows.some(x => x.bottom > height + SLACK)) out.push('ink below the space')
  for (let i = 1; i < rows.length; i++) if (rows[i].top < rows[i - 1].bottom - SLACK) { out.push('lines touch'); break }
  return out
}
window.run = () => {
  const perFont = {}, worst = []
  let inkViolations = 0, inkChecked = 0
  for (const family of FONTS) {
    const ink = INKS[family]?.[WEIGHT]
    if (!ink) { perFont[family] = { missing: true }; continue }
    let total = 0, noFit = 0, sizeSum = 0
    for (const s of slots.values()) for (const [i, text] of HEADS.entries()) {
      const r = layoutHeadline(text, { family, weight: WEIGHT, sizes: PRESET.headline.sizes[s.priority], width: s.width, height: s.height, ink })
      total++; sizeSum += r.size
      if (!r.fits) { noFit++; if (worst.length < 12) worst.push({ family, slot: s.example, lines: r.lines.length, text: text.slice(0, 50) }) }
      if (i % 7 === 0) { inkChecked++; const v = violations(r, family, s.height); if (v.length) { inkViolations++; if (worst.length < 24) worst.push({ family, slot: s.example, why: v, text: text.slice(0, 50) }) } }
    }
    perFont[family] = { total, noFit, noFitPct: Math.round(noFit / total * 1000) / 10, averageSize: Math.round(sizeSum / total * 10) / 10 }
  }
  // Self-check: the bug's spacing, on two-line headlines in the main font, must be read as lines touching on at least 5.
  // Not on all: many lines have no matra under them to collide. And a line set too high must read as ink above the space.
  const family = PRESET.headline.family, ink = INKS[family][WEIGHT], s = [...slots.values()][0]
  let caught = 0, tried = 0
  for (const text of HEADS.slice(0, 40)) {
    const good = layoutHeadline(text, { family, weight: WEIGHT, sizes: [30], width: 300, height: 1e6, ink })
    if (good.lines.length < 2) continue
    tried++
    const pitch = 30 * 1.14, bad = { ...good, pitch, lines: good.lines.map((l, i) => ({ ...l, baseline: 30 * ink.top + i * pitch })) }
    if (violations(bad, family, 1e6).includes('lines touch')) caught++
  }
  const clipped = violations({ ...layoutHeadline(HEADS[0], { family, weight: WEIGHT, sizes: [30], width: 300, height: 1e6, ink }), lines: [{ text: 'कि कीं', baseline: 5, w: 300 }], fits: true }, family, 1e6)
  const main = perFont[family]
  return { slots: slots.size, headlines: HEADS.length, fonts: perFont, noFitPct: main.noFitPct, inkChecked, inkViolations, mutantTried: tried, mutantCaughtCount: caught, mutantCaught: caught >= 5 && clipped.includes('ink above the space') ? 1 : 0, worst }
}
window.ready = Promise.all(FONTS.map(f => document.fonts.load(WEIGHT + ' 30px "' + f + '"', 'क')))
`
const bundle = await esbuild.build({ stdin: { contents: code, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const work = path.join(root, 'spike/out'), html = path.join(work, 'measure-headfit.html')
fs.writeFileSync(html, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}"></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] }), page = await browser.newPage(), errors = []
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready)
const out = await page.evaluate(() => window.run())
await browser.close()
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
fs.writeFileSync(path.join(work, 'headfit.json'), JSON.stringify(out, null, 1))
console.log(`${out.headlines} headlines x ${out.slots} slot sizes. Ink checked ${out.inkChecked}, problems ${out.inkViolations}. Bug spacing caught on ${out.mutantCaughtCount}/${out.mutantTried}; self-check ${out.mutantCaught ? 'passed' : 'FAILED'}`)
for (const [f, r] of Object.entries(out.fonts)) console.log(r.missing ? `${f}: no ink data` : `${f.padEnd(24)} no fit ${String(r.noFitPct).padStart(5)}% (${r.noFit}/${r.total}), average size ${r.averageSize}px`)
for (const w of out.worst.slice(0, 10)) console.log(`  ${w.family} ${w.slot} ${w.why ? w.why.join(', ') : w.lines + ' lines'}: ${w.text}`)
