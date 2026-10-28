// Adds the testing and debugging rules (10-16) to CLAUDE.md, right after rule 9. Safe to run twice.
// Usage: node harness/tools/add-testing-rules.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../CLAUDE.md')
let s = fs.readFileSync(file, 'utf8')
const MARK = '<!-- testing-rules -->'
if (s.includes(MARK)) { console.log('CLAUDE.md already has the testing rules. Nothing changed.'); process.exit(0) }
const block = `${MARK}
10. Done means a command passes. Name the command before writing code. After every task run \`npm test\` and \`npm run harness -- --phase N\` and paste the real output. "Should work" is not a result.
11. Bug workflow: reproduce, write a failing test with the exact input, find the cause (log or bisect; do not guess), fix, run everything. Keep the test forever. Add the input to \`harness/corpus\` or \`spike/samples\`.
12. Never loosen a gate or test to get green: do not edit thresholds in \`harness/gates.json\`, skip or delete a test, or change an expected value without Amal's explicit approval. If a gate or test looks wrong, stop and show the evidence.
13. flow() contract and invariants (\`docs/TESTING.md\`): text conserved, lines inside frames, clear of obstacles, never wider than the box, reading order, deterministic. The engine stays DOM-free; Node tests use \`packages/engine/test/helpers/fake-canvas.js\`.
14. Every op has an inverse and must pass \`fuzzUndo\` (\`packages/engine/test/helpers/fuzz.js\`). Ops never mutate their input.
15. One small task per commit (about an hour of work), committed only when green. Never commit with a failing test.
16. Anything that changes print output (export, colour, fonts, bleed) is reviewed by a fresh session that did not write it, and gets a physical proof from the printer before a phase is called done.
`
const lines = s.split('\n')
const i = lines.findIndex(l => /^9\. Phase gates are hard/.test(l))
if (i >= 0) lines.splice(i + 1, 0, ...block.trimEnd().split('\n')); else lines.push('', ...block.trimEnd().split('\n'))
fs.writeFileSync(file, lines.join('\n'))
console.log(`Added testing rules ${i >= 0 ? 'after rule 9' : 'at the end'} of CLAUDE.md`)
