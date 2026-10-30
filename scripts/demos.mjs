// Rebuilds demos/index.html: every gate's status from a fresh harness run, then the task demos listed in demos/tasks.json.
//   npm run demos              gates with --fast (the slow parity gate shows SKIP)
//   npm run demos -- --full    every gate, including parity
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { gateGaps } from './gate-gaps.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const full = process.argv.includes('--full')
// run.mjs prints one row per gate and exits 1 on a failing gate; the table is what we want either way.
const out = spawnSync(process.execPath, [path.join(root, 'harness/run.mjs'), ...(full ? [] : ['--fast'])], { cwd: root, encoding: 'utf8' }).stdout
const gates = [...out.matchAll(/^(G\S+)\s+P(\d+)\s+(PASS|FAIL|PENDING|SKIP)\s+(.*?)(?:\s{2,}(.*))?$/gm)]
  .map(([, id, phase, status, title, detail = '']) => ({ id, phase, status, title, detail: detail.trim() === '-' ? '' : detail.trim() }))
if (!gates.length) { console.error('no gate rows in harness output:\n' + out); process.exit(1) }
const untrusted = /JUDGES CHANGED WITHOUT APPROVAL/.test(out)

// Newest first; same-day tasks keep their tasks.json order (sort is stable).
const tasks = JSON.parse(fs.readFileSync(path.join(root, 'demos/tasks.json'), 'utf8')).sort((a, b) => b.date.localeCompare(a.date))
const { open: openGaps } = gateGaps()
const missing = tasks.filter(t => !fs.existsSync(path.join(root, 'demos', t.page)))
if (missing.length) { console.error('demo pages missing: ' + missing.map(t => t.page).join(', ')); process.exit(1) }

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Studio demos</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;max-width:1100px;color:#222;background:#f4f4f4}a{color:#05c}
table{border-collapse:collapse;width:100%;background:#fff}td,th{text-align:left;padding:6px 10px;border-bottom:1px solid #e3e3e3;vertical-align:top}
.s{font-weight:600;font-size:12px;padding:2px 8px;border-radius:10px;color:#fff;white-space:nowrap}
.PASS{background:#1a7f37}.FAIL{background:#c62828}.PENDING,.SKIP{background:#8a8a8a}.d{color:#666;font-size:13px}
.warn{background:#fff3cd;border:1px solid #e0b100;padding:8px 12px}</style></head>
<body><h1>Studio demos</h1>
<p class="warn">Gate numbers use an ASSUMED grid (A3, 12 mm margins, 5 columns, 4 mm gutter, 9 pt body) until the printer's spec sheet arrives (GG-007).</p>
<p class="d">Gates from <code>node harness/run.mjs${full ? '' : ' --fast'}</code>, ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Rebuild with <code>npm run demos</code>${full ? '' : ' (add <code>-- --full</code> to run the slow parity gate)'}.</p>
${untrusted ? '<p class="warn">Judges changed without approval: these results are not trusted until Amal runs <code>npm run approve</code>.</p>' : ''}
<h2>Gates</h2>
<table><tr><th>Gate</th><th>Phase</th><th>Status</th><th>What it checks</th><th>Result</th></tr>
${gates.map(g => `<tr><td>${esc(g.id)}</td><td>${g.phase}</td><td><span class="s ${g.status}">${g.status}</span></td><td>${esc(g.title)}</td><td class="d">${esc(g.detail)}</td></tr>`).join('\n')}
</table>
<p><a href="gate-gaps.html"><b>${openGaps} open gate gaps</b></a> <span class="d">(risks no gate checks yet, from <code>docs/GATE_GAPS.md</code>)</span></p>
<h2>Tasks</h2>
<table><tr><th>Date</th><th>Task</th><th>What changed</th></tr>
${tasks.map(t => `<tr><td>${esc(t.date)}</td><td><a href="${esc(t.page)}">${esc(t.task)}</a></td><td>${esc(t.summary)}</td></tr>`).join('\n')}
</table></body></html>
`
fs.writeFileSync(path.join(root, 'demos/index.html'), html)
console.log(`wrote demos/index.html: ${gates.length} gates, ${openGaps} open gate gaps, ${tasks.length} tasks${untrusted ? ' (judges unapproved)' : ''}`)
