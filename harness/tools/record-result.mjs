// Records a hand-measured gate result (stopwatch time, usability score, printer proof) with who, when and which build.
// Amal runs this; Claude is blocked from running it and from writing harness/results/ directly.
//
//   npm run record -- G1.time minutes=52 --by Amal --note "issue 2026-11-04, Ravi operating"
//   npm run record -- G2.proof accepted=1 --by Amal --note "Shree Printers, proof #3"
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { ROOT } from '../judges.mjs'

const args = process.argv.slice(2)
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
const [id, kv] = args
const by = opt('--by'), note = opt('--note') || ''
const usage = 'usage: npm run record -- <gate id> <key>=<number> --by <name> [--note "..."]'
if (!id || !kv || !kv.includes('=') || !by) { console.error(usage); process.exit(2) }

const { gates } = JSON.parse(fs.readFileSync(path.join(ROOT, 'harness/gates.json'), 'utf8'))
const g = gates.find(x => x.id === id)
if (!g) { console.error(`No gate ${id} in harness/gates.json`); process.exit(2) }
if (g.run) { console.error(`${id} is measured by a command (${g.run}); it cannot be recorded by hand.`); process.exit(2) }
const [key, raw] = kv.split('=')
if (key !== g.metricKey) { console.error(`${id} reads "${g.metricKey}", not "${key}".`); process.exit(2) }
const value = Number(raw)
if (!Number.isFinite(value)) { console.error(`${raw} is not a number`); process.exit(2) }

const git = a => spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() || ''
const build = (git(['rev-parse', '--short', 'HEAD']) || 'no-git') + (git(['status', '--porcelain']) ? '+dirty' : '')
const out = { [key]: value, measuredBy: by, date: new Date().toISOString().slice(0, 10), build, note }
const file = path.join(ROOT, g.metricFile)
fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
console.log(`Wrote ${g.metricFile}: ${JSON.stringify(out)}\nCommit it. Flip ${id} to "active" in gates.json if it is still pending.`)
