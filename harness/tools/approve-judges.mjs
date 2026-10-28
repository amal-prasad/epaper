// Amal runs this in his own terminal after reading the diff. Claude is blocked from running it (.claude/hooks/protect-gates.mjs).
// It shows every change to the judges since the last approval, then records the current state as approved
// (harness/judges.lock.json) and re-baselines the test ratchet (harness/test-ratchet.json).
//
//   npm run approve                 show what changed and ask
//   npm run approve -- --yes        no prompt (Git Bash / mintty, where Node cannot read the keyboard)
//   npm run approve -- --yes --loosen   also needed when a gate gets easier or an approved test line changed
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { spawnSync } from 'node:child_process'
import { ROOT, LOCK, RATCHET, verify, readLock, writeLock } from '../judges.mjs'

const args = process.argv.slice(2)
const yes = args.includes('--yes'), loosenOk = args.includes('--loosen')
const v = verify(ROOT)
const lock = readLock(ROOT)

if (v.ok && !v.newTests.length && lock) { console.log('Judges match the approved state. Nothing to approve.'); process.exit(0) }

console.log(lock ? '\nChanges to the judges since the last approval:\n' : '\nNo lock yet: this records the current judges as the approved baseline.\n')
for (const p of v.problems) console.log('  - ' + p)
for (const f of v.newTests) console.log('  + new test file (will become append-only): ' + f)

// show the real diff for changed files, from the commit that last touched the lock
const since = spawnSync('git', ['log', '-1', '--format=%H', '--', LOCK], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim()
const files = [...new Set(v.problems.map(p => (p.match(/(?:judge changed|test) ([^\s:#]+)/) || [])[1]).filter(Boolean))]
if (since && files.length) {
  const d = spawnSync('git', ['diff', '--no-color', since, '--', ...files], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 << 20 })
  if (d.stdout?.trim()) console.log(`\n----- git diff ${since.slice(0, 8)} -- ${files.join(' ')}\n${d.stdout.slice(0, 20000)}${d.stdout.length > 20000 ? '\n... (truncated; run git diff yourself)' : ''}`)
}

const risky = v.gateChanges.some(g => g.loosened) || v.problems.some(p => /approved line changed|inserted inside|disables or rewires|file deleted|judge file deleted/.test(p))
if (risky && !loosenOk) {
  console.log('\nSome changes make a gate easier to pass or change an approved test. Re-run with --loosen if you really mean it,')
  console.log('and add a decision-log row in CLAUDE.md saying why.')
  process.exit(1)
}

if (!yes) {
  if (!process.stdin.isTTY) { console.log('\nThis terminal cannot take keyboard input (common in Git Bash). Re-run with --yes after reading the list above.'); process.exit(1) }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const a = (await rl.question('\nType "approve" to accept these changes: ')).trim(); rl.close()
  if (a !== 'approve') { console.log('Not approved. Nothing written.'); process.exit(1) }
}

writeLock(ROOT, process.env.USERNAME || process.env.USER || 'Amal')
try { fs.rmSync(path.join(ROOT, RATCHET)) } catch {}
spawnSync(process.execPath, [path.join(ROOT, 'harness/run-tests.mjs'), '--quiet'], { cwd: ROOT, stdio: 'inherit' })
console.log(`\nApproved. Wrote ${LOCK} and re-baselined ${RATCHET}. Commit both with the change.`)
