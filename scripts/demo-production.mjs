// Deterministic synthetic examples, deliberately separate from real operator records.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { summarize } from '../packages/production/src/ledger.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const samples = [180, 160, 140, 120].map((minutes, index) => {
  const date = `2026-10-${String(index + 10).padStart(2, '0')}`
  const end = new Date(Date.parse(`${date}T08:00:00+05:30`) + minutes * 60000).toISOString()
  return { id: `SYNTHETIC-${index + 1}`, kind: 'synthetic', publication: index % 2 ? 'Example pilot weekly' : 'Janshakti workflow example',
    operator: 'Synthetic operator', measurementNote: 'Invented fixture; never a real measurement',
    producedAt: end, copyReceivedAt: `${date}T08:00:00+05:30`, pressSentAt: end,
    pageCount: 8, pageSize: { widthMm: 297, heightMm: 420, basis: 'Assumed development preset, not printer confirmed' }, paid: index >= 2,
    steps: [{ name: 'Copy preparation', minutes: 20 }, { name: 'Layout', minutes: minutes - 50 }, { name: 'Export and dispatch', minutes: 20 }],
    storyCount: 5, stories: Array.from({ length: 5 }, (_, story) => ({ id: `story-${story + 1}`,
      initialPlacement: story < index + 2 ? 'auto' : 'manual', manualMoves: story === 0 && index === 0 ? 1 : 0 })) }
})
const ledger = { schemaVersion: 1, kind: 'synthetic', issues: samples }
const summary = summarize(ledger)
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
const rows = summary.rows.map(row => `<tr><th scope="row">${escape(row.id)}</th><td>${escape(row.publication)}</td><td>${row.paid ? 'Paid example' : 'Unpaid example'}</td><td>${row.pageCount}</td><td>${row.elapsedMinutes}</td><td>${row.activeMinutes}</td><td>${row.autoplacedStories}/${row.storyCount}</td><td>${row.manualMoves}</td></tr>`).join('')
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Production ledger — synthetic demonstration</title>
<style>body{font:17px/1.6 system-ui,sans-serif;color:#26251f;background:#f8f7f3;margin:0}main{max-width:1150px;margin:48px auto;padding:0 24px 60px}h1{font-size:38px;line-height:1.15;margin:12px 0 20px}h2{font-size:23px;margin-top:36px}p{max-width:850px}.notice{border-left:5px solid #9b4510;padding:18px 22px;background:#fff0d8}.tag{font-weight:750;letter-spacing:.06em;color:#91400e;font-size:14px}.scroll{overflow:auto;border:1px solid #d9d6cb;background:white}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:13px 15px;border-bottom:1px solid #e5e2d9;white-space:nowrap}thead{background:#eeece4}td:nth-child(2){white-space:normal;min-width:180px}pre{overflow:auto;background:#eeece4;padding:18px;font-size:14px;line-height:1.6}a{color:#155b79}li{margin:7px 0}.muted{color:#625e52}</style>
<main><p class="tag">LOCAL PRODUCTION WORKFLOW</p><h1>Four examples explain the ledger.<br>No production evidence is claimed.</h1>
<p class="notice"><strong>All records below are synthetic.</strong> They never qualify for either gate and generate no recording command. Real production records are entered by the operator and stored separately under <code>.local/production/</code>.</p>
<h2>What the operator records</h2><p>Each issue has an immutable ID, actual produced date, publication, paid/unpaid state, page count and size basis. Copy-received and press-sent timestamps include a timezone. Measured step minutes show active work; the full elapsed interval includes waiting.</p>
<div class="scroll"><table><thead><tr><th>Issue</th><th>Publication</th><th>Payment</th><th>Pages</th><th>Elapsed minutes</th><th>Active minutes</th><th>Auto / all stories</th><th>Manual moves</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="muted">Example page size: 297 × 420 mm, an explicitly assumed development preset. This is not a printer specification or proof acceptance.</p>
<h2>What can qualify later</h2><table><thead><tr><th>Check</th><th>Selection and calculation</th><th>This demonstration</th></tr></thead><tbody>
<tr><th>Time</th><td>Latest four real produced issues first; all four must be eight pages. Median of full copy-to-press elapsed minutes. No scaling or older replacements.</td><td>Ineligible: synthetic</td></tr>
<tr><th>Placement</th><td>Same latest four real produced issues. Median of per-issue percentages: initially auto-placed with zero manual moves ÷ all intended stories.</td><td>Ineligible: synthetic</td></tr>
<tr><th>Inclusion</th><td>Paid and unpaid, including Janshakti, all stay in the chronological window. Manual and unplaced stories stay in the denominator.</td><td>No convenient exclusions</td></tr>
<tr><th>Protected evidence</th><td>Local summary only. No writes to harness results, no automatic approval or gate activation.</td><td>Untouched</td></tr></tbody></table>
<h2>Small local workflow</h2><pre>node scripts/production-log.mjs append MY_REAL_ISSUE.json
node scripts/production-log.mjs summary
node scripts/production-log.mjs summary --json</pre>
<p>Use the <a href="production-log-example.json">synthetic JSON example</a> to learn the fields. Do not relabel invented records as real. Read <a href="../docs/production-log.md">the workflow and measurement rules</a> before entering actual production records.</p>
<h2>Review checks</h2><p>The focused tests cover duplicate IDs, negative and conflicting times, story counts, synthetic separation, last-four selection, immutable appends, lock collisions, and corrupt-ledger preservation. Run <code>node --test packages/production/test/*.test.js</code> for current results.</p>
<p class="muted">A local record asserts that an issue was produced. It does not establish PDF/X certification, press acceptance, clean printing, the week-eight deadline, or backup recovery.</p></main></html>`
await fs.writeFile(path.join(root, 'demos/production-log-example.json'), JSON.stringify(ledger, null, 2) + '\n')
await fs.writeFile(path.join(root, 'demos/production-log.html'), html)
if (process.argv.includes('--check')) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage(), errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(pathToFileURL(path.join(root, 'demos/production-log.html')).href)
    await page.getByRole('heading', { level: 1 }).waitFor()
    if (await page.locator('tbody').first().locator('tr').count() !== 4) throw new Error('Production demo lost an example row')
    if (errors.length) throw new Error(errors.join('\n'))
    console.log('Chromium: four synthetic rows rendered; zero console errors.')
  } finally { await browser.close() }
}
console.log('Wrote demos/production-log.html and its separate synthetic JSON example. No real ledger or harness results written.')
