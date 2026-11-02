// Owned synthetic copy. Real Chromium font measurements and the existing export renderer, before and after a proposal.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { buildPage } from '../packages/engine/src/templates.js'

const root = fileURLToPath(new URL('../', import.meta.url)), dir = path.join(root, 'demos/autopage')
const esbuild = createRequire(new URL('../spike/package.json', import.meta.url))('esbuild')
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
fs.mkdirSync(dir, { recursive: true })
const preset = read('presets/newspaper.json'), orgId = 'synthetic-autopage'
const template = { id: 'autopage-demo', columns: preset.grid.cols, rows: 12, slots: [
  { id: 'lead', kind: 'story', col: 0, span: 4, row: 1, rows: 6, textCols: 3, priority: 1 },
  { id: 'secondary', kind: 'story', col: 4, span: 2, row: 1, rows: 6, textCols: 2, priority: 2 },
  { id: 'existing', kind: 'story', col: 0, span: 3, row: 7, rows: 5, textCols: 2, priority: 2 },
  { id: 'reserved', kind: 'story', col: 3, span: 3, row: 7, rows: 5, textCols: 2, priority: 3 },
].map(slot => ({ ...slot, head: { kicker: 0, headline: 0, byline: 0 } })) }
const built = buildPage(template, preset, { pageId: 'p1', orgId })
built.frames.find(f => f.slotId === 'existing').storyId = 'existing'
const copy = 'यह समाचार केवल पृष्ठ विन्यास की जाँच के लिए लिखा गया है। नगर के पुस्तकालय में बच्चों के लिए नई पुस्तकें उपलब्ध हैं। शिक्षकों ने अध्ययन कार्यक्रम में भाग लिया। '
const stories = [
  { id: 'lead', priority: 1, headline: 'पुस्तकालय में नई पहल', body: [copy.repeat(10)] },
  { id: 'secondary', priority: 2, headline: 'बच्चों का अध्ययन कार्यक्रम', body: [copy.repeat(5)] },
  { id: 'existing', priority: 2, headline: 'पहले से रखा समाचार', body: [copy.repeat(5)] },
  { id: 'too-long', priority: 1, headline: 'अगले पृष्ठ की आवश्यकता', body: [copy.repeat(70)] },
].map(s => ({ orgId, ...s }))
built.objects.push({ id: 'masthead', orgId, kind: 'label', x: preset.margins.left, y: preset.margins.top,
  w: preset.page.w - preset.margins.left - preset.margins.right, h: 10, text: 'समाचार स्टूडियो · स्वतः पृष्ठ नमूना',
  wrap: { mode: 'none', offset: {} }, style: { fontSize: 24 } })
const doc = { id: 'autopage-synthetic', orgId, schemaVersion: 1, preset, stories, pages: [{ id: 'p1', orgId, no: 1, ...built }] }
const fontsPath = path.join(root, 'spike/public/fonts.css')
const css = fs.readFileSync(fontsPath, 'utf8').match(/@font-face\s*\{[^}]*\}/g)
  .filter(f => f.includes("font-family: 'Noto Sans Devanagari'" )).join('\n')
  .replace(/url\(([^)]+)\)/g, (_, rel) => `url(data:font/woff2;base64,${fs.readFileSync(path.resolve(path.dirname(fontsPath), rel)).toString('base64')})`)
const modulePath = path.join(root, 'packages/engine/src/autopage.js').replaceAll('\\', '/')
const proposalBundle = await esbuild.build({ stdin: { contents: `import { autopage } from ${JSON.stringify(modulePath)}; window.autopage = autopage;`,
  resolveDir: root }, bundle: true, write: false, format: 'iife' })
