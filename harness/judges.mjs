// The judges: every file that decides whether work is "done". Claude may propose changes to some of them,
// but no change counts until Amal approves it with `npm run approve` (harness/tools/approve-judges.mjs).
// `npm test` (harness/test/judges.test.mjs) and `npm run harness` both fail while an unapproved change exists.
//
// Three kinds of judge:
//   exact       any byte change needs approval (runners, hooks, the spike scorer, npm scripts, CLAUDE.md rules)
//   gates       harness/gates.json; any change needs approval and loosened gates are named explicitly
//   appendOnly  existing tests and test helpers: new top-level code may be added, approved lines may not change
//               or be removed, and nothing may be inserted inside an existing block (e.g. an early `return`)
// Line endings are normalised, so a Windows checkout and Linux CI hash the same.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const LOCK = 'harness/judges.lock.json'
export const RATCHET = 'harness/test-ratchet.json'

const norm = s => s.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)
const read = (root, rel) => { const p = path.join(root, rel); return fs.existsSync(p) ? norm(fs.readFileSync(p, 'utf8')) : null }
const walk = (root, dir, re, out = []) => {
  const abs = path.join(root, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const rel = `${dir}/${e.name}`
    e.isDirectory() ? walk(root, rel, re, out) : re.test(rel) && out.push(rel)
  }
  return out
}
const json = (root, rel) => { const s = read(root, rel); if (s === null) return null; try { return JSON.parse(s) } catch { return { __unparseable: s } } }
const section = (s, heading) => { if (s === null) return null; const a = s.indexOf(`\n${heading}\n`); if (a < 0) return null
  const b = s.indexOf('\n## ', a + heading.length + 2); return s.slice(a, b < 0 ? undefined : b) }

// What each judge contributes to its fingerprint. Extracts keep unrelated edits (new dependency, new decision-log row) free.
function exactJudges(root) {
  const files = [
    'harness/run.mjs', 'harness/run-tests.mjs', 'harness/judges.mjs',
    'harness/tools/approve-judges.mjs', 'harness/tools/record-result.mjs',
    'harness/ux/ux-lint.mjs', 'harness/ux/routes.json',
    'spike/run.mjs', 'spike/src/main.js',
    // what G0.speed / G0.pdfpos measure with, and the real copy G0.parity / G0.headline / G0.pdfpos read
    'scripts/measure-export.mjs',
    ...walk(root, 'spike/samples', /\.txt$/), ...walk(root, 'spike/headlines', /\.txt$/),
    ...walk(root, '.claude', /\.(json|mjs|js|md)$/).filter(f => !f.endsWith('settings.local.json')),
  ]
  const out = Object.fromEntries(files.map(f => [f, read(root, f)]))
  const scripts = rel => { const j = json(root, rel); return j === null ? null : JSON.stringify(j.scripts ?? {}) }
  out['package.json#scripts'] = scripts('package.json')
  out['spike/package.json#scripts'] = scripts('spike/package.json')
  const fonts = json(root, 'spike/fonts.json')
  out['spike/fonts.json#launch'] = fonts === null ? null : JSON.stringify((fonts.fonts || []).filter(f => f.launch).map(f => f.name).sort())
  out['CLAUDE.md#Rules'] = section(read(root, 'CLAUDE.md'), '## Rules')
  return out
}

export const appendOnlyFiles = root => [
  ...walk(root, 'harness/test', /\.test\.[cm]?js$/),
  ...fs.existsSync(path.join(root, 'packages')) ? fs.readdirSync(path.join(root, 'packages')).flatMap(p => walk(root, `packages/${p}/test`, /\.[cm]?js$/)) : [],
]

