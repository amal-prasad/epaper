// Phase 0 spike runner: builds, serves, drives Chromium, writes out/report.md + out/report.json
//
// Gate runs:
//   node run.mjs                       G0.parity, writes out/report.*: launch body fonts (launch:true, role text/text-serif), body sizes 12/14 px, weight 400
//   node run.mjs --headline-gate       G0.headline, writes out/headline.*: launch fonts with role headline, text or text-serif (body fonts set subheads and kickers in bold), weight 700,
//                                      18/24/30/36 px, 1-4 column widths of the assumed A3 grid, the real headlines in headlines/*.txt
// Screening runs (write out/report-screen.* unless --out <name> is given, so they never overwrite the gate report):
//   node run.mjs --all                 every installed font in fonts.json
//   node run.mjs --fonts "Halant,Hind"
//   node run.mjs --roles headline,display
//   node run.mjs --quick               fewer sizes/widths (about 3x faster)
//   node run.mjs --headline            headline sizes 20-48 px, bold, wide columns, roles headline+display+handwritten
//   node run.mjs --sizes 9,10,11 --weights 400,700 --widths 70,90,140
//
// Besides the match rate it classifies every mismatch at the first differing line:
//   under = Pretext broke earlier than the browser (line slightly loose: harmless in print)
//   over  = Pretext put MORE on the line than the browser (text would run past the column: visible in print)
// longerThanDom = over + unclassified, on the gate fonts. G0.parity requires 0.
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
// news-sample.txt is invented text; the gate reports it separately and refuses to pass while it is present.
const INVENTED = new Set(['news-sample.txt'])
const sampleFiles = fs.readdirSync(path.join(root, 'samples')).filter(f => f.endsWith('.txt')).sort()
const parasOf = f => fs.readFileSync(path.join(root, 'samples', f), 'utf8').split(/\n\s*\n/)
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40)
const byFile = Object.fromEntries(sampleFiles.map(f => [f, parasOf(f).length]))
const headlineGate = flag('--headline-gate')
// headline gate: one real headline per line in headlines/*.txt, instead of the body paragraphs
const headlineFiles = headlineGate ? fs.readdirSync(path.join(root, 'headlines')).filter(f => f.endsWith('.txt')).sort() : []
const headlines = headlineFiles.flatMap(f => fs.readFileSync(path.join(root, 'headlines', f), 'utf8').split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean))
if (headlineGate) Object.assign(byFile, Object.fromEntries(headlineFiles.map(f => [`headlines/${f}`, null])))
const paras = headlineGate ? headlines : sampleFiles.flatMap(parasOf)
const inventedParagraphs = headlineGate ? 0 : sampleFiles.filter(f => INVENTED.has(f)).reduce((a, f) => a + byFile[f], 0)
const realParagraphs = paras.length - inventedParagraphs
if (!paras.length) { console.error('No paragraphs in spike/samples/*.txt (blank line between paragraphs, each > 40 characters).'); process.exit(1) }

// ---- fonts
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'fonts.json'), 'utf8')).fonts
const installed = new Set((fs.readFileSync(path.join(pub, 'fonts.css'), 'utf8').match(/font-family:\s*'([^']*)'/g) || []).map(s => s.replace(/.*'([^']*)'.*/, '$1')))
const list = n => val(n) ? val(n).split(',').map(s => s.trim()).filter(Boolean) : null
const headline = flag('--headline')
const roles = list('--roles') || (headline && !val('--fonts') && !flag('--all') ? ['headline', 'display', 'handwritten'] : null)
let chosen
if (val('--fonts')) { const want = list('--fonts'); chosen = cfg.filter(f => want.includes(f.name)); const unknown = want.filter(w => !cfg.some(f => f.name === w)); if (unknown.length) console.warn(`Not in fonts.json: ${unknown.join(', ')}`) }
else if (flag('--all') || roles) chosen = cfg
else if (headlineGate) chosen = cfg.filter(f => f.launch && ['headline', 'text', 'text-serif'].includes(f.role))
else chosen = cfg.filter(f => f.launch && ['text', 'text-serif'].includes(f.role))   // display/handwritten launch fonts: no gate yet (GG-022)
if (roles) chosen = chosen.filter(f => roles.includes(f.role))
const skipped = chosen.filter(f => !installed.has(f.name)).map(f => f.name)
chosen = chosen.filter(f => installed.has(f.name))
if (skipped.length) console.warn(`Skipping fonts not installed (run node add-fonts.mjs): ${skipped.join(', ')}`)
if (!chosen.length) { console.error('No fonts to test.'); process.exit(1) }
const FONTS = chosen.map(f => f.name)
const hasWeight = (font, w) => (cfg.find(f => f.name === font)?.weights || [400]).includes(w)

