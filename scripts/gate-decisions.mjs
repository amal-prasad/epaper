// Demo for Amal's gate-review decisions (2026-10-29): the justify experiment (word spaces 0.8-1.33x, then +-2% glyph
// scaling, no letter-spacing), plus the results of the other three items read from their own output files:
//   spike/out/export.json   node scripts/measure-export.mjs   (G0.speed, G0.pdfpos)
//   spike/out/coverage.json node scripts/font-coverage.mjs    (font coverage)
//   scratch/outlier/result.json and demos/gate-decisions/outlier-raster.png (one-off raster of the PDF outlier line)
//   node scripts/gate-decisions.mjs     writes demos/gate-decisions.html and demos/gate-decisions/justify-*.png
// The experiment re-breaks lines with its own greedy breaker over words (flow() breaks at 1.0x only); the page reports
// how often that breaker at 1.0x reproduces flow()'s lines, so the before/after comparison can be trusted.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const work = path.join(root, 'scratch/gate-decisions'), demoDir = path.join(root, 'demos/gate-decisions')
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(demoDir, { recursive: true })
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const exp = readJson('spike/out/export.json'), cov = readJson('spike/out/coverage.json'), outlier = readJson('scratch/outlier/result.json')

const paras = fs.readdirSync(path.join(root, 'spike/samples')).filter(f => f.endsWith('.txt'))
  .flatMap(f => fs.readFileSync(path.join(root, 'spike/samples', f), 'utf8').split(/\n\s*\n/))
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40)

