// Gate G1.fitdrift: does the fit meter tell the truth about what a browser draws? Real Hindi copy, real fonts, headless Chromium.
// For each case fit() runs, then two independent looks:
//   drawn: flow()'s lines drawn absolutely, the way export draws them: count, each line's rendered width against its box,
//          how many lines fit below the last one.
//   reflow: only without obstacles, the same text laid out by the browser's own line breaker at the same width; the lines
//          it needs must equal fit's lines + overflowLines.
// A case differs if either look disagrees. Also checks itself: a fit() that lies by one line must read as drift.
//   node scripts/measure-fit.mjs     writes spike/out/fitdrift.json { pct, cases, differ, ... }
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esbuild = createRequire(path.join(root, 'spike/package.json'))('esbuild')
const preset = JSON.parse(fs.readFileSync(path.join(root, 'presets/newspaper.json'), 'utf8'))
const copy = fs.readFileSync(path.join(root, 'spike/samples/janshakti-live.txt'), 'utf8').split(/\n\s*\n/)
  .map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40).join(' ')

const code = `
import { flow, fit } from ${JSON.stringify(path.join(root, 'packages/engine/src/flow.js').replace(/\\/g, '/'))}
import { columnBoxes } from ${JSON.stringify(path.join(root, 'packages/engine/src/preset.js').replace(/\\/g, '/'))}
const COPY = ${JSON.stringify(copy)}, PRESET = ${JSON.stringify(preset)}
const PX_PER_MM = 96 / 25.4, TOL = 0.5
const stage = document.getElementById('stage')
const text = chars => { const cut = COPY.indexOf(' ', chars); return cut < 0 ? COPY : COPY.slice(0, cut) }

function buildCases() {
  const col = columnBoxes(PRESET)[0].w, gutter = PRESET.grid.gutter, out = []
  for (const family of ['Noto Sans Devanagari', 'Noto Serif Devanagari'])
    for (const [px, lh] of [[12, 15], [14, 18]])
      for (const span of [1, 2, 3])
        for (const rows of [10, 30, 60, 120])
          for (const chars of [200, 800, 2400, 6000]) {
            const w = (span * col + (span - 1) * gutter) * PX_PER_MM
            const frame = { id: 'f', x: 0, y: 0, w, h: rows * lh }
            out.push({ family, px, lh, span, rows, chars, frames: [frame], obstacles: [] })
            // A photo in part of the frame: the drawn look only, since CSS has no equal to the engine's gaps.
            if (rows >= 30 && chars === 800) out.push({ family, px, lh, span, rows, chars, frames: [frame], obstacles: [{ x: 0, y: 5 * lh, w: w * 0.45, h: 8 * lh, margin: 4 }] })
          }
  return out
}

// What the browser shows for this case, measured with no help from fit().
function look(c, story) {
  const font = c.px + 'px "' + c.family + '"'
  const set = flow(story, c.frames, c.obstacles, { font, lineHeight: c.lh })
  stage.textContent = ''
  const page = document.createElement('div')
  page.lang = 'hi'
  page.style.cssText = 'position:relative;font:' + font + ';line-height:' + c.lh + 'px;width:' + c.frames[0].w + 'px'
  const spans = set.lines.map(l => {
    const row = document.createElement('div')
    row.style.cssText = 'position:absolute;white-space:pre;left:' + l.x + 'px;top:' + l.y + 'px'
    row.textContent = l.text.trimEnd()
    page.append(row)
    return { row, l }
  })
  stage.append(page)
  const f = c.frames[0], widest = spans.reduce((m, { row, l }) => Math.max(m, row.getBoundingClientRect().width - l.w), -Infinity)
  const out = { drawn: spans.length, overBox: widest > TOL, freeBelow: spans.length ? Math.round((f.y + f.h - (spans.at(-1).l.y + c.lh)) / c.lh) : Math.round(f.h / c.lh) }
  if (!c.obstacles.length) {
    stage.textContent = ''
    const el = document.createElement('div')
    el.lang = 'hi'
    el.style.cssText = 'font:' + font + ';line-height:' + c.lh + 'px;width:' + f.w + 'px;overflow-wrap:break-word;white-space:normal'
    el.textContent = story
    stage.append(el)
    out.reflowLines = Math.round(el.getBoundingClientRect().height / c.lh)
  }
  stage.textContent = ''
  return out
}

function differs(c, m, seen) {
  const why = []
  if (m.lines !== seen.drawn) why.push('lines ' + m.lines + ' vs drawn ' + seen.drawn)
  if (seen.overBox) why.push('a drawn line is wider than its box')
  if (!c.obstacles.length) {
    if (m.underfillLines !== seen.freeBelow && !m.overflowLines) why.push('underfill ' + m.underfillLines + ' vs free below ' + seen.freeBelow)
    if (m.lines + m.overflowLines !== seen.reflowLines) why.push('needs ' + (m.lines + m.overflowLines) + ' vs browser ' + seen.reflowLines)
  }
  return why
}

window.run = () => {
  const cases = buildCases(), rows = []
  let differ = 0, overflow = 0, underfill = 0, mutantMissed = 0, reflowChecked = 0, wrongFontDiffer = 0
  for (const c of cases) {
    const story = text(c.chars), m = fit(story, c.frames, c.obstacles, { font: c.px + 'px "' + c.family + '"', lineHeight: c.lh })
    const seen = look(c, story), why = differs(c, m, seen)
    if (why.length) { differ++; rows.push({ family: c.family, px: c.px, span: c.span, rows: c.rows, chars: c.chars, photo: c.obstacles.length > 0, why }) }
    if (m.overflowLines) overflow++
    else if (m.underfillLines) underfill++
    if ('reflowLines' in seen) reflowChecked++
    // Mutants: a meter that lies by one line. Every one must show up as a difference.
    const lies = [{ ...m, lines: m.lines + 1 }, { ...m, overflowLines: m.overflowLines + 1 }]
    if (!c.obstacles.length && lies.some(l => !differs(c, l, seen).length)) mutantMissed++
    if (c.obstacles.length && !differs(c, lies[0], seen).length) mutantMissed++
    // A real fault: fit() measuring with the other font, while the browser draws this one. It must not read as clean.
    const otherFamily = c.family.includes('Serif') ? 'Noto Sans Devanagari' : 'Noto Serif Devanagari'
    const wrong = fit(story, c.frames, c.obstacles, { font: c.px + 'px "' + otherFamily + '"', lineHeight: c.lh })
    if (differs(c, wrong, seen).length) wrongFontDiffer++
  }
  const wrongFontPct = Math.round(wrongFontDiffer / cases.length * 1000) / 10
  return { pct: Math.round(differ / cases.length * 1000) / 10, cases: cases.length, differ, overflowCases: overflow, underfillCases: underfill, reflowChecked, wrongFontPct, mutantCaught: mutantMissed === 0 && wrongFontPct > 10 ? 1 : 0, mutantMissed, rows }
}
window.ready = (async () => {
  for (const f of ['Noto Sans Devanagari', 'Noto Serif Devanagari']) for (const px of [12, 14]) await document.fonts.load(px + 'px "' + f + '"', 'क')
})()
`
const bundle = await esbuild.build({ stdin: { contents: code, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', write: false })
const work = path.join(root, 'spike/out'), html = path.join(work, 'measure-fit.html')
fs.mkdirSync(work, { recursive: true })
fs.writeFileSync(html, `<!doctype html><html lang="hi"><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(path.join(root, 'spike/public/fonts.css')).href}">
<style>body{margin:0}</style></head><body><div id="stage"></div>
<script type="module">${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
const browser = await chromium.launch(), page = await browser.newPage(), errors = []
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
await page.goto(pathToFileURL(html).href); await page.waitForFunction(() => window.ready); await page.evaluate(() => window.ready)
const out = await page.evaluate(() => window.run())
await browser.close()
if (errors.length) { console.error('browser errors:\n' + errors.join('\n')); process.exit(1) }
fs.writeFileSync(path.join(work, 'fitdrift.json'), JSON.stringify(out, null, 1))
console.log(`fit vs browser: ${out.differ}/${out.cases} cases differ (${out.pct}%); ${out.overflowCases} overflow, ${out.underfillCases} underfill; reflow checked on ${out.reflowChecked}; lying meter missed ${out.mutantMissed}; wrong font differs on ${out.wrongFontPct}%; self-check ${out.mutantCaught ? 'passed' : 'FAILED'}`)
for (const r of out.rows.slice(0, 15)) console.log(`  ${r.family} ${r.px}px span ${r.span} rows ${r.rows} chars ${r.chars}${r.photo ? ' photo' : ''}: ${r.why.join('; ')}`)
