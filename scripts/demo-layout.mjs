// Layout demo page for a task: screenshots scripts/preview.mjs variants side by side into demos/<task>.html.
//   node scripts/demo-layout.mjs <task> "<title>" "<label>=<query>" ["<label>=<query>" ...] [--note "<text>"]
// Each query is a preview URL query (e.g. mingap=6&deadgaps=0); every page panel it renders becomes one image.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const noteAt = args.indexOf('--note'), note = noteAt >= 0 ? args.splice(noteAt, 2)[1] : ''
const [task, title, ...variants] = args
if (!task || !title || !variants.length) { console.error('usage: node scripts/demo-layout.mjs <task> "<title>" "<label>=<query>" ... [--note "<text>"]'); process.exit(2) }

execFileSync(process.execPath, [path.join(root, 'scripts/preview.mjs')], { stdio: 'inherit' })
const preview = pathToFileURL(path.join(root, 'scratch/preview.html')).href
const dir = path.join(root, 'demos', task)
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })

const browser = await chromium.launch(), page = await browser.newPage(), errors = []
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => m.type() === 'error' && errors.push(m.text()))
const shots = []
for (const v of variants) {
  const [label, query] = [v.slice(0, v.indexOf('=')), v.slice(v.indexOf('=') + 1)]
  await page.goto(`${preview}?${query}`); await page.waitForSelector('section h2', { timeout: 20000 })
  const panels = await page.$$('section')
  for (const [i, s] of panels.entries()) {
    const file = `${shots.length + 1}.jpg`, caption = await s.$eval('h2', h => h.textContent)
    await s.screenshot({ path: path.join(dir, file), type: 'jpeg', quality: 85 })
    shots.push({ label: panels.length > 1 ? `${label} ${i + 1}` : label, caption, file })
  }
}
await browser.close()
if (errors.length) { console.error('preview errors:\n' + errors.join('\n')); process.exit(1) }

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
fs.writeFileSync(path.join(root, 'demos', `${task}.html`), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#222;background:#f4f4f4}a{color:#05c}
.row{display:flex;gap:16px;align-items:flex-start;overflow-x:auto}figure{margin:0;flex:1 1 0;min-width:280px}
figure img{width:100%;border:1px solid #ccc;background:#fff}figcaption{font-size:13px;margin-bottom:6px}b{display:block}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p><h1>${esc(title)}</h1>${note ? `<p>${esc(note)}</p>` : ''}
<p>Generated ${new Date().toISOString().slice(0, 10)} from <code>scripts/preview.mjs</code> (A3, 5 columns, real Hindi copy). Click an image for full size.</p>
<div class="row">${shots.map(s => `<figure><figcaption><b>${esc(s.label)}</b>${esc(s.caption)}</figcaption><a href="${task}/${s.file}"><img src="${task}/${s.file}" alt="${esc(s.label)}"></a></figure>`).join('')}</div>
</body></html>
`)
console.log(`wrote demos/${task}.html with ${shots.length} images`)