const meaningful = s => s.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '')
// A line that may follow an insertion: the insertion then sits between top-level statements, not inside a block.
const TOP = /^(test|describe|it|suite|before|after|import|export|const|let|var|function|async|class|\/\/|\/\*|for|if|try|await|[A-Za-z_$][\w$.]*\()/

// Added code that switches tests off or rewires the assertion library is never "additive".
const SABOTAGE = /process\.(exit|kill|abort|reallyExit)|\.only\s*\(|\bonly\s*:\s*true|\b(assert|strict)\s*\.\s*\w+\s*=[^=]|defineProperty\s*\(\s*assert|\bskip\s*:\s*true|\.skip\s*\(|\.todo\s*\(/

// Approved lines must survive in order; new lines may only be inserted before a top-level statement or at the end.
export function appendOnlyProblems(approved, current) {
  if (current === null) return ['file deleted']
  const a = meaningful(approved), c = meaningful(current), problems = []
  let i = 0, inserted = []
  const added = []
  for (const line of c) {
    if (i < a.length && line === a[i]) {
      if (inserted.length && !TOP.test(a[i])) problems.push(`lines inserted inside an existing block, before: ${a[i].trim().slice(0, 70)}\n      inserted: ${inserted[0].trim().slice(0, 70)}`)
      inserted = []; i++
    } else { inserted.push(line); added.push(line) }
  }
  if (i < a.length) problems.push(`approved line changed or removed: ${a[i].trim().slice(0, 90)}`)
  for (const l of added) if (SABOTAGE.test(l)) problems.push(`added line disables or rewires tests: ${l.trim().slice(0, 90)}`)
  return problems
}

const gateKey = g => `${g.id}`
// Lists every difference between the approved and the current gates.json, and marks the ones that make a gate easier to pass.
export function gateChanges(oldGates, newGates) {
  const out = []
  const o = new Map((oldGates?.gates || []).map(g => [gateKey(g), g])), n = new Map((newGates?.gates || []).map(g => [gateKey(g), g]))
  const easier = (op, a, b) => op === '>=' ? b < a : op === '<=' ? b > a : a !== b
  for (const [id, g] of o) {
    const h = n.get(id)
    if (!h) { out.push({ id, change: 'gate removed', loosened: true }); continue }
    for (const k of new Set([...Object.keys(g), ...Object.keys(h)])) {
      const a = JSON.stringify(g[k]), b = JSON.stringify(h[k])
      if (a === b) continue
      let loosened = false
      if (k === 'threshold' || k === 'target') loosened = easier(h.op, g[k], h[k])
      if (k === 'op' || k === 'metricKey' || k === 'metricFile' || k === 'run' || k === 'phase') loosened = true
      if (k === 'also') {                                   // adding a condition tightens; dropping or changing one loosens
        const sig = a => JSON.stringify([a.key, a.op, a.threshold]), now = new Set((h.also || []).map(sig))
        loosened = (g.also || []).some(a => !now.has(sig(a)))
      }
      if (k === 'status') loosened = g.status === 'active'
      out.push({ id, change: `${k}: ${a ?? '(none)'} -> ${b ?? '(none)'}`, loosened })
    }
  }
  for (const [id] of n) if (!o.has(id)) out.push({ id, change: 'gate added', loosened: false })
  return out
}

export function snapshot(root = ROOT) {
  const exact = Object.fromEntries(Object.entries(exactJudges(root)).map(([k, v]) => [k, v === null ? null : sha(v)]))
  const appendOnly = Object.fromEntries(appendOnlyFiles(root).map(f => [f, meaningful(read(root, f))]))
  return { exact, gates: json(root, 'harness/gates.json'), appendOnly }
}

export function readLock(root = ROOT) {
  const p = path.join(root, LOCK)
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return { corrupt: true } }
}

// -> { ok, problems: [string], gateChanges: [...], newTests: [file] }
export function verify(root = ROOT) {
  const lock = readLock(root)
  if (!lock) return { ok: false, problems: [`${LOCK} is missing. Amal: run \`npm run approve\` once to record the approved judges.`], gateChanges: [], newTests: [] }
  if (lock.corrupt) return { ok: false, problems: [`${LOCK} is not valid JSON.`], gateChanges: [], newTests: [] }
  const now = snapshot(root), problems = []
  for (const k of new Set([...Object.keys(lock.exact || {}), ...Object.keys(now.exact)])) {
    const a = lock.exact?.[k], b = now.exact[k]
    if (a === b) continue
    problems.push(a === undefined ? `new judge file: ${k}` : b === null ? `judge file deleted: ${k}` : `judge changed: ${k}`)
  }
  const gc = gateChanges(lock.gates, now.gates)
  for (const g of gc) problems.push(`gate ${g.id}: ${g.change}${g.loosened ? '  <-- LOOSENED' : ''}`)
  for (const [f, lines] of Object.entries(lock.appendOnly || {})) {
    const cur = read(root, f)
    for (const p of appendOnlyProblems(lines.join('\n'), cur)) problems.push(`test ${f}: ${p}`)
  }
  const newTests = Object.keys(now.appendOnly).filter(f => !(f in (lock.appendOnly || {})))
  return { ok: problems.length === 0, problems, gateChanges: gc, newTests }
}

export function writeLock(root = ROOT, by = 'Amal') {
  const s = snapshot(root)
  fs.writeFileSync(path.join(root, LOCK), JSON.stringify({ _readme: 'Written by `npm run approve`. Do not edit by hand.', approvedBy: by, approvedAt: new Date().toISOString(), ...s }, null, 1) + '\n')
}
