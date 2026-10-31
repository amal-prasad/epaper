// flow() around photos that are not a plain column-aligned box: across a gutter, 2.5 columns wide, round, rotated,
// free-form. flow() takes rectangles, so each shape is sliced into one rectangle per line band (its widest extent inside
// that band, plus the margin). Before: the Phase 0 engine (commit e797b6d: wider gap only, 6 em minimum, every line
// justified). After: the working-tree engine (D-037: every gap of 3 em or more, lines beside a shape aligned away from it).
//   node scripts/flow-shapes.mjs     writes demos/flow-shapes/<case>-<before|after>.jpg and demos/flow-shapes.html
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const story = fs.readFileSync(path.join(root, 'spike/samples/janshakti-live.txt'), 'utf8').split(/\n\s*\n/)
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40).slice(0, 30).join(' ')
const BEFORE = 'e797b6d', beforeFile = path.join(root, 'spike/out/flow-before.js')
fs.mkdirSync(path.dirname(beforeFile), { recursive: true })
fs.writeFileSync(beforeFile, execFileSync('git', ['show', `${BEFORE}:packages/engine/src/flow.js`], { cwd: root }))
const unix = p => JSON.stringify(p.replace(/\\/g, '/'))

const code = `
import { flow as flowAfter } from ${unix(path.join(root, 'packages/engine/src/flow.js'))}
import { flow as flowBefore } from ${unix(beforeFile)}
const VARIANTS = { before: 'before (Phase 0): wider side only, 6 em minimum, all lines justified', after: 'after (D-037, D-038): every side of 3 em or more; aligned beside shapes, justified beside rectangles' }
const FAMILY = '"Noto Sans Devanagari"', PX = 12, LH = 15, W = 640, H = 760, GUT = 12, COLW = (W - 3 * GUT) / 4, TOP = 56, M = 8
const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e }
const poly = (cx, cy, pts) => pts.map(([x, y]) => [cx + x, cy + y])
const rot = (w, h, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [x * c - y * s, x * s + y * c]) }
const circle = r => Array.from({ length: 72 }, (_, i) => [r * Math.cos(i * Math.PI / 36), r * Math.sin(i * Math.PI / 36)])
const blob = Array.from({ length: 90 }, (_, i) => { const a = i * Math.PI / 45, r = 120 + 28 * Math.sin(3 * a) + 16 * Math.cos(5 * a + 1); return [r * Math.cos(a) * 0.9, r * Math.sin(a) * 1.15] })
const CASES = {
  'across-gutter': { title: 'Photo across the gutter of columns 1 and 2', pts: [[COLW + GUT / 2 - 95, 150], [COLW + GUT / 2 + 95, 150], [COLW + GUT / 2 + 95, 360], [COLW + GUT / 2 - 95, 360]] },
  'two-and-half': { title: 'Photo 2.5 columns wide', pts: [[0, TOP], [2.5 * COLW + 2 * GUT, TOP], [2.5 * COLW + 2 * GUT, 300], [0, 300]] },
  round: { title: 'Round photo across columns 2 and 3', pts: poly(W / 2, 330, circle(120)) },
  diagonal: { title: 'Photo rotated 25 degrees', pts: poly(W / 2, 320, rot(280, 180, -25)) },
  freeform: { title: 'Free-form cut-out', pts: poly(W / 2 - 40, 360, blob) },
}
// x-extent of a polygon on the horizontal line at y (even-odd crossings), or null
function span(pts, y) {
  const xs = []
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]
    if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) xs.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1)) }
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null
}
// one rectangle per line band: the shape's widest extent inside the band (sampled every px), plus the margin
function bands(pts) {
  const ys = pts.map(p => p[1]), out = []
  for (let y = TOP + Math.floor((Math.min(...ys) - M - TOP) / LH) * LH; y < Math.max(...ys) + M; y += LH) {
    let lo = Infinity, hi = -Infinity
    for (let yy = y - M; yy <= y + LH + M; yy++) { const s = span(pts, yy); if (s) { lo = Math.min(lo, s[0]); hi = Math.max(hi, s[1]) } }
    if (hi > lo) out.push({ x: lo - M, y, w: hi - lo + 2 * M, h: LH, margin: 0, shape: 'contour' })
  }
  return out
}
window.draw = (name, variant) => {
  const c = CASES[name], frames = [0, 1, 2, 3].map(i => ({ id: 'c' + i, x: i * (COLW + GUT), y: TOP, w: COLW, h: H - TOP }))
  const RECT = name === 'across-gutter' || name === 'two-and-half'   // plain rectangles: one box obstacle, no slicing (D-038)
  const xs = c.pts.map(p => p[0]), yp = c.pts.map(p => p[1])
  const obstacles = RECT ? [{ x: Math.min(...xs), y: Math.min(...yp), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...yp) - Math.min(...yp), margin: M, shape: 'box' }] : bands(c.pts), opts = { font: PX + 'px ' + FAMILY, lineHeight: LH }
  const r = (variant === 'before' ? flowBefore : flowAfter)(${JSON.stringify(story)}, frames, obstacles, opts)
  document.body.textContent = ''
  const pg = el('div', 'position:relative;box-sizing:content-box;padding-right:12px;width:' + W + 'px;height:' + H + 'px;background:#fff;overflow:hidden')
  pg.append(el('div', 'position:absolute;left:0;top:2px;font:700 20px/26px ' + FAMILY, c.title))
  pg.append(el('div', 'position:absolute;left:0;top:30px;font:13px/18px sans-serif;color:#b42318', VARIANTS[variant]))
  const img = el('div', 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background:linear-gradient(135deg,#6a8caf,#c9a46b 60%,#5d7a4a);clip-path:polygon(' + c.pts.map(([x, y]) => x.toFixed(1) + 'px ' + y.toFixed(1) + 'px').join(',') + ')')
  pg.append(img)
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = PX + 'px ' + FAMILY
  for (const [i, l] of r.lines.entries()) {
    // justified the export way (word spacing only, D-006), except lines flow() aligned away from a shape (l.align)
    const t = l.text.trimEnd(), n = (t.match(/ /g) || []).length
    const ws = !l.align && n && i < r.lines.length - 1 ? (l.w - ctx.measureText(t).width) / n : 0
    pg.append(el('div', 'position:absolute;white-space:pre;text-align:' + (l.align === 'right' ? 'right' : 'left') + ';word-spacing:' + ws + 'px;font:' + PX + 'px/' + LH + 'px ' + FAMILY + ';left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px', t))
  }
  document.body.append(pg)
  return { lines: r.lines.length, bands: obstacles.length }
}
window.CASE_NAMES = Object.keys(CASES); window.VARIANT_NAMES = Object.keys(VARIANTS)
window.ready = document.fonts.load(PX + 'px ' + FAMILY, 'क').then(() => document.fonts.load('700 24px ' + FAMILY, 'क'))
`
const bundle = await esbuild.build({ stdin: { contents: code, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const work = path.join(root, 'spike/out'), html = path.join(work, 'flow-shapes.html'), dir = path.join(root, 'demos/flow-shapes')
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(html, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}">
<style>body{margin:0}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 652, height: 760 }, deviceScaleFactor: 1.5 }), errors = []
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready)
const { names, variants } = await page.evaluate(() => ({ names: window.CASE_NAMES, variants: window.VARIANT_NAMES })), rows = []
for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f))
for (const n of names) for (const v of variants) {
  const r = await page.evaluate(([x, y]) => window.draw(x, y), [n, v])
  await page.screenshot({ path: path.join(dir, `${n}-${v}.jpg`), type: 'jpeg', quality: 82 })
  rows.push({ n, v, ...r })
}
await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }
// one row per shape: before, after; more lines set = more of the white space used
const figs = names.map(n => `<h2>${n}</h2><div class="g">${rows.filter(r => r.n === n).map(r => `<figure><img src="flow-shapes/${r.n}-${r.v}.jpg" alt="${r.n} ${r.v}"><figcaption>${r.v}: ${r.lines} lines set</figcaption></figure>`).join('')}</div>`).join('\n')
fs.writeFileSync(path.join(root, 'demos/flow-shapes.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>flow() around shapes</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1360px;color:#222;background:#f4f4f4}a{color:#05c}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}@media(max-width:900px){.g{grid-template-columns:1fr}}figure{margin:0}img{width:100%;border:1px solid #ccc;background:#fff}
figcaption{font-size:13px;color:#666}.w{background:#fff3cd;border-left:4px solid #e0b100;padding:8px 12px}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p>
<h1>flow() around photos that are not plain boxes</h1>
<p class="w">The page is 4 columns, 640 &times; 760 px at 12 px, not the A3 grid. flow() takes rectangles, so each shape is sliced into one rectangle per line of text: its widest point inside that line, plus an 8 px margin.</p>
<p>Each row shows one shape twice. Left, <b>before</b>: the Phase 0 engine (commit e797b6d). Text takes only the wider side of a split line, gaps under 6 em stay empty, and every line is justified. Right, <b>after</b>: today's <code>packages/engine/src/flow.js</code> (D-037).</p>
<ul>
<li><b>Gaps.</b> Every gap of at least 3 em takes text, left to right.</li>
<li><b>Alignment applies only to shaped objects</b> (round, rotated, free-form). A line with the shape on its right is flush left (<code>align: 'left'</code>); with the shape on its left, flush right (<code>align: 'right'</code>). Lines beside plain rectangles stay justified.</li>
<li><b>Other lines</b> stay justified the export way (word spacing only, D-006).</li></ul>
<p>Still open: each line clears the shape's widest point inside it, so the top and bottom of the round photo leave small wedges. A finer outline is later work.</p>
${figs}
<p>Rebuild: <code>node scripts/flow-shapes.mjs</code>.</p>
</body></html>
`)
console.log(rows.map(r => `${r.n} ${r.v}: ${r.lines} lines`).join('\n'))
