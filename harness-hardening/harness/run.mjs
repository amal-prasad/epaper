// Gate runner.
//   node harness/run.mjs                 every gate; runs the active ones
//   node harness/run.mjs --phase 0       one phase
//   node harness/run.mjs --phase 0 --fast    skip gates marked "slow" (use inside the build loop)
//   node harness/run.mjs --phase 0 --done    phase exit check: pending or skipped gates count as failures
//   node harness/run.mjs --list          list gates and status
// Exit 1 if any active gate fails, if the judges changed without approval, or (with --done) if any gate is not passing.
//
// Gate fields: id, phase, status (active|pending), title, run?, metricFile, metricKey, op (>=|<=|==), threshold, target?,
//   slow? (true = skipped by --fast), also? [{ key, op, threshold, why }] extra conditions on the same metric file.
// Gates without `run` are hand-measured: their file must carry measuredBy, date and build (write it with `npm run record`).
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { verify } from './judges.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const has = f => args.includes(f)
let phaseArg = null
if (has('--phase')) {
  phaseArg = Number(args[args.indexOf('--phase') + 1])
  if (!Number.isInteger(phaseArg)) { console.error('usage: --phase <number>'); process.exit(2) }
}
const listOnly = has('--list'), fast = has('--fast'), done = has('--done')
if (fast && done) { console.error('--done cannot be combined with --fast: a phase is not done until its slow gates pass too.'); process.exit(2) }

let gates
try { ({ gates } = JSON.parse(fs.readFileSync(path.join(root, 'harness/gates.json'), 'utf8'))) }
catch (e) { console.error(`harness/gates.json is not valid JSON: ${e.message}`); process.exit(1) }

const cmp = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a === b }
const ran = new Map()                                   // command -> error message | null, so shared commands run once
const run = cmd => {
  if (ran.has(cmd)) return ran.get(cmd)
  let err = null
  try { execSync(cmd, { cwd: root, stdio: 'pipe', timeout: 30 * 60 * 1000, maxBuffer: 64 << 20 }) }
  catch (e) {
    const all = `${e.stderr || ''}\n${e.stdout || ''}`.split('\n').map(l => l.trim()).filter(Boolean)
    const key = all.filter(l => /\w*Error:|\berror\b:|missing|not found|cannot|doesn't exist|timed out|\bRun:/i.test(l) && !/^(at |name:|code:|log:)/.test(l))
    const tail = (key.length ? key.slice(0, 2) : all.slice(-3)).join(' | ')
    err = `command failed (${cmd})${tail ? ': ' + tail.slice(0, 300) : ''}`
  }
  ran.set(cmd, err); return err
}
const readMetric = rel => {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) return { err: `missing ${rel}` }
  try { return { data: JSON.parse(fs.readFileSync(file, 'utf8')) } } catch (e) { return { err: `${rel} is not valid JSON` } }
}

const rows = []
let failed = 0, notDone = 0
for (const g of gates) {
  if (phaseArg !== null && g.phase !== phaseArg) continue
  if (listOnly) { rows.push([g.id, `P${g.phase}`, String(g.status).toUpperCase() + (g.slow ? ' (slow)' : ''), g.title]); continue }
  if (g.status !== 'active') { rows.push([g.id, `P${g.phase}`, 'PENDING', g.title, '-']); notDone++; continue }
  if (fast && g.slow) { rows.push([g.id, `P${g.phase}`, 'SKIP', g.title, 'slow gate skipped by --fast']); notDone++; continue }
  const fail = why => { rows.push([g.id, `P${g.phase}`, 'FAIL', g.title, why]); failed++ }

  if (g.run) {
    // remove the old result first, so a command that "succeeds" without writing one cannot pass on stale numbers
    if (!ran.has(g.run)) try { fs.rmSync(path.join(root, g.metricFile)) } catch {}
    const err = run(g.run)
    if (err) { fail(err); continue }
  }
  const { data, err } = readMetric(g.metricFile)
  if (err) { fail(err); continue }
  if (!g.run) {
    const miss = ['measuredBy', 'date', 'build'].filter(k => !data[k])
    if (miss.length) { fail(`hand-measured result has no ${miss.join('/')} (record it with: npm run record -- ${g.id} ${g.metricKey}=<n> --by <name>)`); continue }
  }
  const val = data[g.metricKey]
  if (typeof val !== 'number' || !Number.isFinite(val)) { fail(`no numeric "${g.metricKey}" in ${g.metricFile}`); continue }
  if (!cmp[g.op]) { fail(`unknown op ${g.op}`); continue }
  const extra = (g.also || []).map(a => ({ ...a, v: data[a.key] })).filter(a => typeof a.v !== 'number' || !cmp[a.op]?.(a.v, a.threshold))
  const ok = cmp[g.op](val, g.threshold) && !extra.length
  let status = ok ? 'PASS' : 'FAIL', note = ''
  if (ok && g.target !== undefined && !cmp[g.op](val, g.target)) { status = 'WARN'; note = ` · below target ${g.target}` }
  if (!ok) failed++
  const why = extra.map(a => ` · ${a.key} ${a.v ?? 'missing'} (need ${a.op} ${a.threshold}${a.why ? ': ' + a.why : ''})`).join('')
  rows.push([g.id, `P${g.phase}`, status, g.title, `${val} (need ${g.op} ${g.threshold})${note}${why}`])
}

const w = i => Math.max(...rows.map(r => String(r[i] ?? '').length), 0)
for (const r of rows) console.log(r.map((c, i) => i < 3 ? String(c).padEnd(w(i)) : c).join('  '))
if (listOnly) process.exit(0)

const j = verify(root)
if (!j.ok) {
  console.log('\nJUDGES CHANGED WITHOUT APPROVAL. These results are not trusted:')
  for (const p of j.problems.slice(0, 25)) console.log('  - ' + p)
  console.log('Claude: stop and tell Amal what you changed and why. Amal: read the diff, then `npm run approve` in your own terminal.')
}
const scope = phaseArg === null ? 'All phases' : `Phase ${phaseArg}`
if (failed) console.log(`\nGATES FAILED: ${failed}`)
else if (notDone) console.log(`\n${scope}: no active gate fails, but ${notDone} gate(s) are pending or skipped, so this is NOT done.`)
else console.log(`\n${scope}: every gate passes.`)
process.exit(failed || !j.ok || (done && notDone) ? 1 : 0)
