// One PDF with every Phase 0 / D-037 visual, for Amal to review in one place.
//   node scripts/visual-report.mjs     writes demos/visuals-2026-10-31.pdf (A4, printed by Chromium from the demo images)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const d = p => pathToFileURL(path.join(root, 'demos', p)).href
const need = ['phase0-done/flow.png', 'phase0-done/flow-justified.png', 'gg042/line-407.png', 'gg042/line-408.png', 'gg042/line-409.png',
  ...['across-gutter', 'two-and-half', 'round', 'diagonal', 'freeform'].flatMap(s => [`flow-shapes/${s}-before.jpg`, `flow-shapes/${s}-after.jpg`]),
  ...['Cyan', 'Magenta', 'Yellow', 'Black'].flatMap(c => [`g0-black-prep/rewrite-${c}.png`, `g0-black-prep/cmyk-${c}.png`])]
const missing = need.filter(p => !fs.existsSync(path.join(root, 'demos', p)))
if (missing.length) { console.error('missing images (run the demo scripts first):\n' + missing.join('\n')); process.exit(1) }

const shape = (s, title) => `<section><h2>${title}</h2><div class="two"><figure><img src="${d(`flow-shapes/${s}-before.jpg`)}"><figcaption>Before (Phase 0 engine)</figcaption></figure>
<figure><img src="${d(`flow-shapes/${s}-after.jpg`)}"><figcaption>After (D-037)</figcaption></figure></div></section>`
const plates = route => `<div class="four">${['Cyan', 'Magenta', 'Yellow', 'Black'].map(c => `<figure><img src="${d(`g0-black-prep/${route}-${c}.png`)}"><figcaption>${c}</figcaption></figure>`).join('')}</div>`

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:12mm}body{font:10.5pt/1.45 system-ui,sans-serif;color:#222;margin:0}
h1{font-size:20pt;margin:0 0 4mm}h2{font-size:13pt;margin:0 0 3mm}section{break-before:page}section:first-of-type{break-before:auto}
table{border-collapse:collapse;width:100%;margin:3mm 0}td,th{text-align:left;padding:1.5mm 2mm;border-bottom:.3mm solid #ddd;vertical-align:top}
.ok{color:#1a7f37;font-weight:600}.no{color:#c62828;font-weight:600}.w{background:#fff3cd;border-left:1mm solid #e0b100;padding:2mm 3mm}
img{width:100%;border:.3mm solid #ccc;display:block}figure{margin:0;break-inside:avoid}
.full img{width:auto;max-width:100%;max-height:150mm;margin:auto}.two img{max-height:160mm;width:auto;max-width:100%;margin:auto}figcaption{font-size:9pt;color:#555;margin:1mm 0 2mm}
.two{display:grid;grid-template-columns:1fr 1fr;gap:4mm;max-width:250mm;margin:auto}.four{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm}
</style></head><body>
<section><h1>Studio: Phase 0 and D-037 visuals</h1>
<p>2026-10-31. Every page uses the assumed grid (A3, 12 mm margins, 5 columns, 4 mm gutter, 9 pt body) or the 4-column test page noted on it. Interactive versions: <code>demos/index.html</code>.</p>
<table><tr><th>Gate</th><th>Status</th><th>Result</th></tr>
<tr><td>G0.parity: body line breaks vs browser</td><td class="ok">PASS</td><td>99.7%, 0 overflows</td></tr>
<tr><td>G0.headline: bold headlines, 4 fonts, 200 real headlines</td><td class="ok">PASS</td><td>12796/12800, 0 overflows</td></tr>
<tr><td>G0.flow: engine tests</td><td class="ok">PASS</td><td>all engine tests pass (15 flow cases plus contract and fuzz)</td></tr>
<tr><td>G0.speed: flow() on a full A3 page</td><td class="ok">PASS</td><td>3.4 ms (limit 30)</td></tr>
<tr><td>G0.pdfpos: PDF matches flow()</td><td class="ok">PASS*</td><td>left edges by raster, all 438 lines, worst 0.009 pt; mutation check caught an 8 pt shift (read 7.991 pt). *waits for approval of the measuring change</td></tr>
<tr><td>G0.black: black on K only</td><td class="ok">PASS</td><td>Amal's check of the separations and in CorelDRAW</td></tr></table>
<p class="w">Waiting for Amal: approve the G0.pdfpos raster left-edge change (D-040).</p>
<h2>Contents</h2><ol><li>flow() page, ragged and justified</li><li>Shapes before and after D-037 (5 pages)</li><li>G0.pdfpos left edges by raster</li><li>Black text on the plates</li><li>How objects will be placed</li></ol></section>

<section><h2>1. flow() on a realistic page</h2><p>4 columns, a photo and a boxed quote. Left half of each image: flow() lines drawn the export way. Right half: the same text in plain CSS columns.</p>
<figure class="full"><img src="${d('phase0-done/flow.png')}"><figcaption>Ragged right</figcaption></figure></section>
<section><h2>1. flow() on a realistic page, justified</h2><figure class="full"><img src="${d('phase0-done/flow-justified.png')}"><figcaption>Justified with word spacing only (no letter-spacing). The line breaks are the same as in the ragged version.</figcaption></figure></section>

${shape('round', '2. Round photo across columns 2 and 3')}
${shape('diagonal', '2. Photo rotated 25 degrees')}
${shape('freeform', '2. Free-form cut-out')}
${shape('two-and-half', '2. Photo 2.5 columns wide')}
${shape('across-gutter', '2. Photo across the gutter of columns 1 and 2')}

<section><h2>3. G0.pdfpos left edges: pdf.js text vs raster (GG-042)</h2>
<p>Strips from the printed PDF. <b style="color:#d00">Red</b>: where flow() put the line's left edge. <b style="color:#05c">Blue</b>: where pdf.js's first text item starts (the old check). <b style="color:#0a0">Green</b>: where the new raster check finds the ink starting.</p>
<figure><img src="${d('gg042/line-407.png')}"><figcaption>Line 407: all three coincide (raster -0.006 pt)</figcaption></figure>
<figure><img src="${d('gg042/line-408.png')}"><figcaption>Line 408: green sits on red (raster -0.005 pt). pdf.js has no text item for "व्य", so blue sits on the second व, 8.3 pt in: the old check's false alarm.</figcaption></figure>
<figure><img src="${d('gg042/line-409.png')}"><figcaption>Line 409: all three coincide (raster 0.000 pt)</figcaption></figure>
<p>Mutation check, run on every gate run: the page printed again with one line 8 pt to the right must read as 8 pt off. On 2026-10-31 it read 7.991 pt.</p></section>

<section><h2>4. Black text on the plates (G0.black)</h2>
<p>Top of the test page, each plate in its ink colour.</p>
<p><b>Chosen route for colour pages (rewrite):</b> text and rules appear only on Black; colour stays in C, M and Y.</p>${plates('rewrite')}
<p><b>Rejected (plain CMYK):</b> black text appears on all four plates.</p>${plates('cmyk')}</section>

<section><h2>5. How objects will be placed (from docs/UX_SPEC.md and the designs)</h2>
<table>
<tr><th>Way</th><th>What the user does</th><th>Where it is specified</th></tr>
<tr><td>Auto-pager</td><td>Stories and photos are placed into the template; every move is listed and can be undone</td><td>Phase 1 (auto-page v0)</td></tr>
<tr><td>Drag and drop, anywhere on the page</td><td>Ghost preview while dragging, snap highlights to columns and baseline, text reflows live (target under 8 ms per frame)</td><td>UX_SPEC "Drag with help"; budget in PRODUCT_PROMPT</td></tr>
<tr><td>Buttons, no drag needed</td><td>A small toolbar on the selected object: ← कॉलम, कॉलम →, ↑ ↓, आकार, plus "यहाँ रखें" (place here). Works on a phone</td><td>UX_SPEC F3, WCAG 2.5.7; Guided design</td></tr>
<tr><td>Keyboard</td><td>Arrow keys move, Shift+arrow by a column</td><td>UX_SPEC rule 8 (touch and keyboard are equals)</td></tr>
<tr><td>Exact numbers</td><td>X, Y, width, height in mm, wrap mode and offsets per side in the wrap panel</td><td>Main design (wrap panel)</td></tr>
</table>
<p>Every way produces the same op (<code>moveBlock</code>, <code>resizeBlock</code> and so on), so undo works the same and the auto-pager can do anything the user can. Phase 1 (operator tool) builds the toolbar buttons, keyboard and number fields. Drag and drop with snapping comes with the self-serve editor (Phase 3) unless Amal moves it earlier. Free placement anywhere is allowed; snapping only suggests column edges.</p></section>
</body></html>`
const tmp = path.join(root, 'spike/out/visual-report.html')
fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, html)
const browser = await chromium.launch(), page = await browser.newPage()
await page.goto(pathToFileURL(tmp).href); await page.waitForLoadState('networkidle')
const out = path.join(root, 'demos/visuals-2026-10-31.pdf')
await page.pdf({ path: out, format: 'A4', landscape: true, printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } })
await browser.close()
console.log(`${path.relative(root, out)}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`)
