import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
const T = 'D:/epaper/scratch/tools/node_modules/'
const pdfjs = await import(pathToFileURL(T + 'pdfjs-dist/legacy/build/pdf.mjs').href)
const { createCanvas } = await import(pathToFileURL(T + '@napi-rs/canvas/index.js').href)
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync('D:/epaper/scratch/gate-review/page.pdf')) }).promise
const pg = await doc.getPage(1), vp = pg.getViewport({ scale: 1 }), cv = createCanvas(vp.width, vp.height), ctx = cv.getContext('2d')
ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height)
await pg.render({ canvasContext: ctx, viewport: vp }).promise
fs.writeFileSync('C:/Users/bened/AppData/Local/Temp/claude/D--epaper/f16cea70-4b34-4f24-b5cb-659d8a800a35/scratchpad/peek.png', cv.toBuffer('image/png'))
const d = ctx.getImageData(0, 0, vp.width, vp.height).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100 && d[i+3] > 0) dark++
console.log(vp.width, vp.height, 'dark px', dark, 'alpha0 first px', d[3])
