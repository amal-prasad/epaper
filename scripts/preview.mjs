// Dev-only preview: flow() on a sample A3 page, 5 columns, real Hindi copy, two photos. Writes scratch/preview.html.
// Open it in a browser; ?mingap=4,6,8 (default) shows one page per minimum gap, in ems, side by side.
// flow.js is bundled as is, except that MIN_GAP_EM is swapped for the URL value in the bundled copy only.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const flowPath = path.join(root, 'packages/engine/src/flow.js')

// ponytail: string patch of one expression; fails loudly if flow.js changes. A minGapEm option in flow() would replace it.
const NEEDLE = 'MIN_GAP_EM * size'
const src = fs.readFileSync(flowPath, 'utf8')
if (src.split(NEEDLE).length !== 2) throw new Error(`preview: expected "${NEEDLE}" exactly once in flow.js; update scripts/preview.mjs`)
const patched = src.replace(NEEDLE, '(globalThis.PREVIEW_MIN_GAP_EM ?? MIN_GAP_EM) * size')

const paras = fs.readdirSync(path.join(root, 'spike/samples')).filter(f => f.endsWith('.txt'))
  .flatMap(f => fs.readFileSync(path.join(root, 'spike/samples', f), 'utf8').split(/\n\s*\n/))
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40)

// Page geometry in px at 96 dpi; A3 portrait.
const mm = x => +(x * 96 / 25.4).toFixed(2)
const PAGE = { w: mm(297), h: mm(420) }
const M = mm(12), GUT = mm(4), TOP = mm(42), BOTTOM = PAGE.h - M
const COL = (PAGE.w - 2 * M - 4 * GUT) / 5
const frames = Array.from({ length: 5 }, (_, i) => ({ id: 'c' + (i + 1), x: +(M + i * (COL + GUT)).toFixed(2), y: TOP, w: +COL.toFixed(2), h: +(BOTTOM - TOP).toFixed(2) }))
// Gaps chosen so 4, 6 and 8 em (48, 72, 96 px at 12 px) differ: ~90 px right of the mid-column photo, ~55 px in column 5.
const photos = [
  { label: 'photo mid-column', x: +(frames[1].x + mm(8)).toFixed(2), y: mm(150), w: mm(18), h: mm(60), margin: mm(1.5) },
  { label: 'photo across 2 columns', x: frames[3].x, y: mm(110), w: +(2 * COL + GUT - mm(16)).toFixed(2), h: mm(80), margin: mm(1.5) },
]
const layout = { page: PAGE, frames, photos, font: '12px "Noto Sans Devanagari"', family: 'Noto Sans Devanagari', size: 12, lineHeight: 15, story: paras.join(' ') }

const driver = `
import { flow, MIN_GAP_EM } from ${JSON.stringify(flowPath.replace(/\\/g, '/'))}
const L = ${JSON.stringify(layout)}
const q = new URLSearchParams(location.search).get('mingap')
const gaps = (q || '4,6,8').split(',').map(Number).filter(n => n > 0)
await document.fonts.load(L.font, L.story)
const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text) e.textContent = text; return e }
for (const em of gaps) {
  globalThis.PREVIEW_MIN_GAP_EM = em
  const t0 = performance.now()
  const res = flow(L.story, L.frames, L.photos, { font: L.font, lineHeight: L.lineHeight })
  const ms = (performance.now() - t0).toFixed(1)
  const panel = el('section', 'display:inline-block;vertical-align:top;margin:0 16px 16px 0')
  panel.append(el('h2', 'font:600 14px system-ui;margin:0 0 6px', em + ' em min gap (' + em * L.size + ' px)' + (em === MIN_GAP_EM ? ', flow.js default' : '') + ': ' + res.lines.length + ' lines, ' + res.remainder.length + ' chars left over, ' + res.deadGaps.length + ' dead gaps, ' + ms + ' ms'))
  const page = el('div', 'position:relative;background:#fff;box-shadow:0 1px 4px #0003;width:' + L.page.w + 'px;height:' + L.page.h + 'px')
  page.append(el('div', 'position:absolute;left:' + L.frames[0].x + 'px;top:30px;font:700 36px "Noto Sans Devanagari"', 'नमूना पृष्ठ'))
  for (const f of L.frames) page.append(el('div', 'position:absolute;outline:1px dashed #9bd;left:' + f.x + 'px;top:' + f.y + 'px;width:' + f.w + 'px;height:' + f.h + 'px'))
  for (const p of L.photos) {
    page.append(el('div', 'position:absolute;outline:1px dotted #e99;left:' + (p.x - p.margin) + 'px;top:' + (p.y - p.margin) + 'px;width:' + (p.w + 2 * p.margin) + 'px;height:' + (p.h + 2 * p.margin) + 'px'))
    page.append(el('div', 'position:absolute;background:#ccc;display:flex;align-items:center;justify-content:center;font:11px system-ui;left:' + p.x + 'px;top:' + p.y + 'px;width:' + p.w + 'px;height:' + p.h + 'px', p.label))
  }
  for (const d of res.deadGaps) page.append(el('div', 'position:absolute;box-sizing:border-box;border:1px solid #d22;background:repeating-linear-gradient(45deg,#d2222233 0 4px,transparent 4px 8px);color:#b00;font:9px system-ui;overflow:hidden;left:' + d.x + 'px;top:' + d.y + 'px;width:' + d.width + 'px;height:' + d.height + 'px', d.reason))
  for (const l of res.lines) page.append(el('div', 'position:absolute;white-space:pre;font:' + L.font + ';line-height:' + L.lineHeight + 'px;left:' + l.x + 'px;top:' + l.y + 'px;width:' + l.w + 'px', l.text))
  panel.append(page); document.body.append(panel)
}
`

const out = await esbuild.build({
  stdin: { contents: driver, resolveDir: root, loader: 'js' },
  bundle: true, format: 'esm', write: false, absWorkingDir: root,
  plugins: [{ name: 'patch-flow', setup(b) { b.onLoad({ filter: /[\\/]flow\.js$/ }, a => path.resolve(a.path) === flowPath ? { contents: patched, loader: 'js', resolveDir: path.dirname(flowPath) } : undefined) } }],
})

const html = `<!doctype html>
<html lang="hi"><head><meta charset="utf-8"><title>flow() preview</title>
<link rel="stylesheet" href="../spike/public/fonts.css">
<style>body{margin:16px;background:#eee;white-space:nowrap}</style></head>
<body><p style="font:13px system-ui;margin:0 0 12px">Dev preview of flow(): A3, 5 columns, ${paras.length} real paragraphs. Change the minimum gap with ?mingap=4,6,8. Dashed blue: frames. Dotted red: photo margin. Red hatched: deadGaps (space left empty beside a photo).</p>
<script type="module">${out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>
`
fs.mkdirSync(path.join(root, 'scratch'), { recursive: true })
fs.writeFileSync(path.join(root, 'scratch/preview.html'), html)
console.log(`wrote scratch/preview.html (${(html.length / 1024).toFixed(0)} KB). Open it in a browser; add ?mingap=4,6,8 to compare.`)
