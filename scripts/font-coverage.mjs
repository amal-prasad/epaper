// Font coverage: every character in real copy (spike/samples, spike/headlines) must be drawn by each launch font itself, never by a fallback.
// A character is covered by a family+weight only if some @font-face in spike/public/fonts.css has it in its unicode-range
// AND that face's served .woff2 has it in its cmap. Each flagged character is then confirmed in Chromium (widths with two
// different fallback stacks differ when the browser falls back).
//   node scripts/font-coverage.mjs [--fonts "Khand,Eczar"] [--extra "₹“”"]    default: fonts.json launch:true; writes spike/out/coverage.json
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pub = path.join(root, 'spike/public')
const arg = process.argv.indexOf('--fonts')
const families = arg > 0 ? process.argv[arg + 1].split(',').map(s => s.trim())
  : JSON.parse(fs.readFileSync(path.join(root, 'spike/fonts.json'), 'utf8')).fonts.filter(f => f.launch).map(f => f.name)

// cmap of a WOFF2 file: the table directory, then one brotli stream with the tables back to back (cmap is never transformed).
function cmapOf(file) {
  const b = fs.readFileSync(file)
  if (b.toString('latin1', 0, 4) !== 'wOF2') throw new Error(file + ': not WOFF2')
  const n = b.readUInt16BE(12)
  let p = 48, off = 0, cmap
  const u128 = () => { let v = 0; for (;;) { const x = b[p++]; v = v * 128 + (x & 127); if (!(x & 128)) return v } }
  for (let i = 0; i < n; i++) {
    const flags = b[p++], tagIx = flags & 63, ver = flags >> 6
    if (tagIx === 63) p += 4
    const orig = u128(), transformed = (tagIx === 10 || tagIx === 11) ? ver === 0 : ver !== 0
    const len = transformed ? u128() : orig
    if (tagIx === 0) cmap = { off, len }
    off += len
  }
  const t = zlib.brotliDecompressSync(b.subarray(p)).subarray(cmap.off, cmap.off + cmap.len)
  const recs = Array.from({ length: t.readUInt16BE(2) }, (_, i) => ({ pid: t.readUInt16BE(4 + i * 8), eid: t.readUInt16BE(6 + i * 8), o: t.readUInt32BE(8 + i * 8) }))
  const pick = recs.find(r => r.pid === 3 && r.eid === 10) || recs.find(r => r.pid === 3 && r.eid === 1) || recs.find(r => r.pid === 0)
  const s = t.subarray(pick.o), has = new Set(), fmt = s.readUInt16BE(0)
  if (fmt === 12) {
    for (let g = 0, ng = s.readUInt32BE(12); g < ng; g++) for (let c = s.readUInt32BE(16 + g * 12); c <= s.readUInt32BE(20 + g * 12); c++) has.add(c)
  } else if (fmt === 4) {
    const seg = s.readUInt16BE(6) / 2, end = 14, start = end + seg * 2 + 2, delta = start + seg * 2, ro = delta + seg * 2
    for (let i = 0; i < seg; i++) for (let c = s.readUInt16BE(start + i * 2); c <= s.readUInt16BE(end + i * 2) && c !== 0xffff; c++) {
      const r = s.readUInt16BE(ro + i * 2)
      const gid = r === 0 ? (c + s.readInt16BE(delta + i * 2)) & 0xffff : s.readUInt16BE(ro + i * 2 + r + (c - s.readUInt16BE(start + i * 2)) * 2)
      if (gid) has.add(c)
    }
  } else throw new Error(file + ': cmap format ' + fmt)
  return has
}

const faces = [...fs.readFileSync(path.join(pub, 'fonts.css'), 'utf8').matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
  family: body.match(/font-family:\s*'([^']+)'/)[1], weight: +body.match(/font-weight:\s*(\d+)/)[1],
  file: path.join(pub, body.match(/url\(([^)]+)\)/)[1]),
  ranges: body.match(/unicode-range:\s*([^;]+)/)[1].split(',').map(r => r.trim().replace(/^U\+/i, '').split('-').map(h => parseInt(h, 16))).map(([a, z = a]) => [a, z]),
})).filter(f => families.includes(f.family))
for (const f of faces) f.cmap = cmapOf(f.file)

const copy = ['spike/samples', 'spike/headlines'].flatMap(d => fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.txt')).map(f => fs.readFileSync(path.join(root, d, f), 'utf8'))).join('\n')
const counts = new Map()
for (const ch of copy) if (!/[\n\r\t]/.test(ch)) counts.set(ch, (counts.get(ch) || 0) + 1)
// --extra "₹“”": characters to check that the copy does not contain yet (count 0)
const extra = process.argv.indexOf('--extra')
if (extra > 0) for (const ch of process.argv[extra + 1]) if (!counts.has(ch)) counts.set(ch, 0)
const context = ch => { const i = copy.indexOf(ch); return i < 0 ? '(not in copy)' : copy.slice(Math.max(0, i - 15), i + 15).replace(/\s+/g, ' ') }

const results = []
for (const family of families) for (const weight of [...new Set(faces.filter(f => f.family === family).map(f => f.weight))].sort()) {
  const fw = faces.filter(f => f.family === family && f.weight === weight), missing = []
  for (const [ch, count] of counts) {
    const cp = ch.codePointAt(0), inRange = fw.filter(f => f.ranges.some(([a, z]) => cp >= a && cp <= z))
    if (inRange.some(f => f.cmap.has(cp))) continue
    const elsewhere = fw.some(f => f.cmap.has(cp))
    missing.push({ cp: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'), ch, count, context: context(ch),
      reason: elsewhere ? 'in a cmap but outside that face\'s unicode-range' : inRange.length ? 'in unicode-range, not in cmap' : 'in no face\'s unicode-range or cmap' })
  }
  results.push({ family, weight, files: fw.length, missing })
}

// Chromium check: a covered character measures the same whatever comes after the family in the stack.
const page = path.join(root, 'scratch/font-coverage.html')
fs.mkdirSync(path.dirname(page), { recursive: true })
fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="../spike/public/fonts.css"><body>`)
const browser = await chromium.launch(), bp = await browser.newPage()
await bp.goto(pathToFileURL(page).href)
for (const r of results) for (const m of r.missing) {
  m.browser = await bp.evaluate(async ([fam, w, ch]) => {
    await document.fonts.load(`${w} 40px "${fam}"`, ch)
    const ctx = document.createElement('canvas').getContext('2d')
    const width = stack => { ctx.font = `${w} 40px "${fam}", ${stack}`; return ctx.measureText(ch).width }
    const a = width('serif'), b = width('monospace')
    return a === 0 && b === 0 ? 'zero width, cannot tell' : Math.abs(a - b) > 0.01 ? 'falls back' : 'same width with both stacks (inconclusive: both may reach one system font)'
  }, [r.family, r.weight, m.ch])
}
await browser.close()

fs.mkdirSync(path.join(root, 'spike/out'), { recursive: true })
const out = { date: new Date().toISOString(), characters: counts.size, copyChars: [...copy].length, results }
fs.writeFileSync(path.join(root, 'spike/out/coverage.json'), JSON.stringify(out, null, 1))
console.log(`${counts.size} distinct characters in ${out.copyChars} characters of copy`)
for (const r of results) {
  console.log(`\n${r.family} ${r.weight} (${r.files} files): ${r.missing.length} missing`)
  for (const m of r.missing) console.log(`  ${m.cp} ${JSON.stringify(m.ch)} x${m.count}  ${m.reason}; browser: ${m.browser}  …${m.context}…`)
}
