// Runs every test file (harness/test, packages/*/test) with node:test, one process per file, and writes
// harness/results/tests.json:
//   { passed, failed, skipped, todo, cancelled, flowPassed, flowSkipped, files: {file: {...}}, ratchet: [problems] }
// flow* = conservation.test.js + flow*.test.js in packages/engine/test (gate G0.flow).
// Ratchet (harness/test-ratchet.json): a test file may not lose tests or gain skips. Amal re-baselines with `npm run approve`.
// Exit 1 on any failure, cancelled test, missing file or ratchet problem.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const quiet = process.argv.includes('--quiet')
const RATCHET = path.join(root, 'harness/test-ratchet.json')
const rel = p => path.relative(root, p).split(path.sep).join('/')

const files = []
const walk = d => { if (!fs.existsSync(d)) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = path.join(d, e.name)
    e.isDirectory() ? walk(p) : /\.test\.(js|mjs|cjs)$/.test(e.name) && files.push(rel(p)) } }
walk(path.join(root, 'harness', 'test'))
for (const pkg of fs.existsSync(path.join(root, 'packages')) ? fs.readdirSync(path.join(root, 'packages')).sort() : []) walk(path.join(root, 'packages', pkg, 'test'))
files.sort()

const runFile = f => new Promise(resolve => {
  // process.execPath: the same Node that runs this script, whatever is first on PATH (matters on Windows)
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT          // so a nested run reports its own counts
  const c = spawn(process.execPath, ['--test', '--test-reporter=tap', f], { cwd: root, env })
  let out = '', err = ''
  const timer = setTimeout(() => { c.kill(); err += '\n[run-tests] timed out after 300 s' }, 300_000)
  c.stdout.on('data', d => out += d); c.stderr.on('data', d => err += d)
  c.on('close', code => {
    clearTimeout(timer)
    const n = k => Number((out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] ?? 0)
    const r = { tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped'), todo: n('todo'), cancelled: n('cancelled'), exit: code }
    if (code !== 0 && r.fail === 0 && r.cancelled === 0) r.fail = 1          // crashed before reporting
    resolve({ f, r, out, err })
  })
})

const results = []
const queue = [...files], workers = Math.max(1, Math.min(os.cpus().length, 6))
await Promise.all(Array.from({ length: workers }, async () => { while (queue.length) results.push(await runFile(queue.shift())) }))
results.sort((a, b) => a.f.localeCompare(b.f))

const sum = k => results.reduce((a, x) => a + x.r[k], 0)
const isFlow = f => /^packages\/engine\/test\/(conservation|flow[^/]*)\.test\.(js|mjs)$/.test(f)
const flow = results.filter(x => isFlow(x.f))

// ---- ratchet
let ratchet = null
try { ratchet = JSON.parse(fs.readFileSync(RATCHET, 'utf8')) } catch {}
const problems = []
if (ratchet) for (const [f, was] of Object.entries(ratchet.files || {})) {
  const now = results.find(x => x.f === f)?.r
  if (!now) { problems.push(`${f}: test file is gone (had ${was.tests} tests)`); continue }
  if (now.tests < was.tests) problems.push(`${f}: ${now.tests} tests, was ${was.tests}. Tests were removed.`)
  if (now.skipped + now.todo > was.skipped) problems.push(`${f}: ${now.skipped + now.todo} skipped/todo, was ${was.skipped}. Tests were switched off.`)
}
// raise the bar automatically when things improve; never lower it here
const next = { _readme: 'Maintained by harness/run-tests.mjs. Only `npm run approve` may lower a number.', files: { ...(ratchet?.files || {}) } }
if (!problems.length) for (const { f, r } of results) {
  const was = next.files[f]
  next.files[f] = { tests: Math.max(r.tests, was?.tests ?? 0), skipped: Math.min(r.skipped + r.todo, was?.skipped ?? Infinity) }
}
if (JSON.stringify(next) !== JSON.stringify(ratchet)) fs.writeFileSync(RATCHET, JSON.stringify(next, null, 1) + '\n')

const res = {
  passed: sum('pass'), failed: sum('fail') + sum('cancelled') + problems.length, skipped: sum('skipped'), todo: sum('todo'), cancelled: sum('cancelled'),
  flowPassed: flow.reduce((a, x) => a + x.r.pass, 0), flowSkipped: flow.reduce((a, x) => a + x.r.skipped + x.r.todo, 0),
  files: Object.fromEntries(results.map(x => [x.f, x.r])), ratchet: problems,
}
fs.mkdirSync(path.join(root, 'harness/results'), { recursive: true })
fs.writeFileSync(path.join(root, 'harness/results/tests.json'), JSON.stringify(res, null, 1) + '\n')

// ---- report
if (!quiet) {
  for (const { f, r, out, err } of results) {
    const bad = r.fail || r.cancelled
    console.log(`${bad ? 'FAIL' : 'ok  '}  ${f.padEnd(52)} ${r.pass} pass${r.fail ? `, ${r.fail} fail` : ''}${r.skipped ? `, ${r.skipped} skipped` : ''}${r.todo ? `, ${r.todo} todo` : ''}${r.cancelled ? `, ${r.cancelled} cancelled` : ''}`)
    if (bad) {
      const lines = out.split('\n'), keep = []
      lines.forEach((l, i) => { if (/^\s*not ok /.test(l)) keep.push(...lines.slice(i, i + 14)) })
      console.log((keep.join('\n') || out.slice(-3000)).split('\n').map(l => '      ' + l).join('\n'))
      if (err.trim()) console.log('      stderr: ' + err.trim().slice(-1500).replace(/\n/g, '\n      '))
    }
  }
  for (const p of problems) console.log(`FAIL  ratchet: ${p}`)
  if (res.skipped) console.log(`\n${res.skipped} skipped. Skipped tests are not passes.`)
  console.log(`\n${res.passed} passed, ${res.failed} failed${res.skipped ? `, ${res.skipped} skipped` : ''}  ->  harness/results/tests.json`)
}
process.exit(res.failed ? 1 : 0)
