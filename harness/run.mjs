// Gate runner. Usage: node harness/run.mjs [--phase N] [--list]
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const phaseArg = args.includes('--phase') ? Number(args[args.indexOf('--phase') + 1]) : null
const listOnly = args.includes('--list')
const { gates } = JSON.parse(fs.readFileSync(path.join(root, 'harness/gates.json'), 'utf8'))

const cmp = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a === b }
const rows = []
let failed = 0

for (const g of gates) {
  if (phaseArg !== null && g.phase !== phaseArg) continue
  if (listOnly) { rows.push([g.id, `P${g.phase}`, g.status.toUpperCase(), g.title]); continue }
  if (g.status !== 'active') { rows.push([g.id, `P${g.phase}`, 'PENDING', g.title, '-']); continue }

  let note = ''
  if (g.run) {
    try { execSync(g.run, { cwd: root, stdio: 'pipe', timeout: 15 * 60 * 1000 }) }
    catch (e) { rows.push([g.id, `P${g.phase}`, 'FAIL', g.title, `command failed: ${String(e.message).split('\n')[0]}`]); failed++; continue }
  }
  const file = path.join(root, g.metricFile)
  if (!fs.existsSync(file)) { rows.push([g.id, `P${g.phase}`, 'FAIL', g.title, `missing ${g.metricFile}`]); failed++; continue }
  const val = JSON.parse(fs.readFileSync(file, 'utf8'))[g.metricKey]
  if (typeof val !== 'number') { rows.push([g.id, `P${g.phase}`, 'FAIL', g.title, `no numeric "${g.metricKey}" in ${g.metricFile}`]); failed++; continue }
  const ok = cmp[g.op](val, g.threshold)
  let status = ok ? 'PASS' : 'FAIL'
  if (ok && g.target !== undefined && !cmp[g.op](val, g.target)) { status = 'WARN'; note = `below target ${g.target}` }
  if (!ok) failed++
  rows.push([g.id, `P${g.phase}`, status, g.title, `${val} (need ${g.op} ${g.threshold})${note ? ' · ' + note : ''}`])
}

const w = i => Math.max(...rows.map(r => String(r[i] ?? '').length))
for (const r of rows) console.log(r.map((c, i) => i < 3 ? String(c).padEnd(w(i)) : c).join('  '))
if (!listOnly) console.log(`\n${failed ? 'GATES FAILED: ' + failed : 'All active gates pass.'}`)
process.exit(failed ? 1 : 0)