const quick = flag('--quick')
const lhFor = size => Math.round(size * (size >= 18 && headlineGate || size >= 20 ? 1.2 : 1.5))
const nums = n => list(n)?.map(Number).filter(x => Number.isFinite(x) && x > 0)
// Assumed grid until the printer's spec sheet arrives (GG-007): A3 297 mm wide, 12 mm margins, 5 columns, 4 mm gutter.
const mmPx = mm => mm * 96 / 25.4, gridCol = (297 - 2 * 12 - 4 * 4) / 5
const GRID_WIDTHS = [1, 2, 3, 4].map(n => +mmPx(n * gridCol + (n - 1) * 4).toFixed(2))   // 194.27 / 403.65 / 613.04 / 822.43 px
const SIZES = (nums('--sizes') || (headlineGate ? [18, 24, 30, 36] : headline ? [20, 28, 36, 48] : quick ? [14] : [12, 14])).map(size => ({ size, lh: lhFor(size) }))
const WIDTHS = nums('--widths') || (headlineGate ? GRID_WIDTHS : headline ? [140, 240, 360, 480] : quick ? [110, 180] : [90, 110, 140, 180, 240])   // CSS px; 90 = 6-col, 240 = 2-col
const WEIGHTS = nums('--weights') || (headline || headlineGate ? [700] : [400])
const OBST = headline || headlineGate ? [] : quick ? [{ obsW: 70, obsH: 60, gap: 8 }] : [{ obsW: 70, obsH: 60, gap: 8 }, { obsW: 100, obsH: 90, gap: 8 }]
const HALANT_SIZES = headline || headlineGate ? [28] : [12, 14], HALANT_WIDTHS = headline || headlineGate ? [140, 240, 360] : [60, 80, 110, 140, 180, 240]
const screening = ['--all', '--fonts', '--roles', '--quick', '--headline', '--sizes', '--widths', '--weights'].some(flag)
const OUT = val('--out') || (screening ? 'report-screen' : headlineGate ? 'headline' : 'report')
const mode = screening ? 'screen' : 'gate'

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

// at the first differing line: did Pretext put more (over) or less (under) on it than the browser?
const direction = r => {
  if (r.match) return null
  if (typeof r.domAt !== 'string' || typeof r.preAt !== 'string') return 'other'
  const d = [...r.domAt].length, p = [...r.preAt].length
  return p > d ? 'over' : p < d ? 'under' : 'other'
}
const tally = () => ({ ok: 0, tot: 0, over: 0, under: 0, other: 0, fails: [], overs: [] })
const add = (t, i, r) => { t.tot++; const d = direction(r); if (!d) { t.ok++; return }
  t[d]++; const f = { para: i, dir: d, firstDiff: r.firstDiff, domAt: r.domAt, preAt: r.preAt }
  if (t.fails.length < 2) t.fails.push(f); if (d !== 'under' && t.overs.length < 20) t.overs.push(f) }
const strip = ({ fails, overs, ...t }) => t
const skippedCombos = []

