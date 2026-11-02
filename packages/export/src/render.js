import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { assertDoc } from '../../engine/src/doc.js'
import { pageCountAllowed } from '../../engine/src/preset.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const esbuild = createRequire(new URL('../../../spike/package.json', import.meta.url))('esbuild')
const geometry = (o, page) => {
  if (!['x', 'y', 'w', 'h'].every(k => Number.isFinite(o[k])) || o.x < 0 || o.y < 0 || o.w <= 0 || o.h <= 0 ||
    o.x + o.w > page.w + 0.01 || o.y + o.h > page.h + 0.01) throw new Error(`${o.id}: invalid geometry`)
  if (o.rot) throw new Error(`${o.id}: rotation is not yet supported by export`)
}
const checkText = (text, id, literalBrackets) => {
  if (typeof text !== 'string') throw new Error(`${id}: explicit text is required`)
  if (!literalBrackets && /\[[^\]]*\]/u.test(text)) throw new Error(`${id}: unresolved placeholder`)
}

function prepare(doc, assetRoot) {
  assertDoc(doc)
  if (!pageCountAllowed(doc.preset, doc.pages.length)) throw new Error('export page count violates preset.pageCount')
  const copy = structuredClone(doc), placed = new Set(), ids = new Set()
  for (const p of copy.pages) {
    for (const o of [p, ...p.frames, ...p.objects]) {
      if (!o.id || ids.has(o.id)) throw new Error(`duplicate or missing id: ${o.id}`)
      ids.add(o.id)
    }
    for (const f of p.frames) {
      geometry(f, copy.preset.page)
      if (!Number.isInteger(f.cols) || f.cols < 1 || !Number.isFinite(f.gutter) || f.gutter < 0 ||
        f.w - (f.cols - 1) * f.gutter <= 0) throw new Error(`${f.id}: invalid cols or gutter`)
      if (f.nextFrameId) throw new Error(`${f.id}: nextFrameId export is not implemented yet`)
      if (!f.storyId) continue
      const story = copy.stories.find(s => s.id === f.storyId)
      if (!story) throw new Error(`${f.id}: missing story ${f.storyId}`)
      if (!Array.isArray(story.body) || !story.body.every(t => typeof t === 'string')) throw new Error(`${story.id}: body must be a list of plain paragraphs`)
      checkText(story.body.join(' '), story.id, story.literalBrackets)
      placed.add(story.id)
    }
    for (const o of p.objects) {
      geometry(o, copy.preset.page)
      if (!['label', 'quote', 'photo', 'ad', 'box', 'line'].includes(o.kind)) throw new Error(`${o.id}: unsupported kind ${o.kind}`)
      if (['label', 'quote'].includes(o.kind) || o.kind === 'ad' && !o.assetId && !o.src) checkText(o.text, o.id, o.literalBrackets)
      if (['photo', 'ad'].includes(o.kind) && (o.kind === 'photo' || o.src || o.assetId)) {
        const asset = o.assetId && copy.assets?.find(a => a.id === o.assetId)
        let src = o.src ?? asset?.path
        if (!src) throw new Error(`${o.id}: missing asset`)
        if (!src.startsWith('data:')) {
          const file = path.resolve(assetRoot, src), ext = path.extname(file).toLowerCase()
          const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext]
          if (!mime) throw new Error(`${o.id}: unsupported asset format ${ext}`)
          try { src = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}` } catch { throw new Error(`${o.id}: missing asset ${file}`) }
        }
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(src)) throw new Error(`${o.id}: unsupported asset data`)
        o.src = src
      }
    }
  }
  for (const s of copy.stories) if (!placed.has(s.id)) throw new Error(`unplaced story ${s.id}`)
  return copy
}

function fontsCss(doc) {
  const wanted = new Set(['Noto Sans Devanagari'])
  for (const p of doc.pages) for (const o of [...p.objects, ...p.frames]) if (o.style?.family) wanted.add(o.style.family)
  const cssPath = path.join(root, 'spike/public/fonts.css'), css = fs.readFileSync(cssPath, 'utf8')
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
  for (const family of wanted) if (!faces.some(f => f.includes(`font-family: '${family}'`))) throw new Error(`unknown bundled font ${family}`)
  return faces.filter(f => [...wanted].some(family => f.includes(`font-family: '${family}'`))).join('\n')
    .replace(/url\(([^)]+)\)/g, (_, rel) => `url(data:font/woff2;base64,${fs.readFileSync(path.resolve(path.dirname(cssPath), rel)).toString('base64')})`)
}

// Intermediate RGB PDF only. Existing CMYK/PDF-X processing is a separate integration boundary.
export async function renderIssue(document, { assetRoot = root, minImageDpi = 150 } = {}) {
  const doc = prepare(document, assetRoot), css = fontsCss(doc)
  doc.exportMinImageDpi = minImageDpi
  const bundle = await esbuild.build({ entryPoints: [path.join(root, 'packages/export/src/render-browser.js')], bundle: true, write: false, format: 'iife' })
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] }), errors = []
  try {
    const page = await browser.newPage({ viewport: { width: Math.ceil(doc.preset.page.w * 96 / 25.4), height: Math.ceil(doc.preset.page.h * 96 / 25.4) } })
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await page.route('**/*', route => route.abort())
    await page.setContent(`<!doctype html><html lang="hi"><head><meta charset="utf-8"><style>${css}\n@page{size:${doc.preset.page.w}mm ${doc.preset.page.h}mm;margin:0}html,body{margin:0}*{box-sizing:border-box}section:last-child{break-after:auto}</style></head><body></body></html>`)
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    const inks = JSON.parse(fs.readFileSync(path.join(root, 'fonts/ink.json')))
    const pages = await page.evaluate(async ({ doc, inks }) => window.renderExport(doc, inks), { doc, inks })
    for (const [i, report] of pages.entries()) report.screenshot = await page.locator('section').nth(i).screenshot()
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false })
    // A grayscale reference mask preserves stacking/occlusion but whites out coloured content.
    // It lets the final plate check target neutral glyphs even when they sit over a colour photo.
    await page.evaluate(() => {
      const neutral = value => {
        if (value === 'rgba(0, 0, 0, 0)' || value === 'transparent') return value
        const values = value.match(/[\d.]+/g)?.map(Number)
        return values && values[0] === values[1] && values[1] === values[2] ? value : '#ffffff'
      }
      for (const section of document.querySelectorAll('section')) for (const node of section.children) {
        const style = getComputedStyle(node)
        const colour = neutral(style.color), background = neutral(style.backgroundColor)
        node.style.color = colour; node.style.backgroundColor = background
        if (node.tagName === 'IMG') node.style.filter = 'brightness(0) invert(1)'
      }
      document.body.style.zoom = '2'
    })
    for (const [i, report] of pages.entries()) {
      report.neutralMask = await page.locator('section').nth(i).screenshot()
      report.neutralMaskDpi = 192
    }
    if (errors.length) throw new Error(`export browser errors: ${errors.join('; ')}`)
    return { pdf, pages, errors, chromiumVersion: browser.version(), colourSpace: 'RGB', stage: 'intermediate' }
  } finally { await browser.close() }
}
