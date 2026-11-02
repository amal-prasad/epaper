import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildPage } from '../packages/engine/src/templates.js'
import { renderIssue } from '../packages/export/src/render.js'
import { hash, comparePng } from './golden-compare.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(new URL('../spike/package.json', import.meta.url))
const { createCanvas } = require('@napi-rs/canvas')
const templateIds = ['weekly-front', 'front-hero', 'front-rail', 'weekly-inner', 'inner-center', 'inner-cutout', 'inner-halfad', 'inner-hero', 'weekly-back', 'ads-classified']
const sentence = 'यह स्वयं लिखी परीक्षण सामग्री है। नगर के पुस्तकालय में बच्चों ने नई पुस्तकें पढ़ीं। शिक्षकों ने विज्ञान, पर्यावरण और स्वास्थ्य पर चर्चा की। '
// Authored after bundled-font flow inspection; frozen inputs, never fitted or
// shortened at generation time. Several slots end within one line of the bottom.
const denseCopy = {
  'weekly-inner': { top: 18, 'half-a': 9, 'half-b': 10, 'third-a': 10, 'third-b': 6, 'third-c': 6 },
  'weekly-back': { top: 14, 'half-a': 7, 'half-b': 7, 'third-a': 6, 'third-b': 8, 'third-c': 6 },
}

function artwork() {
  const canvas = createCanvas(2400, 1800), ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ead9b9'; ctx.fillRect(0, 0, 2400, 1800)
  ctx.fillStyle = '#285666'; ctx.fillRect(100, 700, 2200, 800)
  ctx.fillStyle = '#e6a14d'; ctx.beginPath(); ctx.arc(1200, 520, 310, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#faf6eb'; ctx.fillRect(300, 980, 800, 330); ctx.fillRect(1300, 980, 800, 330)
  return canvas.toDataURL('image/png')
}

// Fixed owned content; no random values, clock, network, fit-and-trim or external images.
export function buildGoldenFixtures() {
  const src = artwork()
  return templateIds.map((id, i) => {
    const templateFile = path.join(root, 'templates', `${id}.json`), template = JSON.parse(fs.readFileSync(templateFile))
    const preset = JSON.parse(fs.readFileSync(path.join(root, 'presets/newspaper.json')))
    preset.pageCount.multipleOf = 1
    if (i === 7) preset.page = { w: 250, h: 380 }
    const orgId = 'owned-golden-fixtures', built = buildPage(template, preset, { orgId, pageId: `golden-${i + 1}` })
    const stories = built.frames.map((f, j) => {
      f.storyId = `${f.id}-story`
      f.style = { family: i === 4 ? 'Noto Serif Devanagari' : 'Noto Sans Devanagari', weight: 400, fontSize: 12, lineHeight: 19 }
      const count = denseCopy[id]?.[f.slotId] ?? Math.max(1, Math.floor(f.w * f.h * 0.035 / sentence.length))
      return { id: f.storyId, orgId, headline: `नगर में नई पहल ${j + 1}`, body: [sentence.repeat(count)], source: 'owned synthetic golden fixture', licence: 'own-synthetic' }
    })
    for (const o of built.objects) {
      const role = o.style.role
      if (['photo', 'ad'].includes(o.kind)) { o.src = src; continue }
      const text = { masthead: 'समाचार स्टूडियो', strip: 'स्वयं लिखी नमूना सामग्री · 2 नवंबर 2026', folio: `परीक्षण संस्करण · पृष्ठ ${i + 1}`, section: 'नगर समाचार', sectionLabel: 'विशेष',
        kicker: 'नगर संवाद', headline: 'पुस्तकालय में नई पहल', byline: 'परीक्षण संवाददाता', caption: 'स्वयं बनाया नमूना चित्र', quote: 'पढ़ना नई सोच की शुरुआत है।',
        imprint: 'नमूना प्रकाशन · स्वामी, मुद्रक, प्रकाशक एवं संपादक: परीक्षण · मुद्रण एवं प्रकाशन स्थल: नमूना नगर · PRGI: परीक्षण · केवल दृश्य जाँच के लिए' }
      o.text = text[role] ?? 'परीक्षण समाचार'
      o.style = { ...o.style, family: ['headline', 'masthead'].includes(role) ? 'Khand' : 'Noto Sans Devanagari', weight: ['headline', 'masthead'].includes(role) ? 700 : 400,
        fontSize: role === 'masthead' ? 40 : role === 'headline' ? 24 : 10,
        ...(['headline', 'masthead'].includes(role) ? { sizes: role === 'masthead' ? [40, 36, 32, 28] : preset.headline.sizes[built.frames.find(f => f.slotId === o.slotId)?.priority ?? 3] } : {}) }
    }
    return { id: `${String(i + 1).padStart(2, '0')}-${id}`, templateId: id, templateHash: hash(fs.readFileSync(templateFile)),
      features: template.name, document: { id: `golden-${id}`, schemaVersion: 1, orgId, preset, stories,
        pages: [{ id: `golden-${i + 1}`, no: 1, orgId, ...built }] } }
  })
}

function fontProvenance(fixtures) {
  const cssFile = path.join(root, 'spike/public/fonts.css'), css = fs.readFileSync(cssFile, 'utf8')
  const families = new Set(['Noto Sans Devanagari', ...fixtures.flatMap(f => f.document.pages.flatMap(p => [...p.objects, ...p.frames].map(o => o.style?.family).filter(Boolean)))])
  const files = new Set(['spike/public/fonts.css', 'fonts/ink.json'])
  for (const face of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    if (![...families].some(f => face.includes(`font-family: '${f}'`))) continue
    for (const [, rel] of face.matchAll(/url\(([^)]+)\)/g)) files.add(path.relative(root, path.resolve(path.dirname(cssFile), rel)).replaceAll('\\', '/'))
  }
  return Object.fromEntries([...files].sort().map(f => [f, hash(fs.readFileSync(path.join(root, f)))]))
}

