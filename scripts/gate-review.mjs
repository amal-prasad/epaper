// Gate review measurements (proposal only, no gates changed): justify stretch, PDF line positions + fonts, flow() speed.
// Runs flow() in headless Chromium with the real bundled font (Noto Sans Devanagari), the same way export would.
//   node scripts/gate-review.mjs      writes scratch/gate-review/results.json, page.pdf and demos/gate-review.html
// Needs pdfjs-dist in scratch/tools (npm install --prefix scratch/tools pdfjs-dist@4.10.38); not a repo dependency yet.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const work = path.join(root, 'scratch/gate-review'), demoDir = path.join(root, 'demos/gate-review')
fs.mkdirSync(work, { recursive: true }); fs.rmSync(demoDir, { recursive: true, force: true }); fs.mkdirSync(demoDir, { recursive: true })
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const pdfjs = await import(pathToFileURL(path.join(root, 'scratch/tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href)

const paras = fs.readdirSync(path.join(root, 'spike/samples')).filter(f => f.endsWith('.txt'))
  .flatMap(f => fs.readFileSync(path.join(root, 'spike/samples', f), 'utf8').split(/\n\s*\n/))
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40)

// ---- browser side: flow(), measurement and rendering, bundled with the real flow.js
const browserCode = `
import { flow } from ${JSON.stringify(path.join(root, 'packages/engine/src/flow.js').replace(/\\/g, '/'))}
const PARAS = ${JSON.stringify(paras)}
const FAMILY = '"Noto Sans Devanagari"'
const font = px => px + 'px ' + FAMILY
const ctx = document.createElement('canvas').getContext('2d')
const measure = (t, px) => { ctx.font = font(px); return ctx.measureText(t).width }
const mm = x => x * 96 / 25.4
const colW = cols => (mm(297) - 2 * mm(12) - (cols - 1) * mm(4)) / cols
const spaces = t => (t.match(/ /g) || []).length

// Justify by word space only: every line but a paragraph's last is stretched to the column; ratio = actual space / natural space.
window.justify = (cols, px, lh) => {
  const w = colW(cols), sp = measure(' ', px), rows = []
  for (const para of PARAS) {
    const r = flow(para, [{ id: 'c', x: 0, y: 0, w, h: 1e6 }], [], { font: font(px), lineHeight: lh })
    for (const l of r.lines.slice(0, -1)) {
      const t = l.text.trimEnd(), n = spaces(t), nat = measure(t, px)
      rows.push({ text: t, n, nat, ratio: n ? (sp + (w - nat) / n) / sp : null })
    }
  }
  return { cols, px, w, sp, rows }
}

// A full A3 page: 5 columns, the preview's two photos, all the real copy (overflows; that is fine for timing).
const page = () => {
  const frames = Array.from({ length: 5 }, (_, i) => ({ id: 'c' + (i + 1), x: mm(12) + i * (colW(5) + mm(4)), y: mm(42), w: colW(5), h: mm(420) - mm(12) - mm(42) }))
  const photos = [{ x: frames[1].x + mm(8), y: mm(150), w: mm(18), h: mm(60), margin: mm(1.5) },
    { x: frames[3].x, y: mm(110), w: 2 * colW(5) + mm(4) - mm(16), h: mm(80), margin: mm(1.5) }]
  return { frames, photos, story: PARAS.join(' ') }
}
window.speed = (warm, runs) => {
  const { frames, photos, story } = page(), opts = { font: font(12), lineHeight: 15 }
  for (let i = 0; i < warm; i++) flow(story, frames, photos, opts)
  const times = []; let r
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); r = flow(story, frames, photos, opts); times.push(performance.now() - t0) }
  return { times, lines: r.lines.length, chars: story.length - r.remainder.length }
}

const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e }
// The planned export route: engine lines drawn absolutely, white-space: pre, word-spacing per line; Chromium prints the PDF.
window.renderPage = () => {
  const { frames, photos, story } = page(), px = 12, lh = 15
  const r = flow(story, frames, photos, { font: font(px), lineHeight: lh })
  document.body.innerHTML = ''
  const pg = el('div', 'position:relative;width:' + mm(297) + 'px;height:' + mm(420) + 'px;overflow:hidden')
  pg.append(el('div', 'position:absolute;left:' + mm(12) + 'px;top:' + mm(14) + 'px;font:700 40px ' + FAMILY, 'नमूना पृष्ठ: शहर में नई पहल'))
  pg.append(el('div', 'position:absolute;left:' + mm(12) + 'px;top:' + mm(36) + 'px;width:' + (mm(297) - 2 * mm(12)) + 'px;border-top:1.5px solid #000'))
  for (const p of photos) pg.append(el('div', 'position:absolute;background:#bbb;left:' + p.x + 'px;top:' + p.y + 'px;width:' + p.w + 'px;height:' + p.h + 'px'))
  const out = r.lines.map((l, i) => {
    const t = l.text.trimEnd(), n = spaces(t), last = i === r.lines.length - 1
    const ws = !last && n ? (l.w - measure(t, px)) / n : 0
    pg.append(el('div', 'position:absolute;white-space:pre;font:' + font(px) + ';line-height:' + lh + 'px;word-spacing:' + ws + 'px;left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px', t))
    return { x: l.x, y: l.y, w: l.w, text: t, justified: !last && n > 0 }
  })
  document.body.append(pg)
  return { lines: out, lh, px }
}

// Show lines natural (ragged) and justified, one block per line, for screenshots.
window.showLines = (items, px) => {
  document.body.innerHTML = ''
  items.forEach((it, i) => {
    const box = el('div', 'display:inline-block;margin:8px;padding:8px;background:#fff;border:1px solid #ccc')
    box.id = 'l' + i
    box.append(el('div', 'font:11px system-ui;color:#666;margin-bottom:4px', 'natural'))
    box.append(el('div', 'white-space:pre;font:' + font(px) + ';width:' + it.w + 'px;outline:1px dashed #9bd', it.text))
    box.append(el('div', 'font:11px system-ui;color:#666;margin:6px 0 4px', 'justified: spaces x' + it.ratio.toFixed(2)))
    box.append(el('div', 'white-space:pre;font:' + font(px) + ';width:' + it.w + 'px;outline:1px dashed #9bd;word-spacing:' + ((it.w - it.nat) / it.n) + 'px', it.text))
    document.body.append(box)
  })
}
window.ready = document.fonts.load(font(12), PARAS[0]).then(() => document.fonts.load('700 40px ' + FAMILY, 'नमूना'))
`
const bundle = await esbuild.build({ stdin: { contents: browserCode, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const pagePath = path.join(work, 'page.html')
fs.writeFileSync(pagePath, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="../../spike/public/fonts.css">
<style>@page{size:297mm 420mm;margin:0}html,body{margin:0}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)

const browser = await chromium.launch(), bp = await browser.newPage({ viewport: { width: 1400, height: 1000 } }), errors = []
bp.on('pageerror', e => errors.push(e.message)); bp.on('console', m => m.type() === 'error' && errors.push(m.text()))
const open = async () => { await bp.goto(pathToFileURL(pagePath).href); await bp.waitForFunction(() => window.ready); await bp.evaluate(() => window.ready) }
await open()

// ---- 1. justify
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
const configs = [[4, 12, 15], [5, 12, 15], [6, 12, 15], [4, 13.33, 16.5], [5, 13.33, 16.5], [6, 13.33, 16.5]]
const justify = []
let primaryRows
for (const [cols, px, lh] of configs) {
  const r = await bp.evaluate(([c, p, l]) => window.justify(c, p, l), [cols, px, lh])
  const ratios = r.rows.filter(x => x.ratio != null).map(x => x.ratio)
  justify.push({ cols, px, pt: +(px * 0.75).toFixed(1), colMm: +(r.w * 25.4 / 96).toFixed(1), lines: r.rows.length, noSpace: r.rows.length - ratios.length,
    median: +q(ratios, 0.5).toFixed(2), p95: +q(ratios, 0.95).toFixed(2), p99: +q(ratios, 0.99).toFixed(2), max: +Math.max(...ratios).toFixed(2),
    over2: ratios.filter(x => x > 2).length, over3: ratios.filter(x => x > 3).length, over4: ratios.filter(x => x > 4).length })
  if (cols === 5 && px === 12) primaryRows = r.rows.filter(x => x.ratio != null).map(x => ({ ...x, w: r.w }))
}
const worst = primaryRows.sort((a, b) => b.ratio - a.ratio).slice(0, 5)

// ---- 3. speed (before the PDF so the page is idle)
const sp = await bp.evaluate(() => window.speed(5, 20))
const speed = { runs: sp.times.length, warmup: 5, median: +q(sp.times, 0.5).toFixed(2), p95: +q(sp.times, 0.95).toFixed(2), min: +Math.min(...sp.times).toFixed(2), max: +Math.max(...sp.times).toFixed(2), lines: sp.lines, chars: sp.chars }

// ---- 2. PDF line positions and fonts
const rendered = await bp.evaluate(() => window.renderPage())
const pdfPath = path.join(work, 'page.pdf')
await bp.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true })
const bytes = fs.readFileSync(pdfPath)
const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise
const pg = await doc.getPage(1), H = pg.getViewport({ scale: 1 }).height
const items = (await pg.getTextContent()).items.filter(it => it.str && it.str.trim())
  .map(it => ({ str: it.str, x: it.transform[4], base: H - it.transform[5], right: it.transform[4] + it.width }))
const PT = 0.75, squash = s => s.replace(/\s+/g, '')
const pos = rendered.lines.map(l => {
  const top = l.y * PT, x0 = l.x * PT, x1 = (l.x + l.w) * PT
  const hit = items.filter(it => it.base > top && it.base <= top + rendered.lh * PT && it.x >= x0 - 3 && it.x < x1 + 3).sort((a, b) => a.x - b.x)
  if (!hit.length) return { text: l.text, found: false }
  // Chromium's PDF maps many Devanagari glyphs to nothing or \\0, so an edge is trusted only where the extracted
  // first (last) character is the line's first (last) character.
  const last = hit.reduce((a, b) => (b.right > a.right ? b : a)), clean = s => s.replace(/\0/g, '')
  return { text: l.text, found: true, same: squash(clean(hit.map(h => h.str).join(''))) === squash(l.text), justified: l.justified,
    dx: clean(hit[0].str)[0] === l.text[0] ? hit[0].x - x0 : null, dy: hit[0].base - top,
    dRight: [...clean(last.str)].at(-1) === [...l.text].at(-1) ? last.right - x1 : null }
})
const found = pos.filter(p => p.found), dys = found.map(p => p.dy)
const dxs = found.filter(p => p.dx != null).map(p => p.dx), drs = found.filter(p => p.justified && p.dRight != null).map(p => p.dRight)
const raw = bytes.toString('latin1')
const baseFonts = [...new Set([...raw.matchAll(/\/BaseFont\s*\/([^\s/[\]<>()]+)/g)].map(m => m[1]))]
const pdf = {
  lines: pos.length, found: found.length, textSame: found.filter(p => p.same).length,
  leftChecked: dxs.length, maxAbsDx: +Math.max(...dxs.map(Math.abs)).toFixed(3),
  baselineOffset: +q(dys, 0.5).toFixed(3), dySpread: +(Math.max(...dys) - Math.min(...dys)).toFixed(3),
  rightChecked: drs.length, justifiedLines: found.filter(p => p.justified).length,
  maxAbsRightJustified: +Math.max(...drs.map(Math.abs)).toFixed(3), p95AbsRightJustified: +q(drs.map(Math.abs), 0.95).toFixed(3),
  fonts: baseFonts, subset: baseFonts.filter(f => /^[A-Z]{6}\+/.test(f)).length,
  descriptors: (raw.match(/\/Type\s*\/FontDescriptor/g) || []).length, fontFiles: (raw.match(/\/FontFile[23]?\b/g) || []).length,
  rightOutliers: found.filter(p => p.justified && p.dRight != null && Math.abs(p.dRight) > 0.5).map(p => [+p.dRight.toFixed(2), p.text]),
  textMismatch: found.filter(p => !p.same).slice(0, 3).map(p => p.text), missing: pos.filter(p => !p.found).slice(0, 3).map(p => p.text),
}
await bp.screenshot({ path: path.join(demoDir, 'page.jpg'), type: 'jpeg', quality: 80, fullPage: true })

// ---- worst justified lines as images, at 2x so the spacing is readable
const lp = await browser.newPage({ deviceScaleFactor: 2 })
lp.on('pageerror', e => errors.push(e.message))
await lp.goto(pathToFileURL(pagePath).href); await lp.waitForFunction(() => window.ready); await lp.evaluate(() => window.ready)
await lp.evaluate(([w, px]) => window.showLines(w, px), [worst, 12])
for (let i = 0; i < worst.length; i++) await lp.locator('#l' + i).screenshot({ path: path.join(demoDir, `justify-${i + 1}.png`) })
await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }

const results = { date: new Date().toISOString(), paragraphs: paras.length, justify, worst: worst.map(w => ({ ratio: +w.ratio.toFixed(2), n: w.n, text: w.text })), speed, pdf }
fs.writeFileSync(path.join(work, 'results.json'), JSON.stringify(results, null, 1))
console.log(JSON.stringify({ ...results, pdf: { ...pdf, fonts: pdf.fonts.length } }, null, 1))

// ---- demo page: the numbers, the proposed thresholds, the worst justified lines
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const ref = justify.find(j => j.cols === 5 && j.px === 12)
const row = cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
fs.writeFileSync(path.join(root, 'demos/gate-review.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gate review</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1100px;color:#222;background:#f4f4f4}a{color:#05c}
table{border-collapse:collapse;background:#fff;margin:8px 0 16px}td,th{text-align:left;padding:5px 10px;border-bottom:1px solid #e3e3e3}
.p{background:#eef6ff;border-left:4px solid #05c;padding:8px 12px}.w{background:#fff3cd;border-left:4px solid #e0b100;padding:8px 12px}
.lines{display:flex;flex-wrap:wrap;gap:12px}.lines img{width:420px;max-width:100%;border:1px solid #ccc;background:#fff}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p>
<h1>Gate review: three proposed Phase 0 gates</h1>
<p>Measured ${results.date.slice(0, 10)} with <code>node scripts/gate-review.mjs</code>: real flow.js in headless Chromium, real font (Noto Sans Devanagari),
${paras.length} real Janshakti paragraphs. Proposal only: no gate files changed. Column widths are assumed (A3, 12 mm margins, 4 mm gutter);
no real Janshakti grid is written down yet.</p>

<h2>1. G0.justify: word-space stretch when justified (no hyphenation)</h2>
<p>Ratio = word space after justifying / normal word space, for every line except a paragraph's last.</p>
<table><tr><th>Columns</th><th>Body</th><th>Column</th><th>Lines</th><th>Median</th><th>95th pct</th><th>99th pct</th><th>Worst</th><th>&gt;2x</th><th>&gt;3x</th><th>&gt;4x</th></tr>
${justify.map(j => row([j.cols, j.pt + ' pt', j.colMm + ' mm', j.lines, j.median, j.p95, j.p99, j.max, j.over2, j.over3, j.over4])).join('\n')}</table>
<p class="p"><b>Proposed:</b> on the reference grid (A3, 5 columns, 9 pt) 95th percentile &le; 3.0 and worst line &le; 6.0 (today ${ref.p95} and ${ref.max}).
Why: it locks today's behaviour so nothing makes it worse, but these numbers are poor by print standards (above about 2x reads as gappy), so the gate should tighten once line breaking looks ahead instead of filling greedily.</p>
<p class="w">At 6 columns (42 mm) justified text is not shippable: 95th percentile ${justify.find(j => j.cols === 6 && j.px === 12).p95}x, worst ${justify.find(j => j.cols === 6 && j.px === 12).max}x. Narrow columns should default to ragged right.</p>
<h3>The 5 worst lines at 5 columns, 9 pt</h3>
<div class="lines">${worst.map((w, i) => `<figure style="margin:0"><img src="gate-review/justify-${i + 1}.png" alt="${esc(w.text)}"><figcaption>${w.ratio.toFixed(2)}x, ${w.n} spaces</figcaption></figure>`).join('')}</div>

<h2>2. G0.pdfpos: PDF line positions and fonts</h2>
<p>One A3 page (5 columns, headline, rule, 2 photos, ${pdf.lines} lines, justified) drawn the planned export way (absolute lines, <code>white-space: pre</code>, per-line <code>word-spacing</code>), printed by Chromium, read back with pdf.js.</p>
<table><tr><th>Check</th><th>Result</th></tr>
${row(['Lines found in the PDF', `${pdf.found} of ${pdf.lines}`])}
${row(['Left edge vs flow() (lines where the first glyph reads back)', `max ${pdf.maxAbsDx} pt over ${pdf.leftChecked} lines`])}
${row(['Baseline: spread of (PDF baseline - flow() line top)', `${pdf.dySpread} pt (offset ${pdf.baselineOffset} pt, the same on every line)`])}
${row(['Right edge of justified lines', `95th pct ${pdf.p95AbsRightJustified} pt, worst ${pdf.maxAbsRightJustified} pt over ${pdf.rightChecked} of ${pdf.justifiedLines} lines`])}
${row(['Fonts embedded', `${pdf.fontFiles} font files for ${pdf.descriptors} font descriptors`])}
${row(['Fonts subset', `${pdf.subset} of ${pdf.fonts.length} (${pdf.fonts.map(esc).join(', ')})`])}
${row(['Text that reads back from the PDF exactly', `${pdf.textSame} of ${pdf.found} lines`])}</table>
<p class="p"><b>Proposed:</b> every checkable line within 0.1 pt of flow() on the left edge and baseline, justified right edges within 0.1 pt at the 95th percentile, and every font embedded and subset.
Why: the measured error is 0.01 pt, so 0.1 pt (0.035 mm, far below press registration) only fails on a real bug; the one 5 pt right-edge outlier ends in the conjunct ष्ट and looks like a pdf.js zero-width item (seen on ष्ठ in the headline), not confirmed.</p>
<p class="w">Text read back from the PDF is broken on ${pdf.found - pdf.textSame} of ${pdf.found} lines (Chromium maps many Devanagari glyphs to nothing): search, copy-paste and screen readers on the PDF will not work. The e-paper must not take its text from the PDF.</p>
<p><a href="gate-review/page.jpg">The printed test page</a></p>

<h2>3. G0.speed: flow() on a full A3 page</h2>
<table><tr><th>Runs</th><th>Median</th><th>95th pct</th><th>Fastest</th><th>Slowest</th><th>Lines set</th></tr>
${row([`${speed.runs} after ${speed.warmup} warm-up`, speed.median + ' ms', speed.p95 + ' ms', speed.min + ' ms', speed.max + ' ms', speed.lines])}</table>
<p class="p"><b>Proposed:</b> median &le; 30 ms for the full page on Amal's laptop. Why: this run gave ${speed.median} ms and three runs on 2026-10-29 gave medians of 8.4, 12.2 and 19.6 ms, so 30 ms (1.5x the slowest) absorbs machine noise but still catches an algorithmic slowdown; dragging re-flows one story (budget 8 ms per frame), not the whole page.</p>
</body></html>
`)
console.log('wrote demos/gate-review.html')
