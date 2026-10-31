// Gate G1.nodims (D-039): the engine must not hardcode a page size. Page size, grid, page-count rule, export profile and
// asset packs come from the document-type preset. Scans packages/engine/src for paper names and the common page
// dimensions in mm, pt and CSS px; writes spike/out/nodims.json { hits, files, list }.
//   node scripts/check-page-dims.mjs [dir]     dir defaults to packages/engine/src (a dir is for the negative control)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.resolve(process.argv[2] ?? path.join(root, 'packages/engine/src'))
// ponytail: a list of known sizes, not a parser; add a size here when a new preset brings one
const SIZES = [297, 420, 210, 148, 594, 841, 1189, 279, 432, 216, 356,   // mm: A2-A5, tabloid, letter, legal
  841.89, 1190.55, 595.28, 612, 792, 1122.52, 1587.4, 793.7]               // pt and CSS px of A4/A3/letter
const NAMES = /\b(A[2-5]|tabloid|broadsheet|berliner|letter|legal)\b/i
const num = new RegExp(`(?<![\\w.])(${SIZES.map(n => String(n).replace('.', '\\.')).join('|')})(?![\\w.]|\\.\\d)`)
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.[cm]?[jt]s$/.test(e.name) ? [path.join(d, e.name)] : []) : []
const files = walk(src), list = []
for (const f of files) fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
  const code = line.replace(/\/\/.*$/, '')                               // comments may name sizes
  if (num.test(code) || NAMES.test(code)) list.push(`${path.relative(root, f)}:${i + 1}: ${line.trim()}`)
})
if (!files.length) { console.error('no engine source files found under packages/engine/src'); process.exit(1) }
fs.mkdirSync(path.join(root, 'spike/out'), { recursive: true })
fs.writeFileSync(path.join(root, 'spike/out/nodims.json'), JSON.stringify({ hits: list.length, files: files.length, list }, null, 1))
console.log(list.length ? list.join('\n') : `no hardcoded page dimensions in ${files.length} engine file(s)`)
