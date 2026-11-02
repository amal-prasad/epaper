import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = path.resolve(process.argv[2] ?? path.join(root, 'demos/golden-pages'))
const manifestPath = path.join(directory, 'manifest.json'), manifest = JSON.parse(fs.readFileSync(manifestPath))
const dest = path.join(root, 'demos/golden-pages.html')
const relative = path.relative(path.dirname(dest), directory).replaceAll('\\', '/')
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const link = file => esc(`${relative}/${file}`)
const reference = manifest.pages.find(p => p.templateId === 'weekly-inner')
if (manifest.pages.length !== 10 || !reference) throw new Error('demo requires the ten representative candidates')
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Golden page candidates — review pending</title>
<style>body{font:16px/1.55 system-ui,sans-serif;max-width:1300px;margin:32px auto;padding:0 20px;background:#f3f1ec;color:#27251f}a{color:#164b70}aside{background:#fff0c9;border-left:5px solid #ad6511;padding:18px}table{border-collapse:collapse;width:100%;background:white}th,td{padding:12px;text-align:left;border-bottom:1px solid #ddd}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:30px}.controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}figure{margin:0}img{width:100%;height:auto;background:white;border:1px solid #ccc}figcaption{padding:10px 0}code{overflow-wrap:anywhere}small{color:#58554e}@media(max-width:760px){.grid,.controls{grid-template-columns:1fr}}</style>
<a href="index.html">All demos</a><h1>Ten golden-page candidates</h1>
<aside><strong>Human review pending. These are candidates, not accepted baselines.</strong> Every story and illustration is owned synthetic test material. No golden gate result has been recorded or activated. The screenshots exercise the intermediate RGB renderer; colour separations, independent PDF/X validation and physical proofs remain separate checks.</aside>
<p>Open each full-size image and PDF to review Hindi glyphs and matras, reading order, text around shapes, furniture, ad sizes and page margins. The same fixture rendered twice produced identical decoded pixels on every page.</p>
<table><tr><th>Check</th><th>Result</th></tr><tr><td>Representative candidates</td><td>${manifest.pages.length} templates; two editable page sizes; Sans/Serif body; round and cut-out wrapping; ads and print line</td></tr><tr><td>Repeat rendering</td><td>${manifest.pages.filter(p => p.repeatRenderChangedPixels === 0).length}/10 identical; exact decoded RGBA comparison</td></tr><tr><td>Negative controls</td><td>${manifest.controls.length} actual re-rendered defects rejected; focused unit tests also reject one changed pixel</td></tr><tr><td>Baseline acceptance</td><td>Pending human visual review; comparison refuses a missing or unreviewed manifest</td></tr><tr><td>Provenance</td><td>${esc(manifest.provenance.chromium)} Chromium · ${esc(manifest.provenance.platform)} · bundled font hashes in <a href="${link('manifest.json')}">manifest</a></td></tr></table>
<h2>Candidate pages</h2><div class="grid">${manifest.pages.map(p => `<figure><a href="${link(p.image)}"><img src="${link(p.image)}" alt="Unapproved synthetic ${esc(p.templateId)} newspaper candidate"></a><figcaption><strong>${esc(p.id)}</strong> · ${p.size.w} × ${p.size.h} mm · ${p.lines} body lines<br><small>${esc(p.features)}</small><br><a href="${link(p.fixture)}">Source document</a> · <a href="${link(p.pdf)}">Intermediate PDF</a> · <a href="${link(p.image)}">Full-size image</a></figcaption></figure>`).join('')}</div>
<h2>Deliberate defects: before, after and difference</h2><p>The left column is the unchanged candidate; the middle is an independently rendered faulty document. Red pixels on white mark every difference. These controls prove sensitivity, not correctness of the candidate.</p>
${manifest.controls.map(c => `<h3>${esc(c.name)} — rejected (${c.changedPixels} changed pixels)</h3><div class="controls"><figure><img src="${link(reference.image)}" alt="Original candidate"><figcaption>Before</figcaption></figure><figure><img src="${link(c.image)}" alt="Deliberately faulty candidate"><figcaption>After</figcaption></figure><figure><img src="${link(c.diff)}" alt="Red pixels show visual difference"><figcaption>Difference</figcaption></figure></div>`).join('')}
<h2>Review workflow</h2><p>Review all ten candidates at full size. Request fixes before accepting. A human then copies the complete candidate directory to a separate baseline directory and records <code>status: human-reviewed</code> plus <code>review.by</code>, <code>review.at</code> and <code>review.note</code> in its manifest. Image and fixture SHA-256 values stay pinned. No script approves that review.</p><p>Generate future candidates into a fresh directory and run <code>node scripts/golden-compare.mjs CANDIDATE/manifest.json REVIEWED_BASELINE/manifest.json DIFF_DIRECTORY</code>. Any changed pixel, page set, fixture hash or environment/font provenance fails. Renderer source hashes are informational so renderer regressions can reach the pixel comparison.</p><p>Known limits: synthetic pages are not four produced issues or printer acceptance. Baselines are specific to the pinned browser, tools, platform and fonts. Rich paragraphs, frame chains and rotations remain outside this renderer's supported scope.</p></html>`
fs.writeFileSync(dest, html)
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] })
try {
  const page = await browser.newPage(), errors = []
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(pathToFileURL(dest).href)
  await page.locator('img').evaluateAll(images => Promise.all(images.map(i => i.decode())))
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(`wrote demos/golden-pages.html; ${manifest.pages.length} candidates; ${manifest.controls.length} rejected controls; 0 demo console errors`)
} finally { await browser.close() }
