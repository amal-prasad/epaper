// Runs packages/*/test/*.test.js with node:test and writes harness/results/tests.json {passed, failed, flowPassed}
// flowPassed = passing tests in files named flow*.test.js (the Phase 0 engine tests).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Node 20 has no --test globs, so collect files ourselves.
const files = []
const walk = d => { if (!fs.existsSync(d)) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = path.join(d, e.name)
    e.isDirectory() ? walk(p) : /\.test\.(js|mjs)$/.test(e.name) && files.push(path.relative(root, p)) } }
for (const pkg of fs.existsSync(path.join(root, 'packages')) ? fs.readdirSync(path.join(root, 'packages')) : []) walk(path.join(root, 'packages', pkg, 'test'))
const r = spawnSync('node', ['--test', '--test-reporter=tap', ...files], { cwd: root, encoding: 'utf8' })
const out = r.stdout || ''
const num = k => Number((out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] ?? 0)
const res = { passed: num('pass'), failed: num('fail') + (r.status && !num('fail') ? 1 : 0), flowPassed: 0 }
const flowFiles = files.filter(f => /flow[^/]*\.test\.(js|mjs)$/.test(f))
if (flowFiles.length) {
  const fr = spawnSync('node', ['--test', '--test-reporter=tap', ...flowFiles], { cwd: root, encoding: 'utf8' })
  res.flowPassed = Number(((fr.stdout || '').match(/^# pass (\d+)/m) || [])[1] ?? 0)
}
fs.mkdirSync(path.join(root, 'harness/results'), { recursive: true })
fs.writeFileSync(path.join(root, 'harness/results/tests.json'), JSON.stringify(res))
console.log(out.split('\n').slice(-12).join('\n'))
process.exit(res.failed ? 1 : 0)
