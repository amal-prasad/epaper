import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { renderIssue } from '../src/render.js'

const require = createRequire(new URL('../../../spike/package.json', import.meta.url))
const noWrap = { mode: 'none', offset: {} }
const fixture = (size = { w: 297, h: 420 }) => {
  const preset = JSON.parse(fs.readFileSync(new URL('../../../presets/newspaper.json', import.meta.url)))
  preset.page = size; preset.pageCount.multipleOf = 1
  return { id: 'sample', orgId: 'demo', schemaVersion: 1, preset,
    stories: [{ id: 's1', orgId: 'demo', headline: 'शहर में नई पहल', body: ['नगर के पुस्तकालय में आज बच्चों ने नई पुस्तकें पढ़ीं। यह परीक्षण के लिए लिखी गई सामग्री है।'] }],
    pages: [{ id: 'p1', no: 1, orgId: 'demo',
      frames: [{ id: 'f1', orgId: 'demo', x: 12, y: 60, w: size.w - 24, h: 80, cols: 3, gutter: 4, storyId: 's1' }],
      objects: [{ id: 'head', orgId: 'demo', kind: 'label', x: 12, y: 25, w: size.w - 24, h: 28, wrap: noWrap,
        text: 'शहर में नई पहल', style: { family: 'Khand', weight: 700, fontSize: 28, lineHeight: 44, role: 'headline', colour: '#b42318' } },
      { id: 'rule', orgId: 'demo', kind: 'line', x: 12, y: 55, w: size.w - 24, h: 0.4, wrap: noWrap, style: { background: '#000000' } }] }] }
}

test('exports two sizes through the real flow engine, with embedded fonts and preserved text', async () => {
  const pdfjs = await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href)
  for (const size of [{ w: 297, h: 420 }, { w: 250, h: 380 }]) {
    const doc = fixture(size), before = JSON.stringify(doc)
    const result = await renderIssue(doc)
    assert.equal(JSON.stringify(doc), before)
    assert.ok(result.pdf.subarray(0, 5).equals(Buffer.from('%PDF-')))
    assert.ok(result.pages[0].lines.length > 0)
    assert.equal(result.pages[0].remainder, '')
    assert.equal(result.pages[0].lines.map(l => l.text).join('').replace(/\s/g, ''), doc.stories[0].body.join(' ').replace(/\s/g, ''))
    assert.equal(result.errors.length, 0)
    assert.ok(result.pages[0].screenshot.length > 1000)
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(result.pdf), useSystemFonts: false }).promise
    try {
      assert.equal(pdf.numPages, 1)
      const page = await pdf.getPage(1), vp = page.getViewport({ scale: 1 })
      assert.ok(Math.abs(vp.width - size.w * 72 / 25.4) < 1)
      assert.ok(Math.abs(vp.height - size.h * 72 / 25.4) < 1)
      const text = await page.getTextContent()
      assert.ok(text.items.length > 0)
    } finally { await pdf.destroy() }
  }
})

test('refuses body overflow and identifies the page and story', async () => {
  const doc = fixture(); doc.stories[0].body = ['लंबी खबर '.repeat(1500)]
  await assert.rejects(renderIssue(doc), /p1.*s1.*overflow/)
})

test('refuses headline overflow instead of clipping Hindi', async () => {
  const doc = fixture(); doc.pages[0].objects[0].h = 1
  await assert.rejects(renderIssue(doc), /p1.*head.*overflow/)
})

test('refuses unresolved placeholders and allows explicitly resolved literal brackets', async () => {
  const doc = fixture(); doc.pages[0].objects[0].text = '[शीर्षक]'
  await assert.rejects(renderIssue(doc), /head.*placeholder/)
  doc.pages[0].objects[0].literalBrackets = true
  const rendered = await renderIssue(doc)
  assert.ok(rendered.pdf.length > 0)
})

test('missing stories, dangling chains and unplaced copy fail explicitly', async () => {
  const missing = fixture(); missing.pages[0].frames[0].storyId = 'absent'
  await assert.rejects(renderIssue(missing), /absent/)
  const chain = fixture(); chain.pages[0].frames[0].nextFrameId = 'missing-frame'
  await assert.rejects(renderIssue(chain), /nextFrameId/)
  const unplaced = fixture(); delete unplaced.pages[0].frames[0].storyId
  await assert.rejects(renderIssue(unplaced), /unplaced.*s1/)
})

