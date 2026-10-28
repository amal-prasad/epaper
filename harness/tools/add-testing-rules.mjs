// Adds the testing and debugging rules (10-16) and the Claude Code harness section to CLAUDE.md. Safe to run twice.
// Usage: node harness/tools/add-testing-rules.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../CLAUDE.md')
const MARK = '<!-- testing-rules -->', MARK2 = '<!-- claude-code-harness -->'
const rules = `${MARK}
10. Done means a command passes. Name the command before writing code. After every task run \`npm test\` and \`npm run harness -- --phase N\` and paste the real output. "Should work" is not a result.
11. Bug workflow: reproduce, write a failing test with the exact input, find the cause (log or bisect; do not guess), fix, run everything. Keep the test forever. Add the input to \`harness/corpus\` or \`spike/samples\`.
12. Never loosen a gate or test to get green: do not lower thresholds in \`harness/gates.json\`, skip or delete a test, or change an expected value. If a gate or test looks wrong, stop and show Amal the evidence. Any change to a judge (gates, tests, test helpers, spike scorer, npm scripts, these rules) fails \`npm test\` until Amal reads the diff and runs \`npm run approve\`; when that happens, stop and tell him what you changed and why. Never try to get around a hook or the judges lock.
13. flow() contract and invariants (\`docs/TESTING.md\`): text conserved, lines inside frames, clear of obstacles, never wider than the box, reading order, deterministic. The engine stays DOM-free; Node tests use \`packages/engine/test/helpers/fake-canvas.js\`.
14. Every op has an inverse and must pass \`fuzzUndo\` (\`packages/engine/test/helpers/fuzz.js\`). Ops never mutate their input.
15. One small task per commit (about an hour of work), committed only when green. Never commit with a failing test. Never push; Amal pushes.
16. Anything that changes print output (export, colour, fonts, bleed) is reviewed by the \`reviewer\` agent (a fresh session that did not write it), and gets a physical proof from the printer before a phase is called done.
`
const section = `${MARK2}
## Claude Code harness (in \`.claude/\` and \`harness/\`)
- \`/task <what>\` builds one small task with the test-first loop. \`/bug <symptom>\` fixes a bug test-first. \`/gate\` reports the current phase gates. \`/review\` asks the \`reviewer\` agent for a cold review of the diff.
- Hook \`protect-gates.mjs\`: blocks edits to \`.claude/\`, the harness runners, \`harness/results/\`, the judges lock and ratchet, and changes to existing tests (new tests and purely additive edits are allowed).
- \`harness/judges.mjs\`: every judge is fingerprinted in \`harness/judges.lock.json\`. Changing one (including \`gates.json\`, flipping a gate to active, or the spike scorer) is allowed, but \`npm test\` and the harness fail until Amal approves with \`npm run approve\`. Loosened gates are named in the approval.
- \`harness/test-ratchet.json\`: a test file may never lose tests or gain skips.
- Hand-measured results are recorded only by Amal: \`npm run record -- <gate> <key>=<n> --by <name>\`.
- Hook \`stop-check.mjs\`: Claude cannot finish while \`npm test\` fails (two attempts, then it must explain).
- If a hook or the lock blocks you, do not look for a workaround. Tell Amal what you wanted to change and why.
`
let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), did = []
if (s.includes(MARK)) {                                   // refresh an older copy of the rules block
  const a = s.indexOf(MARK), b = s.indexOf('\n', s.indexOf('\n16. ', a) + 1)
  const fresh = rules.trimEnd()
  if (b > a && s.slice(a, b) !== fresh) { s = s.slice(0, a) + fresh + s.slice(b); did.push('updated testing rules 10-16') }
} else {
  const lines = s.split('\n')
  const i = lines.findIndex(l => /^9\. Phase gates are hard/.test(l))
  if (i >= 0) lines.splice(i + 1, 0, ...rules.trimEnd().split('\n')); else lines.push('', ...rules.trimEnd().split('\n'))
  s = lines.join('\n'); did.push('testing rules 10-16')
}
if (!s.includes(MARK2)) {
  const j = s.indexOf('## Decision log')
  s = j >= 0 ? s.slice(0, j) + section + '\n' + s.slice(j) : s.trimEnd() + '\n\n' + section
  did.push('Claude Code harness section')
} else {                                                  // refresh an older copy of the harness section
  const a = s.indexOf(MARK2), b = s.indexOf('\n## ', s.indexOf('\n## ', a) + 1)
  const fresh = section.trimEnd()
  if (b > a && s.slice(a, b).trimEnd() !== fresh) { s = s.slice(0, a) + fresh + '\n' + s.slice(b); did.push('updated Claude Code harness section') }
}