const renderBundle = await esbuild.build({ entryPoints: [path.join(root, 'packages/export/src/render-browser.js')], bundle: true, write: false, format: 'iife' })
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] }), errors = []
let report
try {
  const page = await browser.newPage({ viewport: { width: Math.ceil(preset.page.w * 96 / 25.4), height: Math.ceil(preset.page.h * 96 / 25.4) } })
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.setContent(`<!doctype html><html lang="hi"><meta charset="utf-8"><style>${css}body{margin:0}section{box-sizing:border-box}</style>`)
  await page.addScriptTag({ content: proposalBundle.outputFiles[0].text })
  await page.addScriptTag({ content: renderBundle.outputFiles[0].text })
  report = await page.evaluate(async ({ doc, inks }) => {
    await document.fonts.load('400 12px "Noto Sans Devanagari"', 'हिन्दी समाचार')
    await document.fonts.ready
    const proposal = window.autopage({ doc, locks: ['p1-reserved'] })
    const before = await window.renderExport(doc, inks), after = await window.renderExport(proposal.doc, inks)
    // Outlines expose empty and locked slots in a read-only preview; all body text is the actual renderer's output.
    for (const section of document.querySelectorAll('section')) for (const frame of doc.pages[0].frames) {
      const outline = document.createElement('div'), px = 96 / 25.4
      Object.assign(outline.style, { position: 'absolute', pointerEvents: 'none', boxSizing: 'border-box',
        left: `${frame.x * px}px`, top: `${frame.y * px}px`, width: `${frame.w * px}px`, height: `${frame.h * px}px`,
        border: `1px dashed ${frame.id === 'p1-reserved' ? '#a1672b' : '#91a0a4'}` })
      section.append(outline)
    }
    return { proposal, before: before.map(p => ({ pageId: p.id, lines: p.lines.length })),
      after: after.map(p => ({ pageId: p.id, lines: p.lines.length })),
      lineChecks: proposal.placements.map(p => ({ storyId: p.storyId, fitLines: p.fit.lines,
        renderedLines: after.flatMap(r => r.lines).filter(l => l.storyId === p.storyId).length })) }
  }, { doc, inks: read('fonts/ink.json') })
  for (const check of report.lineChecks) assert.equal(check.renderedLines, check.fitLines, `${check.storyId}: fit/render lines differ`)
  assert.equal(report.proposal.placements.filter(p => !p.existing).length, 2)
  assert.deepEqual(report.proposal.unplaced.map(p => [p.storyId, p.reason]), [['too-long', 'overflow']])
  await page.locator('section').nth(0).screenshot({ path: path.join(dir, 'before.png') })
  await page.locator('section').nth(1).screenshot({ path: path.join(dir, 'after.png') })
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(dir, 'input.json'), JSON.stringify(doc, null, 2) + '\n')
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ ...report, browserErrors: errors }, null, 2) + '\n')
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  fs.writeFileSync(path.join(root, 'demos/autopage.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Auto-page v0</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:1200px;margin:32px auto;padding:0 20px;background:#f4f2ed;color:#24211c}table{border-collapse:collapse;width:100%;background:white}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0}img{width:100%;border:1px solid #ccc}aside{background:#fff1cd;padding:16px}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style>
<a href="index.html">All demos</a><h1>Auto-page v0 · review before accepting</h1><p>Priority assigns whole synthetic stories to empty slots using bundled Hindi fonts. Existing placement stays in place; the dashed amber slot stays locked.</p>
<aside>Two new placements; one existing story; one oversized story remains unplaced. No copy was cut. This synthetic fixture is not production evidence for G1.autoplaced or B.minutes.w8. These are page previews, not a complete export-ready issue. Headlines, continuations and print approval still require operator work.</aside>
<div class="pair"><figure><figcaption>Before · existing story and reserved slot</figcaption><a href="autopage/before.png"><img src="autopage/before.png" alt="Before proposal, empty story slots visible"></a></figure><figure><figcaption>After · two whole stories placed</figcaption><a href="autopage/after.png"><img src="autopage/after.png" alt="After proposal, two additional stories laid out and locked slot untouched"></a></figure></div>
<h2>Explicit proposed changes</h2><table><tr><th>Story</th><th>Frame</th><th>Action</th></tr>${report.proposal.changes.map(c => `<tr><td>${esc(c.storyId)}</td><td>${esc(c.frameId)}</td><td>${esc(c.kind)}</td></tr>`).join('')}</table>
<h2>Fit and actual renderer</h2><table><tr><th>Story</th><th>Fit lines</th><th>Rendered lines</th></tr>${report.lineChecks.map(c => `<tr><td>${esc(c.storyId)}</td><td>${c.fitLines}</td><td>${c.renderedLines}</td></tr>`).join('')}</table>
<p>Chromium console errors: 0. <a href="autopage/report.json">Proposal, ops, inverses and checks</a> · <a href="autopage/input.json">Owned synthetic input</a>.</p><p>Existing ops accept each listed change; their inverses restore the original document. See <code>docs/autopage.md</code> for the API and limits.</p></html>`)
  const review = await browser.newPage(), reviewErrors = []
  review.on('pageerror', e => reviewErrors.push(e.message)); review.on('console', m => { if (m.type() === 'error') reviewErrors.push(m.text()) })
  await review.goto(pathToFileURL(path.join(root, 'demos/autopage.html')).href)
  await review.locator('img').evaluateAll(images => Promise.all(images.map(i => i.decode())))
  assert.deepEqual(reviewErrors, [])
  console.log(`wrote demos/autopage.html; 2 new placements; 1 explicit overflow; ${report.lineChecks.length} fit/render line comparisons passed; 0 browser console errors`)
} finally { await browser.close() }
