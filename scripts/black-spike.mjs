// Experiment E2 (docs/EXPERIMENTS.md), prep for G0.black: does black text and rules land on the K plate only?
// One A3 test page set the export way (flow() lines drawn absolutely, as in scripts/measure-export.mjs), printed by
// Chromium, then four routes through Ghostscript, each separated with tiffsep and checked region by region:
//   gray       -sColorConversionStrategy=Gray (mono page)
//   cmyk       -sColorConversionStrategy=CMYK, nothing else (control)
//   rewrite    neutral RGB (black, greys: a a a rg / RG) rewritten to DeviceCMYK 0 0 0 1-a (k / K) in the uncompressed PDF, then CMYK
//   blacktext  -dBlackText -dBlackVector, then CMYK
//   node scripts/black-spike.mjs     writes spike/out/black/ (PDFs, plates), spike/out/black.json, demos/g0-black-prep/
// Records nothing: G0.black needs Amal's print check. The photo is synthetic (drawn in canvas), so no licence applies.
import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const spikeRequire = createRequire(path.join(root, 'spike/package.json'))
const esbuild = spikeRequire('esbuild'), { createCanvas } = spikeRequire('@napi-rs/canvas')
const out = path.join(root, 'spike/out/black'), demo = path.join(root, 'demos/g0-black-prep')
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(demo, { recursive: true })
const GS = process.env.GS || ['C:/Program Files/gs/gs10.04.0/bin/gswin64c.exe', 'gswin64c', 'gs'].find(g => { try { execFileSync(g, ['-v']); return true } catch { return false } })
if (!GS) { console.error('Ghostscript not found. Windows: winget install ArtifexSoftware.GhostScript   (or set GS=path\\to\\gswin64c.exe)'); process.exit(1) }

const paras = fs.readdirSync(path.join(root, 'spike/samples')).filter(f => f.endsWith('.txt'))
  .flatMap(f => fs.readFileSync(path.join(root, 'spike/samples', f), 'utf8').split(/\n\s*\n/))
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40).slice(0, 40)

