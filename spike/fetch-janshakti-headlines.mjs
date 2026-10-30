// Pull real headlines from YOUR OWN site into spike/headlines for the G0.headline parity run.
// Run on your machine (needs internet):  node spike/fetch-janshakti-headlines.mjs
// Options: --base https://www.janshaktiujala.in  --max 200  --delay 300
// Reads the site's sitemap.xml, takes the first --max /samachar/ story pages in it and keeps each page's og:title
// (falls back to the first <h1>). Writes spike/headlines/janshakti-headlines.txt (one headline per line) and
// spike/headlines/janshakti-headlines.sources.md (which URLs, in the same order). The sitemap changes as stories
// are published, so a rerun gives a newer set; those files are judges (harness/judges.mjs) and need approval.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const arg = (k, d) => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d
const base = arg('--base', 'https://www.janshaktiujala.in').replace(/\/$/, '')
const MAX = Number(arg('--max', 200)), DELAY = Number(arg('--delay', 300))
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'headlines')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'Studio-spike/0.1 (layout parity test; contact amalprasad1998@gmail.com)' } })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.text()
}

const sitemap = await get(`${base}/sitemap.xml`)
const urls = [...new Set([...sitemap.matchAll(/<loc>([^<]*\/samachar\/[^<]+)<\/loc>/g)].map(m => m[1]))].slice(0, MAX)
if (!urls.length) { console.error('No /samachar/ URLs in sitemap.xml. Pass --base or edit the pattern in this script.'); process.exit(1) }
console.log(`Found ${urls.length} story URLs`)

const seen = new Set(), rows = []
for (const u of urls) {
  try {
    const h = await get(u)
    const m = h.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/) || h.match(/<h1[^>]*>([^<]+)<\/h1>/)
    // drop a trailing " | site name" or " - जनशक्ति ..." suffix
    const t = m && decode(m[1]).replace(/\s*[|–-]\s*जनशक्ति.*$/u, '').replace(/\s*\|.*$/, '').replace(/\s+/g, ' ').trim()
    if (t && /[ऀ-ॿ]/.test(t) && !seen.has(t)) { seen.add(t); rows.push({ u, t }) }
  } catch (e) { console.warn('skip', e.message) }
  await sleep(DELAY)
}
if (rows.length < 100) { console.error(`Only ${rows.length} headlines; G0.headline needs at least 100.`); process.exit(1) }
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'janshakti-headlines.txt'), rows.map(r => r.t).join('\n') + '\n', 'utf8')
fs.writeFileSync(path.join(outDir, 'janshakti-headlines.sources.md'), `# Sources (${new Date().toISOString().slice(0, 10)})\n\n` +
  `One headline per line in janshakti-headlines.txt, in this order: the og:title of each story page below (Janshakti Ujala, the customer's own copy; first ${MAX} /samachar/ URLs in ${base}/sitemap.xml). Used only for the G0.headline line-break parity run (node spike/fetch-janshakti-headlines.mjs).\n\n` +
  rows.map((r, i) => `${i + 1}. ${r.u}`).join('\n') + '\n', 'utf8')
console.log(`Wrote ${rows.length} headlines to spike/headlines/janshakti-headlines.txt`)
