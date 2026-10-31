// GG-042 evidence: G0.pdfpos's left-edge check vs the raster, for the line it flags and its neighbours.
// Runs a copy of scripts/measure-export.mjs (the locked judge is only read, never changed) with a hook that rasterises
// the three lines from the printed PDF and marks: red = flow() left edge, blue = where pdf.js's first text item starts.
//   node scripts/gg042-visual.mjs     writes demos/gg042/line-<n>.png and demos/gg042-pdfpos.html
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'demos/gg042'), copy = path.join(root, 'scripts/_gg042-measure.mjs')
fs.mkdirSync(dir, { recursive: true })
const hook = `
{ const { createCanvas: cc } = spikeRequire('@napi-rs/canvas'), S2 = 12, rows = []
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)) }).promise, pg = await doc.getPage(1), H = pg.getViewport({ scale: 1 }).height
  const items = (await pg.getTextContent()).items.filter(it => it.str && it.str.trim()).map(it => ({ str: it.str, x: it.transform[4], base: H - it.transform[5] }))
  const bad = pos.map((p, i) => [p, i]).filter(([p]) => p.found && p.dx != null && Math.abs(p.dx) > 0.1).map(([, i]) => i)
  const pick = bad.length ? [bad[0] - 1, bad[0], bad[0] + 1] : [0, 1, 2]
  for (const i of pick) {
    const l = rendered.lines[i], sx = l.x * PT - 8, sy = l.y * PT - 2, W2 = Math.round((l.w * PT + 16) * S2), H2 = Math.round((rendered.lh * PT + 4) * S2)
    const cv = cc(W2, H2), c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, W2, H2)
    await pg.render({ canvasContext: c, viewport: pg.getViewport({ scale: S2, offsetX: -sx * S2, offsetY: -sy * S2 }) }).promise
    const it = items.filter(t => t.base > l.y * PT && t.base <= (l.y + rendered.lh) * PT && t.x >= l.x * PT - 3 && t.x < (l.x + l.w) * PT + 3).sort((a, b) => a.x - b.x)
    const mark = (x, col) => { c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo((x - sx) * S2, 0); c.lineTo((x - sx) * S2, H2); c.stroke() }
    const lr = left.rows.find(r => r.i === i)
    mark(l.x * PT, '#d00'); if (it[0]) mark(it[0].x, '#05c'); if (lr) mark(l.inkLeft * PT + lr.d, '#0a0')
    fs.writeFileSync(path.join(root, 'demos/gg042/line-' + i + '.png'), cv.toBuffer('image/png'))
    rows.push({ i, text: l.text.trim(), dx: pos[i].dx, raster: lr ? lr.d : null, first: it[0] ? [it[0].str.replace(/\\0/g, '∅'), +(it[0].x - l.x * PT).toFixed(2)] : null })
  }
  fs.writeFileSync(path.join(root, 'demos/gg042/rows.json'), JSON.stringify(rows))
  process.exit(0) }
`
const src = fs.readFileSync(path.join(root, 'scripts/measure-export.mjs'), 'utf8')
const anchor = "fs.writeFileSync(path.join(root, 'spike/out/export.json')"
if (!src.includes(anchor)) throw new Error('measure-export.mjs changed: anchor not found')
fs.writeFileSync(copy, src.replace(anchor, hook + anchor))
try { execFileSync(process.execPath, [copy], { stdio: 'inherit' }) } finally { fs.rmSync(copy, { force: true }) }

const rows = JSON.parse(fs.readFileSync(path.join(dir, 'rows.json'), 'utf8'))
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
fs.writeFileSync(path.join(root, 'demos/gg042-pdfpos.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G0.pdfpos left edge</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1100px;color:#222;background:#f4f4f4}a{color:#05c}
figure{margin:0 0 18px}img{max-width:100%;border:1px solid #ccc;background:#fff}figcaption{font-size:14px}
.w{background:#fff3cd;border-left:4px solid #e0b100;padding:8px 12px}.p{background:#eef6ff;border-left:4px solid #05c;padding:8px 12px}
table{border-collapse:collapse;background:#fff}td,th{text-align:left;padding:5px 10px;border-bottom:1px solid #e3e3e3}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p>
<h1>G0.pdfpos left edges: pdf.js text vs raster (GG-042)</h1>
<p class="w">Assumed grid: A3, 12 mm margins, 5 columns, 4 mm gutter, 9 pt body (GG-007).</p>
<p>Each strip is one line from the printed PDF, rendered at 12 px per pt. Three marks:</p>
<ul>
<li><b style="color:#d00">Red:</b> where flow() put the line's left edge.</li>
<li><b style="color:#05c">Blue:</b> where pdf.js's first text item starts. That is what the old check measured.</li>
<li><b style="color:#0a0">Green:</b> where the new raster check finds the line's ink starting. It compares that with where the first word's ink should start, drawn at 50x in Chromium.</li>
</ul>
${rows.map(r => `<figure><img src="gg042/line-${r.i}.png" alt="line ${r.i}"><figcaption>Line ${r.i}: <span lang="hi">${esc(r.text)}</span><br>
old check (pdf.js text): <b>${r.dx == null ? 'not checked' : r.dx.toFixed(3) + ' pt'}</b>, first item <span lang="hi">${r.first ? esc(r.first[0]) : '-'}</span> at ${r.first ? r.first[1] + ' pt' : '-'}; <b>new check (raster): ${r.raster == null ? '-' : r.raster.toFixed(3) + ' pt'}</b></figcaption></figure>`).join('\n')}
<p>On line 408 the ink starts on the red mark, the same as on its neighbours. pdf.js has no text item for the first conjunct (व्य), so its first item is "वस्", about 8 pt further in, and the old check took it because it also starts with व. The raster check reads the ink itself, so it does not depend on what pdf.js extracts.</p>
<p class="p"><b>Mutation check (part of the gate):</b> every run prints the page a second time with one line drawn 8 pt to the right. The raster check must read that line as 8 pt off, within 0.1 pt, and every other line within 0.1 pt; otherwise the gate fails. On 2026-10-31 it read 7.991 pt.</p>
<p>Rebuild: <code>node scripts/gg042-visual.mjs</code>.</p>
</body></html>
`)
console.log(rows.map(r => `line ${r.i}: dx ${r.dx}, first item ${JSON.stringify(r.first)}`).join('\n'))
