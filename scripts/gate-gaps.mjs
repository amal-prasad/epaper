// Renders docs/GATE_GAPS.md as a table page, demos/gate-gaps.html; scripts/demos.mjs imports gateGaps() for the open count.
//   node scripts/gate-gaps.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const cols = ['id', 'date', 'risk', 'failure', 'measure', 'phase', 'status', 'source']

// Writes demos/gate-gaps.html and returns { gaps, open }.
export function gateGaps() {
  const md = fs.readFileSync(path.join(root, 'docs/GATE_GAPS.md'), 'utf8')
  const gaps = md.split('\n').filter(l => /^\|\s*GG-\d+/.test(l))
    .map(l => Object.fromEntries(l.split('|').slice(1, -1).map((c, i) => [cols[i], c.trim()])))
  const open = gaps.filter(g => g.status === 'open').length
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gate gaps</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1400px;color:#222;background:#f4f4f4}a{color:#05c}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}td,th{text-align:left;padding:6px 10px;border-bottom:1px solid #e3e3e3;vertical-align:top}
.s{font-weight:600;font-size:12px;padding:2px 8px;border-radius:10px;color:#fff;white-space:nowrap}
.open{background:#c62828}.accepted{background:#1a7f37}.deferred,.rejected{background:#8a8a8a}.d{color:#666;font-size:13px}</style></head>
<body><p><a href="index.html">&larr; all demos</a></p>
<h1>Gate gaps: ${open} open of ${gaps.length}</h1>
<p class="d">Risks no gate checks yet, from <code>docs/GATE_GAPS.md</code>. Proposals only: Amal decides which become gates. Rebuild with <code>node scripts/gate-gaps.mjs</code>. Measured numbers use an assumed grid (A3, 12 mm margins, 5 columns, 4 mm gutter, 9 pt body) until the printer's spec sheet arrives (GG-007).</p>
<table><tr><th>ID</th><th>Risk</th><th>Failure on a real issue</th><th>Measure</th><th>Phase</th><th>Status</th><th>Source</th></tr>
${gaps.map(g => `<tr><td>${esc(g.id)}<div class="d">${esc(g.date)}</div></td><td>${esc(g.risk)}</td><td>${esc(g.failure)}</td><td class="d">${esc(g.measure)}</td><td>${esc(g.phase)}</td><td><span class="s ${esc(g.status)}">${esc(g.status)}</span></td><td class="d">${esc(g.source)}</td></tr>`).join('\n')}
</table></body></html>
`
  fs.writeFileSync(path.join(root, 'demos/gate-gaps.html'), html)
  return { gaps, open }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { gaps, open } = gateGaps()
  console.log(`wrote demos/gate-gaps.html: ${gaps.length} gaps, ${open} open`)
}