export async function generateGoldenCandidates(destination) {
  const dir = path.resolve(destination)
  // Refuse existing directories so candidate generation cannot overwrite reviewed files.
  fs.mkdirSync(dir, { recursive: false })
  const fixtures = buildGoldenFixtures(), pages = [], controls = []
  let chromium
  for (const fixture of fixtures) {
    const source = JSON.stringify(fixture.document, null, 2) + '\n'
    const rendered = await renderIssue(fixture.document), rerendered = await renderIssue(fixture.document)
    const stable = await comparePng(rendered.pages[0].screenshot, rerendered.pages[0].screenshot)
    if (!stable.ok) throw new Error(`${fixture.id}: repeat rendering changed ${stable.changedPixels} pixels`)
    chromium = rendered.chromiumVersion
    const stem = fixture.id
    fs.writeFileSync(path.join(dir, `${stem}.json`), source)
    fs.writeFileSync(path.join(dir, `${stem}.png`), rendered.pages[0].screenshot)
    fs.writeFileSync(path.join(dir, `${stem}.pdf`), rendered.pdf)
    pages.push({ id: stem, templateId: fixture.templateId, templateHash: fixture.templateHash, features: fixture.features,
      size: fixture.document.preset.page, image: `${stem}.png`, imageHash: hash(rendered.pages[0].screenshot), fixture: `${stem}.json`, fixtureHash: hash(source),
      pdf: `${stem}.pdf`, lines: rendered.pages[0].lines.length,
      density: fixture.document.pages[0].frames.map(f => {
        const lines = rendered.pages[0].lines.filter(l => l.frameId.startsWith(`${f.id}-c`))
        return { slot: f.slotId, lines: lines.length, columns: f.cols, frameBottomMm: f.y + f.h,
          lastLineBottomMm: lines.length ? Math.max(...lines.map(l => l.y + f.style.lineHeight)) * 25.4 / 96 : null }
      }), repeatRenderChangedPixels: stable.changedPixels })
    if (fixture.templateId === 'weekly-inner') {
      for (const [name, mutate] of [
        ['omitted-headline', doc => { doc.pages[0].objects.find(o => o.style.role === 'headline').text = 'पुस्तकालय' }],
        ['moved-frame', doc => { doc.pages[0].frames[0].x += 1 }],
        ['changed-body-font', doc => { doc.pages[0].frames[0].style.family = 'Noto Serif Devanagari' }],
      ]) {
        const doc = structuredClone(fixture.document); mutate(doc)
        const broken = await renderIssue(doc), { diff, ...result } = await comparePng(rendered.pages[0].screenshot, broken.pages[0].screenshot)
        if (result.ok) throw new Error(`negative control ${name} was not detected`)
        fs.writeFileSync(path.join(dir, `control-${name}.png`), broken.pages[0].screenshot)
        fs.writeFileSync(path.join(dir, `control-${name}-diff.png`), diff)
        controls.push({ name, expected: 'rejected', ...result, image: `control-${name}.png`, diff: `control-${name}-diff.png` })
      }
    }
    console.log(`${stem}: ${pages.at(-1).lines} lines; repeat render identical`)
  }
  const manifest = { schemaVersion: 1, status: 'candidate', note: 'Unapproved synthetic candidates. Human review is required before these can be baselines.',
    provenance: { raster: 'screen-96dpi', chromium, platform: `${process.platform}-${process.arch}`, node: process.version,
      canvas: require('@napi-rs/canvas/package.json').version, playwright: require('playwright/package.json').version,
      fonts: fontProvenance(fixtures), launchArgs: ['--font-render-hinting=none'] },
    source: { generator: hash(fs.readFileSync(fileURLToPath(import.meta.url))), renderer: hash(fs.readFileSync(path.join(root, 'packages/export/src/render.js'))),
      browserRenderer: hash(fs.readFileSync(path.join(root, 'packages/export/src/render-browser.js'))) }, pages, controls }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (!process.argv[2]) throw new Error('Usage: node scripts/golden-pages.mjs NEW_CANDIDATE_DIRECTORY')
    await generateGoldenCandidates(process.argv[2]); console.log('Candidate generation complete; no baseline approved and no gate result recorded.')
  } catch (error) { console.error(error.stack); process.exitCode = 1 }
}