const rows = []
for (const font of FONTS) for (const weight of WEIGHTS) {
  if (!hasWeight(font, weight)) { skippedCombos.push(`${font} ${weight}`); continue }
  for (const { size, lh } of SIZES) for (const width of WIDTHS) {
    const t = tally(); let heightMiss = 0
    for (const [i, text] of paras.entries()) {
      const r = await page.evaluate(a => window.runColumn(a), { text, font, size, lh, width, weight })
      add(t, i, r)
      if (r.domH !== null && Math.abs(r.domH - r.preH) > 0.5) heightMiss++
    }
    rows.push({ test: 'column', font, weight, size, width, ...strip(t), heightMiss, fails: t.fails, overs: t.overs })
  }
  for (const o of OBST) for (const width of [240, 320]) {
    const t = tally()
    for (const [i, text] of paras.entries()) add(t, i, await page.evaluate(a => window.runObstacle(a), { text, font, size: 14, lh: 21, width, weight, ...o }))
    rows.push({ test: 'obstacle', font, weight, size: 14, width, obs: `${o.obsW}x${o.obsH}`, ...strip(t), fails: t.fails, overs: t.overs })
  }
}
// halant: break parity on dense synthetic paragraphs + word-width agreement canvas vs DOM
const halant = {}
for (const font of FONTS) {
  const w = WEIGHTS.find(x => hasWeight(font, x)); if (w === undefined) continue
  let ok = 0, tot = 0
  for (const size of HALANT_SIZES) for (const width of HALANT_WIDTHS) for (const t of halantParas) {
    const r = await page.evaluate(a => window.runColumn(a), { text: t, font, size, lh: lhFor(size), width, weight: w })
    tot++; if (r.match) ok++
  }
  const agree = await page.evaluate(a => window.runWords(a), { words: halantWords, font, size: HALANT_SIZES.at(-1), weight: w })
  halant[font] = { breakOk: ok, breakTot: tot, widthOk: agree.filter(Boolean).length, widthTot: agree.length }
}
const perf = await page.evaluate(a => window.runPerf(a), { text: paras.join(' '), font: FONTS[0], size: 14, lh: 21, width: 240, frames: headline ? 200 : 2000 })
await browser.close(); server.close()

// ---- per-font summary
const GATE = 99.5
const sumRows = rs => rs.reduce((a, r) => ({ ok: a.ok + r.ok, tot: a.tot + r.tot, over: a.over + r.over + r.other, under: a.under + r.under }), { ok: 0, tot: 0, over: 0, under: 0 })
const perFont = FONTS.filter(f => halant[f]).map(font => {
  const s = sumRows(rows.filter(x => x.font === font)), h = halant[font], meta = cfg.find(f => f.name === font)
  const real = +(100 * s.ok / s.tot).toFixed(1), hb = +(100 * h.breakOk / h.breakTot).toFixed(1)
  const clean = hb >= 99 && h.widthOk === h.widthTot
  return { font, role: meta.role, launch: !!meta.launch, real, over: s.over, under: s.under, halantBreaks: hb, halantWidths: `${h.widthOk}/${h.widthTot}`,
    verdict: real >= GATE && clean && s.over === 0 ? 'PASS' : real >= 95 ? (s.over ? 'CAVEAT (overflows)' : 'CAVEAT') : 'FAIL' }
}).sort((a, b) => (a.over - b.over) || (b.real - a.real))

const launchRows = rows.filter(r => cfg.find(f => f.name === r.font)?.launch)
const gateRows = mode === 'gate' && launchRows.length ? launchRows : rows
const sum = sumRows(gateRows), sumAll = sumRows(rows)
const pct = +(100 * sum.ok / sum.tot).toFixed(1), pctAll = +(100 * sumAll.ok / sumAll.tot).toFixed(1)
const longerThanDom = sum.over
const scope = mode === 'gate' && launchRows.length ? 'launch fonts' : 'tested fonts'
const desc = `${SIZES.map(s => s.size).join('/')} px, weight ${WEIGHTS.join('/')}, widths ${WIDTHS.join('/')} px${quick ? ', quick' : ''}`