// commands added by the harness hardening update
const cmds = [
  ['--fast', '- `npm run harness -- --phase 0 --fast` — same, skipping slow gates (the parity run); use inside the build loop'],
  ['--done', '- `npm run harness -- --phase 0 --done` — phase exit check: pending or skipped gates count as failures'],
  ['npm run approve', '- `npm run approve` — Amal only, in his own terminal: review and approve changes to gates, tests, scorer or rules'],
  ['npm run record', '- `npm run record -- G1.time minutes=52 --by Amal` — Amal only: record a hand-measured gate result'],
]
const anchor = s.indexOf('\n', s.indexOf('- `npm run harness -- --list`'))
if (anchor > 0) {
  const add = cmds.filter(([k]) => !s.slice(0, s.indexOf('## Rules') > 0 ? s.indexOf('## Rules') : s.length).includes(k)).map(([, l]) => l)
  if (add.length) { s = s.slice(0, anchor + 1) + add.join('\n') + '\n' + s.slice(anchor + 1); did.push('harness commands') }
}

// decision-log rows, appended once each (the log is append-only)
const rows = [
  ['D-010', '| D-010 | 2026-10-28 | Bundle Devanagari + Latin subsets of every font; launch body fonts Noto Sans and Noto Serif Devanagari; Pretext stays the candidate live engine | Devanagari-only subsets made digits and English fall back to system fonts that canvas and DOM measure differently; with Latin bundled the launch fonts reach 99.6% (docs/FONTS.md). Row reconstructed 2026-10-28 from docs/FONTS.md and phase0-engine.md, which cite it; correct it if the original said otherwise |'],
  ['D-011', '| D-011 | 2026-10-28 | Harness hardening: G0.flow is active and counts the 12 conservation contract tests plus 5 own flow tests (>= 17, none skipped); G0.parity also needs >= 40 real paragraphs and no invented samples; new flow invariants (no overlapping lines, no premature overflow); every judge is fingerprinted in harness/judges.lock.json and changes wait for `npm run approve`; hand results need `npm run record` | A do-nothing flow() passed all conservation tests; G0.flow could never pass as defined and phase docs told Claude to edit a file the hook blocks; the parity gate could pass on invented text; hand results and the spike scorer could be changed without anyone noticing |'],
]
for (let [id, row] of rows) {
  if (id === 'D-011') {                                   // the hardening row takes the next free number if D-011 is already used
    if (s.includes('| Harness hardening:')) continue
    if (s.includes('| D-011 |')) { const max = Math.max(...[...s.matchAll(/\| D-(\d+) \|/g)].map(m => +m[1])); id = `D-${String(max + 1).padStart(3, '0')}`; row = row.replace('| D-011 |', `| ${id} |`) }
  } else if (s.includes(`| ${id} |`)) continue
  const log = s.indexOf('## Decision log'); if (log < 0) break
  const end = s.indexOf('\n## ', log + 1), at = end < 0 ? s.length : end
  s = s.slice(0, at).trimEnd() + '\n' + row + '\n' + (end < 0 ? '' : '\n' + s.slice(at + 1)); did.push(id)
}
if (!did.length) console.log('CLAUDE.md already up to date. Nothing changed.')
else { fs.writeFileSync(file, s); console.log('Added to CLAUDE.md: ' + did.join(' and ')) }
