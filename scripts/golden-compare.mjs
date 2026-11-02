// Standalone preparation tool. Does not write gate evidence or approve baselines.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(new URL('../spike/package.json', import.meta.url))
const { createCanvas, loadImage } = require('@napi-rs/canvas')
export const hash = value => createHash('sha256').update(value).digest('hex')

// Exact decoded RGBA comparison: even one changed pixel fails. No whole-page
// percentage can hide a clipped matra, missing punctuation or a thin column rule.
export async function comparePng(expected, actual) {
  const [a, b] = await Promise.all([loadImage(expected), loadImage(actual)])
  if (a.width !== b.width || a.height !== b.height) return { ok: false, reason: 'image dimensions differ', expected: [a.width, a.height], actual: [b.width, b.height] }
  const pixels = img => {
    const canvas = createCanvas(img.width, img.height), ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, img.width, img.height).data
  }
  const ap = pixels(a), bp = pixels(b)
  let changedPixels = 0, minX = a.width, minY = a.height, maxX = -1, maxY = -1
  const diff = createCanvas(a.width, a.height), ctx = diff.getContext('2d'), rgba = ctx.createImageData(a.width, a.height)
  for (let i = 0; i < ap.length; i += 4) {
    const changed = [0, 1, 2, 3].some(c => ap[i + c] !== bp[i + c])
    rgba.data[i] = changed ? 220 : 255; rgba.data[i + 1] = changed ? 20 : 255
    rgba.data[i + 2] = changed ? 70 : 255; rgba.data[i + 3] = 255
    if (!changed) continue
    changedPixels++
    const x = i / 4 % a.width, y = Math.floor(i / 4 / a.width)
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  ctx.putImageData(rgba, 0, 0)
  return { ok: changedPixels === 0, changedPixels, width: a.width, height: a.height,
    bounds: changedPixels ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
    diff: diff.toBuffer('image/png') }
}

const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
const inside = (dir, relative) => {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error('manifest asset path must be relative')
  const resolved = path.resolve(dir, relative), rel = path.relative(dir, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`manifest asset path escapes directory: ${relative}`)
  return resolved
}
async function readPage(manifestPath, page) {
  const result = {}
  for (const key of ['image', 'fixture']) {
    const file = inside(path.dirname(manifestPath), page[key])
    const bytes = await fs.readFile(file)
    if (!/^[a-f0-9]{64}$/.test(page[`${key}Hash`]) || hash(bytes) !== page[`${key}Hash`]) throw new Error(`${page.id}: ${key} hash mismatch`)
    result[key] = bytes
  }
  return result
}

export async function compareManifests(candidatePath, baselinePath, { diffDir, requirePageCount } = {}) {
  if (!baselinePath) throw new Error('human-reviewed baseline manifest missing; candidates are never approved automatically')
  let baseline
  try { baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') throw new Error(`human-reviewed baseline missing: ${baselinePath}`); throw error }
  const candidate = JSON.parse(await fs.readFile(candidatePath, 'utf8'))
  if (baseline.status !== 'human-reviewed' || !['by', 'at', 'note'].every(key => typeof baseline.review?.[key] === 'string' && baseline.review[key].trim()))
    throw new Error('baseline requires human-review status and review.by/at/note')
  if (candidate.schemaVersion !== 1 || baseline.schemaVersion !== 1) throw new Error('unsupported golden manifest schema')
  if (!candidate.pages?.length || !baseline.pages?.length || candidate.pages.length !== baseline.pages.length) throw new Error('candidate and baseline pages must be nonempty and match')
  if (requirePageCount && candidate.pages.length !== requirePageCount) throw new Error(`comparison requires ${requirePageCount} pages`)
  const ids = m => m.pages.map(p => p.id)
  if (new Set(ids(candidate)).size !== candidate.pages.length || stable(ids(candidate)) !== stable(ids(baseline))) throw new Error('candidate and baseline pages must have matching unique ids in order')
  for (const m of [candidate, baseline]) {
    if (!['raster', 'chromium', 'platform', 'node', 'canvas', 'playwright'].every(key => typeof m.provenance?.[key] === 'string' && m.provenance[key].trim())
      || !m.provenance?.fonts || !Object.keys(m.provenance.fonts).length) throw new Error('render/font/tool provenance missing required fields')
  }
  if (stable(candidate.provenance) !== stable(baseline.provenance)) throw new Error('render/font/tool provenance differs; review a new baseline for this environment')
  const pages = []
  if (diffDir) await fs.mkdir(diffDir, { recursive: true })
  for (const [i, p] of candidate.pages.entries()) {
    const b = baseline.pages[i]
    const [actual, expected] = await Promise.all([readPage(candidatePath, p), readPage(baselinePath, b)])
    if (p.fixtureHash !== b.fixtureHash) throw new Error(`${p.id}: fixture hash differs; changed content requires human review`)
    const { diff, ...result } = await comparePng(expected.image, actual.image)
    if (diffDir && diff) await fs.writeFile(path.join(diffDir, `${i + 1}-diff.png`), diff)
    pages.push({ id: p.id, ...result })
  }
  return { ok: pages.every(p => p.ok), baseline: baselinePath, candidate: candidatePath, comparison: 'exact-decoded-rgba', pages }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [, , candidate, baseline, diffDir] = process.argv
    if (!candidate) throw new Error('Usage: node scripts/golden-compare.mjs CANDIDATE_MANIFEST HUMAN_REVIEWED_MANIFEST [DIFF_DIRECTORY]')
    const report = await compareManifests(candidate, baseline, { diffDir, requirePageCount: 10 })
    console.log(JSON.stringify(report, null, 2)); process.exitCode = report.ok ? 0 : 1
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