let md = `# Phase 0 spike report (${mode === 'gate' ? (headlineGate ? 'GATE run, G0.headline' : 'GATE run') : 'screening run, not the gate'})\n\n- ${headlineGate ? 'Headlines' : 'Paragraphs'} tested: ${paras.length} (${realParagraphs} real, ${inventedParagraphs} invented)\n- Fonts tested: ${perFont.length} at ${desc}\n`
if (headlineGate) md += `- Widths are 1-4 columns of an ASSUMED grid (A3, 12 mm margins, 5 columns, 4 mm gutter; GG-007) until the printer's spec sheet arrives\n`
md += `- Line-break match vs real browser DOM, ${scope}: **${sum.ok}/${sum.tot} (${pct}%)**${mode === 'gate' ? '  <- gate metric' : ''}\n`
md += `- Lines where Pretext fits MORE than the browser (would overflow in print), ${scope}: **${longerThanDom}**${mode === 'gate' ? '  <- must be 0' : ''}; lines where it breaks earlier (harmless): ${sum.under}\n`
md += `- Same, all tested fonts: ${sumAll.ok}/${sumAll.tot} (${pctAll}%), ${sumAll.over} over\n`
md += `- Drag simulation (${perf.frames} obstacle re-layouts, ${perf.linesPerFrame} lines each): ${perf.msPerFrame} ms/frame\n`
if (skippedCombos.length) md += `- Not tested (weight not in the font): ${skippedCombos.join(', ')}\n`
md += `\n## Verdict rule (per font)\n- real copy >= 99.5%, halant checks clean and 0 overflows: PASS, Pretext as live engine for that font\n- 95-99.5%, or any overflow: CAVEAT, Pretext for live preview only, server layout for final output\n- < 95%: FAIL, do not use live; server layout only\n\n`
md += `## Per-font summary (overflows first, then by parity)\n\n| font | role | launch | real copy match | overflows | early breaks | halant break match | halant widths agree | verdict |\n|---|---|---|---|---|---|---|---|---|\n`
for (const p of perFont) md += `| ${p.font} | ${p.role} | ${p.launch ? 'yes' : ''} | ${p.real}% | ${p.over} | ${p.under} | ${p.halantBreaks}% | ${p.halantWidths} | ${p.verdict} |\n`
const overs = rows.flatMap(r => r.overs.map(f => ({ r, f })))
if (overs.length) {
  md += `\n## Overflows (Pretext fits more than the browser)\n`
  for (const { r, f } of overs.slice(0, 60)) md += `\n- ${r.test} / ${r.font} ${r.weight} / ${r.size}px / w=${r.width}${r.obs ? ' / ' + r.obs : ''} / para ${f.para}: line ${f.firstDiff} (${f.dir})\n  - DOM: \`${f.domAt}\`\n  - Pretext: \`${f.preAt}\`\n`
}
md += `\n## Results\n\n| test | font | weight | px | col width | obstacle | match | over | early | height mismatches |\n|---|---|---|---|---|---|---|---|---|---|\n`
for (const r of rows) md += `| ${r.test} | ${r.font} | ${r.weight} | ${r.size} | ${r.width} | ${r.obs ?? '-'} | ${r.ok}/${r.tot} | ${r.over + r.other} | ${r.under} | ${r.heightMiss ?? '-'} |\n`
md += `\n## Sample failures\n`
for (const r of rows.filter(r => r.fails.length)) for (const f of r.fails)
  md += `\n- ${r.test} / ${r.font} ${r.weight} / ${r.size}px / w=${r.width}${r.obs ? ' / ' + r.obs : ''} / para ${f.para}: line ${f.firstDiff} (${f.dir === 'under' ? 'early break' : f.dir})\n  - DOM: \`${f.domAt}\`\n  - Pretext: \`${f.preAt}\`\n`
fs.writeFileSync(path.join(out, `${OUT}.md`), md)
fs.writeFileSync(path.join(out, `${OUT}.json`), JSON.stringify({ mode, pct, pctAll, longerThanDom, earlyBreaks: sum.under, scope, paragraphs: paras.length, realParagraphs, inventedParagraphs, samples: byFile,
  realHeadlines: headlineGate ? headlines.length : 0,
  fonts: FONTS, sizes: SIZES.map(s => s.size), weights: WEIGHTS, widths: WIDTHS, quick, skippedCombos, perFont, perf, rows }, null, 2))
console.log(md.split('## Results')[0]); console.log(`Full report: ${path.join(out, OUT + '.md')}`)
