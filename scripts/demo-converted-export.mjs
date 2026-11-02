// Builds colour/mono bundles using the existing synthetic renderer fixtures, then shows actual final ink plates.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { exportIssue } from '../packages/export/src/export.js'

const root = fileURLToPath(new URL('../', import.meta.url)), demo = path.join(root, 'demos/converted-export')
fs.mkdirSync(demo, { recursive: true })
const run = path.join(demo, 'runs', new Date().toISOString().replace(/[:.]/g, '-'))
const rows = []
for (const mode of ['colour', 'mono']) {
  const doc = JSON.parse(fs.readFileSync(path.join(root, `demos/press-export/${mode === 'colour' ? 'a3' : 'compact'}.json`)))
  doc.preset.exportProfile.colourRoute = null
  const second = structuredClone(doc.pages[0]); second.id = 'p2'; second.no = 2; second.frames = []
  second.objects = second.objects.filter(o => !['headline', 'edition'].includes(o.id)).map(o => ({ ...o, id: o.id + '-p2' }))
  doc.pages.push(second)
  const profile = JSON.parse(fs.readFileSync(path.join(root, `presets/output/development-${mode}.json`)))
  const output = path.join(run, mode), report = await exportIssue(doc, profile, output)
  rows.push({ mode, folder: path.relative(demo, output).replace(/\\/g, '/'), report })
}
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checked colour and mono exports</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:1300px;margin:32px auto;padding:0 20px;background:#f4f2ed;color:#24211c}aside{padding:16px;background:#fff1cd}table{width:100%;border-collapse:collapse}td,th{padding:12px;text-align:left;border-bottom:1px solid #ccc}.plates{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}img{width:100%;background:white;border:1px solid #ddd}figure{margin:0}@media(max-width:700px){.plates{grid-template-columns:repeat(2,1fr)}}</style>
<a href="index.html">All demos</a><h1>Checked colour and mono exports</h1><p>The established neutral-to-K colour route and Gray route are connected to the shared document renderer. These are two-page synthetic issues at two page sizes.</p>
<aside>Development output with explicit assumptions. PDF/X-3 target metadata and output intent are checked; independent PDF/X certification and physical press acceptance remain pending. This does not mark Phase 1 complete.</aside>
<p><a href="press-export.html">Screen/intermediate PDF comparison</a></p>
${rows.map(({ mode, folder, report }) => `<h2>${esc(mode)} · ${report.settings.page.w} × ${report.settings.page.h} mm</h2><p><a href="converted-export/${folder}/issue.pdf">Open checked PDF</a> · <a href="converted-export/${folder}/report.json">Full report and assumptions</a></p>
<table><tr><th>Check</th><th>Actual result</th></tr><tr><td>Pages</td><td>${report.pages}</td></tr><tr><td>Fonts</td><td>${report.pdf.fonts.length}, all embedded and subset</td></tr><tr><td>Final maximum ink</td><td>${report.plates.totalInkMaxPct}% (limit ${report.settings.profile.inkLimit}%)</td></tr><tr><td>Neutral interior pixels checked</td><td>${report.plates.neutralCheckedPixels}; ${report.plates.neutralFailedPct}% failed (limit 0.5%)</td></tr><tr><td>PDF/X target</td><td>${esc(report.pdf.pdfx)}; independent certification pending</td></tr></table>
${report.plates.pages.map((page, i) => `<h3>Page ${i + 1}: final C / M / Y / K plates</h3><div class="plates">${Object.entries(page.images).map(([name, file]) => `<figure><figcaption>${esc(name)}</figcaption><img src="converted-export/${folder}/${file}" alt="${esc(name)} ink plate"></figure>`).join('')}</div>`).join('')}`).join('')}
<p>Uses bundled Ghostscript output profiles provisionally, not a claimed national press standard. Zero bleed and no crop marks are supported now; other values fail explicitly. Source documents and conversion diagnostics are preserved with each output.</p></html>`
fs.writeFileSync(path.join(root, 'demos/converted-export.html'), html)
fs.writeFileSync(path.join(demo, 'latest.json'), JSON.stringify(rows.map(({ mode, folder, report }) => ({ mode, folder, outputSha256: report.outputSha256 })), null, 2) + '\n')
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] })
try {
  const page = await browser.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(pathToFileURL(path.join(root, 'demos/converted-export.html')).href)
  await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())))
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`wrote demos/converted-export.html; colour and mono, ${rows.map(r => r.report.pages).join('/')} pages, 0 console errors`)
} finally { await browser.close() }