const browserCode = `
import { flow } from ${JSON.stringify(path.join(root, 'packages/engine/src/flow.js').replace(/\\/g, '/'))}
const PARAS = ${JSON.stringify(paras)}
const FAMILY = '"Noto Sans Devanagari"'
const font = px => px + 'px ' + FAMILY
const ctx = document.createElement('canvas').getContext('2d')
const measure = (t, px) => { ctx.font = font(px); return ctx.measureText(t).width }
const mm = x => x * 96 / 25.4
const colW = cols => (mm(297) - 2 * mm(12) - (cols - 1) * mm(4)) / cols

// One justified line: words width at glyph scale s, space ratio = actual space / natural space.
const setLine = (words, w, px, sp, glyph) => {
  const text = words.join(' '), n = words.length - 1, ww = measure(text, px) - n * sp
  if (!n) return { text, n, ww, s: 1, ratio: null }
  let s = 1
  const ratio = s => (w - s * ww) / n / sp
  if (glyph && ratio(1) > 1.33) s = Math.min(1.02, (w - 1.33 * n * sp) / ww)
  if (glyph && ratio(1) < 0.8) s = Math.max(0.98, (w - 0.8 * n * sp) / ww)
  return { text, n, ww, s, ratio: ratio(s) }
}
// Greedy over words: a line fits if its words (at the smallest glyph scale) plus n spaces at minSpace fit the column.
const breakPara = (para, w, px, minSpace, glyph) => {
  const words = para.split(' '), sp = measure(' ', px), wid = words.map(x => measure(x, px)), minS = glyph ? 0.98 : 1
  const lines = []; let cur = [], cw = 0
  for (let i = 0; i < words.length; i++) {
    const add = cur.length ? minS * (cw + wid[i]) + cur.length * minSpace * sp : minS * wid[i]
    if (cur.length && add > w + 1e-6) { lines.push(cur); cur = [words[i]]; cw = wid[i] } else { cur.push(words[i]); cw += wid[i] }
  }
  if (cur.length) lines.push(cur)
  return lines.map((l, i) => i === lines.length - 1 ? { text: l.join(' '), last: true } : { ...setLine(l, w, px, sp, glyph), last: false })
}
window.run = (cols, px, lh) => {
  const w = colW(cols), sp = measure(' ', px), out = { cols, px, w, before: [], same: 0, total: 0, spaces: [], glyph: [] }
  PARAS.forEach((para, pi) => {
    const fl = flow(para, [{ id: 'c', x: 0, y: 0, w, h: 1e6 }], [], { font: font(px), lineHeight: lh }).lines.map(l => l.text.trimEnd())
    const mine = breakPara(para, w, px, 1, false).map(l => l.text)
    out.total += fl.length; out.same += fl.filter((t, i) => t === mine[i]).length
    fl.slice(0, -1).forEach(t => out.before.push({ pi, ...setLine(t.split(' '), w, px, sp, false) }))
    breakPara(para, w, px, 0.8, false).filter(l => !l.last).forEach(l => out.spaces.push({ pi, ...l }))
    breakPara(para, w, px, 0.8, true).filter(l => !l.last).forEach(l => out.glyph.push({ pi, ...l }))
  })
  out.beforeLinesAll = PARAS.reduce((a, p) => a + flow(p, [{ id: 'c', x: 0, y: 0, w, h: 1e6 }], [], { font: font(px), lineHeight: lh }).lines.length, 0)
  out.spacesLinesAll = PARAS.reduce((a, p) => a + breakPara(p, w, px, 0.8, false).length, 0)
  out.glyphLinesAll = PARAS.reduce((a, p) => a + breakPara(p, w, px, 0.8, true).length, 0)
  return out
}
const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e }
// A justified line as print would draw it: the line is set at width w/s with word-spacing, then scaled by s horizontally.
const lineEl = (l, w, px, lh) => {
  const sp = measure(' ', px), extra = l.n ? (w / l.s - l.ww - l.n * sp) / l.n : 0
  return el('div', 'white-space:pre;font:' + font(px) + ';line-height:' + lh + 'px;width:' + (w / l.s) + 'px;word-spacing:' + extra + 'px;transform:scaleX(' + l.s + ');transform-origin:0 0', l.text)
}
window.showLines = (items, w, px, lh) => {
  document.body.innerHTML = ''
  items.forEach((it, i) => {
    const box = el('div', 'display:inline-block;margin:8px;padding:8px;background:#fff;border:1px solid #ccc'); box.id = 'l' + i
    const inner = el('div', 'width:' + w + 'px;outline:1px dashed #9bd'); inner.append(lineEl(it, w, px, lh)); box.append(inner)
    document.body.append(box)
  })
}
// One column of whole paragraphs, set three ways side by side, for judging texture by eye.
window.showColumns = (sets, w, px, lh) => {
  document.body.innerHTML = ''
  const row = el('div', 'display:flex;gap:24px;padding:12px;background:#fff'); row.id = 'cols'
  for (const [label, paras] of sets) {
    const col = el('div', 'width:' + w + 'px'); col.append(el('div', 'font:12px system-ui;color:#666;margin-bottom:6px', label))
    for (const lines of paras) { for (const l of lines) col.append(l.last ? el('div', 'white-space:pre;font:' + font(px) + ';line-height:' + lh + 'px', l.text) : lineEl(l, w, px, lh)); col.append(el('div', 'height:' + lh / 2 + 'px')) }
    row.append(col)
  }
  document.body.append(row)
}
window.paraLines = (pis, cols, px, lh) => {
  const w = colW(cols), sp = measure(' ', px)
  const before = pis.map(pi => { const t = flow(PARAS[pi], [{ id: 'c', x: 0, y: 0, w, h: 1e6 }], [], { font: font(px), lineHeight: lh }).lines.map(l => l.text.trimEnd()); return t.map((x, i) => i === t.length - 1 ? { text: x, last: true } : { ...setLine(x.split(' '), w, px, sp, false), last: false }) })
  return { w, sets: [['before: flow() today', before], ['spaces 0.8-1.33x', pis.map(pi => breakPara(PARAS[pi], w, px, 0.8, false))], ['spaces 0.8-1.33x + glyphs 98-102%', pis.map(pi => breakPara(PARAS[pi], w, px, 0.8, true))]] }
}
window.ready = document.fonts.load(font(12), PARAS[0])
`
const bundle = await esbuild.build({ stdin: { contents: browserCode, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const pagePath = path.join(work, 'page.html')
fs.writeFileSync(pagePath, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="../../spike/public/fonts.css">
<style>html,body{margin:0;background:#f4f4f4}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)

const browser = await chromium.launch(), errors = []
const bp = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })
bp.on('pageerror', e => errors.push(e.message)); bp.on('console', m => m.type() === 'error' && errors.push(m.text()))
await bp.goto(pathToFileURL(pagePath).href); await bp.waitForFunction(() => window.ready); await bp.evaluate(() => window.ready)

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
const stats = (rows, all) => {
  const r = rows.filter(x => x.ratio != null).map(x => x.ratio)
  return { lines: all, median: +q(r, 0.5).toFixed(2), p95: +q(r, 0.95).toFixed(2), p99: +q(r, 0.99).toFixed(2), max: +Math.max(...r).toFixed(2),
    over133: r.filter(x => x > 1.33 + 1e-9).length, over2: r.filter(x => x > 2).length, over3: r.filter(x => x > 3).length, over4: r.filter(x => x > 4).length }
}
const configs = [[4, 12, 15], [5, 12, 15], [6, 12, 15], [4, 13.33, 16.5], [5, 13.33, 16.5], [6, 13.33, 16.5]]
const table = []
let ref
for (const [cols, px, lh] of configs) {
  const r = await bp.evaluate(([c, p, l]) => window.run(c, p, l), [cols, px, lh])
  table.push({ cols, pt: +(px * 0.75).toFixed(1), colMm: +(r.w * 25.4 / 96).toFixed(1), identical: +(100 * r.same / r.total).toFixed(1),
    before: stats(r.before, r.beforeLinesAll), spaces: stats(r.spaces, r.spacesLinesAll), glyph: stats(r.glyph, r.glyphLinesAll),
    glyphScaled: r.glyph.filter(x => x.s !== 1).length, glyphRows: r.glyph.filter(x => x.ratio != null).length })
  if (cols === 5 && px === 12) ref = r
}
const worstOf = rows => rows.filter(x => x.ratio != null).sort((a, b) => b.ratio - a.ratio).slice(0, 5)
const worstBefore = worstOf(ref.before), worstAfter = worstOf(ref.glyph)
for (const [name, items] of [['before', worstBefore], ['after', worstAfter]]) {
  await bp.evaluate(([it, w]) => window.showLines(it, w, 12, 15), [items, ref.w])
  for (let i = 0; i < items.length; i++) await bp.locator('#l' + i).screenshot({ path: path.join(demoDir, `justify-${name}-${i + 1}.png`) })
}
// paragraphs holding the 3 worst lines before, set three ways
const pis = [...new Set(worstBefore.map(x => x.pi))].slice(0, 3)
const pl = await bp.evaluate(([p]) => window.paraLines(p, 5, 12, 15), [pis])
await bp.evaluate(([s, w]) => window.showColumns(s, w, 12, 15), [pl.sets, pl.w])
await bp.locator('#cols').screenshot({ path: path.join(demoDir, 'justify-columns.png') })
await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }
fs.writeFileSync(path.join(work, 'justify.json'), JSON.stringify({ date: new Date().toISOString(), table, worstBefore, worstAfter }, null, 1))
console.log(JSON.stringify(table, null, 1))

// ---- page
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const row = cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
const t5 = table.find(t => t.cols === 5 && t.pt === 9)
const fig = (src, cap, alt) => `<figure style="margin:0"><img src="gate-decisions/${src}" alt="${esc(alt)}"><figcaption>${cap}</figcaption></figure>`
const missingRows = cov.results.map(r => row([esc(r.family), r.weight, r.missing.length, r.missing.map(m => `${m.cp} ${esc(m.ch)} (${esc(m.reason)})`).join('<br>') || '-']))
fs.writeFileSync(path.join(root, 'demos/gate-decisions.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gate decisions</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1150px;color:#222;background:#f4f4f4}a{color:#05c}
table{border-collapse:collapse;background:#fff;margin:8px 0 16px}td,th{text-align:left;padding:5px 10px;border-bottom:1px solid #e3e3e3}
th.g{border-left:2px solid #ccc}td:nth-child(5),td:nth-child(10),td:nth-child(15){border-left:2px solid #ccc}
.p{background:#eef6ff;border-left:4px solid #05c;padding:8px 12px}.w{background:#fff3cd;border-left:4px solid #e0b100;padding:8px 12px}
.lines{display:flex;flex-wrap:wrap;gap:12px}.lines img{width:420px;max-width:100%;border:1px solid #ccc;background:#fff}img.big{max-width:100%;border:1px solid #ccc}</style></head>
<body><p><a href="index.html">&larr; all demos</a> · proposals were on <a href="gate-review.html">gate review</a></p>
<h1>Gate review decisions</h1>
<p>Amal's decisions of 2026-10-29, carried out. Real copy: ${paras.length} Janshakti paragraphs, Noto Sans Devanagari, headless Chromium. Grid assumed (A3, 12 mm margins, 4 mm gutter; GG-007).</p>

<h2>1. G0.speed added: median &le; 30 ms</h2>
<p>Gate run (<code>node scripts/measure-export.mjs</code>, ${exp.date.slice(0, 16).replace('T', ' ')} UTC): median <b>${exp.speedMedianMs} ms</b>, 95th pct ${exp.speedP95Ms} ms, ${exp.speedRuns} runs, ${exp.speedLines} lines set.
Guard added: at least 400 lines placed, so a flow() that places nothing cannot pass by being fast.</p>

<h2>2. G0.pdfpos: the 5.264 pt outlier is not real; gate added</h2>
<p>The outlier line <i>${esc(outlier.outlier.text)}</i> read back from the PDF ${'5.26 pt short of'} the column's right edge (the gate-review page wrongly said "past"). Rasterised from the same PDF with pdf.js at 4x:</p>
<table><tr><th>Check over all ${outlier.lines} justified lines</th><th>Result</th></tr>
${row(['Ink right edge minus flow() right edge, raster', `min ${outlier.inkMin.toFixed(3)} pt, median ${outlier.inkMedian.toFixed(3)} pt, max ${outlier.inkMax.toFixed(3)} pt`])}
${row(['The outlier line, raster', `${outlier.outlier.ink.toFixed(3)} pt (the median: normal side bearing)`])}
${row(['Text right edge in the DOM before printing', `${outlier.domMin.toFixed(3)} to ${outlier.domMax.toFixed(3)} pt from flow()'s edge; outlier ${outlier.outlier.dom.toFixed(3)} pt`])}</table>
<p>${fig('outlier-raster.png', 'The outlier line (blue box) rasterised from the PDF; red = flow() right edge. Its ink ends where its neighbours\' does.', 'outlier raster')}</p>
<p>No line's ink passes the edge (worst +${outlier.inkMax.toFixed(3)} pt), so there is no bug to fix: the 5 pt was pdf.js giving the conjunct ष्ट a wrong width in text extraction. The lines that end furthest inside (about 1.3 pt) all end in । , whose glyph has a wide right side bearing.</p>
<table><tr><th>G0.pdfpos check (gate run)</th><th>Result</th><th>Need</th></tr>
${row(['Left edge, lines whose first glyph reads back', `max ${exp.pdfMaxLeftPt} pt over ${exp.pdfLeftCheckedPct}% of lines`, '&le; 0.1 pt; at least 90% checked'])}
${row(['Baseline spread (PDF baseline minus flow() line top)', `${exp.pdfBaselineSpreadPt} pt (offset ${exp.pdfBaselineOffsetPt} pt on every line)`, '&le; 0.1 pt'])}
${row(['Justified right edge, 95th pct', `${exp.pdfRightP95Pt} pt over ${exp.pdfRightCheckedPct}% of justified lines; worst ${exp.pdfRightMaxPt} pt (the pdf.js artefact above, reported only)`, '&le; 0.1 pt; at least 75% checked'])}
${row(['Fonts', `${exp.pdfFonts} fonts, ${exp.pdfFontsNotEmbedded} not embedded, ${exp.pdfFontsNotSubset} not subset`, 'all embedded and subset; at least 2 found'])}
${row(['Lines missing from the PDF', `${exp.pdfMissingLines} of ${exp.pdfLines}`, '0'])}</table>
<p class="w">The 95th percentile cannot catch one bad line: a single real 5 pt overshoot would pass. And the gate checks this measurement script's renderer, because no export module exists yet. Both are in <a href="gate-gaps.html">gate gaps</a> (GG-018, GG-019).</p>

<h2>3. Justify, cheap first (no gate; judge by eye)</h2>
<p>Lines are re-broken greedily over words. A line fits if its words plus its spaces at 0.8x fit the column; the spare width is then shared by the spaces.
"+ glyphs" also lets a line fit with words at 98% width, and scales a line's glyphs between 98% and 102% to bring its spaces inside 0.8-1.33x before stretching them further. No letter-spacing.
Check of the breaker: at 1.0x it reproduces ${t5.identical}% of flow()'s lines on the reference grid (all grids: ${table.map(t => t.identical + '%').join(', ')}).</p>
<p class="w">Adopting this means changing how flow() breaks lines (it fits at 1.0x today), and export must draw glyph scaling (here CSS <code>transform: scaleX</code>). That is a task to plan, not done here.</p>
<table><tr><th>Columns</th><th>Body</th><th>Column</th><th></th><th>Lines</th><th>Median</th><th>95th</th><th>99th</th><th>Worst</th><th>&gt;1.33x</th><th>&gt;2x</th><th>&gt;3x</th><th>&gt;4x</th></tr>
${table.flatMap(t => [['before: flow() today', t.before], ['spaces 0.8-1.33x', t.spaces], ['+ glyphs 98-102%', t.glyph]].map(([k, s], i) =>
  `<tr${i === 0 ? ' style="border-top:2px solid #999"' : ''}><td>${i ? '' : t.cols}</td><td>${i ? '' : t.pt + ' pt'}</td><td>${i ? '' : t.colMm + ' mm'}</td><td>${k}</td><td>${s.lines}</td><td>${s.median}</td><td>${s.p95}</td><td>${s.p99}</td><td>${s.max}</td><td>${s.over133}</td><td>${s.over2}</td><td>${s.over3}</td><td>${s.over4}</td></tr>`)).join('\n')}</table>
<p>Lines = all lines set (compression fits more per line). Ratios count every line except a paragraph's last. With glyphs, ${t5.glyphScaled} of ${t5.glyphRows} lines on the reference grid are scaled.</p>
<h3>Reference grid (5 columns, 9 pt): the 5 worst lines before</h3>
<div class="lines">${worstBefore.map((w, i) => fig(`justify-before-${i + 1}.png`, `${w.ratio.toFixed(2)}x, ${w.n} spaces`, w.text)).join('')}</div>
<h3>The 5 worst lines after (spaces 0.8-1.33x + glyphs 98-102%)</h3>
<div class="lines">${worstAfter.map((w, i) => fig(`justify-after-${i + 1}.png`, `${w.ratio.toFixed(2)}x, ${w.n} spaces, glyphs ${(w.s * 100).toFixed(1)}%`, w.text)).join('')}</div>
<h3>Whole paragraphs, set three ways</h3>
<p>The ${pis.length} paragraphs that hold the worst lines before.</p>
<img class="big" src="gate-decisions/justify-columns.png" alt="paragraphs before and after">

<h2>4. Font coverage of real copy</h2>
<p><code>node scripts/font-coverage.mjs</code>: every one of the ${cov.characters} distinct characters in ${cov.copyChars} characters of copy, against each launch font and weight.
A character counts only if a face's <code>unicode-range</code> includes it and that served .woff2 has it in its cmap.</p>
<table><tr><th>Font</th><th>Weight</th><th>Missing</th><th>Characters</th></tr>${missingRows.join('')}</table>
<p class="p">No character in today's copy falls back. The copy is narrow (92 characters: no ₹, curly double quotes, dashes, %, ZWJ/ZWNJ or nukta forms).
Checked separately with 50 common news characters added (₹ “ ” — – … % • ° × ½ | ॐ ऑ ॉ ॰ ऍ ॅ nukta letters ॥ । Devanagari digits ZWJ ZWNJ € @ # &amp; * / : ? ! " ' + = &lt; &gt; [ ] _): only <b>½</b> is missing (in the Latin face's range, not in its cmap; Chromium falls back). Same result for the headline fonts Khand, Eczar, Rozha One and Kalam on the real copy: 0 missing.</p>
</body></html>
`)
console.log('wrote demos/gate-decisions.html')
