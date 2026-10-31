// Wrap modes through the real wrapObstacles() and flow(), in Chromium with real Hindi copy and the bundled font.
// Each row shows the same object twice: wrap mode none (before), then the mode under test (after).
//   node scripts/wrap-modes.mjs     writes demos/wrap-modes/<case>-<before|after>.jpg and demos/wrap-modes.html
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const story = fs.readFileSync(path.join(root, 'spike/samples/janshakti-live.txt'), 'utf8').split(/\n\s*\n/)
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40).slice(0, 30).join(' ')
const unix = p => JSON.stringify(p.replace(/\\/g, '/'))

const code = `
import { flow } from ${unix(path.join(root, 'packages/engine/src/flow.js'))}
import { wrapObstacles, roundPolygon } from ${unix(path.join(root, 'packages/engine/src/wrap.js'))}
const FAMILY = '"Noto Sans Devanagari"', PX = 12, LH = 15, W = 640, H = 760, GUT = 12, COLW = (W - 3 * GUT) / 4, TOP = 40
const frames = [0, 1, 2, 3].map(i => ({ id: 'c' + i, x: i * (COLW + GUT), y: TOP, w: COLW, h: H - TOP }))
const off = { top: 8, right: 8, bottom: 8, left: 8 }
const blob = Array.from({ length: 60 }, (_, i) => { const a = i * Math.PI / 30, r = 0.42 + 0.06 * Math.sin(3 * a) + 0.03 * Math.cos(5 * a + 1); return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)] })
const notch = [[0, 0], [0.3, 0], [0.3, 0.7], [0.7, 0.7], [0.7, 0], [1, 0], [1, 1], [0, 1]]
const CASES = {
  box: { title: 'box: plain photo, lines stay justified', o: { x: 170, y: 150, w: 300, h: 210, wrap: { mode: 'box', offset: off } } },
  offsets: { title: 'box with its own offset on each side (top 4, right 30, bottom 30, left 4)', o: { x: 170, y: 150, w: 300, h: 210, wrap: { mode: 'box', offset: { top: 4, right: 30, bottom: 30, left: 4 } } } },
  jump: { title: 'jump: no text beside the object, it resumes below', o: { x: 170, y: 150, w: 300, h: 210, wrap: { mode: 'jump', offset: off } } },
  round: { title: 'shape: round inset, lines ragged against it', o: { x: 190, y: 150, w: 260, h: 260, wrap: { mode: 'shape', polygon: roundPolygon(), offset: off } } },
  rotated: { title: 'box rotated 25 degrees counts as a shape', o: { x: 180, y: 180, w: 280, h: 180, rot: -25, wrap: { mode: 'box', offset: off } } },
  cutout: { title: 'shape: free-form cut-out', o: { x: 170, y: 130, w: 300, h: 340, wrap: { mode: 'shape', polygon: blob, offset: off } } },
  notch: { title: 'shape: cut-out with a notch, text sets inside the notch', o: { x: 110, y: 130, w: 420, h: 340, wrap: { mode: 'shape', polygon: notch, offset: off } } },
  mingap: { title: 'minimum gap set to 8 em on this object: the narrow side stays empty', o: { x: 100, y: 150, w: 300, h: 210, wrap: { mode: 'box', offset: off, minGap: 8 } } },
}
const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e }
const outline = o => {
  const a = (o.rot ?? 0) * Math.PI / 180, cx = o.x + o.w / 2, cy = o.y + o.h / 2
  return (o.wrap.mode === 'shape' ? o.wrap.polygon : [[0, 0], [1, 0], [1, 1], [0, 1]]).map(([fx, fy]) => {
    const dx = o.x + fx * o.w - cx, dy = o.y + fy * o.h - cy
    return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]
  })
}
window.draw = (name, variant) => {
  const c = CASES[name], o = variant === 'after' ? c.o : { ...c.o, wrap: { ...c.o.wrap, mode: 'none' } }
  const obstacles = wrapObstacles([o], frames, { lineHeight: LH })
  const r = flow(${JSON.stringify(story)}, frames, obstacles, { font: PX + 'px ' + FAMILY, lineHeight: LH })
  document.body.textContent = ''
  const pg = el('div', 'position:relative;width:' + W + 'px;height:' + H + 'px;background:#fff;overflow:hidden')
  pg.append(el('div', 'position:absolute;left:0;top:6px;font:13px/18px sans-serif;color:#b42318', variant === 'after' ? c.title : 'before: wrap mode none'))
  const pts = outline(c.o).map(([x, y]) => x.toFixed(1) + 'px ' + y.toFixed(1) + 'px').join(',')
  pg.append(el('div', 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;background:linear-gradient(135deg,#6a8caf,#c9a46b 60%,#5d7a4a);clip-path:polygon(' + pts + ')'))
  const ctx = document.createElement('canvas').getContext('2d'); ctx.font = PX + 'px ' + FAMILY
  for (const [i, l] of r.lines.entries()) {
    const t = l.text.trimEnd(), n = (t.match(/ /g) || []).length
    const ws = !l.align && n && i < r.lines.length - 1 ? (l.w - ctx.measureText(t).width) / n : 0
    pg.append(el('div', 'position:absolute;white-space:pre;text-align:' + (l.align === 'right' ? 'right' : 'left') + ';word-spacing:' + ws + 'px;font:' + PX + 'px/' + LH + 'px ' + FAMILY + ';left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px', t))
  }
  document.body.append(pg)
  return { lines: r.lines.length, obstacles: obstacles.length, title: c.title }
}
window.CASE_NAMES = Object.keys(CASES)
window.ready = document.fonts.load(PX + 'px ' + FAMILY, 'क')
`
const bundle = await esbuild.build({ stdin: { contents: code, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const work = path.join(root, 'spike/out'), html = path.join(work, 'wrap-modes.html'), dir = path.join(root, 'demos/wrap-modes')
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(html, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}">
<style>body{margin:0}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 640, height: 760 }, deviceScaleFactor: 1.5 }), errors = []
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready)
const names = await page.evaluate(() => window.CASE_NAMES), rows = []
for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f))
for (const n of names) for (const v of ['before', 'after']) {
  const r = await page.evaluate(([x, y]) => window.draw(x, y), [n, v])
  await page.screenshot({ path: path.join(dir, `${n}-${v}.jpg`), type: 'jpeg', quality: 82 })
  rows.push({ n, v, ...r })
}
await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }
const figs = names.map(n => {
  const pair = rows.filter(r => r.n === n)
  return `<h2>${pair[0].title}</h2><div class="g">${pair.map(r => `<figure><img src="wrap-modes/${r.n}-${r.v}.jpg" alt="${r.n} ${r.v}"><figcaption>${r.v}: ${r.lines} lines set, ${r.obstacles} obstacles</figcaption></figure>`).join('')}</div>`
}).join('\n')
fs.writeFileSync(path.join(root, 'demos/wrap-modes.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wrap modes</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1360px;color:#222;background:#f4f4f4}a{color:#05c}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}@media(max-width:900px){.g{grid-template-columns:1fr}}figure{margin:0}img{width:100%;border:1px solid #ccc;background:#fff}
figcaption{font-size:13px;color:#666}.w{background:#fff3cd;border-left:4px solid #e0b100;padding:8px 12px}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p>
<h1>Wrap modes and shaped objects (D-035, D-036, D-043)</h1>
<p class="w">The page is 4 columns, 640 &times; 760 px at 12 px, not the A3 grid. Each row shows the same object with wrap mode none on the left and the mode under test on the right.</p>
<p>Objects go through <code>wrapObstacles()</code> and <code>flow()</code>, as they will on a real page. A shape's outline is sliced once per line, using what the shape actually covers inside that line, so text can set inside a notch. The editor's snapping to column edges is not built, because there is no editor yet.</p>
${figs}
<p>Rebuild: <code>node scripts/wrap-modes.mjs</code>.</p>
</body></html>
`)
console.log(rows.map(r => `${r.n} ${r.v}: ${r.lines} lines, ${r.obstacles} obstacles`).join('\n'))
