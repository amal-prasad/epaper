// Phase 0 spike runner: builds, serves, drives Chromium, writes out/report.md + out/report.json
// node run.mjs                     launch fonts only (launch:true in fonts.json)  -> decides the gate
// node run.mjs --all               every font in fonts.json that is installed
// node run.mjs --fonts "Halant,Hind"
// node run.mjs --quick             fewer sizes/widths (about 3x faster, for screening many fonts)
import { build } from 'esbuild'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = path.dirname(fileURLToPath(import.meta.url))
const pub = path.join(root, 'public'), out = path.join(root, 'out')
fs.mkdirSync(out, { recursive: true })

const argv = process.argv.slice(2)
const flag = n => argv.includes(n)
const val = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }

if (!fs.existsSync(path.join(pub, 'fonts.css'))) {
  console.error('public/fonts.css is missing. Run:  node add-fonts.mjs   (inside the spike folder) and then run this again.')
  process.exit(1)
}

await build({ entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'esm',
  outfile: path.join(pub, 'bundle.js'), minify: false, logLevel: 'error' })

// ---- samples: every .txt in samples/, paragraphs split on blank lines. Drop real Janshakti stories in samples/.
const paras = fs.readdirSync(path.join(root, 'samples')).filter(f => f.endsWith('.txt'))
  .flatMap(f => fs.readFileSync(path.join(root, 'samples', f), 'utf8').split(/\n\s*\n/))
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40)

// ---- fonts
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'fonts.json'), 'utf8')).fonts
const installed = new Set((fs.readFileSync(path.join(pub, 'fonts.css'), 'utf8').match(/font-family:\s*'([^']*)'/g) || []).map(s => s.replace(/.*'([^']*)'.*/, '$1')))
let chosen
if (val('--fonts')) { const want = val('--fonts').split(',').map(s => s.trim()); chosen = cfg.filter(f => want.includes(f.name)) }
else if (flag('--all')) chosen = cfg
else chosen = cfg.filter(f => f.launch)
const skipped = chosen.filter(f => !installed.has(f.name)).map(f => f.name)
chosen = chosen.filter(f => installed.has(f.name))
if (skipped.length) console.warn(`Skipping fonts not installed (run node add-fonts.mjs): ${skipped.join(', ')}`)
if (!chosen.length) { console.error('No fonts to test.'); process.exit(1) }
const FONTS = chosen.map(f => f.name)

const quick = flag('--quick')
const SIZES = quick ? [{ size: 14, lh: 21 }] : [{ size: 12, lh: 18 }, { size: 14, lh: 21 }]
const WIDTHS = quick ? [110, 180] : [90, 110, 140, 180, 240]   // 6-col .. 2-col newspaper columns, in CSS px
const OBST = quick ? [{ obsW: 70, obsH: 60, gap: 8 }] : [{ obsW: 70, obsH: 60, gap: 8 }, { obsW: 100, obsH: 90, gap: 8 }]

// ---- halant / conjunct stress words (synthetic, not news copy)
const HALANT = {
  'final halant': ['विद्वान्', 'महत्', 'साक्षात्', 'जगत्', 'सम्राट्', 'तत्क्षण्', 'अर्थात्', 'भगवन्', 'संसद्', 'श्रीमान्'],
  'conjuncts': ['क्षत्रिय', 'ज्ञान', 'श्रद्धा', 'द्वारा', 'उद्घाटन', 'प्रस्तुत', 'स्वास्थ्य', 'सम्पूर्ण', 'उत्कृष्ट', 'राष्ट्रीय', 'सुनिश्चित', 'प्रबंधन', 'विद्यालय', 'अनुच्छेद', 'सत्त्व', 'द्भव', 'ह्मण', 'न्न', 'ट्ट', 'ड्ड', 'ल्ल'],
  'reph/rakar': ['धर्म', 'कार्य', 'सूर्य', 'कर्त्तव्य', 'मार्ग', 'राष्ट्र', 'प्रधानमंत्री', 'क्रिकेट', 'ट्रेन', 'ड्राइवर', 'श्री', 'निर्माण', 'वर्ष'],
  'ZWJ/ZWNJ': ['क्‍ष', 'क्‌ष', 'स्‍व', 'द्‍य', 'त्‍त', 'ड्‌ड'],
  'nukta': ['ज़रूर', 'फ़ैसला', 'क़ानून', 'ख़बर', 'पढ़ाई', 'बढ़ती', 'ग़रीब'],
  'matras': ['ऑफिस', 'डॉक्टर', 'कॉलेज', 'आँख', 'मंत्री', 'रुपये', 'पूर्ण', 'ऋषि', 'ॐ'],
}
const halantWords = Object.values(HALANT).flat()
const halantParas = Array.from({ length: 20 }, (_, i) => halantWords.slice(i, i + 14).join(' ') + ' ' + halantWords.slice(0, 5).join(' '))

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.css': 'text/css' }
const server = http.createServer((q, s) => {
  const f = path.join(pub, q.url === '/' ? 'index.html' : q.url.split('?')[0])
  if (!f.startsWith(pub) || !fs.existsSync(f)) { s.writeHead(404).end(); return }
  s.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f))
}).listen(0)
const url = `http://localhost:${server.address().port}/`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
await page.goto(url)
await page.waitForFunction(() => window.spikeReady)

