import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { exportIssue } from '../src/export.js'
import { createRequire } from 'node:module'

const profile = pageMode => ({ id: `working-${pageMode}`, pageMode,
  colourRoute: pageMode === 'mono' ? 'gray' : 'neutral-rgb-to-k-cmyk', pdfx: 'PDF/X-3:2002',
  bleed: 0, cropMarks: false, iccProfile: null, inkLimit: 240, overprint: false,
  neutralCurve: [[0, 0], [1, 1]], imageDpi: 300, minImageDpi: 150,
  assumed: ['inkLimit', 'bleed', 'cropMarks', 'overprint', 'neutralCurve'] })
const fixture = () => {
  const preset = JSON.parse(fs.readFileSync(new URL('../../../presets/newspaper.json', import.meta.url)))
  preset.page = { w: 100, h: 150 }; preset.pageCount.multipleOf = 1; preset.exportProfile.colourRoute = null
  const wrap = { mode: 'none', offset: {} }
  return { id: 'test-issue', schemaVersion: 1, orgId: 'test', preset,
    stories: [{ id: 's', orgId: 'test', body: ['नगर के पुस्तकालय में बच्चों ने नई पुस्तकें पढ़ीं। यह निर्यात परीक्षण है।'] }],
    pages: [{ id: 'p1', no: 1, orgId: 'test',
      frames: [{ id: 'f', orgId: 'test', x: 10, y: 50, w: 80, h: 80, cols: 2, gutter: 3, storyId: 's' }],
      objects: [{ id: 'tint', orgId: 'test', kind: 'box', x: 10, y: 10, w: 80, h: 20, wrap, style: { background: '#d9d9d9' } },
        { id: 'head', orgId: 'test', kind: 'label', x: 12, y: 12, w: 75, h: 17, text: 'समाचार परीक्षण', wrap,
          style: { family: 'Khand', weight: 700, fontSize: 24 } },
        { id: 'colour', orgId: 'test', kind: 'box', x: 10, y: 35, w: 80, h: 5, wrap, style: { background: '#ff6600' } }] }] }
}

test('exports and checks colour and mono PDF/X-targeted files with resolved profiles and reports', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-export-'))
  try {
    for (const mode of ['colour', 'mono']) {
      const report = await exportIssue(fixture(), profile(mode), path.join(dir, mode))
      assert.equal(report.status, 'checked-development')
      assert.equal(report.stage, 'converted')
      assert.equal(report.certification.status, 'independent-validation-pending')
      assert.equal(report.pdf.pdfx, 'PDF/X-3:2002')
      assert.equal(report.pdf.outputIntents.length, 1)
      assert.ok(report.pdf.fonts.length >= 2)
      assert.ok(report.pdf.fonts.every(f => f.embedded && f.subset))
      assert.equal(report.pages, 1)
      assert.ok(report.plates.totalInkMaxPct <= 240)
      assert.ok(report.plates.neutralCheckedPixels > 100)
      assert.equal(report.plates.passed, true)
      assert.ok(fs.existsSync(path.join(dir, mode, 'issue.pdf')))
      assert.ok(fs.existsSync(path.join(dir, mode, 'report.json')))
      assert.ok(report.settings.assumptions.length > 0)
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('failed exports preserve the old successful bundle and never promote broken output', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-preserve-'))
  try {
    const output = path.join(dir, 'published'); fs.mkdirSync(output)
    fs.writeFileSync(path.join(output, 'issue.pdf'), 'previous success')
    const bad = fixture(); bad.stories[0].body = ['overflow '.repeat(10000)]
    await assert.rejects(exportIssue(bad, profile('colour'), output), /overflow|exists/)
    assert.equal(fs.readFileSync(path.join(output, 'issue.pdf'), 'utf8'), 'previous success')
    await assert.rejects(exportIssue(fixture(), profile('colour'), output), /exists/)
    assert.equal(fs.readFileSync(path.join(output, 'issue.pdf'), 'utf8'), 'previous success')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('missing rewrite is caught by the plate check (negative control)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-negative-'))
  try {
    await assert.rejects(exportIssue(fixture(), profile('colour'), path.join(dir, 'bad'), { diagnosticSkipRewrite: true }), /neutral|plate/i)
    assert.equal(fs.existsSync(path.join(dir, 'bad')), false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('unsupported bleed and crop marks are named rather than silently ignored', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-options-'))
  try {
    for (const [field, value] of [['bleed', 3], ['cropMarks', true]]) {
      const p = profile('colour'); p[field] = value
      await assert.rejects(exportIssue(fixture(), p, path.join(dir, field)), new RegExp(field))
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('normalizing page boxes preserves top-origin positions of a thin rule on a large page', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-origin-'))
  try {
    const doc = fixture(); doc.preset.page = { w: 297, h: 420 }
    doc.pages[0].objects.push({ id: 'thin-rule', orgId: 'test', kind: 'line', x: 12, y: 178, w: 273, h: 0.4,
      wrap: { mode: 'none', offset: {} }, style: { background: '#000000' } })
    const report = await exportIssue(doc, profile('colour'), path.join(dir, 'checked'))
    assert.ok(report.plates.pages[0].regions.find(r => r.id === 'thin-rule').checked > 100)
    assert.equal(report.plates.passed, true)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('a raster-only advertisement exports without inventing neutral-vector or font requirements', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raster-ad-'))
  try {
    const { createCanvas } = createRequire(new URL('../../../spike/package.json', import.meta.url))('@napi-rs/canvas')
    const canvas = createCanvas(1000, 1600), context = canvas.getContext('2d')
    context.fillStyle = '#ffa020'; context.fillRect(0, 0, 1000, 1600)
    const doc = fixture(); doc.stories = []; doc.pages[0].frames = []
    doc.pages[0].objects = [{ id: 'advertisement', orgId: 'test', kind: 'ad', x: 10, y: 10, w: 80, h: 130,
      src: canvas.toDataURL('image/png'), wrap: { mode: 'none', offset: {} } }]
    const report = await exportIssue(doc, profile('colour'), path.join(dir, 'ad'))
    assert.equal(report.plates.neutralCheckedPixels, 0)
    assert.equal(report.plates.pages[0].neutralCheck, 'not-applicable')
    assert.equal(report.plates.passed, true)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