// Page in CSS px. Regions are returned so each one can be checked on the plates.
const browserCode = `
import { flow } from ${JSON.stringify(path.join(root, 'packages/engine/src/flow.js').replace(/\\/g, '/'))}
const FAMILY = '"Noto Sans Devanagari"', font = px => px + 'px ' + FAMILY
const ctx = document.createElement('canvas').getContext('2d')
const mm = x => x * 96 / 25.4, colW = (mm(297) - 2 * mm(12) - 4 * mm(4)) / 5
const el = (tag, css, text) => { const e = document.createElement(tag); e.style.cssText = css; if (text != null) e.textContent = text; return e }
const box = (x, y, w, h) => ({ x, y, w, h })
function photo(w, h) {   // synthetic colour photo: sky, sunlit field, deep shadow (rich dark), saturated red and blue
  const c = document.createElement('canvas'); c.width = Math.round(w * 2); c.height = Math.round(h * 2); const g = c.getContext('2d')
  let gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#5aa0e6'); gr.addColorStop(0.45, '#d8ecff'); gr.addColorStop(0.46, '#7bb043'); gr.addColorStop(1, '#2e5418')
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height)
  gr = g.createRadialGradient(c.width * 0.3, c.height * 0.75, 5, c.width * 0.3, c.height * 0.75, c.width * 0.3); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(10,8,6,0)')
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#c8102e'; g.fillRect(c.width * 0.62, c.height * 0.5, c.width * 0.12, c.height * 0.3)
  g.fillStyle = '#1b3a8a'; g.fillRect(c.width * 0.78, c.height * 0.55, c.width * 0.1, c.height * 0.25)
  for (let i = 0; i < 4000; i++) { g.fillStyle = 'rgba(' + (i % 3 ? 0 : 255) + ',0,0,0.04)'; g.fillRect((i * 7919) % c.width, (i * 104729) % c.height, 3, 3) }
  return c.toDataURL('image/jpeg', 0.92)
}
window.renderPage = () => {
  const px = 12, lh = 15, R = {}
  const pg = el('div', 'position:relative;width:' + mm(297) + 'px;height:' + mm(420) + 'px;overflow:hidden;background:#fff')
  R.kicker = box(mm(12), mm(10), mm(80), 22); pg.append(el('div', 'position:absolute;left:' + mm(12) + 'px;top:' + mm(10) + 'px;color:#c8102e;font:700 18px ' + FAMILY, 'इंदौर विशेष'))
  R.headline = box(mm(12), mm(17), mm(273), 52); pg.append(el('div', 'position:absolute;left:' + mm(12) + 'px;top:' + mm(17) + 'px;white-space:nowrap;font:700 40px/52px ' + FAMILY, 'नमूना पृष्ठ: शहर में नई पहल, काली स्याही की जांच'))
  R.rule = box(mm(12), mm(33), mm(273), 2); pg.append(el('div', 'position:absolute;left:' + mm(12) + 'px;top:' + mm(33) + 'px;width:' + mm(273) + 'px;height:2px;background:#000'))
  R.hairline = box(mm(12) + colW, mm(40), 1, mm(160)); pg.append(el('div', 'position:absolute;left:' + (mm(12) + colW + mm(2)) + 'px;top:' + mm(40) + 'px;width:0.75px;height:' + mm(160) + 'px;background:#000'))
  R.hairline.x += mm(2) - 1; R.hairline.w = 3
  R.photo = box(mm(12) + colW + mm(4), mm(40), 2 * colW + mm(4), mm(90))
  const img = el('img', 'position:absolute;left:' + R.photo.x + 'px;top:' + R.photo.y + 'px;width:' + R.photo.w + 'px;height:' + R.photo.h + 'px'); img.src = photo(R.photo.w, R.photo.h); pg.append(img)
  R.tint = box(mm(12) + 4 * (colW + mm(4)), mm(40), colW, mm(50))
  pg.append(el('div', 'position:absolute;background:rgb(217,217,217);left:' + R.tint.x + 'px;top:' + R.tint.y + 'px;width:' + R.tint.w + 'px;height:' + R.tint.h + 'px'))
  R.panel = box(R.tint.x, mm(95), colW, mm(30))   // colour vector box: -dBlackVector must not turn it black
  pg.append(el('div', 'position:absolute;background:rgb(27,58,138);left:' + R.panel.x + 'px;top:' + R.panel.y + 'px;width:' + R.panel.w + 'px;height:' + R.panel.h + 'px'))
  R.tintText = box(R.tint.x + 6, R.tint.y + 8, R.tint.w - 12, 40)
  pg.append(el('div', 'position:absolute;left:' + R.tintText.x + 'px;top:' + R.tintText.y + 'px;width:' + R.tintText.w + 'px;font:700 14px/20px ' + FAMILY, 'बॉक्स: धूसर पृष्ठभूमि पर काला पाठ'))
  const frames = [0, 1, 2, 3].map(i => ({ id: 'c' + i, x: mm(12) + i * (colW + mm(4)), y: mm(40), w: colW, h: mm(160) }))
  const r = flow(${JSON.stringify(paras.join(' '))}, frames, [{ ...R.photo, margin: mm(2) }], { font: font(px), lineHeight: lh })
  R.body = []
  for (const [i, l] of r.lines.entries()) {
    const t = l.text.trimEnd(), n = (t.match(/ /g) || []).length; ctx.font = font(px)
    const ws = i < r.lines.length - 1 && n ? (l.w - ctx.measureText(t).width) / n : 0
    pg.append(el('div', 'position:absolute;white-space:pre;font:' + font(px) + ';line-height:' + lh + 'px;word-spacing:' + ws + 'px;left:' + l.x + 'px;top:' + l.y + 'px', t))
    R.body.push(box(l.x, l.y, l.w, lh))
  }
  document.body.innerHTML = ''; document.body.append(pg)
  return R
}
window.ready = Promise.all([document.fonts.load(font(12), 'क'), document.fonts.load('700 40px ' + FAMILY, 'क')])
`
const bundle = await esbuild.build({ stdin: { contents: browserCode, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const pagePath = path.join(out, 'page.html')
fs.writeFileSync(pagePath, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}">
<style>@page{size:297mm 420mm;margin:0}html,body{margin:0}</style></head><body>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
const browser = await chromium.launch(), bp = await browser.newPage(), errors = []
bp.on('pageerror', e => errors.push(e.message)); bp.on('console', m => m.type() === 'error' && errors.push(m.text()))
await bp.goto(pathToFileURL(pagePath).href); await bp.waitForFunction(() => window.ready); await bp.evaluate(() => window.ready)
const R = await bp.evaluate(() => window.renderPage())
await bp.waitForFunction(() => [...document.images].every(i => i.complete))
const src = path.join(out, 'chromium.pdf')
await bp.pdf({ path: src, preferCSSPageSize: true, printBackground: true }); await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }

const gs = args => execFileSync(GS, ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', ...args], { maxBuffer: 1 << 28 }).toString()
const cmyk = ['-sDEVICE=pdfwrite', '-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK']
// How Chromium writes black: uncompressed copy, colour unchanged
const plain = path.join(out, 'chromium-plain.pdf')
gs(['-sDEVICE=pdfwrite', '-dCompressPages=false', '-sColorConversionStrategy=LeaveColorUnchanged', `-sOutputFile=${plain}`, src])
const plainTxt = fs.readFileSync(plain, 'latin1')
const ops = { 'rg (RGB fill)': /(^|\s)0 0 0 rg\b/gm, 'RG (RGB stroke)': /(^|\s)0 0 0 RG\b/gm, 'sc/scn (colour space fill)': /(^|\s)0 0 0 scn?\b/gm, 'g (gray fill)': /(^|\s)0 g\b/gm, 'k (CMYK fill)': /(^|\s)0 0 0 1 k\b/gm }
const blackOps = Object.fromEntries(Object.entries(ops).map(([k, re]) => [k, (plainTxt.match(re) || []).length]))
const rewritten = path.join(out, 'rewritten-src.pdf')
// every neutral RGB colour (r = g = b: black, greys, white) becomes K only: a a a rg -> 0 0 0 (1-a) k, same for RG/K
const neutral = (op, a) => `0 0 0 ${+(1 - Number(a)).toFixed(5)} ${op === 'rg' ? 'k' : 'K'}`
fs.writeFileSync(rewritten, plainTxt.replace(/(^|\s)([\d.]+) \2 \2 (rg|RG)\b/gm, (_, s, a, op) => s + neutral(op, a)), 'latin1')

const routes = {
  gray: ['-sDEVICE=pdfwrite', '-sColorConversionStrategy=Gray', '-sProcessColorModel=DeviceGray', src],
  cmyk: [...cmyk, src],
  rewrite: [...cmyk, rewritten],
  blacktext: [...cmyk, '-dBlackText', '-dBlackVector', src],
}
const DPI = 200, S = DPI / 96   // CSS px -> plate px

// Uncompressed 8-bit single-channel TIFF (what tiffsep writes with -sCompression=none) -> {w, h, ink: 0..255}
function readTiff(file) {
  const b = fs.readFileSync(file), le = b.toString('latin1', 0, 2) === 'II'
  const u16 = o => le ? b.readUInt16LE(o) : b.readUInt16BE(o), u32 = o => le ? b.readUInt32LE(o) : b.readUInt32BE(o)
  const ifd = u32(4), n = u16(ifd), tag = {}
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12, t = u16(e), type = u16(e + 2), cnt = u32(e + 4), size = type === 3 ? 2 : 4
    const at = cnt * size > 4 ? u32(e + 8) : e + 8, rd = k => size === 2 ? u16(at + k * 2) : u32(at + k * 4)
    tag[t] = Array.from({ length: cnt }, (_, k) => rd(k))
  }
  if ((tag[259]?.[0] ?? 1) !== 1 || (tag[258]?.[0] ?? 1) !== 8) throw new Error(`${file}: need uncompressed 8-bit`)
  const w = tag[256][0], h = tag[257][0], ink = new Uint8Array(w * h), white = (tag[262]?.[0] ?? 0) === 1
  let p = 0
  for (const [k, off] of tag[273].entries()) for (let j = 0; j < tag[279][k]; j++) ink[p++] = white ? 255 - b[off + j] : b[off + j]
  return { w, h, ink }
}

// Ghostscript puts font dictionaries in compressed object streams: inflate every stream before looking
const fontCheck = f => { const b = fs.readFileSync(f); let raw = b.toString('latin1')
  for (const m of raw.matchAll(/stream\r?\n/g)) { try { raw += zlib.inflateSync(b.subarray(m.index + m[0].length)).toString('latin1') } catch { /* not Flate */ } } const names = [...new Set([...raw.matchAll(/\/BaseFont\s*\/([^\s/[\]<>()]+)/g)].map(m => m[1]))]
  return { fonts: names.length, notSubset: names.filter(x => !/^[A-Z]{6}\+/.test(x)).length, notEmbedded: Math.max(0, (raw.match(/\/Type\s*\/FontDescriptor/g) || []).length - (raw.match(/\/FontFile[23]?\b/g) || []).length) } }

const regions = { 'body text': R.body, headline: [R.headline], 'thick rule': [R.rule], hairline: [R.hairline], 'tint box (15% grey)': [R.tint], 'text on tint': [R.tintText], 'red kicker': [R.kicker], 'blue panel': [R.panel], photo: [R.photo] }
const result = { date: new Date().toISOString(), ghostscript: gs(['-v']).split('\n')[0] || GS, dpi: DPI, chromiumBlack: blackOps, routes: {} }
for (const [name, args] of Object.entries(routes)) {
  const pdf = path.join(out, `${name}.pdf`), sep = path.join(out, `${name}-sep.tif`)
  gs([...args.slice(0, -1), `-sOutputFile=${pdf}`, args.at(-1)])
  gs(['-sDEVICE=tiffsep', `-r${DPI}`, '-sCompression=none', `-sOutputFile=${sep}`, pdf])
  const plates = Object.fromEntries(['Cyan', 'Magenta', 'Yellow', 'Black'].map(c => [c, readTiff(sep.replace(/\.tif$/, `(${c}).tif`))]))
  const { w } = plates.Black
  const each = (boxes, fn) => { for (const b of boxes) for (let y = Math.round(b.y * S); y < Math.round((b.y + b.h) * S); y++) for (let x = Math.round(b.x * S); x < Math.round((b.x + b.w) * S); x++) fn(y * w + x) }
  const r = {}
  for (const [k, boxes] of Object.entries(regions)) {
    let inked = 0, cmyOnInk = 0, kOnly = 0
    const tot = []
    each(boxes, i => {
      const c = plates.Cyan.ink[i], m = plates.Magenta.ink[i], yy = plates.Yellow.ink[i], kk = plates.Black.ink[i]
      // on the tint, only the solid text strokes count (the 15% grey under them is checked as its own region)
      if (k === 'text on tint' ? kk >= 230 : c + m + yy + kk > 12) { inked++; if (c > 6 || m > 6 || yy > 6) cmyOnInk++; else kOnly++ }
      if (k === 'photo') tot.push((c + m + yy + kk) / 2.55)
    })
    r[k] = { inkedPx: inked, kOnlyPct: inked ? +(100 * kOnly / inked).toFixed(2) : null }
    if (k === 'photo') { tot.sort((a, b) => a - b); r[k] = { ...r[k], totalInkMaxPct: +tot.at(-1).toFixed(0), totalInkP99Pct: +tot[Math.floor(0.99 * (tot.length - 1))].toFixed(0), over260Pct: +(100 * tot.filter(v => v > 260).length / tot.length).toFixed(2) } }
  }
  // whole-page coverage per plate, Ghostscript's own count
  const inkcov = gs(['-sDEVICE=inkcov', '-o', '-', pdf]).trim().split(/\s+/).slice(0, 4).map(Number)
  result.routes[name] = { regions: r, inkcov: { C: inkcov[0], M: inkcov[1], Y: inkcov[2], K: inkcov[3] }, ...fontCheck(pdf) }
  // demo crops: top of the page, each plate as its ink colour, half resolution
  const cx = 0, cy = Math.round(R.kicker.y * S) - 10, cw = Math.round((R.tint.x + R.tint.w + 30) * S), ch = Math.round((R.photo.y + R.photo.h + 60) * S) - cy
  const tint = { Cyan: [0, 160, 230], Magenta: [230, 0, 126], Yellow: [255, 220, 0], Black: [0, 0, 0] }
  for (const [c, p] of Object.entries(plates)) {
    const cv = createCanvas(cw >> 1, ch >> 1), g = cv.getContext('2d'), im = g.createImageData(cw >> 1, ch >> 1)
    for (let y = 0; y < ch >> 1; y++) for (let x = 0; x < cw >> 1; x++) {
      const a = p.ink[(cy + 2 * y) * w + cx + 2 * x] / 255, o = (y * (cw >> 1) + x) * 4
      for (let j = 0; j < 3; j++) im.data[o + j] = Math.round(255 - a * (255 - tint[c][j])); im.data[o + 3] = 255
    }
    g.putImageData(im, 0, 0); fs.writeFileSync(path.join(demo, `${name}-${c}.png`), cv.toBuffer('image/png'))
  }
  for (const f of fs.readdirSync(out)) if (f.startsWith(`${name}-sep`)) fs.rmSync(path.join(out, f))
}
fs.writeFileSync(path.join(root, 'spike/out/black.json'), JSON.stringify(result, null, 1))

const rw = result.routes.rewrite.regions, ph = result.routes.cmyk.regions.photo
const RECOMMENDATION = `<b>Recommendation (from the run on this page).</b> Colour pages: the <b>rewrite</b> route (neutral RGB to K-only CMYK, then Ghostscript CMYK). Black text, rules and grey tints are ${rw['body text'].kOnlyPct}% / ${rw['thick rule'].kOnlyPct}% / ${rw['tint box (15% grey)'].kOnlyPct}% on K only, and the red kicker, blue panel and photo keep their colour. Mono pages: the <b>gray</b> route. Do not use <b>blacktext</b>: it also turns the red kicker and the blue panel black (${result.routes.blacktext.regions['red kicker'].kOnlyPct}% and ${result.routes.blacktext.regions['blue panel'].kOnlyPct}% K only). The plain <b>cmyk</b> route puts black text on all four plates (${result.routes.cmyk.regions['body text'].kOnlyPct}% K only), so text blurs on any misregistration. <b>Open:</b> the photo reaches ${ph.totalInkMaxPct}% total ink (${ph.over260Pct}% of its area over 260%) with Ghostscript's default profile. Newsprint presses usually limit total ink to about 240&ndash;260%, so the conversion needs the printer's ICC profile (GG-013). The rewrite works on the colour operators Chromium writes today (${Object.values(result.chromiumBlack).reduce((a, b) => a + b, 0)} black operator(s) found); a Chromium update that writes colour another way would make it miss silently (GG-025). <b>Caveat:</b> all routes knock out (the colour under black text is cut away). On this page the tint is K only, so that is harmless here. Black text over a photo or colour panel would leave a white halo on any misregistration, and many newspaper presses overprint black instead. Ask the printer (GG-027).`

// demo page (CLAUDE.md rule 17): K-only table and the plates side by side
// green = what that route should do: black/grey regions on K only; colour regions keep colour (gray route: mono, all K)
const COLOUR = new Set(['red kicker', 'blue panel', 'photo'])
const names = Object.keys(result.routes)
// null = no solid-K pixel at all (text on tint went rich black): a failure where K only is wanted
const cell = (v, want) => v === null ? `<td class="${want ? 'no' : 'ok'}">no solid K</td>` : `<td class="${(want ? v >= 99.9 : v < 50) ? 'ok' : 'no'}">${v}%</td>`
const row = (label, f) => `<tr><td>${label}</td>${names.map(n => f(result.routes[n], n)).join('')}</tr>`
const table = `<tr><th>Region: share of inked pixels on K only (green = right for that route)</th>${names.map(n => `<th>${n}</th>`).join('')}</tr>` +
  Object.keys(regions).map(k => row(k, (r, n) => cell(r.regions[k].kOnlyPct, !COLOUR.has(k) || n === 'gray'))).join('') +
  row('Photo total ink: max / 99th pct / share over 260%', r => `<td>${r.regions.photo.totalInkMaxPct}% / ${r.regions.photo.totalInkP99Pct}% / ${r.regions.photo.over260Pct}%</td>`) +
  row('Fonts embedded / subset', r => `<td>${r.fonts - r.notEmbedded}/${r.fonts}, ${r.fonts - r.notSubset}/${r.fonts}</td>`) +
  row('Ghostscript inkcov, whole page, % (C M Y K)', r => `<td>${['C', 'M', 'Y', 'K'].map(c => (100 * r.inkcov[c]).toFixed(1)).join(' ')}</td>`)
const plates = names.map(n => `<h3>${n}</h3><div class="pl">${['Cyan', 'Magenta', 'Yellow', 'Black'].map(c => `<figure><img src="g0-black-prep/${n}-${c}.png" alt="${n} ${c} plate"><figcaption>${c}</figcaption></figure>`).join('')}</div>`).join('\n')
fs.writeFileSync(path.join(root, 'demos/g0-black-prep.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G0.black prep</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1200px;color:#222;background:#f4f4f4}a{color:#05c}
table{border-collapse:collapse;background:#fff;margin:8px 0 16px}td,th{text-align:left;padding:5px 10px;border-bottom:1px solid #e3e3e3}
td.ok{background:#e3f4e6}td.no{background:#fbe3e3}td.mid{background:#fff3cd}.w{background:#fff3cd;border-left:4px solid #e0b100;padding:8px 12px}
.p{background:#eef6ff;border-left:4px solid #05c;padding:8px 12px}.pl{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
figure{margin:0}figure img{width:100%;border:1px solid #ccc;background:#fff}figcaption{font-size:13px;color:#666}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p>
<h1>G0.black prep: where black text lands on the plates</h1>
<p class="w"><b>Assumed grid and press.</b> A3, 12 mm margins, 5 columns, 4 mm gutter, 9 pt body (GG-007). The CMYK conversion uses Ghostscript's default profile, not the printer's ICC profile (not received yet). The photo is synthetic, drawn in canvas. <b>G0.black is not recorded</b>: it needs Amal's check of a physical proof.</p>
<p>One test page set the export way (flow() lines drawn absolutely), printed by Chromium, then run through four Ghostscript routes and separated with <code>tiffsep</code> at ${DPI} dpi. ${result.ghostscript}, ${result.date.slice(0, 16).replace('T', ' ')} UTC. Chromium writes black as RGB: ${Object.entries(result.chromiumBlack).map(([k, v]) => `${k} &times;${v}`).join(', ')}.</p>
<table>${table}</table>
<p class="p">__RECOMMENDATION__</p>
<h2>Plates (top of the page, each plate in its ink colour)</h2>
${plates}
<p class="d">Rebuild: <code>node scripts/black-spike.mjs</code> (PDFs in <code>spike/out/black/</code>, numbers in <code>spike/out/black.json</code>).</p>
</body></html>
`.replace('__RECOMMENDATION__', RECOMMENDATION))
console.log(JSON.stringify(result, null, 1))
