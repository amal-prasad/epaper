// One-off: rasterise scratch/gate-review/page.pdf, rightmost ink per justified line vs flow() right edge; DOM text right edge too.
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
const T = 'D:/epaper/scratch/tools/node_modules/'
const pdfjs = await import(pathToFileURL(T + 'pdfjs-dist/legacy/build/pdf.mjs').href)
const { createCanvas } = await import(pathToFileURL(T + '@napi-rs/canvas/index.js').href)
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 1000 } })
await p.goto(pathToFileURL('D:/epaper/scratch/gate-review/page.html').href); await p.waitForFunction(() => window.ready); await p.evaluate(() => window.ready)
const r = await p.evaluate(() => {
  const res = window.renderPage()
  const divs = [...document.querySelectorAll('div')].filter(d => d.style.whiteSpace === 'pre')
  res.lines.forEach((l, i) => { const rg = document.createRange(); rg.selectNodeContents(divs[i]); l.domRight = rg.getBoundingClientRect().right - divs[i].parentElement.getBoundingClientRect().left })
  return res
})
await b.close()
const S = 4, doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync('D:/epaper/scratch/gate-review/page.pdf')) }).promise
const pg = await doc.getPage(1), vp = pg.getViewport({ scale: S }), cv = createCanvas(vp.width, vp.height), ctx = cv.getContext('2d')
ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); await pg.render({ canvasContext: ctx, viewport: vp }).promise
const img = ctx.getImageData(0, 0, cv.width, cv.height).data, W = cv.width
const PT = 0.75, rows = []
for (const l of r.lines) {
  if (!l.justified) continue
  const y0 = Math.round(l.y * PT * S), y1 = Math.round((l.y + r.lh) * PT * S), x0 = Math.round(l.x * PT * S), xmax = Math.round(((l.x + l.w) * PT + 5) * S)
  let right = -1
  for (let y = y0; y < y1; y++) for (let x = xmax; x > right && x >= x0; x--) { const k = (y * W + x) * 4; if (img[k] < 100) { right = x; break } }
  rows.push({ text: l.text, ink: right / S - (l.x + l.w) * PT, dom: (l.domRight - (l.x + l.w)) * PT })
}
const s = a => [...a].sort((x, y) => x - y), q = (a, f) => s(a)[Math.floor(f * (a.length - 1))]
const inks = rows.map(x => x.ink), doms = rows.map(x => x.dom)
console.log('justified lines', rows.length)
console.log('ink right - flow right (pt): min', q(inks,0).toFixed(3), 'p1', q(inks,.01).toFixed(3), 'median', q(inks,.5).toFixed(3), 'p99', q(inks,.99).toFixed(3), 'max', q(inks,1).toFixed(3))
console.log('DOM text right - flow right (pt): min', q(doms,0).toFixed(3), 'max', q(doms,1).toFixed(3))
const o = rows.find(x => x.text.startsWith('संबंधित विभागों की अधिसूचनाओं से स्पष्ट'))
console.log('outlier', JSON.stringify(o), [...o.text].map(c => c.codePointAt(0).toString(16)).join(' '))
console.log('worst 5 by |ink|', rows.sort((a, b) => Math.abs(b.ink) - Math.abs(a.ink)).slice(0, 5).map(x => x.ink.toFixed(2) + ' ' + x.text.slice(-12)).join(' | '))
// crop of the outlier line, its column, 2 lines above and below, with the flow() right edge drawn in red
const ol = r.lines.find(l => l.text.startsWith('संबंधित विभागों की अधिसूचनाओं से स्पष्ट'))
const cx = Math.round(ol.x * PT * S) - 8, cy = Math.round((ol.y - 2 * r.lh) * PT * S), cw = Math.round((ol.w * PT + 12) * S), ch = Math.round(5 * r.lh * PT * S)
const crop = createCanvas(cw, ch), c2 = crop.getContext('2d')
c2.drawImage(cv, cx, cy, cw, ch, 0, 0, cw, ch)
c2.strokeStyle = '#d00'; c2.lineWidth = 2; const ex = (ol.x + ol.w) * PT * S - cx
c2.beginPath(); c2.moveTo(ex, 0); c2.lineTo(ex, ch); c2.stroke()
c2.strokeStyle = '#05c'; c2.strokeRect(0, 2 * r.lh * PT * S, cw, r.lh * PT * S)
fs.writeFileSync('D:/epaper/demos/gate-decisions/outlier-raster.png', crop.toBuffer('image/png'))
fs.writeFileSync('D:/epaper/scratch/outlier/result.json', JSON.stringify({ lines: rows.length, inkMin: q(inks,0), inkMedian: q(inks,.5), inkMax: q(inks,1), domMin: q(doms,0), domMax: q(doms,1), outlier: o }, null, 1))
