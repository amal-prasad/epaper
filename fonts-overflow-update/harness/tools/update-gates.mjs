// One-time, safe to re-run: adds the "no overflow" condition to G0.parity in harness/gates.json, in place,
// keeping every other change (plan-review gates etc.). Run by Amal; then `npm run approve -- --yes`.
//   node harness/tools/update-gates.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../gates.json')
const raw = fs.readFileSync(file, 'utf8'), j = JSON.parse(raw)
const g = j.gates.find(x => x.id === 'G0.parity')
if (!g) { console.error('No G0.parity gate in harness/gates.json'); process.exit(1) }
g.also = g.also || []
const did = []
const want = [
  { key: 'longerThanDom', op: '<=', threshold: 0, why: 'Pretext must never fit more on a line than the browser: that text would run past the column in print' },
  { key: 'realParagraphs', op: '>=', threshold: 40, why: 'measure on 40+ real Janshakti paragraphs, not invented text' },
  { key: 'inventedParagraphs', op: '<=', threshold: 0, why: 'delete spike/samples/news-sample.txt (invented text)' },
]
for (const w of want) if (!g.also.some(a => a.key === w.key)) { g.also.push(w); did.push(w.key) }
if (!did.length) { console.log('G0.parity already has these conditions. Nothing changed.'); process.exit(0) }
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n')
console.log(`G0.parity: added ${did.join(', ')}. Now: npm test (will say judge changed), then npm run approve -- --yes`)