const rows = []
for (const font of FONTS) for (const { size, lh } of SIZES) for (const width of WIDTHS) {
  let ok = 0, tot = 0, heightMiss = 0, fails = []
  for (const [i, text] of paras.entries()) {
    const r = await page.evaluate(a => window.runColumn(a), { text, font, size, lh, width })
    tot++; if (r.match) ok++; else fails.push({ para: i, ...r })
    if (r.domH !== null && Math.abs(r.domH - r.preH) > 0.5) heightMiss++
  }
  rows.push({ test: 'column', font, size, width, ok, tot, heightMiss, fails: fails.slice(0, 2) })
}
for (const font of FONTS) for (const o of OBST) for (const width of [240, 320]) {
  let ok = 0, tot = 0, fails = []
  for (const [i, text] of paras.entries()) {
    const r = await page.evaluate(a => window.runObstacle(a), { text, font, size: 14, lh: 21, width, ...o })
    tot++; if (r.match) ok++; else fails.push({ para: i, ...r })
  }
  rows.push({ test: 'obstacle', font, size: 14, width, obs: `${o.obsW}x${o.obsH}`, ok, tot, fails: fails.slice(0, 2) })
}
// halant: break parity on dense synthetic paragraphs + word-width agreement canvas vs DOM
const halant = {}
for (const font of FONTS) {
  let ok = 0, tot = 0
  for (const size of [12, 14]) for (const width of [60, 80, 110, 140, 180, 240]) for (const t of halantParas) {
    const r = await page.evaluate(a => window.runColumn(a), { text: t, font, size, lh: Math.round(size * 1.5), width })
    tot++; if (r.match) ok++
  }
  const agree = await page.evaluate(a => window.runWords(a), { words: halantWords, font, size: 14 })
  halant[font] = { breakOk: ok, breakTot: tot, widthOk: agree.filter(Boolean).length, widthTot: agree.length }
}
const perf = await page.evaluate(a => window.runPerf(a), { text: paras.join(' '), font: FONTS[0], size: 14, lh: 21, width: 240, frames: 2000 })
await browser.close(); server.close()

// ---- per-font summary
const GATE = 99.5
const perFont = FONTS.map(font => {
  const r = rows.filter(x => x.font === font), ok = r.reduce((a, x) => a + x.ok, 0), tot = r.reduce((a, x) => a + x.tot, 0)
  const h = halant[font], meta = cfg.find(f => f.name === font)
  const real = +(100 * ok / tot).toFixed(1), hb = +(100 * h.breakOk / h.breakTot).toFixed(1)
  return { font, role: meta.role, launch: !!meta.launch, real, halantBreaks: hb, halantWidths: `${h.widthOk}/${h.widthTot}`,
    verdict: real >= GATE && hb >= 99 && h.widthOk === h.widthTot ? 'PASS' : real >= 95 ? 'CAVEAT' : 'FAIL' }
}).sort((a, b) => b.real - a.real)

const launchRows = rows.filter(r => cfg.find(f => f.name === r.font)?.launch)
const gateRows = launchRows.length ? launchRows : rows
const sum = gateRows.reduce((a, r) => ({ ok: a.ok + r.ok, tot: a.tot + r.tot }), { ok: 0, tot: 0 })
const sumAll = rows.reduce((a, r) => ({ ok: a.ok + r.ok, tot: a.tot + r.tot }), { ok: 0, tot: 0 })
const pct = +(100 * sum.ok / sum.tot).toFixed(1), pctAll = +(100 * sumAll.ok / sumAll.tot).toFixed(1)
const scope = launchRows.length ? 'launch fonts' : 'tested fonts'

let md = `# Phase 0 spike report\n\n- Paragraphs tested: ${paras.length}\n- Fonts tested: ${FONTS.length}${quick ? ' (quick mode)' : ''}\n`
md += `- Line-break match vs real browser DOM, ${scope}: **${sum.ok}/${sum.tot} (${pct}%)**  <- gate metric\n`
md += `- Same, all tested fonts: ${sumAll.ok}/${sumAll.tot} (${pctAll}%)\n`
md += `- Drag simulation (${perf.frames} obstacle re-layouts, ${perf.linesPerFrame} lines each): ${perf.msPerFrame} ms/frame\n\n`
md += `## Verdict rule (per font)\n- real copy >= 99.5% and halant checks clean: PASS, Pretext as live engine for that font\n- 95-99.5%: CAVEAT, Pretext for live preview only, HarfBuzz server layout for final output\n- < 95%: FAIL, do not use live; server layout only\n\n`
md += `## Per-font summary (sorted by real-copy parity)\n\n| font | role | launch | real copy match | halant break match | halant widths agree | verdict |\n|---|---|---|---|---|---|---|\n`
for (const p of perFont) md += `| ${p.font} | ${p.role} | ${p.launch ? 'yes' : ''} | ${p.real}% | ${p.halantBreaks}% | ${p.halantWidths} | ${p.verdict} |\n`
md += `\n## Results\n\n| test | font | px | col width | obstacle | match | height mismatches |\n|---|---|---|---|---|---|---|\n`
for (const r of rows) md += `| ${r.test} | ${r.font} | ${r.size} | ${r.width} | ${r.obs ?? '-'} | ${r.ok}/${r.tot} | ${r.heightMiss ?? '-'} |\n`
md += `\n## Sample failures\n`
for (const r of rows.filter(r => r.fails.length)) for (const f of r.fails)
  md += `\n- ${r.test} / ${r.font} / ${r.size}px / w=${r.width}${r.obs ? ' / ' + r.obs : ''} / para ${f.para}: line ${f.firstDiff}\n  - DOM: \`${f.domAt}\`\n  - Pretext: \`${f.preAt}\`\n`
fs.writeFileSync(path.join(out, 'report.md'), md)
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ pct, pctAll, scope, perFont, perf, rows }, null, 2))
console.log(md.split('## Results')[0]); console.log(`Full report: ${path.join(out, 'report.md')}`)
