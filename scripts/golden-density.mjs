// Authoring aid only: inspect real bundled-font capacity, then freeze copy counts
// in golden-pages.mjs. This never modifies fixtures, baselines or user copy.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { buildGoldenFixtures } from './golden-pages.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(new URL('../spike/package.json', import.meta.url))
const esbuild = require('esbuild')
const bundle = await esbuild.build({ stdin: { contents: `import {flow} from './packages/engine/src/flow.js';import {frameColumns} from './packages/engine/src/templates.js';import {wrapObstacles} from './packages/engine/src/wrap.js';window.density={flow,frameColumns,wrapObstacles}`, resolveDir: root }, bundle: true, write: false, format: 'iife' })
const cssFile = path.join(root, 'spike/public/fonts.css'), css = fs.readFileSync(cssFile, 'utf8')
  .replace(/url\(([^)]+)\)/g, (_, rel) => `url(data:font/woff2;base64,${fs.readFileSync(path.resolve(path.dirname(cssFile), rel)).toString('base64')})`)
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] })
try {
  const page = await browser.newPage()
  await page.setContent(`<style>${css}</style>`)
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  const result = await page.evaluate(async fixtures => {
    await document.fonts.load('400 12px "Noto Sans Devanagari"', 'हिन्दी समाचार'); await document.fonts.ready
    const { flow, frameColumns, wrapObstacles } = window.density, px = 96 / 25.4
    const scale = o => ({ ...o, x: o.x * px, y: o.y * px, w: o.w * px, h: o.h * px, gutter: (o.gutter ?? 0) * px,
      wrap: o.wrap && { ...o.wrap, offset: Object.fromEntries(Object.entries(o.wrap.offset).map(([k, v]) => [k, v * px])) } })
    return fixtures.map(fixture => ({ templateId: fixture.templateId, frames: fixture.document.pages[0].frames.map(frame => {
      const source = fixture.document.stories.find(s => s.id === frame.storyId).body[0]
      const sentence = source.slice(0, source.indexOf('यह स्वयं लिखी परीक्षण सामग्री है।', 1) < 0 ? source.length : source.indexOf('यह स्वयं लिखी परीक्षण सामग्री है।', 1))
      const columns = frameColumns(scale(frame)), obstacles = wrapObstacles(fixture.document.pages[0].objects.filter(o => !o.frameId || o.frameId === frame.id).map(scale), columns, { lineHeight: 19 })
      const measure = n => flow(sentence.repeat(n), columns, obstacles, { font: '400 12px "Noto Sans Devanagari"', lineHeight: 19 })
      let max = 0
      while (max < 100 && !measure(max + 1).remainder) max++
      const authored = Math.max(1, Math.floor(max * 0.85)), lines = measure(authored).lines
      return { slot: frame.slotId, maximumSentences: max, authoredSentences: authored, lines: lines.length,
        lastLineBottomMm: (lines.at(-1).y + 19) / px, frameBottomMm: frame.y + frame.h }
    }) }))
  }, buildGoldenFixtures().filter(f => ['weekly-inner', 'weekly-back'].includes(f.templateId)))
  console.log(JSON.stringify(result, null, 2))
} finally { await browser.close() }
