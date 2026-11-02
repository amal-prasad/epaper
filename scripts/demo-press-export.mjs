// Owned synthetic content only. Demonstrates the intermediate renderer, leaving the established colour pipeline separate.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { renderIssue } from '../packages/export/src/render.js'
import { resolveExportSettings } from '../packages/export/src/settings.js'

const root = fileURLToPath(new URL('../', import.meta.url)), dir = path.join(root, 'demos/press-export')
fs.mkdirSync(dir, { recursive: true })
const require = createRequire(new URL('../spike/package.json', import.meta.url))
const { createCanvas } = require('@napi-rs/canvas')
const pdfjs = await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href)
const noWrap = { mode: 'none', offset: {} }
const profile = { id: 'provisional-colour', pageMode: 'colour', colourRoute: 'neutral-rgb-to-k-cmyk',
  pdfx: null, bleed: 0, cropMarks: false, iccProfile: null, inkLimit: 240, overprint: false,
  neutralCurve: [[0, 0], [1, 1]], imageDpi: 300, minImageDpi: 150,
  assumed: ['inkLimit', 'bleed', 'cropMarks', 'overprint', 'neutralCurve'] }
const image = createCanvas(2200, 1500), ctx = image.getContext('2d')
ctx.fillStyle = '#f5d9a0'; ctx.fillRect(0, 0, 2200, 1500)
ctx.fillStyle = '#214c5c'; ctx.fillRect(140, 700, 1920, 470)
ctx.fillStyle = '#f7f3e9'; ctx.fillRect(230, 430, 850, 420); ctx.fillRect(1120, 430, 850, 420)
ctx.fillStyle = '#a56e3e'; ctx.fillRect(300, 1170, 90, 160); ctx.fillRect(1810, 1170, 90, 160)
const syntheticImage = image.toDataURL('image/png')
const body = 'यह नमूना समाचार केवल पृष्ठ और निर्यात की जाँच के लिए लिखा गया है। नगर के पुस्तकालय में बच्चों के लिए नई पुस्तकें उपलब्ध कराई गई हैं। कार्यक्रम में शिक्षकों और अभिभावकों ने भाग लिया। '
const reports = []
const qr = JSON.parse(execFileSync(process.env.PYTHON || 'python', [path.join(root, 'scripts/export-qr-matrix.py')], { encoding: 'utf8', windowsHide: true }))
for (const [name, size] of [['a3', { w: 297, h: 420 }], ['compact', { w: 250, h: 380 }]]) {
  const preset = JSON.parse(fs.readFileSync(path.join(root, 'presets/newspaper.json')))
  preset.page = size; preset.pageCount.multipleOf = 1
  const w = size.w - 24, orgId = 'synthetic-demo'
  const label = (id, text, x, y, width, height, style = {}) => ({ id, orgId, kind: 'label', text,
    x, y, w: width, h: height, wrap: noWrap, style })
  const doc = { id: `reference-${name}`, schemaVersion: 1, orgId, preset,
    stories: [{ id: 'story', orgId, headline: 'पुस्तकालय में बच्चों के लिए नई पहल', body: [body.repeat(14)] }],
    pages: [{ id: 'p1', orgId, no: 1,
      frames: [{ id: 'body', orgId, x: 12, y: 82, w, h: 90, cols: 4, gutter: 4, storyId: 'story' }],
      objects: [
        { id: 'band', orgId, kind: 'box', x: 12, y: 10, w, h: 29, wrap: noWrap, style: { background: '#ffb323' } },
        label('masthead', 'समाचार स्टूडियो', 18, 12, w - 12, 25, { family: 'Khand', weight: 700, fontSize: 48 }),
        label('edition', 'नमूना संस्करण · केवल परीक्षण के लिए · 2 नवंबर 2026', 12, 41, w, 9, { fontSize: 13, colour: '#a51c30' }),
        label('headline', 'पुस्तकालय में बच्चों के लिए नई पहल', 12, 54, w, 23, { family: 'Khand', weight: 700, fontSize: 34 }),
        { id: 'rule', orgId, kind: 'line', x: 12, y: 178, w, h: 0.4, wrap: noWrap, style: { background: '#000000' } },
        label('ad-label', 'विज्ञापन नमूना · चित्र स्वयं बनाया गया है', 12, 184, w, 9, { fontSize: 14, colour: '#214c5c' }),
        { id: 'ad', orgId, kind: 'ad', src: syntheticImage, x: 12, y: 198, w, h: size.h - 228, wrap: noWrap },
        label('imprint', 'परीक्षण प्रकाशन · मुद्रक: नमूना · संपादक: नमूना · व्यावसायिक उपयोग के लिए नहीं', 12, size.h - 22, w, 10, { fontSize: 10 }),
      ] }] }
  const qrX = size.w - 39, qrY = 145, qrSize = 24, moduleSize = qrSize / qr.length
  doc.pages[0].objects.push({ id: 'qr-background', orgId, kind: 'box', x: qrX, y: qrY, w: qrSize, h: qrSize,
    wrap: { mode: 'box', offset: { top: 1, right: 1, bottom: 1, left: 1 } }, style: { background: '#ffffff' } })
  for (const [y, row] of qr.entries()) for (const [x, dark] of row.entries()) if (dark)
    doc.pages[0].objects.push({ id: `qr-${x}-${y}`, orgId, kind: 'box', x: qrX + x * moduleSize, y: qrY + y * moduleSize,
      w: moduleSize, h: moduleSize, wrap: noWrap, style: { background: '#000000' } })
  const settings = resolveExportSettings(preset, profile), result = await renderIssue(doc)
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(doc, null, 2) + '\n')
  fs.writeFileSync(path.join(dir, `${name}.pdf`), result.pdf)
  fs.writeFileSync(path.join(dir, `${name}-screen.png`), result.pages[0].screenshot)
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(result.pdf) }).promise
  try {
    const page = await pdf.getPage(1), viewport = page.getViewport({ scale: 96 / 72 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    fs.writeFileSync(path.join(dir, `${name}-pdf.png`), canvas.toBuffer('image/png'))
  } finally { await pdf.destroy() }
  reports.push({ name, size, stage: result.stage, colourSpace: result.colourSpace,
    lines: result.pages[0].lines.length, browserErrors: result.errors, settings })
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Document PDF rendering</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;background:#f4f2ed;color:#24211c}table{width:100%;border-collapse:collapse;background:white}td,th{padding:12px;text-align:left;border-bottom:1px solid #ddd}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{width:100%;border:1px solid #ccc}figure{margin:0}aside{padding:16px;background:#fff1cd}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>
<a href="index.html">All demos</a><h1>Document → positioned PDF</h1>
<p>Two editable page sizes, the same Hindi layout engine and bundled fonts. All content and artwork here are synthetic.</p>
<aside>This page demonstrates intermediate RGB PDFs. It does not replace or certify the existing CMYK/PDF/X work. Physical press acceptance is not claimed. Separation plates are not shown because no colour conversion runs here.</aside>
<table><tr><th>Check</th><th>Result</th></tr><tr><td>Reference sizes</td><td>297 × 420 mm and 250 × 380 mm</td></tr><tr><td>Browser errors during rendering</td><td>${reports.reduce((n, r) => n + r.browserErrors.length, 0)}</td></tr><tr><td>Overflow, missing assets/fonts, placeholders</td><td>Rejected with an identifier; covered by renderer tests</td></tr><tr><td>Remaining integration</td><td>Existing colour/PDF-X exporter, QR fixture, final validation and atomic publication</td></tr></table>
${reports.map(r => `<h2>${esc(r.name)} · ${r.size.w} × ${r.size.h} mm</h2><p>${r.lines} engine lines. <a href="press-export/${r.name}.pdf">Open intermediate PDF</a> · <a href="press-export/${r.name}.json">Fixture document</a></p><div class="pair"><figure><figcaption>Screen render</figcaption><img src="press-export/${r.name}-screen.png" alt="Screen render of synthetic newspaper"></figure><figure><figcaption>Actual PDF raster</figcaption><img src="press-export/${r.name}-pdf.png" alt="Raster of the exported PDF"></figure></div>`).join('')}
<p><a href="press-export/report.json">Resolved settings and assumptions</a>. Known limitations: no frame chains or rotations; unsupported objects fail explicitly; story paragraphs currently use the engine's existing joined-text behaviour.</p></html>`
fs.writeFileSync(path.join(root, 'demos/press-export.html'), html)
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(reports, null, 2) + '\n')
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] })
try {
  const page = await browser.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(pathToFileURL(path.join(root, 'demos/press-export.html')).href)
  await page.locator('img').evaluateAll(images => Promise.all(images.map(i => i.decode())))
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`wrote demos/press-export.html; two PDFs; ${reports.map(r => r.lines).join('/')} lines; 0 demo console errors`)
} finally { await browser.close() }
