// Weekly templates through the real buildPage(), frameColumns(), flow() and fit(), in Chromium with real Hindi copy.
// Each row shows one template twice: its empty slots, then the page filled. The assumed grid comes from presets/newspaper.json.
//   node scripts/demo-templates.mjs     writes demos/templates/<template>-<empty|filled>.jpg and demos/templates.html
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const preset = read('presets/newspaper.json'), paper = read('papers/janshakti.json')
const NAMES = ['weekly-front', 'weekly-inner', 'weekly-ads']
const templates = NAMES.map(n => read(`templates/${n}.json`))
const stories = read('spike/stories/stories.json')     // whole real stories, one per slot, never cut to fit
const engine = f => JSON.stringify(path.join(root, 'packages/engine/src', f).replace(/\\/g, '/'))

const code = `
import { flow, fit } from ${engine('flow.js')}
import { buildPage, frameColumns } from ${engine('templates.js')}
const PRESET = ${JSON.stringify(preset)}, TEMPLATES = ${JSON.stringify(templates)}, IMPRINT = ${JSON.stringify(paper.imprint)}, STORIES = ${JSON.stringify(stories)}
const PX = 96 / 25.4, BODY = 12, LH = PRESET.grid.baseline * PX, HEAD_LINES = { 1: 5, 2: 4, 3: 3 }, HEAD_PX = { 1: 34, 2: 24, 3: 19 }
const el = (css, text) => { const e = document.createElement('div'); e.style.cssText = 'position:absolute;box-sizing:border-box;' + css; if (text != null) e.textContent = text; return e }
const box = b => 'left:' + b.x * PX + 'px;top:' + b.y * PX + 'px;width:' + b.w * PX + 'px;height:' + b.h * PX + 'px;'
const pagePx = () => ({ w: PRESET.page.w * PX, h: PRESET.page.h * PX })
const LABEL = { photo: 'फोटो', masthead: 'मास्टहेड', imprint: 'प्रिंट लाइन', ad: 'विज्ञापन' }
window.draw = (name, filled) => {
  const t = TEMPLATES.find(x => x.id === name), { frames, objects } = buildPage(t, PRESET, { pageId: 'p', orgId: 'o' }), rows = []
  document.body.textContent = ''
  const { w, h } = pagePx(), page = el('position:relative;background:#fff;overflow:hidden;width:' + w + 'px;height:' + h + 'px')
  let next = window.nextStory
  for (const o of objects) {
    const role = o.style.role
    if (!filled) { page.append(el(box(o) + 'border:2px dashed #6a8caf;background:#eef3f8;font:400 20px sans-serif;color:#456;padding:8px', LABEL[role])); continue }
    if (role === 'photo') page.append(el(box(o) + 'background:linear-gradient(135deg,#6a8caf,#c9a46b 60%,#5d7a4a)'))
    if (role === 'ad') page.append(el(box(o) + 'border:2px solid #222;display:flex;align-items:center;justify-content:center;font:400 28px "Noto Sans Devanagari";color:#444', LABEL.ad))
    if (role === 'masthead') page.append(el(box(o) + 'border-bottom:4px solid #111;font:700 86px/1.3 "Khand";text-align:center', 'जनशक्ति उजाला'))
    if (role === 'imprint') page.append(el(box(o) + 'border-top:1px solid #111;padding-top:4px;font:12px/16px "Noto Sans Devanagari";color:#b42318', 'मुद्रक: ' + IMPRINT.printer + ' · मुद्रण स्थल: ' + IMPRINT.placeOfPrinting + ' · संपादक: ' + IMPRINT.editor + ' · प्रकाशक: ' + IMPRINT.publisher + ' · प्रकाशन स्थल: ' + IMPRINT.placeOfPublication))
  }
  for (const f of frames) {
    if (!filled) { page.append(el(box(f) + 'border:2px solid #1a7f37;background:#eef8f0;font:400 20px sans-serif;color:#1a7f37;padding:8px', 'खबर · प्राथमिकता ' + f.priority + ' · ' + f.cols + ' कॉलम')); continue }
    const story = STORIES[next++]
    const headH = HEAD_LINES[f.priority] * PRESET.grid.baseline, gap = 2
    const body = { ...f, y: f.y + headH, h: f.h - headH - gap }
    page.append(el('left:' + f.x * PX + 'px;top:' + f.y * PX + 'px;width:' + f.w * PX + 'px;height:' + headH * PX + 'px;overflow:hidden;font:700 ' + HEAD_PX[f.priority] + 'px/1.15 "Khand"', story.headline))
    const columns = frameColumns(body).map(c => ({ ...c, x: c.x * PX, y: c.y * PX, w: c.w * PX, h: Math.floor(c.h * PX / LH) * LH }))
    const text = story.body.join(' ')
    const opts = { font: BODY + 'px "Noto Sans Devanagari"', lineHeight: LH }, set = flow(text, columns, [], opts), meter = fit(text, columns, [], opts)
    rows.push({ story: story.id, headline: story.headline, chars: story.chars, slot: f.slotId, priority: f.priority, cols: f.cols, fillPct: meter.fillPct, overflowLines: meter.overflowLines, underfillLines: meter.underfillLines })
    const ctx = document.createElement('canvas').getContext('2d'); ctx.font = opts.font
    for (const [i, l] of set.lines.entries()) {
      const s = l.text.trimEnd(), n = (s.match(/ /g) || []).length, ws = n && i < set.lines.length - 1 ? (l.w - ctx.measureText(s).width) / n : 0
      page.append(el('white-space:pre;left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px;word-spacing:' + ws + 'px;font:' + BODY + 'px/' + LH + 'px "Noto Sans Devanagari"', s))
    }
  }
  window.nextStory = next
  document.body.append(page)
  return rows
}
window.size = pagePx
window.ready = Promise.all([document.fonts.load('12px "Noto Sans Devanagari"', 'क'), document.fonts.load('400 28px "Noto Sans Devanagari"', 'क'), document.fonts.load('700 34px "Khand"', 'क')])
`
const bundle = await esbuild.build({ stdin: { contents: code, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const work = path.join(root, 'spike/out'), html = path.join(work, 'demo-templates.html'), dir = path.join(root, 'demos/templates')
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(html, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}">
<style>body{margin:0}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1123, height: 1588 } }), errors = []
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready)
for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f))
const meters = {}
await page.evaluate(() => { window.nextStory = 0 })
for (const t of templates) {
  await page.evaluate(n => window.draw(n, false), t.id)
  await page.screenshot({ path: path.join(dir, `${t.id}-empty.jpg`), type: 'jpeg', quality: 80 })
  meters[t.id] = await page.evaluate(n => window.draw(n, true), t.id)
  await page.screenshot({ path: path.join(dir, `${t.id}-filled.jpg`), type: 'jpeg', quality: 80 })
}
await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const figs = templates.map(t => `<h2>${esc(t.name)}</h2><div class="g"><figure><img src="templates/${t.id}-empty.jpg" alt="${t.id} empty"><figcaption>Empty slots</figcaption></figure><figure><img src="templates/${t.id}-filled.jpg" alt="${t.id} filled"><figcaption>Filled with real copy</figcaption></figure></div>
<table><tr><th>Story slot</th><th>Story</th><th>Characters</th><th>Priority</th><th>Columns</th><th>Fill</th><th>Over</th><th>Under</th></tr>${meters[t.id].map(r => `<tr><td>${esc(r.slot)}</td><td lang="hi">${esc(r.story + ': ' + r.headline)}</td><td>${r.chars}</td><td>${r.priority}</td><td>${r.cols}</td><td>${r.fillPct}%</td><td>${r.overflowLines}</td><td>${r.underfillLines}</td></tr>`).join('')}</table>`).join('\n')
fs.writeFileSync(path.join(root, 'demos/templates.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly templates</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1360px;color:#222;background:#f4f4f4}a{color:#05c}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:10px}@media(max-width:900px){.g{grid-template-columns:1fr}}figure{margin:0}img{width:100%;border:1px solid #ccc;background:#fff}
figcaption{font-size:13px;color:#666}.w{background:#fff3cd;border-left:4px solid #e0b100;padding:8px 12px}table{border-collapse:collapse;background:#fff;width:100%;margin-bottom:24px}td,th{text-align:left;padding:4px 10px;border-bottom:1px solid #e3e3e3}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p>
<h1>Weekly templates (D-049)</h1>
<p class="w">The grid is assumed (A3, 5 columns, GG-007) and the imprint holds placeholders, shown in red. Body is Noto Sans 400. Masthead and headlines are Khand 700 (D-051). Each slot holds a different real story from Janshakti's site, uncut, in fetch order. No auto-pager exists yet, so nothing matches story length to slot. Paragraphs are joined, and headlines sit in a fixed band, because how a story maps to a frame is not settled.</p>
<p><b>Over</b> counts lines of text that did not fit, at the frame's column width. <b>Under</b> counts empty line places left in the frame after the story ends. A short last line counts as used, so Under never counts part of a line, and it is 0 whenever anything is over. It counts body lines only: the headline band, photos and the space between slots are not in it.</p>
${figs}
<p>Rebuild: <code>node scripts/demo-templates.mjs</code>.</p>
</body></html>
`)
console.log(Object.entries(meters).map(([k, v]) => k + ': ' + v.map(r => r.slot + ' ' + r.fillPct + '%').join(', ')).join('\n'))