test('unknown fonts and unsupported objects do not silently disappear', async () => {
  const doc = fixture(); doc.pages[0].objects[0].style.family = 'Missing Font'
  await assert.rejects(renderIssue(doc), /font/)
  const unknown = fixture(); unknown.pages[0].objects[0].kind = 'unknown-kind'
  await assert.rejects(renderIssue(unknown), /unknown-kind/)
})

test('rejects page-count violations, off-page geometry and missing photos', async () => {
  const count = fixture(); count.preset.pageCount.multipleOf = 4
  await assert.rejects(renderIssue(count), /page.count/)
  const geometry = fixture(); geometry.pages[0].frames[0].x = -1
  await assert.rejects(renderIssue(geometry), /f1.*geometry/)
  const image = fixture(); image.pages[0].objects[0].kind = 'photo'
  await assert.rejects(renderIssue(image), /head.*asset/)
})

test('rejects styles which would overlap body ink or make a column invalid', async () => {
  const leading = fixture(); leading.pages[0].frames[0].style = { fontSize: 12, lineHeight: 4 }
  await assert.rejects(renderIssue(leading), /lineHeight|ink/)
  const columns = fixture(); columns.pages[0].frames[0].cols = 0
  await assert.rejects(renderIssue(columns), /cols/)
})

test('a multi-page issue retains its page count and embeds font programs', async () => {
  const doc = fixture(), other = structuredClone(doc.pages[0])
  other.id = 'p2'; other.no = 2; other.frames = []
  other.objects.forEach(o => { o.id += '-second' })
  doc.pages.push(other)
  const result = await renderIssue(doc)
  assert.equal(result.pages.length, 2)
  assert.match(result.pdf.toString('latin1'), /\/FontFile[23]?\s/)
  assert.match(result.pdf.toString('latin1'), /\/[A-Z]{6}\+/)
})

test('text backgrounds and foreground layer order survive rendering', async () => {
  const doc = fixture(), head = doc.pages[0].objects[0]
  head.style.background = '#113355'; head.style.colour = '#ffffff'
  const result = await renderIssue(doc)
  const { createCanvas, loadImage } = require('@napi-rs/canvas')
  const img = await loadImage(result.pages[0].screenshot), canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0)
  assert.deepEqual([...ctx.getImageData(1000, 110, 1, 1).data], [17, 51, 85, 255])
  const overlay = fixture()
  overlay.pages[0].objects.push({ id: 'overlay', orgId: 'demo', kind: 'box', x: 12, y: 60, w: 80, h: 20,
    z: 100, wrap: noWrap, style: { background: '#113355' } })
  const rendered = await renderIssue(overlay), cover = await loadImage(rendered.pages[0].screenshot)
  ctx.drawImage(cover, 0, 0)
  const data = ctx.getImageData(50, 230, 250, 50).data
  for (let i = 0; i < data.length; i += 4) assert.deepEqual([...data.slice(i, i + 4)], [17, 51, 85, 255])
})

test('borderline leading keeps measured Hindi ink inside the first line at the page edge', async () => {
  const doc = fixture(); doc.pages[0].objects = []
  doc.pages[0].frames[0].y = 0
  doc.pages[0].frames[0].style = { fontSize: 12, lineHeight: 15 }
  doc.stories[0].body = ['ऊँ नमूना समाचार']
  const result = await renderIssue(doc)
  for (const line of result.pages[0].lines) {
    assert.ok(line.inkTop >= line.y - 0.01)
    assert.ok(line.inkBottom <= line.y + 15 + 0.01)
  }
})

test('label ink stays inside its box at the page edge', async () => {
  const doc = fixture(), label = doc.pages[0].objects[0]
  label.y = 0; label.text = 'ऊँ'; label.style = { family: 'Noto Sans Devanagari', fontSize: 12, weight: 400 }
  const rendered = await renderIssue(doc), measured = rendered.pages[0].objects.find(o => o.id === label.id)
  assert.ok(measured.inkTop >= 0)
  assert.ok(measured.inkBottom <= label.h * 96 / 25.4)
})
