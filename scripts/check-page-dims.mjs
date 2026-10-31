// Gate G1.nodims (D-039): the engine must not hardcode a page size. Page size, grid, page-count rule, export profile and
// asset packs come from the document-type preset. Scans packages/engine/src for paper names and the common page
// dimensions in mm, pt and CSS px; writes spike/out/nodims.json { hits, files, list }.
//   node scripts/check-page-dims.mjs [dir]     dir defaults to packages/engine/src (a dir is for the negative control)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.resolve(process.argv[2] ?? path.join(root, 'packages/engine/src'))
// ponytail: patterns, not a parser. A size built up by arithmetic from unlisted numbers still gets through.
const presetDir = path.join(root, 'presets')
const presetSizes = fs.existsSync(presetDir) ? fs.readdirSync(presetDir).filter(f => f.endsWith('.json'))
  .flatMap(f => { const { page } = JSON.parse(fs.readFileSync(path.join(presetDir, f), 'utf8')); return [page.w, page.h] }) : []
const SIZES = [...new Set([297, 420, 210, 148, 594, 841, 1189, 279, 432, 216, 356,   // mm: A2-A5, tabloid, letter, legal
  841.89, 1190.55, 595.28, 612, 792, 1122.52, 1587.4, 793.7,                         // pt and CSS px of A4/A3/letter
  ...presetSizes])]                                                                  // whatever the presets say, custom or not
const NAMES = /\b(A[2-5]|tabloid|broadsheet|berliner|letter|legal)\b/i
const num = new RegExp(`(?<![\\w.])(${SIZES.map(n => String(n).replace('.', '\\.')).join('|')})(?:\\.0+)?(?:mm|cm|in|pt|px)?(?![\\w.])`)
// Any size, on the list or not: a width and height written as numbers, or a number assigned to a page, trim, paper or sheet name.
const WH = /\b(w|width)\s*:\s*\d[\d.]*\s*,\s*(h|height)\s*:\s*\d|\b(h|height)\s*:\s*\d[\d.]*\s*,\s*(w|width)\s*:\s*\d/
const NAMED = /\b\w*(page|trim|paper|sheet)\w*\s*[:=]\s*\d/i
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.[cm]?[jt]s$/.test(e.name) ? [path.join(d, e.name)] : []) : []
const files = walk(src), list = []
for (const f of files) fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
  const code = line.replace(/\/\/.*$/, '')                               // comments may name sizes
  if (num.test(code) || NAMES.test(code) || WH.test(code) || NAMED.test(code)) list.push(`${path.relative(root, f)}:${i + 1}: ${line.trim()}`)
})
if (!files.length) { console.error('no engine source files found under packages/engine/src'); process.exit(1) }
fs.mkdirSync(path.join(root, 'spike/out'), { recursive: true })
fs.writeFileSync(path.join(root, 'spike/out/nodims.json'), JSON.stringify({ hits: list.length, files: files.length, list }, null, 1))
console.log(list.length ? list.join('\n') : `no hardcoded page dimensions in ${files.length} engine file(s)`)
