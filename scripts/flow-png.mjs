// Phase 0 task 6 (docs/phases/phase0-engine.md): visual check of flow() on one realistic page.
// Left: flow() lines drawn absolutely (4 columns, a photo, a boxed quote). Right: the same text in plain CSS columns.
//   node scripts/flow-png.mjs              writes spike/out/flow.html, spike/out/flow.png and a copy in demos/phase0-done/flow.png
//   node scripts/flow-png.mjs --justify    same lines justified the export way (word spacing only, D-006; last line ragged),
//                                          CSS columns with text-align: justify; writes flow-justified.html / .png
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const story = fs.readFileSync(path.join(root, 'spike/samples/janshakti-live.txt'), 'utf8').split(/\n\s*\n/)
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40).slice(0, 30).join(' ')

const JUSTIFY = process.argv.includes('--justify'), NAME = JUSTIFY ? 'flow-justified' : 'flow'
const code = `
const JUSTIFY = ${JUSTIFY}
import { flow } from ${JSON.stringify(path.join(root, 'packages/engine/src/flow.js').replace(/\\/g, '/'))}
const FAMILY = '"Noto Sans Devanagari"', PX = 12, LH = 15, W = 760, H = 1000, GUT = 14, COLW = (W - 3 * GUT) / 4
const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e }
window.draw = () => {
  const frames = [0, 1, 2, 3].map(i => ({ id: 'c' + i, x: i * (COLW + GUT), y: 70, w: COLW, h: H - 70 }))
  const photo = { x: COLW + GUT, y: 70, w: 2 * COLW + GUT, h: 260, margin: 8 }
  const quote = { x: 3 * (COLW + GUT), y: 420, w: COLW, h: 140, margin: 8 }
  const r = flow(${JSON.stringify(story)}, frames, [photo, quote], { font: PX + 'px ' + FAMILY, lineHeight: LH })
  const left = el('div', 'position:relative;width:' + W + 'px;height:' + H + 'px;background:#fff;outline:1px solid #ccc')
  left.append(el('div', 'position:absolute;left:0;top:8px;font:700 30px/40px ' + FAMILY, 'flow(): मुख्य समाचार'))
  left.append(el('div', 'position:absolute;background:#9ab;left:' + photo.x + 'px;top:' + photo.y + 'px;width:' + photo.w + 'px;height:' + photo.h + 'px;font:14px sans-serif;color:#fff;display:grid;place-items:center', 'photo'))
  left.append(el('div', 'position:absolute;box-sizing:border-box;border-top:3px solid #000;border-bottom:1px solid #000;padding:8px 4px;left:' + quote.x + 'px;top:' + quote.y + 'px;width:' + quote.w + 'px;height:' + quote.h + 'px;font:700 17px/24px ' + FAMILY, '“भर्ती की उम्मीदों को मिली नई रफ्तार”'))
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = PX + 'px ' + FAMILY
  const space = ctx.measureText(' ').width, ratios = []
  for (const [i, l] of r.lines.entries()) {
    // justify: spread the spare width over the line's spaces (no letter-spacing); the story's last line stays ragged
    const t = l.text.trimEnd(), n = (t.match(/ /g) || []).length
    const ws = JUSTIFY && n && i < r.lines.length - 1 ? (l.w - ctx.measureText(t).width) / n : 0
    if (JUSTIFY && n && i < r.lines.length - 1) ratios.push((space + ws) / space)
    left.append(el('div', 'position:absolute;white-space:pre;word-spacing:' + ws + 'px;font:' + PX + 'px/' + LH + 'px ' + FAMILY + ';left:' + l.x + 'px;top:' + l.y + 'px', t))
  }
  const right = el('div', 'width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:#fff;outline:1px solid #ccc')
  right.append(el('div', 'font:700 30px/40px ' + FAMILY + ';margin:8px 0 22px', 'CSS columns: वही पाठ'))
  const cols = el('div', 'columns:4;column-gap:' + GUT + 'px;font:' + PX + 'px/' + LH + 'px ' + FAMILY + ';height:' + (H - 70) + 'px;column-fill:auto' + (JUSTIFY ? ';text-align:justify' : ''), ${JSON.stringify(story)})
  cols.lang = 'hi'; right.append(cols)
  document.body.append(left, right)
  ratios.sort((a, b) => a - b)
  return { lines: r.lines.length, remainder: r.remainder.length, spaceMedian: ratios[ratios.length >> 1], spaceMax: ratios.at(-1), over2: ratios.filter(x => x > 2).length }
}
window.ready = document.fonts.load('12px ' + '"Noto Sans Devanagari"', 'क').then(() => document.fonts.load('700 30px "Noto Sans Devanagari"', 'क'))
`
const bundle = await esbuild.build({ stdin: { contents: code, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const out = path.join(root, 'spike/out'), html = path.join(out, `${NAME}.html`)
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(html, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}">
<style>body{margin:16px;display:flex;gap:24px;background:#eee}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1600, height: 1040 } }), errors = []
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready)
const r = await page.evaluate(() => window.draw())
await page.screenshot({ path: path.join(out, `${NAME}.png`) }); await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }
fs.mkdirSync(path.join(root, 'demos/phase0-done'), { recursive: true })
fs.copyFileSync(path.join(out, `${NAME}.png`), path.join(root, `demos/phase0-done/${NAME}.png`))
console.log(`spike/out/${NAME}.png: ${r.lines} lines set by flow(), ${r.remainder} characters left over` +
  (JUSTIFY ? `; word space median ${r.spaceMedian.toFixed(2)}x, max ${r.spaceMax.toFixed(2)}x, ${r.over2} lines over 2x` : ''))
