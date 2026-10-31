// Pull whole real stories from Janshakti's OWN site, one file per story, for layout runs that need separate stories.
//   node scripts/fetch-janshakti-stories.mjs [--count 24] [--delay 300]
// Takes story pages in the order listed in spike/headlines/janshakti-headlines.sources.md and keeps each page's title and
// article paragraphs, unedited except for dropping site buttons (D-033). Writes spike/stories/stories.json with each
// story's URL, and spike/stories/README.md. Copy stays exactly as published: it is not cut to fit anything.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d
const COUNT = Number(arg('--count', 24)), DELAY = Number(arg('--delay', 300))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const strip = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const SITE_TEXT = /^लिंक कॉपी करें\s*अ?\s*/u
const hasHindi = s => (s.match(/[ऀ-ॿ]/g) || []).length > 20

const sources = fs.readFileSync(path.join(root, 'spike/headlines/janshakti-headlines.sources.md'), 'utf8')
const urls = [...sources.matchAll(/^\d+\.\s+(https?:\S+)/gm)].map(m => m[1])
const stories = [], seen = new Set()
for (const url of urls) {
  if (stories.length >= COUNT) break
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Studio-spike/0.1 (layout test on own copy; contact amalprasad1998@gmail.com)' } })
    if (!r.ok) throw new Error(String(r.status))
    const html = await r.text()
    const title = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1] ?? html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1]
    const headline = title && decode(title).replace(/\s*[|–-]\s*जनशक्ति.*$/u, '').replace(/\s*\|.*$/, '').replace(/\s+/g, ' ').trim()
    const scope = html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? html
    const paras = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]).replace(SITE_TEXT, '')).filter(hasHindi)
    const body = paras.join(' ')
    if (headline && body.length > 300 && !seen.has(headline)) { seen.add(headline); stories.push({ id: `s${stories.length + 1}`, headline, url, paragraphs: paras.length, chars: body.length, body: paras }) }
  } catch (e) { console.warn('skip', url, e.message) }
  await sleep(DELAY)
}
if (stories.length < 8) { console.error(`Only ${stories.length} stories; the template run needs at least 8.`); process.exit(1) }
const dir = path.join(root, 'spike/stories')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'stories.json'), JSON.stringify(stories, null, 1) + '\n', 'utf8')
fs.writeFileSync(path.join(dir, 'README.md'), `# Real Janshakti stories\n\nFetched ${new Date().toISOString().slice(0, 10)} from the customer's own site (rule 4), for layout runs. One entry per story, with its URL. Copy is as published and is not cut to fit. Rebuild: \`node scripts/fetch-janshakti-stories.mjs\`.\n`, 'utf8')
console.log(stories.map(s => `${s.id} ${String(s.chars).padStart(6)} chars, ${String(s.paragraphs).padStart(2)} paras  ${s.headline.slice(0, 60)}`).join('\n'))
