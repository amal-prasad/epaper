// Weekly templates through the real buildPage(), frameColumns(), wrapObstacles(), flow() and fit(), in Chromium with real
// Hindi copy. Each row shows one template twice: its empty slots, then the page filled. Grid assumed: presets/newspaper.json.
// Stories are whole and never cut. Each goes to the slot where it fits best, in a simple greedy pass made for this demo only;
// it is not the auto-pager.
// Pages are built once per font set below, so fonts can be compared.
//   node scripts/demo-templates.mjs     writes demos/templates.html and demos/templates-<font>.html, with images beside them
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const preset = read('presets/newspaper.json'), paper = read('papers/janshakti.json')
const NAMES = fs.readdirSync(path.join(root, 'templates')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
const order = n => (/front/.test(n) ? 0 : /inner/.test(n) ? 1 : /back/.test(n) ? 2 : 3)
const templates = NAMES.sort((a, b) => order(a) - order(b) || a.localeCompare(b)).map(n => read(`templates/${n}.json`))
const stories = read('spike/stories/stories.json')
const engine = f => JSON.stringify(path.join(root, 'packages/engine/src', f).replace(/\\/g, '/'))

const code = `
import { flow, fit } from ${engine('flow.js')}
import { buildPage, frameColumns } from ${engine('templates.js')}
import { wrapObstacles } from ${engine('wrap.js')}
import { layoutHeadline } from ${engine('headline.js')}
const PRESET = ${JSON.stringify(preset)}, TEMPLATES = ${JSON.stringify(templates)}, IMPRINT = ${JSON.stringify(paper.imprint)}, STORIES = ${JSON.stringify(stories)}
const INKS = ${JSON.stringify(read('fonts/ink.json'))}, WEIGHT = PRESET.headline.weight
let INK, BODY_FONT, HEAD_FONT, HEAD_FAMILY, opts
const PX = 96 / 25.4, BODY = 12, LH = PRESET.grid.baseline * PX, KICKER_PX = { 1: 22, 2: 16, 3: 14 }
const RED = '#b42318'
window.setFonts = (head, body) => { HEAD_FAMILY = head; INK = INKS[head][WEIGHT]; HEAD_FONT = '"' + head + '"'; BODY_FONT = '"' + body + '"'; opts = { font: BODY + 'px ' + BODY_FONT, lineHeight: LH } }
const el = (css, text) => { const e = document.createElement('div'); e.style.cssText = 'position:absolute;box-sizing:border-box;' + css; if (text != null) e.textContent = text; return e }
const box = b => 'left:' + b.x * PX + 'px;top:' + b.y * PX + 'px;width:' + b.w * PX + 'px;height:' + b.h * PX + 'px;'
const toPx = o => ({ ...o, x: o.x * PX, y: o.y * PX, w: o.w * PX, h: o.h * PX, wrap: { ...o.wrap, offset: Object.fromEntries(Object.entries(o.wrap.offset).map(([k, v]) => [k, v * PX])) } })
const LABEL = { photo: 'फोटो', masthead: 'मास्टहेड', imprint: 'प्रिंट लाइन', ad: 'विज्ञापन', ear: 'इयर', strip: 'पट्टी', folio: 'फोलियो', kicker: 'कीकर', headline: 'शीर्षक', byline: 'बाइलाइन', inset: 'फोटो', caption: 'कैप्शन', hero: 'बड़ी फोटो', cutout: 'कटआउट', section: 'सेक्शन पट्टी', sectionLabel: 'सेक्शन', quote: 'उद्धरण' }
const clip = o => (o.wrap.polygon ? 'clip-path:polygon(' + o.wrap.polygon.map(([x, y]) => (x * 100).toFixed(1) + '% ' + (y * 100).toFixed(1) + '%').join(',') + ');' : '')
const PHOTO = 'background:linear-gradient(135deg,#6a8caf,#c9a46b 60%,#5d7a4a);'
const layoutOf = (frame, objects) => {
  const columns = frameColumns(toPx(Object.assign({ wrap: { offset: {} } }, frame, { gutter: frame.gutter * PX }))).map(c => ({ ...c, h: Math.floor(c.h / LH + 1e-6) * LH }))
  const obstacles = wrapObstacles(objects.filter(o => o.frameId === frame.id).map(toPx), columns, { lineHeight: LH })
  return { columns, obstacles }
}
const used = new Set()
const pick = (frame, objects) => {
  const { columns, obstacles } = layoutOf(frame, objects)
  let best = null
  for (const s of STORIES) {
    if (used.has(s.id)) continue
    const m = fit(s.body.join(' '), columns, obstacles, opts)
    const score = Math.abs(m.fillPct - 98) + (m.overflowLines ? 40 : 0)
    if (!best || score < best.score) best = { s, m, score }
  }
  used.add(best.s.id)
  return { ...best, columns, obstacles }
}
function drawObject(page, o, headline, section) {
  const r = o.style.role
  if (r === 'ear') page.append(el(box(o) + 'border:1px solid #333;padding:3px;background:linear-gradient(160deg,#27406b,#c9783b)'))
  if (r === 'masthead') page.append(el(box(o) + 'display:flex;align-items:center;justify-content:center;font:700 88px/1 ' + HEAD_FONT, 'जनशक्ति उजाला'))
  if (r === 'strip') page.append(el(box(o) + 'background:#17457e;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:0 12px;font:400 12px ' + BODY_FONT, 'वर्ष: [वर्ष]   अंक: [अंक]   ·   [स्थान], [तारीख]   ·   पेज: [पेज]   मूल्य: [मूल्य]'))
  if (r === 'folio') page.append(el(box(o) + 'background:#f7e14a;border-top:2px solid #111;display:flex;justify-content:space-between;align-items:center;padding:0 12px;font:400 16px ' + BODY_FONT, '[पेज]  ' + section + '   ·   जनशक्ति उजाला   ·   [तारीख]'))
  if (r === 'imprint') page.append(el(box(o) + 'border-top:1px solid #111;padding-top:5px;text-align:center;font:400 12px/17px ' + BODY_FONT + ';color:' + RED, 'स्वामी: ' + IMPRINT.owner + ', मुद्रक: ' + IMPRINT.printer + ', ' + IMPRINT.placeOfPrinting + ' से मुद्रित एवं प्रकाशक: ' + IMPRINT.publisher + ', ' + IMPRINT.placeOfPublication + ' से प्रकाशित। (' + IMPRINT.registrationNo + '), संपादक: ' + IMPRINT.editor + ', मोबाइल: ' + IMPRINT.mobile + ', ईमेल: ' + IMPRINT.email + ' (न्याय क्षेत्र: ' + IMPRINT.jurisdiction + ')'))
  if (r === 'ad') page.append(el(box(o) + 'border:1px solid #333;display:flex;align-items:center;justify-content:center;background:#fafafa;font:400 18px ' + BODY_FONT + ';color:#777', 'विज्ञापन'))
  if (r === 'inset') page.append(el(box(o) + PHOTO + clip(o)))
  if (r === 'hero') page.append(el(box(o) + 'background:linear-gradient(120deg,#0d3b66,#2a9d8f 45%,#e9c46a 80%,#f4a261)'))
  if (r === 'sectionLabel') page.append(el(box(o) + 'background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;padding:0 12px;font:700 24px ' + HEAD_FONT, section || 'देश विदेश'))
  if (r === 'cutout') page.append(el(box(o) + 'background:linear-gradient(170deg,#7a3e9d,#d1495b 70%,#edae49);' + clip(o)))
  if (r === 'section') page.append(el(box(o) + 'background:#b42318;color:#fff;display:flex;align-items:center;padding:0 12px;font:700 22px ' + HEAD_FONT, section || 'खास खबरें'))
  if (r === 'quote') page.append(el(box(o) + 'border-top:3px solid ' + RED + ';border-bottom:1px solid #999;display:flex;align-items:center;padding:6px;font:400 15px/1.35 ' + BODY_FONT + ';color:' + RED, '“ [उद्धरण] ”'))
  if (r === 'caption') page.append(el(box(o) + 'font:400 10px/14px ' + BODY_FONT + ';color:' + RED, '[फोटो कैप्शन]'))
}
window.draw = (name, filled, section) => {
  const t = TEMPLATES.find(x => x.id === name), { frames, objects } = buildPage(t, PRESET, { pageId: 'p', orgId: 'o' }), rows = []
  document.body.textContent = ''
  const page = el('position:relative;background:#fff;overflow:hidden;width:' + PRESET.page.w * PX + 'px;height:' + PRESET.page.h * PX + 'px')
  if (!filled) {
    for (const f of frames) page.append(el(box(f) + 'border:2px solid #1a7f37;background:#eef8f0;font:400 18px sans-serif;color:#1a7f37;padding:6px;text-align:right', 'पाठ · प्राथमिकता ' + f.priority + ' · ' + f.cols + ' कॉलम'))
    for (const o of objects) page.append(el(box(o) + 'border:2px dashed #6a8caf;background:#eef3f8;font:400 15px sans-serif;color:#345;padding:3px', LABEL[o.style.role]))
    document.body.append(page)
    return rows
  }
  used.clear()      // each page has different stories; stories can repeat from page to page, since the pool is 24
  for (const f of frames) if (f.boxed) page.append(el(box(f) + 'background:#fbeee0'))
  for (const o of objects) drawObject(page, o, null, section)
  for (const f of [...frames].sort((a, b) => a.priority - b.priority)) {
    const { s, m, columns, obstacles } = pick(f, objects), text = s.body.join(' ')
    const part = role => objects.find(o => o.slotId === f.slotId && o.style.role === role)
    if (part('kicker')) page.append(el(box(part('kicker')) + 'font:400 ' + KICKER_PX[f.priority] + 'px/1.3 ' + BODY_FONT + ';color:' + RED, '[कीकर]'))
    const space = part('headline'), head = layoutHeadline(s.headline, { family: HEAD_FAMILY, weight: WEIGHT, sizes: PRESET.headline.sizes[f.priority], width: space.w * PX, height: space.h * PX, ink: INK })
    // Each line sits at the baseline the engine chose. Nothing is clipped; a headline that fits at no size is flagged in the table.
    const lift = (head.pitch - (INK.ascent + INK.descent) * head.size) / 2 + INK.ascent * head.size
    for (const l of head.lines) page.append(el('white-space:pre;left:' + space.x * PX + 'px;top:' + (space.y * PX + l.baseline - lift) + 'px;font:' + WEIGHT + ' ' + head.size + 'px/' + head.pitch + 'px ' + HEAD_FONT + (head.fits ? '' : ';color:' + RED), l.text))
    if (part('byline')) page.append(el(box(part('byline')) + 'font:italic 400 11px/1.5 ' + BODY_FONT + ';color:' + RED, '[बाइलाइन]'))
    const set = flow(text, columns, obstacles, opts)
    rows.push({ headSize: head.size, headFits: head.fits, story: s.id, headline: s.headline, chars: s.chars, slot: f.slotId, priority: f.priority, cols: f.cols, fillPct: m.fillPct, overflowLines: m.overflowLines, underfillLines: m.underfillLines })
    const ctx = document.createElement('canvas').getContext('2d'); ctx.font = opts.font
    for (const [i, l] of set.lines.entries()) {
      const str = l.text.trimEnd(), n = (str.match(/ /g) || []).length, ws = n && !l.align && i < set.lines.length - 1 ? (l.w - ctx.measureText(str).width) / n : 0
      page.append(el('white-space:pre;left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px;word-spacing:' + ws + 'px;font:' + BODY + 'px/' + LH + 'px ' + BODY_FONT, str))
    }
  }
  document.body.append(page)
  return rows
}
window.loadFonts = () => Promise.all([document.fonts.load('12px ' + BODY_FONT, 'क'), document.fonts.load('italic 11px ' + BODY_FONT, 'क'), document.fonts.load(WEIGHT + ' 40px ' + HEAD_FONT, 'क')])
window.ready = 1
`
const bundle = await esbuild.build({ stdin: { contents: code, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const work = path.join(root, 'spike/out'), html = path.join(work, 'demo-templates.html')
fs.mkdirSync(work, { recursive: true })
fs.writeFileSync(html, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}">
<style>body{margin:0}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] }), page = await browser.newPage({ viewport: { width: 1123, height: 1588 } }), errors = []
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready)
const SECTION = n => (/ads/.test(n) ? 'विज्ञापन' : /back/.test(n) ? 'देश विदेश' : /inner/.test(n) ? 'प्रदेश' : 'खास खबर')
// The first set is the main page. Others show filled story pages only, to keep the repository small.
const SETS = [
  { slug: '', label: 'Khand + Noto Sans', head: 'Khand', body: 'Noto Sans Devanagari', note: 'Khand 700 is approved for headlines (D-051).' },
  { slug: 'noto-sans', label: 'Noto Sans', head: 'Noto Sans Devanagari', body: 'Noto Sans Devanagari', note: 'For comparison: only Khand 700 is approved for headlines so far (D-051).' },
  { slug: 'noto-serif', label: 'Noto Serif', head: 'Noto Serif Devanagari', body: 'Noto Serif Devanagari', note: 'For comparison: only Khand 700 is approved for headlines so far (D-051).' },
  { slug: 'eczar', label: 'Eczar + Noto Serif', head: 'Eczar', body: 'Noto Serif Devanagari', note: 'For comparison: only Khand 700 is approved for headlines so far (D-051). Eczar is the tallest font measured, so more headlines step down or fail to fit.' },
  { slug: 'halant', label: 'Halant', head: 'Halant', body: 'Halant', note: 'Halant is not a launch font and no gate runs on it (D-052). Its bold had a CAVEAT on halant breaks, at 98.8% (D-048).' },
]
const INKS = read('fonts/ink.json'), results = []
for (const set of SETS) {
  const name = set.slug ? `templates-${set.slug}` : 'templates', dir = path.join(root, 'demos', name), meters = {}
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  await page.evaluate(([h, b]) => { window.setFonts(h, b); return window.loadFonts() }, [set.head, set.body])
  const shown = set.slug ? templates.filter(t => t.slots.some(s => s.kind === 'story')) : templates
  for (const t of shown) {
    if (!set.slug) {
      await page.evaluate(n => window.draw(n, false, ''), t.id)
      await page.screenshot({ path: path.join(dir, `${t.id}-empty.jpg`), type: 'jpeg', quality: 80 })
    }
    meters[t.id] = await page.evaluate(([n, s]) => window.draw(n, true, s), [t.id, SECTION(t.id)])
    await page.screenshot({ path: path.join(dir, `${t.id}-filled.jpg`), type: 'jpeg', quality: set.slug ? 72 : 80 })
  }
  results.push({ set, name, shown, meters })
}
await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const table = rows => rows.length ? `<table><tr><th>Story slot</th><th>Story</th><th>Characters</th><th>Priority</th><th>Headline</th><th>Text columns</th><th>Fill</th><th>Over</th><th>Under</th></tr>${rows.map(r => `<tr><td>${esc(r.slot)}</td><td lang="hi">${esc(r.story + ': ' + r.headline)}</td><td>${r.chars}</td><td>${r.priority}</td><td>${r.headSize} px${r.headFits ? '' : ', does not fit'}</td><td>${r.cols}</td><td>${r.fillPct}%</td><td>${r.overflowLines}</td><td>${r.underfillLines}</td></tr>`).join('')}</table>` : '<p>No stories on this page.</p>'
const nav = current => '<p><b>Fonts:</b> ' + results.map(r => (r === current ? `<b>${esc(r.set.label)}</b>` : `<a href="${r.name}.html">${esc(r.set.label)}</a>`)).join(' &middot; ') + '</p>'
for (const result of results) {
const { set, name, shown, meters } = result
const allRows = Object.values(meters).flat(), bad = allRows.filter(r => !r.headFits).length, sizes = allRows.map(r => r.headSize)
const bodyInk = INKS[set.body]?.[400], bodyLeading = preset.grid.baseline * 96 / 25.4 / 12, bodyInkHeight = bodyInk ? bodyInk.top + bodyInk.bottom : 0
const fontFacts = `<p><b>This page:</b> headlines ${esc(set.head)} 700, body ${esc(set.body)} 400. ${esc(set.note)}</p>
<p>Across these ${allRows.length} story slots, ${bad} ${bad === 1 ? 'headline fits' : 'headlines fit'} at no size, and the average headline size is ${(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)} px. Body leading is ${bodyLeading.toFixed(2)} em and this font's ink is ${bodyInkHeight.toFixed(2)} em tall${bodyLeading < bodyInkHeight ? ', so <b>body lines can touch</b> at this size' : ''}.</p>`
const figs = shown.map(t => `<h2>${esc(t.name)}</h2><div class="g">${set.slug ? '' : `<figure><img src="${name}/${t.id}-empty.jpg" alt="${t.id} empty"><figcaption>Empty slots</figcaption></figure>`}<figure><img src="${name}/${t.id}-filled.jpg" alt="${t.id} filled"><figcaption>Filled with real copy</figcaption></figure></div>${table(meters[t.id])}`).join('\n')
fs.writeFileSync(path.join(root, `demos/${name}.html`), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Weekly templates</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1360px;color:#222;background:#f4f4f4}a{color:#05c}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:10px}@media(max-width:900px){.g{grid-template-columns:1fr}}figure{margin:0}img{width:100%;border:1px solid #ccc;background:#fff}
figcaption{font-size:13px;color:#666}.w{background:#fff3cd;border-left:4px solid #e0b100;padding:8px 12px}table{border-collapse:collapse;background:#fff;width:100%;margin-bottom:24px}td,th{text-align:left;padding:4px 10px;border-bottom:1px solid #e3e3e3}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p>
<h1>Weekly templates: 12 layouts (D-058, D-059, D-060)</h1>
${nav(result)}
${fontFacts}
<p>Page structure comes from Janshakti's printed pages. The variety comes from studying how another daily lays out its pages: layout patterns only, none of its content or images. Patterns used: a big photo across the top with the section name on it, cut-outs beside the masthead and in stories with text following the outline, photos left, right, round and in the middle of the text, tinted panels, quotes, side rails, section bands, a half-page ad, and small classified ads.</p>
<p class="w">The grid is assumed (A3, 6 columns, GG-007). Red text marks placeholders: print line, kicker, byline, caption, quote, and the issue details. Photos and ads are empty colour boxes, cut-outs are a stand-in head-and-shoulders outline until real images bring their own, and there is no real logo. The colours only echo the printed pages and are not decided for print.</p>
<p>On each page, each story slot holds a different real story from Janshakti's site, uncut; stories can repeat between pages, since the pool is 24. A simple greedy pass made only for this demo gives each slot the unused story that fits best. It is not the auto-pager. Paragraphs are joined, so real pages will run slightly longer.</p>
<p><b>Headlines</b> are never clipped. Line spacing comes from each font's measured ink, and the size steps down until the headline fits. The table shows the size used; a headline that fits at no size turns red and says so. A one-line headline still leaves space below it, because the text does not rise yet.</p>
<p><b>Over</b> counts lines of text that did not fit, at the frame's column width. <b>Under</b> counts empty line places left in the frame after the story ends. A short last line counts as used, so Under never counts part of a line, and it is 0 whenever anything is over. It counts body lines only.</p>
${figs}
<p>Rebuild: <code>node scripts/demo-templates.mjs</code>.</p>
</body></html>
`)
console.log(`${set.label.padEnd(20)} ${allRows.length} slots, ${bad} headlines do not fit, average ${(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(1)} px, body leading ${bodyLeading.toFixed(2)} vs ink ${bodyInkHeight.toFixed(2)}`)
}
