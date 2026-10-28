// Pull real paragraphs from YOUR OWN site into spike/samples for the Phase 0 parity test.
// Run on your machine (needs internet):  node harness/tools/fetch-janshakti-samples.mjs
// Options: --base https://www.janshaktiujala.in  --min 60  --max-pages 40  --delay 700
// Writes spike/samples/janshakti-live.txt (UTF-8, blank line between paragraphs) and
// spike/samples/janshakti-live.sources.md (which URLs were used). Use your own stories only.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const arg = (k, d) => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d
const base = arg('--base', 'https://www.janshaktiujala.in').replace(/\/$/, '')
const MIN = Number(arg('--min', 60)), MAX_PAGES = Number(arg('--max-pages', 40)), DELAY = Number(arg('--delay', 700))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = path.join(root, 'spike/samples')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…', ndash: '–', mdash: '—' }
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m))
const clean = s => decode(s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const devRatio = s => { const l = s.match(/\p{L}/gu) || []; return l.length ? (s.match(/[ऀ-ॿ]/g) || []).length / l.length : 0 }

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'StudioSpike/0.1 (own-site sample export)', accept: 'text/html' } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.text()
}

export function extractParagraphs(html) {
  const out = []
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (typeof o.articleBody === 'string') out.push(...o.articleBody.split(/\n+/)); Object.values(o).forEach(walk) } }
      walk(JSON.parse(m[1]))
    } catch { /* ignore bad JSON-LD */ }
  }
  if (!out.length) {
    const scope = (html.match(/<article[\s\S]*?<\/article>/i) || [html])[0]
    for (const m of scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) out.push(m[1])
  }
  return out.map(clean).filter(p => p.length >= MIN && devRatio(p) >= 0.5)
}

const home = await get(base)
const links = [...new Set([...home.matchAll(/href="([^"#?]*\/samachar\/[a-z0-9-]+)"/gi)].map(m => new URL(m[1], base).href))].slice(0, MAX_PAGES)
if (!links.length) { console.error('No /samachar/ links found on the homepage. Pass --base or edit the link pattern in this script.'); process.exit(1) }
console.log(`Found ${links.length} article links`)

const seen = new Set(), paras = [], used = []
for (const url of links) {
  try {
    const ps = extractParagraphs(await get(url)).filter(p => !seen.has(p))
    ps.forEach(p => seen.add(p)); if (ps.length) { paras.push(...ps); used.push(`${url}  (${ps.length})`) }
    console.log(`${ps.length.toString().padStart(3)}  ${url}`)
  } catch (e) { console.warn('skip', e.message) }
  if (paras.length >= 120) break
  await sleep(DELAY)
}
if (!paras.length) { console.error('No paragraphs extracted. The article HTML may be client-rendered; export from your database instead.'); process.exit(1) }
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'janshakti-live.txt'), paras.join('\n\n') + '\n', 'utf8')
fs.writeFileSync(path.join(outDir, 'janshakti-live.sources.md'), `# Sources (${new Date().toISOString().slice(0, 10)})\n\n` + used.map(u => `- ${u}`).join('\n') + '\n', 'utf8')
console.log(`\nWrote ${paras.length} paragraphs to spike/samples/janshakti-live.txt`)
console.log(paras.length < 40 ? 'Fewer than 40: raise --max-pages or add more text by hand.' : 'Good. Delete spike/samples/news-sample.txt (invented), then run: npm run spike')
