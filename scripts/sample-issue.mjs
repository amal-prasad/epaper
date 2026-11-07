// Builds data/issues/sample.json for the Studio app from the human-reviewed golden pages (harness/golden/baseline-2026-11-03).
// Own synthetic content only (rule 4). Run: node scripts/sample-issue.mjs
import fs from 'node:fs'

const base = new URL('../harness/golden/baseline-2026-11-03/', import.meta.url)
const names = ['01-weekly-front', '02-front-hero', '03-front-rail', '04-weekly-inner']
const docs = names.map(n => JSON.parse(fs.readFileSync(new URL(`${n}.json`, base))))
const sample = {
  ...docs[0], id: 'sample',
  stories: docs.flatMap(d => d.stories),
  pages: docs.flatMap(d => d.pages).map((p, i) => ({ ...p, no: i + 1 })),
}
fs.mkdirSync(new URL('../data/issues/', import.meta.url), { recursive: true })
fs.writeFileSync(new URL('../data/issues/sample.json', import.meta.url), JSON.stringify(sample))
console.log(`wrote data/issues/sample.json: ${sample.pages.length} pages, ${sample.stories.length} stories`)
