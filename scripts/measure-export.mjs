// Metrics for gates G0.speed and G0.pdfpos (harness/gates.json); writes spike/out/export.json and nothing else.
// One A3 page: 5 columns, headline, rule, 2 photos, all of spike/samples, set by the real flow.js in headless Chromium
// with the bundled Noto Sans Devanagari. Speed: flow() on that page. PDF: the page drawn the planned export way
// (absolute lines, white-space: pre, per-line word-spacing), printed by Chromium, read back with pdf.js (baselines,
// fonts) and rendered by pdf.js to find each line's leftmost ink (left edges, GG-042) and each justified line's rightmost
// ink (right edges). Mutation check: the page is printed a second time with one line drawn 8 pt to the right, and the
// left-edge measure must read that line as 8 pt off (pdfLeftMutantCaught), so a measure that can no longer see a shift fails.
//   node scripts/measure-export.mjs
// Exits 1 when a measured set is empty, so a broken read-back can never pass on missing numbers.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const spikeRequire = createRequire(path.join(root, 'spike/package.json'))
const esbuild = spikeRequire('esbuild')
const pdfjs = await import(pathToFileURL(spikeRequire.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href)
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-export-'))

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
const spaces = t => (t.match(/ /g) || []).length
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
  return { times, lines: r.lines.length }
}
// How far a word's ink reaches past its advance, in px at size px: drawn at 50x and scanned, because measureText's
// actualBoundingBoxRight is whole-pixel rounded at small sizes and loose on curves (ी, ं) at large ones.
// Only the core band (CORE em above the baseline down to it) counts, here and in the PDF scan: at our leading the
// neighbour lines' matras and descenders reach into a line's box, so ink outside the core may not be this line's.
const CORE = 0.75
const big = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
const overhang = (word, px) => {
  const K = 50, base = Math.round(K * px * 1.3); big.font = font(K * px)
  const adv = big.measureText(word).width, W = Math.ceil(adv + K * px), Hc = Math.ceil(2 * K * px)
  big.canvas.width = W; big.canvas.height = Hc; big.font = font(K * px); big.fillText(word, 0, base)
  const d = big.getImageData(0, 0, W, Hc).data; let edge = 0
  for (let y = Math.round(base - CORE * K * px); y < base; y++) for (let x = W - 1; x > edge; x--) { const a = d[(y * W + x) * 4 + 3]; if (a > 8) { edge = Math.max(edge, x + a / 255); break } }
  return (edge - adv) / K
}
// Where a word's ink starts relative to its origin, in px at size px (negative when it reaches left of the origin):
// drawn at 50x, origin K px in, scanned in the same core band.
const bearing = (word, px) => {
  const K = 50, base = Math.round(K * px * 1.3), o = K * px; big.font = font(K * px)
  const W = Math.ceil(big.measureText(word).width + 2 * o), Hc = Math.ceil(2 * K * px)
  big.canvas.width = W; big.canvas.height = Hc; big.font = font(K * px); big.fillText(word, o, base)
  const d = big.getImageData(0, 0, W, Hc).data; let edge = W
  for (let y = Math.round(base - CORE * K * px); y < base; y++) for (let x = 0; x < edge; x++) { const a = d[(y * W + x) * 4 + 3]; if (a > 8) { edge = Math.min(edge, x + 1 - a / 255); break } }
  return (edge - o) / K
}
const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e }
// shift: { i, px } draws line i px to the right (mutation check); the returned lines keep flow()'s positions
window.renderPage = (shift = null) => {
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
    const dx = shift && shift.i === i ? shift.px : 0
    pg.append(el('div', 'position:absolute;white-space:pre;font:' + font(px) + ';line-height:' + lh + 'px;word-spacing:' + ws + 'px;left:' + (l.x + dx) + 'px;top:' + l.y + 'px;width:' + l.w + 'px', t))
    return { x: l.x, y: l.y, w: l.w, text: t, justified: !last && n > 0, inkRight: l.x + l.w + overhang(t.slice(t.lastIndexOf(' ') + 1), px),
      inkLeft: l.x + bearing(t.slice(0, (t + ' ').indexOf(' ')), px) }
  })
  document.body.append(pg)
  return { lines: out, lh, px, core: CORE }
}
window.ready = document.fonts.load(font(12), PARAS[0]).then(() => document.fonts.load('700 40px ' + FAMILY, 'नमूना'))
`
const bundle = await esbuild.build({ stdin: { contents: browserCode, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const pagePath = path.join(work, 'page.html')
fs.writeFileSync(pagePath, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}">
<style>@page{size:297mm 420mm;margin:0}html,body{margin:0}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)

const browser = await chromium.launch(), bp = await browser.newPage({ viewport: { width: 1400, height: 1000 } }), errors = []
bp.on('pageerror', e => errors.push(e.message)); bp.on('console', m => m.type() === 'error' && errors.push(m.text()))
await bp.goto(pathToFileURL(pagePath).href); await bp.waitForFunction(() => window.ready); await bp.evaluate(() => window.ready)

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
const sp = await bp.evaluate(() => window.speed(5, 20))
const rendered = await bp.evaluate(() => window.renderPage())
const pdfPath = path.join(work, 'page.pdf')
await bp.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true })
// mutation check: the same page with one line (in the middle of the story) drawn 8 pt to the right
const PT = 0.75, MUT = Math.floor(rendered.lines.length / 2), MUT_PT = 8
await bp.evaluate(s => window.renderPage(s), { i: MUT, px: MUT_PT / PT })
const mutPath = path.join(work, 'mutant.pdf')
await bp.pdf({ path: mutPath, preferCSSPageSize: true, printBackground: true })
await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }

const clean = s => s.replace(/\0/g, '')
const { createCanvas } = spikeRequire('@napi-rs/canvas')
const S = 20, PAD = 8
// Edges by raster: pdf.js text extraction drops or mis-sizes conjuncts (ष्ट, व्य: GG-006, GG-042), so each line's ink is
// found on a rendered strip of the page and compared with where its first word's ink should start (left) or its last
// word's ink should end (right). Only the core band counts (see CORE). S px per pt; an edge is the outermost pixel with
// ink plus its coverage, so the step is well under 0.1 pt. No ink within PAD of the expected edge counts as a PAD error.
async function edges(pg, H, lines, key, side, baseOffset) {
  const errs = [], rows = []; let checked = 0
  for (const [xc, ls] of Map.groupBy(lines, l => Math.round(l[key] * PT))) {
    const sx = xc - PAD, W = 2 * PAD * S, Hpx = Math.ceil(H * S)
    const cv = createCanvas(W, Hpx), c = cv.getContext('2d')
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, Hpx)
    await pg.render({ canvasContext: c, viewport: pg.getViewport({ scale: S, offsetX: -sx * S }) }).promise
    const img = c.getImageData(0, 0, W, Hpx).data
    // a pixel is text ink only if a dark core (< 128) follows within 4 px inward: the photos' flat grey (#bbb) beside a
    // line never qualifies, a glyph's anti-aliased edge always does (strokes are about 20 px wide at S = 20)
    const v = (y, x) => img[(y * W + x) * 4], core = (y, x, dir) => { for (let k = 0; k <= 4; k++) { const xx = x + dir * k; if (xx >= 0 && xx < W && v(y, xx) < 128) return true } return false }
    for (const l of ls) {
      const base = l.y * PT + baseOffset, y0 = Math.round((base - rendered.core * rendered.px * PT) * S), y1 = Math.round(base * S)
      let edge = side === 'right' ? -1 : Infinity
      for (let y = y0; y < y1; y++)
        if (side === 'right') { for (let x = W - 1; x > edge; x--) { const d = 255 - v(y, x); if (d > 8 && core(y, x, -1)) { edge = Math.max(edge, x + d / 255); break } } }
        else { for (let x = 0; x < Math.min(edge, W); x++) { const d = 255 - v(y, x); if (d > 8 && core(y, x, 1)) { edge = Math.min(edge, x + 1 - d / 255); break } } }
      const ok = Number.isFinite(edge) && edge >= 0
      const e = ok ? sx + edge / S - l[key] * PT : (side === 'right' ? -PAD : PAD)
      if (ok) checked++
      errs.push(Math.abs(e)); rows.push({ i: rendered.lines.indexOf(l), d: +e.toFixed(3), text: side === 'right' ? l.text.slice(-24) : l.text.slice(0, 24) })
    }
  }
  return { errs, rows, checked }
}
// One printed PDF: text read back with pdf.js (line found, baseline), edges by raster
async function measurePdf(file, { rightEdges = true } = {}) {
  const bytes = fs.readFileSync(file)
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise
  const pg = await doc.getPage(1), H = pg.getViewport({ scale: 1 }).height
  const items = (await pg.getTextContent()).items.filter(it => it.str && it.str.trim())
    .map(it => ({ str: it.str, x: it.transform[4], base: H - it.transform[5], right: it.transform[4] + it.width }))
  const pos = rendered.lines.map(l => {
    const top = l.y * PT, x0 = l.x * PT, x1 = (l.x + l.w) * PT
    const hit = items.filter(it => it.base > top && it.base <= top + rendered.lh * PT && it.x >= x0 - 3 && it.x < x1 + 3).sort((a, b) => a.x - b.x)
    if (!hit.length) return { found: false }
    // pdf.js edges are kept for comparison only: Chromium's PDF maps many Devanagari glyphs to nothing (D-028)
    const last = hit.reduce((a, b) => (b.right > a.right ? b : a))
    return { found: true, justified: l.justified, dy: hit[0].base - top,
      dx: clean(hit[0].str)[0] === l.text[0] ? hit[0].x - x0 : null,
      dRight: [...clean(last.str)].at(-1) === [...l.text].at(-1) ? last.right - x1 : null }
  })
  const found = pos.filter(p => p.found), dys = found.map(p => p.dy)
  const left = await edges(pg, H, rendered.lines, 'inkLeft', 'left', q(dys, 0.5))
  const right = rightEdges ? await edges(pg, H, rendered.lines.filter(l => l.justified), 'inkRight', 'right', q(dys, 0.5)) : null
  return { bytes, pos, found, dys, left, right }
}
const real = await measurePdf(pdfPath), mutant = await measurePdf(mutPath, { rightEdges: false })
const { bytes, pos, found, dys, left, right } = real
const justified = found.filter(p => p.justified)
const pdfjsLeft = found.filter(p => p.dx != null).map(p => Math.abs(p.dx)), pdfjsRight = justified.filter(p => p.dRight != null).map(p => Math.abs(p.dRight))
const inkLines = rendered.lines.filter(l => l.justified), drs = right.errs, dxs = left.errs
// the mutant line must read as shifted by MUT_PT (within the gate's tolerance), and every other line as before
const mutRow = mutant.left.rows.find(r => r.i === MUT), mutOthers = Math.max(...mutant.left.rows.filter(r => r.i !== MUT).map(r => Math.abs(r.d)))
const mutantCaught = mutRow && Math.abs(mutRow.d - MUT_PT) <= 0.1 && mutOthers <= 0.1 ? 1 : 0
const empty = Object.entries({ 'speed runs': sp.times, 'lines found in the PDF': found, 'left edges': dxs, 'right edges': drs }).filter(([, a]) => !a.length)
if (empty.length) { console.error('nothing measured: ' + empty.map(([k]) => k).join(', ')); process.exit(1) }

const raw = bytes.toString('latin1')
const fonts = [...new Set([...raw.matchAll(/\/BaseFont\s*\/([^\s/[\]<>()]+)/g)].map(m => m[1]))]
const descriptors = (raw.match(/\/Type\s*\/FontDescriptor/g) || []).length, fontFiles = (raw.match(/\/FontFile[23]?\b/g) || []).length
const r3 = x => +x.toFixed(3)
const out = {
  date: new Date().toISOString(), paragraphs: paras.length,
  speedMedianMs: r3(q(sp.times, 0.5)), speedP95Ms: r3(q(sp.times, 0.95)), speedRuns: sp.times.length, speedLines: sp.lines,
  pdfLines: pos.length, pdfMissingLines: pos.length - found.length,
  pdfMaxLeftPt: r3(Math.max(...dxs)), pdfLeftP95Pt: r3(q(dxs, 0.95)), pdfLeftCheckedPct: +(100 * left.checked / rendered.lines.length).toFixed(1),
  pdfLeftWorst: [...left.rows].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5),
  pdfLeftMutantCaught: mutantCaught, pdfLeftMutantLine: MUT, pdfLeftMutantReadPt: mutRow ? mutRow.d : null, pdfLeftMutantOthersMaxPt: r3(mutOthers),
  pdfBaselineSpreadPt: r3(Math.max(...dys) - Math.min(...dys)), pdfBaselineOffsetPt: r3(q(dys, 0.5)),
  pdfRightP95Pt: r3(q(drs, 0.95)), pdfRightMaxPt: r3(Math.max(...drs)), pdfRightCheckedPct: +(100 * right.checked / inkLines.length).toFixed(1),
  pdfRightWorst: [...right.rows].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 5),
  pdfjsLeftMaxPt: r3(Math.max(...pdfjsLeft)), pdfjsRightP95Pt: r3(q(pdfjsRight, 0.95)), pdfjsRightMaxPt: r3(Math.max(...pdfjsRight)),
  pdfFonts: fonts.length, pdfFontsNotSubset: fonts.filter(f => !/^[A-Z]{6}\+/.test(f)).length,
  pdfFontsNotEmbedded: Math.max(0, descriptors - fontFiles), fontNames: fonts,
}
fs.mkdirSync(path.join(root, 'spike/out'), { recursive: true })
fs.writeFileSync(path.join(root, 'spike/out/export.json'), JSON.stringify(out, null, 1))
fs.rmSync(work, { recursive: true, force: true })
console.log(JSON.stringify(out, null, 1))
