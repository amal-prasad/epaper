// Strip site UI text that the fetch scripts picked up from the story pages, so the gates measure story copy only.
// Run: node spike/clean-samples.mjs   (rewrites spike/samples/*.txt and spike/headlines/*.txt in place; idempotent)
// Found in the 2026-10-28 fetch: every story's first paragraph starts with "लिंक कॉपी करें अ " (share button and
// font-size button). Dates, places and numbers inside sentences are story text and stay.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const UI = [/^लिंक कॉपी करें अ /gm]
for (const dir of ['samples', 'headlines']) for (const f of fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.txt'))) {
  const p = path.join(root, dir, f), before = fs.readFileSync(p, 'utf8')
  const after = UI.reduce((s, re) => s.replace(re, ''), before)
  if (after !== before) fs.writeFileSync(p, after, 'utf8')
  console.log(`${dir}/${f}: ${before.length - after.length} characters removed`)
}
